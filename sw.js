const VERSION="5.41.0";
const SHELL_CACHE="tools-digital-shell-"+VERSION;
const RUNTIME_CACHE="tools-digital-runtime-"+VERSION;
const CACHE_PREFIX="tools-digital-";
const CORE=[
  "./",
  "./index.html","./404.html",
  "./styles.css?v=5.41.0",
  "./manifest.json",
  "./assets/IMG_0162.JPG",
  "./src/main.js?v=5.41.0",
  "./src/services/neon.js?v=5.41.0",
  "./src/data/tools.js?v=5.41.0",
  "./src/modules/tools-cockpit.js?v=5.41.0",
  "./src/modules/tools-operations.js?v=5.41.0",
  "./src/modules/tools-dashboard.js?v=5.41.0",
  "./src/modules/tools-checklists.js?v=5.41.0",
  "./src/modules/tools-knowledge.js?v=5.41.0",
  "./src/modules/tools-vault.js?v=5.41.0",
  "./src/modules/tools-service-orders.js?v=5.41.0",
  "./src/modules/tools-stacks.js?v=5.41.0",
  "./src/modules/tools-custom.js?v=5.41.0",
    "./src/modules/flow-tools.js?v=5.41.0",
  "./src/modules/session.js?v=5.41.0",
  "./src/modules/projects.js?v=5.41.0",
  "./src/modules/bootstrap.js?v=5.41.0",
  "./src/modules/second-brain.js?v=5.41.0",
  "./src/modules/wikilinks.js?v=5.41.0",
  "./src/modules/markdown.js?v=5.41.0",
  "./src/modules/note-templates.js?v=5.41.0",
  "./src/modules/knowledge-graph.js?v=5.41.0",
  "./src/modules/finance.js?v=5.41.0",
  "./src/modules/finance-enhancements.js?v=5.41.0",
  "./src/modules/finance-fixed-bills.js?v=5.41.0",
  "./src/modules/project-enhancements.js?v=5.41.0",
  "./src/modules/ai-operations.js?v=5.41.0","./src/modules/ai-office-3d.js?v=5.41.0",
  "./src/services/jev.js?v=5.41.0"
];

async function cacheResponse(request,response,cacheName=RUNTIME_CACHE){
  if(!response||!response.ok||response.type==="opaque")return response;
  const cache=await caches.open(cacheName);
  await cache.put(request,response.clone());
  return response;
}

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(SHELL_CACHE);
    await cache.addAll(CORE);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&![SHELL_CACHE,RUNTIME_CACHE].includes(key)).map(key=>caches.delete(key)));
    await self.clients.claim();
    const clients=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    clients.forEach(client=>client.postMessage({type:"TD_VERSION_ACTIVATED",version:VERSION}));
  })());
});

self.addEventListener("message",event=>{
  if(event.data?.type==="SKIP_WAITING")self.skipWaiting();
  if(event.data?.type==="CLEAR_RUNTIME_CACHE")event.waitUntil?.(caches.delete(RUNTIME_CACHE));
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  const request=event.request,navigation=request.mode==="navigate";
  const dynamic=request.destination==="script"||request.destination==="style"||request.destination==="document"||url.pathname.endsWith(".json");
  event.respondWith((async()=>{
    if(navigation){
      try{return await cacheResponse(request,await fetch(request,{cache:"no-store"}),SHELL_CACHE)}
      catch{return(await caches.match(request))||caches.match("./index.html")}
    }
    if(dynamic){
      try{return await cacheResponse(request,await fetch(request,{cache:"no-store"}))}
      catch{return(await caches.match(request))||Response.error()}
    }
    const cached=await caches.match(request);
    if(cached)return cached;
    try{return await cacheResponse(request,await fetch(request))}
    catch{return Response.error()}
  })());
});
