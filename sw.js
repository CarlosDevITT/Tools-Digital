const CACHE="tools-digital-v5-5-1";
const CORE=[
  "./",
  "./index.html",
  "./styles.css?v=5.6.0",
  "./src/main.js?v=5.6.0",
  "./src/services/neon.js?v=5.6.0",
  "./src/data/tools.js?v=5.6.0",
  "./src/modules/flow-tools.js?v=5.6.0","./src/modules/session.js?v=5.6.0","./src/modules/projects.js?v=5.6.0","./src/modules/bootstrap.js?v=5.6.0",
  "./src/modules/second-brain.js?v=5.6.0","./src/modules/wikilinks.js","./src/modules/markdown.js","./src/modules/note-templates.js","./src/modules/knowledge-graph.js","./src/modules/finance.js?v=5.6.0",
  "./manifest.json",
  "./assets/IMG_0162.JPG"
];

self.addEventListener("install",event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
});

self.addEventListener("message",event=>{
  if(event.data?.type==="SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin) return;
  const nav=event.request.mode==="navigate";
  event.respondWith(
    (nav?fetch(event.request,{cache:"no-store"}):fetch(event.request))
      .then(response=>{
        if(response.ok){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy));
        }
        return response;
      })
      .catch(()=>caches.match(event.request).then(cached=>cached||(nav?caches.match("./index.html"):Response.error())))
  );
});
