const THREE_URL="https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
let THREE_PROMISE;
const three=()=>THREE_PROMISE||(THREE_PROMISE=import(THREE_URL));
const statusColor={working:0x44d17a,idle:0x7d8797,approval:0xf0b84b,blocked:0xe06a5f,error:0xe06a5f};
export async function mountAgentOffice3D(root,{agents=[],approvals=0,onAgent=()=>{}}={}){
 if(!root)return()=>{};
 const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches,compact=innerWidth<760||((navigator.deviceMemory||8)<=4);
 root.innerHTML='<div class="office3d-loading">Carregando escritório 3D…</div>';
 let T;try{T=await three()}catch{root.innerHTML='<div class="office3d-loading">3D indisponível. Use o Escritório 2D.</div>';return()=>{}}
 root.innerHTML='<canvas class="office3d-canvas"></canvas><div class="office3d-hud"><b>STATES · AI OFFICE 3D</b><span>JEV LIVE</span><small>'+agents.length+' agentes · '+approvals+' aprovação(ões)</small></div>';
 const canvas=root.querySelector("canvas"),renderer=new T.WebGLRenderer({canvas,antialias:!compact,alpha:true,powerPreference:compact?"low-power":"high-performance"});
 renderer.setPixelRatio(Math.min(devicePixelRatio,compact?1.25:1.75));renderer.shadowMap.enabled=!compact;
 const scene=new T.Scene();scene.background=new T.Color(0x101216);
 const camera=new T.PerspectiveCamera(38,1,.1,100);camera.position.set(11,11,14);camera.lookAt(0,0,0);
 scene.add(new T.HemisphereLight(0xffffff,0x30343b,2.2));const key=new T.DirectionalLight(0xffffff,2.2);key.position.set(5,10,6);key.castShadow=!compact;scene.add(key);
 const mat=(color)=>new T.MeshStandardMaterial({color,roughness:.72,metalness:.08});
 const floor=new T.Mesh(new T.BoxGeometry(15,.25,10),mat(0x20242b));floor.position.y=-.2;floor.receiveShadow=true;scene.add(floor);
 const wall=mat(0x2a3038);[[-7.4,1.1,0,.2,2.5,10],[0,1.1,-4.9,15,2.5,.2]].forEach(v=>{const m=new T.Mesh(new T.BoxGeometry(v[3],v[4],v[5]),wall);m.position.set(v[0],v[1],v[2]);scene.add(m)});
 const desks=[],clickables=[],agentByMesh=new Map(),deskMat=mat(0x72513a),screenMat=mat(0x151a20);
 const spots=[[-5,-2],[-1.7,-2],[1.7,-2],[5,-2],[-5,2],[-1.7,2],[1.7,2],[5,2]];
 agents.forEach((a,i)=>{const p=spots[i%spots.length],g=new T.Group();g.position.set(p[0],0,p[1]);
  const desk=new T.Mesh(new T.BoxGeometry(2.25,.18,1.05),deskMat);desk.position.y=.8;desk.castShadow=!compact;g.add(desk);
  const screen=new T.Mesh(new T.BoxGeometry(.9,.58,.08),screenMat);screen.position.set(0,1.25,-.2);g.add(screen);
  const body=new T.Mesh(new T.CapsuleGeometry(a.chief?.34:.25,a.chief?.75:.55,4,8),mat(a.chief?0x1596c8:(statusColor[a.status]||0x7d8797)));body.position.set(0,a.chief?.72:.58,.65);body.userData.agentId=a.id;g.add(body);clickables.push(body);agentByMesh.set(body,a);
  const lamp=new T.Mesh(new T.SphereGeometry(.08,8,8),new T.MeshBasicMaterial({color:statusColor[a.status]||0x7d8797}));lamp.position.set(.8,1.05,.1);g.add(lamp);if(a.chief){g.position.set(0,0,-3.5);const crown=new T.Mesh(new T.TorusGeometry(.34,.07,8,20),new T.MeshBasicMaterial({color:0x5ccfff}));crown.rotation.x=Math.PI/2;crown.position.set(0,1.65,.65);g.add(crown)}scene.add(g);desks.push({g,body,a,baseY:body.position.y,phase:i});
 });
 const table=new T.Mesh(new T.CylinderGeometry(1.25,1.25,.18,24),mat(0x4d5968));table.position.set(0,.45,0);scene.add(table);
 const jev=new T.Mesh(new T.CylinderGeometry(.32,.45,1.25,16),mat(0x5c79ff));jev.position.set(0,.7,0);scene.add(jev);
 const ray=new T.Raycaster(),pointer=new T.Vector2();canvas.addEventListener("click",e=>{const r=canvas.getBoundingClientRect();pointer.x=((e.clientX-r.left)/r.width)*2-1;pointer.y=-((e.clientY-r.top)/r.height)*2+1;ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(clickables)[0];if(hit)onAgent(agentByMesh.get(hit.object))});
 let raf=0,alive=true;const resize=()=>{const w=root.clientWidth,h=Math.max(compact?430:560,Math.min(720,innerHeight*.68));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()};new ResizeObserver(resize).observe(root);resize();
 const tick=t=>{if(!alive)return;if(!reduced)desks.forEach(x=>{if(x.a.status==="working")x.body.position.y=x.baseY+Math.sin(t*.003+x.phase)*.025});renderer.render(scene,camera);raf=requestAnimationFrame(tick)};raf=requestAnimationFrame(tick);
 return()=>{alive=false;cancelAnimationFrame(raf);renderer.dispose();scene.traverse(o=>{o.geometry?.dispose?.();if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose?.())}})}
}
