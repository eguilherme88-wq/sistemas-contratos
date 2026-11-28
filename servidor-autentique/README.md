# Servidor de integração com o Autentique

Pequeno servidor no **Cloudflare Workers** (plano gratuito). Ele guarda o token da API do Autentique, que não pode ficar no navegador, e faz a ponte entre o sistema de contratos e o Autentique.

O que ele faz:
- cria o documento no Autentique e envia o convite de assinatura por e-mail (contratos e aditivos);
- consulta quem já visualizou, assinou ou recusou;
- devolve o link do PDF assinado.

As testemunhas assinam como testemunha (`SIGN_AS_A_WITNESS`). As demais partes assinam como parte (`SIGN`).

## Instalação pelo painel da Cloudflare (sem instalar nada)

1. Entre em https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Create Worker**.
2. Dê o nome `partner-autentique`, clique em **Deploy** e depois em **Edit code**.
3. Apague o código de exemplo, cole todo o conteúdo de `worker.js` e clique em **Deploy**.
4. Em **Settings → Variables and Secrets**, adicione:
   - `AUTENTIQUE_TOKEN`, do tipo **Secret**: o token gerado no Autentique em *Configurações → API*;
   - `INTEGRACAO_CHAVE`, do tipo **Secret**: uma senha longa inventada por você, com 30 caracteres ou mais;
   - `ORIGENS`, do tipo **Text**: `https://eguilherme88-wq.github.io`;
   - opcional: `AUTENTIQUE_SANDBOX`, do tipo **Text**: `true` para testar sem validade jurídica, `false` em produção.
5. Abra o endereço do worker (ex.: `https://partner-autentique.<sua-conta>.workers.dev`). A resposta deve mostrar `"configurado": true`.
6. No sistema de contratos, em qualquer contrato, preencha:
   - **Servidor de integração**: o endereço do worker;
   - **Chave do servidor**: a mesma `INTEGRACAO_CHAVE`.

   O navegador guarda os dois campos, então a configuração vale para todos os contratos e aditivos daquele aparelho.

## Instalação pela linha de comando (alternativa)

```bash
cd servidor-autentique
npx wrangler login
npx wrangler secret put AUTENTIQUE_TOKEN
npx wrangler secret put INTEGRACAO_CHAVE
npx wrangler deploy
```

## Rotas

| Método | Rota | Uso |
|---|---|---|
| GET | `/` | verificação: mostra se o servidor está configurado |
| POST | `/documentos` | `{ nome, arquivoNome, pdfBase64, signatarios: [{ nome, email, papel }] }` → `{ id, url, sandbox, signatarios }` |
| GET | `/documentos/:id` | `{ id, url, arquivoAssinado, signatarios: [{ email, status, link, assinadoEm }] }` |

Toda chamada, exceto a verificação, precisa do cabeçalho `X-Integracao-Chave` e vir de um endereço listado em `ORIGENS`.
