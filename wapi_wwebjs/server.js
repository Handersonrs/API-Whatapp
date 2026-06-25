process.env.PUPPETEER_SKIP_DOWNLOAD = 'true';

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const qrcode = require('qrcode-terminal');

const CHROME_PATHS = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
];
function encontrarChrome() {
    for (const p of CHROME_PATHS) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

const app = express();
app.use(express.json());
const upload = multer({ dest: os.tmpdir() });

const AUTH_DIR = path.join(__dirname, '.wwebjs_auth');
const PORT = process.env.PORT || 8082;
const API_KEY = process.env.API_KEY || 'wwebjs-key-2024';

let client = null;
let isReady = false;
let currentQR = null;
let reiniciando = false;
let logoutExplicito = false;

function verificarReconectar(erroMsg) {
    const msg = String(erroMsg || '').toLowerCase();
    if (msg.includes('detached frame') || msg.includes('target closed') ||
        msg.includes('session closed') || msg.includes('browser has been closed') ||
        msg.includes('page has been closed') || msg.includes('protocol error')) {
        if (!reiniciando) {
            reiniciando = true;
            isReady = false;
            console.log('Erro de sessao detectado, reiniciando em 5s...', erroMsg);
            setTimeout(() => { reiniciando = false; iniciar(); }, 5000);
        }
        return true;
    }
    return false;
}

function checkApiKey(req, res, next) {
    const key = req.headers['apikey'] || req.headers['x-api-key'];
    if (key !== API_KEY) {
        return res.status(401).json({ error: 'API Key invalida' });
    }
    next();
}

app.use('/send-text', checkApiKey);
app.use('/send-media', checkApiKey);
app.use('/logout', checkApiKey);

app.get('/status', (req, res) => {
    res.json({
        connected: isReady,
        user: client?.info?.pushname || null,
        phone: client?.info?.wid?.user || null,
    });
});

app.post('/logout', async (req, res) => {
    if (!client) {
        return res.json({ success: true, message: 'cliente nao inicializado' });
    }
    try {
        logoutExplicito = true;
        await client.logout();
        isReady = false;
        currentQR = null;
        console.log('Logout wwebjs realizado com sucesso');
        res.json({ success: true, message: 'desconectado do WhatsApp' });
    } catch (e) {
        console.log('Erro no logout wwebjs:', e.message);
        isReady = false;
        res.status(500).json({ error: e.message });
    }
});

app.get('/qr', (req, res) => {
    if (currentQR) {
        res.json({ qr: currentQR });
    } else {
        res.status(404).json({ error: 'QR Code nao disponivel' });
    }
});

app.post('/send-text', async (req, res) => {
    if (!isReady) {
        return res.status(503).json({ error: 'WhatsApp nao conectado' });
    }
    const { number, text } = req.body;
    if (!number || !text) {
        return res.status(400).json({ error: 'Campos obrigatorios: number, text' });
    }
    try {
        const num = String(number).replace(/\D/g, '');
        const chatId = num.includes('@c.us') ? num : `${num}@c.us`;
        await client.sendMessage(chatId, String(text), { linkPreview: false });
        res.json({ success: true });
    } catch (e) {
        verificarReconectar(e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/send-media', upload.single('media'), async (req, res) => {
    if (!isReady) {
        return res.status(503).json({ error: 'WhatsApp nao conectado' });
    }
    const { number, fileName, caption } = req.body;
    const file = req.file;
    if (!number || !file) {
        return res.status(400).json({ error: 'Campos obrigatorios: number, media (arquivo)' });
    }
    try {
        const num = String(number).replace(/\D/g, '');
        const chatId = num.includes('@c.us') ? num : `${num}@c.us`;
        const name = fileName || file.originalname || 'arquivo';
        const ext = path.extname(name).toLowerCase();

        const mimeMap = {
            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
            '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp',
            '.mp4': 'video/mp4', '.avi': 'video/x-msvideo',
            '.mov': 'video/quicktime', '.mkv': 'video/x-matroska', '.3gp': 'video/3gpp',
            '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
            '.aac': 'audio/aac', '.opus': 'audio/opus',
            '.pdf': 'application/pdf', '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.txt': 'text/plain', '.csv': 'text/csv',
            '.zip': 'application/zip', '.rar': 'application/vnd.rar',
            '.7z': 'application/x-7z-compressed',
        };
        const mimetype = mimeMap[ext] || 'application/octet-stream';

        const b64data = fs.readFileSync(file.path, { encoding: 'base64' });
        const mediaMsg = new MessageMedia(mimetype, b64data, name);

        const opts = {};
        if (caption) opts.caption = caption;

        if (['.mp3','.ogg','.wav','.aac','.opus'].includes(ext)) {
            opts.sendAudioAsVoice = false;
        }

        await client.sendMessage(chatId, mediaMsg, opts);

        fs.unlinkSync(file.path);
        res.json({ success: true, fileName: name });
    } catch (e) {
        verificarReconectar(e.message);
        if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        res.status(500).json({ error: e.message });
    }
});

let _destroying = null;
let _iniciando = false;

function destroyClient() {
    if (client) {
        const c = client;
        client = null;
        isReady = false;
        _destroying = c.destroy().catch(() => {}).then(() => { _destroying = null; });
    }
}

async function iniciar() {
    if (_iniciando) return;
    _iniciando = true;
    try {
        destroyClient();
        if (_destroying) {
            try { await _destroying; } catch (_) {}
        }
        const chromePath = encontrarChrome();
        const puppeteerOpts = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-sync',
                '--no-first-run',
                '--disable-default-apps',
            ],
            ignoreDefaultArgs: ['--enable-automation'],
        };
        if (chromePath) {
            puppeteerOpts.executablePath = chromePath;
        }
        client = new Client({
            authStrategy: new LocalAuth({ dataPath: AUTH_DIR }),
            puppeteer: puppeteerOpts,
        });

        client.on('qr', (qr) => {
        currentQR = qr;
        console.log('\n=== WWEBJS - ESCANEIE O QR CODE ===\n');
        qrcode.generate(qr, { small: true });
        console.log('\n====================================\n');
    });

    client.on('ready', () => {
        isReady = true;
        currentQR = null;
        console.log('WhatsApp Web (wwebjs) conectado!');
        console.log(`Servidor rodando em http://localhost:${PORT}`);
        console.log(`API Key: ${API_KEY}`);
    });

    client.on('disconnected', (reason) => {
        isReady = false;
        if (logoutExplicito) {
            console.log('wwebjs desconectado por logout manual, nao reconectara');
            return;
        }
        console.log('wwebjs desconectado:', reason);
        setTimeout(iniciar, 5000);
    });

    client.on('auth_failure', (msg) => {
        isReady = false;
        if (logoutExplicito) {
            console.log('wwebjs auth_failure apos logout, ignorando reconexao');
            return;
        }
        console.log('wwebjs falha de auth:', msg);
        try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch (_) {}
        setTimeout(iniciar, 5000);
    });

    client.initialize();
} finally {
        _iniciando = false;
    }
}

iniciar();

app.listen(PORT, () => {
    console.log(`\n=== WAPI wwebjs (whatsapp-web.js) ===`);
    console.log(`Porta: ${PORT}`);
    console.log(`API Key: ${API_KEY}`);
    console.log(`Aguardando conexao WhatsApp Web...\n`);
});

process.on('uncaughtException', (err) => {
    console.error('ERRO FATAL:', err.message);
    console.error(err.stack);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    console.error('Promise rejeitada:', reason?.message || reason);
    console.error(reason?.stack || '');
});
