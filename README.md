# Partner — Gestão de Contratos

Sistema web de gestão de contratos, instalável como aplicativo (PWA) em:

- **Windows e Linux** — Google Chrome ou Microsoft Edge (abre em janela própria e cria atalho no menu Iniciar / lançador de aplicativos)
- **Android (celular e tablet)** — Chrome, Edge ou Samsung Internet
- **iPhone e iPad** — Safari → Compartilhar → *Adicionar à Tela de Início*
- **Mac** — Safari → Arquivo → *Adicionar ao Dock*, ou Chrome/Edge

O botão **Instalar aplicativo** fica no menu lateral (e na tela de login). Quando o navegador permite, ele abre a instalação direto; caso contrário, mostra o passo a passo do dispositivo.

## Publicação (GitHub Pages)

1. Envie todos os arquivos deste repositório para a branch `main`.
2. Em **Settings → Pages**, escolha *Deploy from a branch* → `main` → `/ (root)`.
3. Acesse `https://<usuario>.github.io/<repositorio>/`.

Todos os caminhos são relativos, então o app funciona com qualquer nome de repositório.

## Isolamento em relação aos outros apps

Todos os repositórios publicados em `<usuario>.github.io` dividem o mesmo domínio. Para não haver conflito:

| Item | Como está isolado |
|---|---|
| Identidade do app (`id` do manifesto) | `./?app=partner-contratos`, vinculado à pasta do repositório |
| Escopo do app e do service worker | `./`, ou seja, só a pasta deste repositório |
| Cache | prefixo `partner-contratos-`; o service worker só apaga os próprios caches |
| Requisições externas (Supabase, CDNs) | não são interceptadas |
| Janela | `launch_handler` reaproveita a janela já aberta do Partner, sem abrir duplicadas |

## Atualizar o app

Ao publicar uma nova versão do `index.html`, os apps instalados já recebem a página nova (a página é buscada primeiro na rede). Se trocar ícones, aumente `VERSAO` em `sw.js` (ex.: `v2`).

## Estrutura

```
index.html              sistema
manifest.webmanifest    dados do aplicativo (nome, ícones, cores, escopo)
sw.js                   service worker (instalação e uso sem conexão da tela inicial)
icons/                  ícones 32, 180, 192, 512 e versões "maskable"
```
