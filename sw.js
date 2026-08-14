// Instalação do Service Worker
self.addEventListener('install', (e) => {
    console.log('[Service Worker] Instalado com sucesso!');
    self.skipWaiting();
});

// Ativação
self.addEventListener('activate', (e) => {
    console.log('[Service Worker] Ativado e rodando em segundo plano.');
    return self.clients.claim();
});

// Interceptador de Rede (Pass-through)
// Deixamos a internet passar livremente para não travar o Google Sheets
self.addEventListener('fetch', (e) => {
    e.respondWith(fetch(e.request));
});