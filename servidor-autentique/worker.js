/**
 * Servidor de integração Partner Contratos ↔ Autentique (Cloudflare Workers).
 *
 * Guarda o token da API do Autentique (que não pode ficar no navegador) e expõe
 * as duas rotas que o sistema de contratos usa:
 *
 *   POST /documentos       cria o documento no Autentique e envia para assinatura
 *        corpo: { nome, arquivoNome, pdfBase64, signatarios: [{ nome, email, papel }] }
 *        resposta: { id, url, sandbox, signatarios: [{ nome, email, publicId, link, status, assinadoEm }] }
 *
 *   GET  /documentos/:id   consulta a situação das assinaturas
 *        resposta: { id, url, arquivoAssinado, signatarios: [...] }
 *
 * Variáveis (Cloudflare → Workers → este worker → Settings → Variables and Secrets):
 *   AUTENTIQUE_TOKEN   (secret)  token da API do Autentique
 *   INTEGRACAO_CHAVE   (secret)  chave que o sistema envia no cabeçalho X-Integracao-Chave
 *   ORIGENS            (texto)   endereços autorizados, separados por vírgula
 *                                (padrão: https://eguilherme88-wq.github.io)
 *   AUTENTIQUE_SANDBOX (texto)   "true" para criar documentos de teste, que não valem juridicamente
 */

const API = 'https://api.autentique.com.br/v2/graphql';
const PAINEL = 'https://painel.autentique.com.br/documentos/';
const LIMITE_PDF = 15 * 1024 * 1024;

const CAMPOS_ASSINATURA = `
  public_id name email created_at
  action { name }
  link { short_link }
  user { id name email }
  viewed { created_at }
  signed { created_at }
  rejected { created_at reason }
`;

const CRIAR = `mutation CriarDocumento($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
  createDocument(document: $document, signers: $signers, file: $file, sandbox: SANDBOX) {
    id name created_at
    signatures { ${CAMPOS_ASSINATURA} }
  }
}`;

const CONSULTAR = `query Documento($id: UUID!) {
  document(id: $id) {
    id name created_at
    files { original signed }
    signatures { ${CAMPOS_ASSINATURA} }
  }
}`;

export default {
  async fetch(request, env) {
    const cors = cabecalhosCors(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const json = (corpo, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });

    try {
      const url = new URL(request.url);
      const rota = url.pathname.replace(/\/+$/, '');

      if (request.method === 'GET' && (rota === '' || rota === '/')) {
        return json({ ok: true, servico: 'Partner Contratos ↔ Autentique', configurado: !!(env.AUTENTIQUE_TOKEN && env.INTEGRACAO_CHAVE), sandbox: sandbox(env) });
      }
      if (!origemPermitida(request, env)) return json({ erro: 'Origem não autorizada.' }, 403);
      if (!env.AUTENTIQUE_TOKEN || !env.INTEGRACAO_CHAVE) return json({ erro: 'Servidor sem configuração: defina AUTENTIQUE_TOKEN e INTEGRACAO_CHAVE.' }, 500);
      if (!chaveConfere(request.headers.get('X-Integracao-Chave') || '', env.INTEGRACAO_CHAVE)) return json({ erro: 'Chave do servidor inválida. Confira o campo "Chave do servidor" no sistema.' }, 403);

      if (request.method === 'POST' && rota === '/documentos') return json(await criarDocumento(await request.json(), env));
      const m = rota.match(/^\/documentos\/([0-9a-fA-F-]{20,})$/);
      if (request.method === 'GET' && m) return json(await consultarDocumento(m[1], env));
      return json({ erro: 'Rota não encontrada.' }, 404);
    } catch (e) {
      return json({ erro: e.message || String(e) }, e.status || 500);
    }
  }
};

