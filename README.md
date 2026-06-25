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

## Como usar este repositorio

1. Edite os arquivos `wapi/server.js`, `wapi/package.json`, `wapi_wwebjs/server.js`, `wapi_wwebjs/package.json`
2. Execute **testar.bat** para copiar os arquivos para o Nobre Messenger e instalar dependencias
3. Teste o QR Code e envio de mensagens
4. Execute **publicar.bat** para enviar as alteracoes para o GitHub

## Quando o WhatsApp parar de funcionar

### 1. Verificar release notes das bibliotecas

- **Baileys:** https://github.com/WhiskeySockets/Baileys/releases
- **wwebjs:** https://github.com/pedroslopez/whatsapp-web.js/releases

### 2. Atualizar os arquivos

Edite `wapi/server.js` e/ou `wapi_wwebjs/server.js` conforme as mudanças necessarias. Atualize tambem as versoes no `package.json` se necessario.

### 3. Rodar testar.bat

Copia os arquivos para o Nobre Messenger e instala as dependencias automaticamente.

### 4. Rodar publicar.bat

Envia as alteracoes para o GitHub. Apos o push, os usuarios clicam em "npm update" para receber a correcao.
