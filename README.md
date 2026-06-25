# API-Whatapp

APIs Node.js do WhatsApp usadas pelo **Nobre Messenger**.

- `wapi/` — Baileys (porta 8080)
- `wapi_wwebjs/` — whatsapp-web.js (porta 8082)

## Fluxo de atualização

As APIs são editadas no repositório **Nobre-messenger** (`wapi/` e `wapi_wwebjs/`).

1. Edite os arquivos no Nobre-messenger
2. Execute `sync_api.bat` de lá — copia para cá e publica no GitHub
3. Usuários clicam em "npm update" no app para receber a atualização
