const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

const upload = multer({ dest: os.tmpdir() });

const AUTH_DIR = process.env.AUTH_DIR || path.join(__dirname, 'auth_info');
const PORT = process.env.PORT || 8080;
const API_KEY = process.env.API_KEY || 'wapi-key-2024';

const CONTACTS_FILE = path.join(__dirname, 'chat_contacts.json');
const chatContacts = new Map();

function loadContacts() {
    try {
        if (fs.existsSync(CONTACTS_FILE)) {
            const data = JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf-8'));
            for (const [number, name] of Object.entries(data)) {
                chatContacts.set(number, name);
            }
            console.log(`[wapi] ${chatContacts.size} contatos carregados do cache`);
        }
    } catch (_) {}
}

function saveContacts() {
    try {
        const obj = Object.fromEntries(chatContacts);
        fs.writeFileSync(CONTACTS_FILE, JSON.stringify(obj), 'utf-8');
    } catch (_) {}
}

loadContacts();

let sock = null;
let currentQR = null;
let wapiConnected = false;
let isReconnecting = false;
let logoutExplicito = false;

function withTimeout(promise, ms, msg = 'timeout') {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms))
    ]);
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
app.use('/check-number', checkApiKey);
app.use('/logout', checkApiKey);

app.get('/status', (req, res) => {
    res.json({
        connected: wapiConnected,
        user: sock?.user?.name || null,
        phone: sock?.user?.id?.replace(/@.*/, '') || null,
    });
});

app.post('/logout', async (req, res) => {
    if (!sock) {
        return res.json({ success: true, message: 'servidor nao inicializado' });
    }
    try {
        logoutExplicito = true;
        await sock.logout();
        wapiConnected = false;
        currentQR = null;
        console.log('Logout realizado com sucesso');
        res.json({ success: true, message: 'desconectado do WhatsApp' });
    } catch (e) {
        console.log('Erro no logout:', e.message);
        try {
            sock.end();
            wapiConnected = false;
            res.json({ success: true, message: 'desconectado via end()' });
        } catch (e2) {
            wapiConnected = false;
            res.status(500).json({ error: e.message });
        }
    }
});

