const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function mountFlow(root,{store,onNotify}={}){
 const key="td:flow:v1",saved=store?.get(key,null),model=saved&&Array.isArray(saved.nodes)?saved:{nodes:[],edges:[]};
 root.innerHTML=`<div class="flow-shell"><div class="flow-toolbar"><button data-flow="select" class="active">↖ Selecionar</button><button data-flow="node">＋ Bloco</button><button data-flow="connect">⌁ Conectar</button><button data-flow="delete">⌫ Excluir</button><span></span><button data-flow="clear">Limpar</button></div><div class="flow-stage"><canvas id="flowCanvas"></canvas><div class="flow-hint">Duplo clique cria bloco · Arraste para mover · Scroll para zoom</div></div></div>`;
 const canvas=root.querySelector("#flowCanvas"),ctx=canvas.getContext("2d"),stage=canvas.parentElement;
 let mode="select",selected=null,drag=null,connectFrom=null,pan={x:0,y:0},zoom=1,dpr=devicePixelRatio||1;
 const save=()=>store?.set(key,model),notify=(t)=>onNotify?.(t);
 const resize=()=>{const r=stage.getBoundingClientRect();canvas.width=Math.max(1,r.width*dpr);canvas.height=Math.max(1,r.height*dpr);canvas.style.width=r.width+"px";canvas.style.height=r.height+"px";draw()};
 const world=(e)=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left-pan.x)/zoom,y:(e.clientY-r.top-pan.y)/zoom}};
 const hit=p=>[...model.nodes].reverse().find(n=>p.x>=n.x&&p.x<=n.x+n.w&&p.y>=n.y&&p.y<=n.y+n.h);
 const node=(x,y,title="Novo bloco")=>{const n={id:crypto.randomUUID?.()||Date.now()+"-"+Math.random(),x,y,w:180,h:74,title};model.nodes.push(n);selected=n.id;save();draw();return n};
 function roundRect(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
 function draw(){
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,canvas.width/dpr,canvas.height/dpr);
  ctx.save();ctx.translate(pan.x,pan.y);ctx.scale(zoom,zoom);
  const W=canvas.width/dpr/zoom,H=canvas.height/dpr/zoom,step=28;ctx.strokeStyle="#171717";ctx.lineWidth=1/zoom;
  for(let x=(-pan.x/zoom)%step;x<W;x+=step){ctx.beginPath();ctx.moveTo(x,-pan.y/zoom);ctx.lineTo(x,H-pan.y/zoom);ctx.stroke()}
  for(let y=(-pan.y/zoom)%step;y<H;y+=step){ctx.beginPath();ctx.moveTo(-pan.x/zoom,y);ctx.lineTo(W-pan.x/zoom,y);ctx.stroke()}
  model.edges.forEach(e=>{const a=model.nodes.find(n=>n.id===e.a),b=model.nodes.find(n=>n.id===e.b);if(!a||!b)return;const ax=a.x+a.w,ay=a.y+a.h/2,bx=b.x,by=b.y+b.h/2,m=(ax+bx)/2;ctx.strokeStyle="#777";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(ax,ay);ctx.bezierCurveTo(m,ay,m,by,bx,by);ctx.stroke()});
  model.nodes.forEach(n=>{ctx.shadowColor=n.id===selected?"#fff5":"transparent";ctx.shadowBlur=n.id===selected?16:0;roundRect(n.x,n.y,n.w,n.h,14);ctx.fillStyle="#090909";ctx.fill();ctx.strokeStyle=n.id===selected?"#fff":"#343434";ctx.lineWidth=n.id===selected?2:1;ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle="#fff";ctx.font="600 14px DM Sans";ctx.fillText(n.title,n.x+16,n.y+31);ctx.fillStyle="#777";ctx.font="12px DM Sans";ctx.fillText("Fluxo Tools",n.x+16,n.y+51)});
  ctx.restore()
 }
 root.querySelectorAll("[data-flow]").forEach(b=>b.onclick=()=>{const a=b.dataset.flow;if(a==="clear"){if(!model.nodes.length)return;const go=()=>{model.nodes=[];model.edges=[];selected=null;save();draw();notify("Fluxo limpo")};if(window.Swal)Swal.fire({title:"Limpar fluxo?",text:"Todos os blocos e conexões serão removidos.",icon:"warning",showCancelButton:true,confirmButtonText:"Limpar",cancelButtonText:"Cancelar",background:"#080808",color:"#fff",confirmButtonColor:"#fff"}).then(r=>r.isConfirmed&&go());else if(confirm("Limpar fluxo?"))go();return}mode=a;root.querySelectorAll("[data-flow]").forEach(x=>x.classList.toggle("active",x===b))});
 canvas.ondblclick=e=>{const p=world(e);node(p.x-90,p.y-37)};
 canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);const p=world(e),n=hit(p);if(mode==="node"){node(p.x-90,p.y-37);mode="select";return}if(mode==="delete"&&n){model.nodes=model.nodes.filter(x=>x.id!==n.id);model.edges=model.edges.filter(x=>x.a!==n.id&&x.b!==n.id);save();draw();return}if(mode==="connect"&&n){if(connectFrom&&connectFrom!==n.id){if(!model.edges.some(x=>x.a===connectFrom&&x.b===n.id))model.edges.push({a:connectFrom,b:n.id});connectFrom=null;save()}else connectFrom=n.id;selected=n.id;draw();return}if(n){selected=n.id;drag={id:n.id,dx:p.x-n.x,dy:p.y-n.y}}else{selected=null;drag={pan:true,x:e.clientX-pan.x,y:e.clientY-pan.y}};draw()};
 canvas.onpointermove=e=>{if(!drag)return;if(drag.pan){pan.x=e.clientX-drag.x;pan.y=e.clientY-drag.y}else{const p=world(e),n=model.nodes.find(x=>x.id===drag.id);if(n){n.x=p.x-drag.dx;n.y=p.y-drag.dy}}draw()};
 canvas.onpointerup=()=>{if(drag&&!drag.pan)save();drag=null};
 canvas.onwheel=e=>{e.preventDefault();zoom=clamp(zoom*(e.deltaY<0?1.1:.9),.4,2.2);draw()};
 window.addEventListener("keydown",e=>{if((e.key==="Delete"||e.key==="Backspace")&&selected&&root.isConnected&&!["INPUT","TEXTAREA"].includes(document.activeElement.tagName)){model.nodes=model.nodes.filter(n=>n.id!==selected);model.edges=model.edges.filter(x=>x.a!==selected&&x.b!==selected);selected=null;save();draw()}});
 new ResizeObserver(resize).observe(stage);resize();
}