async function criarDocumento(dados, env) {
  const nome = String(dados?.nome || 'Contrato').slice(0, 200);
  const arquivoNome = String(dados?.arquivoNome || 'contrato.pdf').replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'contrato.pdf';
  const pdf = base64ParaBytes(String(dados?.pdfBase64 || ''));
  if (!pdf.length) throw erro('O PDF do contrato não foi enviado.', 400);
  if (pdf.length > LIMITE_PDF) throw erro('O PDF passou de 15 MB.', 413);
  if (String.fromCharCode(...pdf.slice(0, 4)) !== '%PDF') throw erro('O arquivo enviado não é um PDF.', 400);

  const lista = Array.isArray(dados?.signatarios) ? dados.signatarios : [];
  const signers = lista.filter(s => s && s.email).map(s => ({
    email: String(s.email).trim().toLowerCase(),
    action: /testemunha/i.test(s.papel || '') ? 'SIGN_AS_A_WITNESS' : 'SIGN'
  }));
  if (!signers.length) throw erro('Informe ao menos um signatário com e-mail.', 400);

  const form = new FormData();
  form.append('operations', JSON.stringify({ query: CRIAR.replace('SANDBOX', sandbox(env) ? 'true' : 'false'), variables: { document: { name: nome }, signers, file: null } }));
  form.append('map', JSON.stringify({ file: ['variables.file'] }));
  form.append('file', new Blob([pdf], { type: 'application/pdf' }), arquivoNome);

  const doc = (await graphql(env, form)).createDocument;
  return { id: doc.id, url: PAINEL + doc.id, sandbox: sandbox(env), signatarios: converterAssinaturas(doc.signatures, lista) };
}

async function consultarDocumento(id, env) {
  const doc = (await graphql(env, JSON.stringify({ query: CONSULTAR, variables: { id } }), 'application/json')).document;
  if (!doc) throw erro('Documento não encontrado no Autentique.', 404);
  return { id: doc.id, url: PAINEL + doc.id, arquivoAssinado: doc.files?.signed || '', signatarios: converterAssinaturas(doc.signatures) };
}

function converterAssinaturas(assinaturas = [], enviados = []) {
  return (assinaturas || [])
    .filter(a => a.email || a.user?.email)
    .map(a => {
      const email = String(a.email || a.user?.email || '').toLowerCase();
      const local = enviados.find(s => String(s.email || '').toLowerCase() === email);
      const status = a.rejected ? 'Recusado' : a.signed ? 'Assinado' : a.viewed ? 'Visualizado' : 'Pendente';
      return {
        nome: local?.nome || a.name || a.user?.name || '',
        email,
        publicId: a.public_id || '',
        link: a.link?.short_link || '',
        status,
        assinadoEm: a.signed?.created_at || '',
        motivoRecusa: a.rejected?.reason || ''
      };
    });
}

async function graphql(env, corpo, tipo) {
  const r = await fetch(API, { method: 'POST', headers: { Authorization: 'Bearer ' + env.AUTENTIQUE_TOKEN, ...(tipo ? { 'Content-Type': tipo } : {}) }, body: corpo });
  const texto = await r.text();
  let dados = {};
  try { dados = JSON.parse(texto); } catch (e) { throw erro('Resposta inesperada do Autentique (HTTP ' + r.status + '): ' + texto.slice(0, 200), 502); }
  if (r.status === 401 || r.status === 403) throw erro('O Autentique recusou o token. Confira AUTENTIQUE_TOKEN.', 502);
  if (dados.errors?.length) throw erro('Autentique: ' + dados.errors.map(e => e.message).join('; '), 502);
  if (!r.ok) throw erro('Autentique respondeu HTTP ' + r.status + '.', 502);
  return dados.data || {};
}

function base64ParaBytes(b64) {
  const limpo = b64.replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
  if (!limpo) return new Uint8Array();
  const bin = atob(limpo);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function sandbox(env) { return String(env.AUTENTIQUE_SANDBOX || '').toLowerCase() === 'true'; }
function origens(env) { return String(env.ORIGENS || 'https://eguilherme88-wq.github.io').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean); }
function origemPermitida(request, env) { const o = request.headers.get('Origin'); return !o || origens(env).includes(o); }
function cabecalhosCors(request, env) {
  const o = request.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': o && origens(env).includes(o) ? o : origens(env)[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Integracao-Chave',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}
function chaveConfere(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function erro(msg, status) { const e = new Error(msg); e.status = status; return e; }