app.get('/check-number/:number', async (req, res) => {
    if (!wapiConnected) {
        return res.status(503).json({ error: 'WhatsApp nao conectado' });
    }
    const number = req.params.number.replace(/\D/g, '');
    try {
        const [result] = await withTimeout(
            sock.onWhatsApp(number + '@s.whatsapp.net'),
            10000, 'Timeout ao verificar numero'
        );
        res.json({ number, exists: !!(result && result.exists), jid: result?.jid || null });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/send-text', async (req, res) => {
    if (!wapiConnected) {
        return res.status(503).json({ error: 'WhatsApp nao conectado' });
    }
    const { number, text } = req.body;
    if (!number || !text) {
        return res.status(400).json({ error: 'Campos obrigatorios: number, text' });
    }
    try {
        const jid = number.includes('@s.whatsapp.net')
            ? number
            : `${number.replace(/\D/g, '')}@s.whatsapp.net`;

        const [onWhats] = await withTimeout(
            sock.onWhatsApp(jid),
            10000, 'Timeout ao verificar numero'
        );
        if (!onWhats || !onWhats.exists) {
            return res.status(400).json({ error: 'Numero nao possui WhatsApp: ' + number });
        }

        await withTimeout(
            sock.sendMessage(jid, { text }),
            15000, 'Timeout ao enviar mensagem'
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/send-media', upload.single('media'), async (req, res) => {
    if (!wapiConnected) {
        return res.status(503).json({ error: 'WhatsApp nao conectado' });
    }
    const { number, fileName, mediatype, caption } = req.body;
    const file = req.file;
    if (!number || !file) {
        return res.status(400).json({ error: 'Campos obrigatorios: number, media (arquivo)' });
    }
    try {
        const jid = number.includes('@s.whatsapp.net')
            ? number
            : `${number.replace(/\D/g, '')}@s.whatsapp.net`;

        const [onWhats] = await withTimeout(
            sock.onWhatsApp(jid),
            10000, 'Timeout ao verificar numero'
        );
        if (!onWhats || !onWhats.exists) {
            fs.unlinkSync(file.path);
            return res.status(400).json({ error: 'Numero nao possui WhatsApp: ' + number });
        }

        const fileBuffer = fs.readFileSync(file.path);
        const name = fileName || file.originalname || 'arquivo';
        const ext = path.extname(name).toLowerCase();

        let type = mediatype || 'document';
        if (!mediatype) {
            if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext)) type = 'image';
            else if (['.mp4', '.avi', '.mov', '.mkv', '.3gp'].includes(ext)) type = 'video';
            else if (['.mp3', '.ogg', '.wav', '.aac', '.opus'].includes(ext)) type = 'audio';
        }

        const mimeMap = {
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.ppt': 'application/vnd.ms-powerpoint',
            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            '.txt': 'text/plain',
            '.csv': 'text/csv',
            '.zip': 'application/zip',
            '.rar': 'application/vnd.rar',
            '.7z': 'application/x-7z-compressed',
            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
            '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp',
            '.mp4': 'video/mp4', '.avi': 'video/x-msvideo',
            '.mov': 'video/quicktime', '.mkv': 'video/x-matroska',
            '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
        };
        let mimetype = file.mimetype || 'application/octet-stream';
        if (!mimetype || mimetype === 'application/octet-stream') {
            mimetype = mimeMap[ext] || mimetype;
        }

        let msg;
        if (type === 'image') {
            msg = { image: fileBuffer };
            if (caption) msg.caption = caption;
        } else if (type === 'video') {
            msg = { video: fileBuffer };
            if (caption) msg.caption = caption;
        } else if (type === 'audio') {
            msg = { audio: { url: file.path }, mimetype: 'audio/mpeg', ptt: false };
        } else {
            msg = {
                document: fileBuffer,
                fileName: name,
                mimetype: mimetype,
            };
            if (caption) msg.caption = caption;
        }

        await sock.sendMessage(jid, msg);
        fs.unlinkSync(file.path);
        res.json({ success: true, fileName: name });
    } catch (e) {
        if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        res.status(500).json({ error: e.message });
    }
});

app.get('/qr', (req, res) => {
    if (currentQR) {
        res.json({ qr: currentQR });
    } else {
        res.status(404).json({ error: 'QR Code nao disponivel (ja conectado ou aguardando)' });
    }
});

app.get('/contacts', async (req, res) => {
    if (!wapiConnected) {
        return res.status(503).json({ error: 'WhatsApp nao conectado' });
    }
    try {
        const contacts = [];
        for (const [number, name] of chatContacts) {
            contacts.push({ number, name });
        }
        res.json({ contacts });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

async function connectToWhatsApp() {
    if (isReconnecting) {
        console.log('Reconexao ja em andamento, ignorando...');
        return;
    }
    isReconnecting = true;

    if (sock) {
        try {
            sock.ev.removeAllListeners();
            sock.end(undefined);
        } catch (e) {
            console.log('Erro ao fechar socket antigo:', e.message);
        }
        sock = null;
    }

    wapiConnected = false;
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    const { version } = await fetchLatestBaileysVersion();
    console.log(`Baileys v${version}`);

    sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        markOnlineOnConnect: true,
        keepAliveIntervalMs: 25000,
        logger: pino({ level: 'error' }),
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messaging-history.set', ({ chats, contacts }) => {
        if (chats) {
            let added = 0;
            for (const chat of chats) {
                const jid = chat.id;
                if (jid && !jid.includes('@g.us') && !jid.includes('@broadcast')) {
                    const number = jid.replace(/@.*/, '');
                    if (/^\d+$/.test(number) && !chatContacts.has(number)) {
                        chatContacts.set(number, chat.name || chat.subject || number);
                        added++;
                    }
                }
            }
            if (added > 0) saveContacts();
        }
    });

    sock.ev.on('contacts.update', (updates) => {
        if (updates) {
            let added = 0;
            for (const c of updates) {
                const jid = c.id;
                if (jid && !jid.includes('@g.us') && !jid.includes('@broadcast')) {
                    const number = jid.replace(/@.*/, '');
                    if (/^\d+$/.test(number) && !chatContacts.has(number)) {
                        chatContacts.set(number, c.name || c.notify || number);
                        added++;
                    }
                }
            }
            if (added > 0) saveContacts();
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            currentQR = qr;
            console.log('\n=== ESCANEIE O QR CODE ABAIXO ===\n');
            qrcode.generate(qr, { small: true });
            console.log('\n=================================\n');
        }

        if (connection === 'open') {
            wapiConnected = true;
            currentQR = null;
            console.log('WhatsApp conectado!');
            console.log(`Servidor rodando em http://localhost:${PORT}`);
            console.log(`API Key: ${API_KEY}`);
        }

        if (connection === 'close') {
            wapiConnected = false;
            if (logoutExplicito) {
                console.log('Baileys desconectado por logout manual, nao reconectara');
                isReconnecting = false;
                return;
            }
            const code = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = code !== DisconnectReason.loggedOut
                && code !== DisconnectReason.connectionReplaced;
            console.log('Conexao fechada. Reconectando:', shouldReconnect, '| code:', code);
            if (shouldReconnect) {
                isReconnecting = false;
                setTimeout(connectToWhatsApp, 3000);
            } else if (code === DisconnectReason.connectionReplaced) {
                console.log('Sessao substituida (connectionReplaced). Removendo auth_info/ e aguardando novo QR...');
                try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch (_) {}
                isReconnecting = false;
                setTimeout(connectToWhatsApp, 10000);
            } else {
                console.log('Sessao expirada (loggedOut). Removendo auth_info/ e reiniciando...');
                try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch (_) {}
                isReconnecting = false;
                setTimeout(connectToWhatsApp, 2000);
            }
        }
    });

    isReconnecting = false;
}

connectToWhatsApp();

app.listen(PORT, () => {
    console.log(`\n=== WhatsApp API (wapi) ===`);
    console.log(`Porta: ${PORT}`);
    console.log(`API Key: ${API_KEY}`);
    console.log(`Aguardando conexao WhatsApp...\n`);
});

process.on('uncaughtException', (err) => {
    console.error('Erro nao tratado:', err.message);
});
process.on('unhandledRejection', (reason) => {
    console.error('Promise rejeitada:', reason?.message || reason);
});
