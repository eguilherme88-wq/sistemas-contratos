/* Service worker do Partner — Gestão de Contratos
 * Isolado dos demais apps do mesmo domínio:
 *  - só atua dentro da pasta deste app (escopo "./");
 *  - usa caches com prefixo próprio e só apaga os seus;
 *  - não intercepta Firebase, CDNs nem nenhum outro endereço externo.
 */
const PREFIXO = 'partner-contratos-';
const VERSAO = 'v2';
const CACHE = PREFIXO + VERSAO;
const ESCOPO = self.registration.scope;
const ARQUIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(
        nomes.filter((n) => n.startsWith(PREFIXO) && n !== CACHE).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(ESCOPO)) return; // fora deste app: não mexe

  // Páginas: sempre tenta a versão mais nova na rede; sem internet, usa a cópia salva.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copia)); }
          return r;
        })
        .catch(() => caches.match('./index.html', { cacheName: CACHE }))
    );
    return;
  }

  // Ícones e manifesto: cache primeiro.
  e.respondWith(
    caches.match(req, { cacheName: CACHE }).then((r) => r || fetch(req))
  );
});
