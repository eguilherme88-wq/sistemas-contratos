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
| Requisições externas (Firebase, CDNs) | não são interceptadas |
| Janela | `launch_handler` reaproveita a janela já aberta do Partner, sem abrir duplicadas |

## Atualizar o app

Ao publicar uma nova versão do `index.html`, os apps instalados já recebem a página nova (a página é buscada primeiro na rede). Se trocar ícones, aumente `VERSAO` em `sw.js` (ex.: `v2`).

## Banco de dados (Firebase)

Os dados ficam no projeto Firebase `partner-contratos` (plano gratuito Spark):

- **Login**: Firebase Authentication, por e-mail e senha.
- **Dados**: Cloud Firestore (`contratos`, `contratosExternos`, `partes`, `tiposServico`, `perfis`, `senhas`, `config`).
- **Arquivos dos contratos externos**: guardados no próprio Firestore, em partes de 700 KB (`arquivos`), porque o Storage exige o plano pago.
- **Regras de acesso**: `firestore.rules` (publicar em Firestore → Regras sempre que mudar).

No primeiro acesso, se ainda não houver administrador, a tela de login oferece criar a conta de administrador e copiar os dados do sistema antigo (Supabase). A cópia também pode ser feita depois em **Usuários → Importar do sistema antigo**.

Limitações do plano gratuito:

- **Assinatura no Autentique** precisa de um servidor de integração próprio (campo "Servidor de integração"); sem ele, o envio fica desativado.
- O administrador **não define a senha de outro usuário**: o sistema envia um e-mail de redefinição para o próprio usuário.
- Ao excluir um usuário, o perfil é removido (ele perde o acesso), mas a conta de login continua listada em Authentication no console do Firebase.

## Propostas Comerciais (integração com o Partner Precificação SaaS)

O menu **Propostas Comerciais** mostra, em tempo real, as propostas geradas no sistema de precificação (`precificacao-saas`), **sem pedir senha**.

- O sistema de precificação publica uma cópia das propostas (com clientes, módulos, sistemas e dados da empresa) em `integracaoContratos/{chave}`, no Firebase dele. A chave é aleatória (256 bits) e fica guardada no banco deste sistema (`config/integracaoPrecificacao`), visível só para quem tem perfil.
- **Ativação (uma única vez):** um Administrador abre o menu e informa o e-mail e a senha da precificação. A senha não é guardada; o sistema só busca a chave e salva. Depois disso, todos os usuários e aparelhos conectam sozinhos.
- O sistema de contratos só lê as propostas; não altera nada na precificação.
- **Gerar contrato**: preenche um novo contrato com o cliente (cadastrado automaticamente em Contratantes, se ainda não existir), a empresa contratada, a vigência de 12 meses, o valor (12 parcelas ou à vista), o meio de pagamento e o objeto com a lista de módulos. O contrato fica vinculado à proposta (`propostaId`) e a lista passa a mostrar o número do contrato.
- Para usuários de nível Master/Usuário, libere o acesso em **Usuários e Acessos → Propostas Comerciais**.

## Estrutura

```
index.html              sistema
manifest.webmanifest    dados do aplicativo (nome, ícones, cores, escopo)
sw.js                   service worker (instalação e uso sem conexão da tela inicial)
firestore.rules         regras de acesso do banco Firestore
icons/                  ícones 32, 180, 192, 512 e versões "maskable"
```
