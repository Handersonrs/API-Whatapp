# API-Whatapp

Arquivos das APIs do WhatsApp usadas pelo **Nobre Messenger**.

## Estrutura

```
API-Whatapp/
├── wapi/              # API Baileys (porta 8080)
│   ├── server.js      # Servidor Express + @whiskeysockets/baileys
│   └── package.json
└── wapi_wwebjs/       # API Redundancia wwebjs (porta 8082)
    ├── server.js      # Servidor Express + whatsapp-web.js
    └── package.json
```

## Como atualizar

Quando o WhatsApp parar de funcionar, as bibliotecas costumam ser atualizadas:

### 1. Verificar release notes das bibliotecas

- **Baileys:** https://github.com/WhiskeySockets/Baileys/releases
- **wwebjs:** https://github.com/pedroslopez/whatsapp-web.js/releases

### 2. Atualizar os arquivos

Edite `wapi/server.js` e/ou `wapi_wwebjs/server.js` conforme as mudanças necessarias. Atualize tambem as versoes no `package.json` se necessario.

### 3. Testar localmente

Execute `npm install` nas pastas `wapi/` e `wapi_wwebjs/` e teste o QR Code e envio de mensagens.

### 4. Publicar

```bash
git add -A
git commit -m "Atualizacao para nova versao das bibliotecas"
git push
```

Apos o push, os usuarios do Nobre Messenger clicam em "npm update" para receber a atualizacao.
