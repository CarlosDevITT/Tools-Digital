import { createClient } from "https://esm.sh/@neondatabase/neon-js@0.7.0-beta?bundle";

const DATA_API_URL="https://ep-shy-hall-b4tnu7jl.apirest.c-6.us-east-2.aws.neon.tech/neondb/rest/v1";
const AUTH_URL="https://ep-shy-hall-b4tnu7jl.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth";

// Cliente único: informa Auth e Data API explicitamente.
// Passar só a URL da Data API fazia o SDK derivar um host de Auth inválido
// (neonauth.apirest...), causando ERR_CERT_COMMON_NAME_INVALID.
export const neon=createClient({
 auth:{url:AUTH_URL},
 dataApi:{url:DATA_API_URL}
});
export const auth=neon.auth;

let sessionCache=null;export async function getSession(){if(sessionCache)return sessionCache;const {data,error}=await auth.getSession();if(error)throw error;sessionCache=data?.session?data:null;return sessionCache}
export async function signIn(email,password){const r=await auth.signIn.email({email,password,rememberMe:true});if(r.error)throw r.error;sessionCache=null;return r.data}
export async function signUp(name,email,password){const r=await auth.signUp.email({name,email,password});if(r.error)throw r.error;sessionCache=null;return r.data}
export async function signOut(){const r=await auth.signOut();sessionCache=null;if(r?.error)throw r.error}

const iso=n=>new Date(n||Date.now()).toISOString();
const validUuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v||"");
const uuid=()=>crypto.randomUUID();

function noteRow(n,owner){
 return {id:validUuid(n.id)?n.id:uuid(),owner_id:owner,title:n.title||"",body:n.body||"",tags:Array.isArray(n.tags)?n.tags:[],pinned:!!n.pinned,favorite:!!n.favorite,created_at:iso(n.createdAt),updated_at:iso(n.updatedAt||n.createdAt)}
}
function txRow(t,owner){
 const amount=Math.abs(Number(t.amount||0));
 return {id:validUuid(t.id)?t.id:uuid(),owner_id:owner,description:t.description||"",category:t.category||"Geral",type:Number(t.amount)>=0?"in":"out",amount_cents:amount,occurred_on:new Date(t.createdAt||Date.now()).toISOString().slice(0,10),created_at:iso(t.createdAt),updated_at:iso(t.updatedAt||t.createdAt)}
}
export async function pullCloud(){
 const s=await getSession();if(!s)return null;
 const [notes,tx,favs,usage]=await Promise.all([
  neon.from("notes").select("*").order("updated_at",{ascending:false}),
  neon.from("transactions").select("*").order("occurred_on",{ascending:false}),
  neon.from("favorites").select("*"),
  neon.from("tool_usage").select("*")
 ]);
 for(const r of [notes,tx,favs,usage])if(r.error)throw r.error;
 return {user:s.user,notes:(notes.data||[]).map(n=>({id:n.id,title:n.title,body:n.body,tags:n.tags||[],pinned:n.pinned,favorite:n.favorite,createdAt:Date.parse(n.created_at),updatedAt:Date.parse(n.updated_at)})),transactions:(tx.data||[]).map(t=>({id:t.id,description:t.description,category:t.category,amount:(t.type==="out"?-1:1)*Number(t.amount_cents),createdAt:Date.parse(t.created_at),updatedAt:Date.parse(t.updated_at)})),favorites:(favs.data||[]).map(x=>x.tool_id),usage:Object.fromEntries((usage.data||[]).map(x=>[x.tool_id,Number(x.access_count)]))}
}
async function mirror(table,rows,owner){
 const current=await neon.from(table).select("id");if(current.error)throw current.error;
 const ids=new Set((current.data||[]).map(x=>x.id));
 for(const row of rows){
  if(ids.has(row.id)){const {id,...patch}=row;const r=await neon.from(table).update(patch).eq("id",id);if(r.error)throw r.error;ids.delete(id)}
  else {const r=await neon.from(table).insert(row);if(r.error)throw r.error}
 }
 for(const id of ids){const r=await neon.from(table).delete().eq("id",id);if(r.error)throw r.error}
}
export async function pushCloud(snapshot){
 const s=await getSession();if(!s)return false;const owner=s.user.id;
 const notes=(snapshot.notes||[]).map(n=>noteRow(n,owner)),transactions=(snapshot.transactions||[]).map(t=>txRow(t,owner));
 await mirror("notes",notes,owner);await mirror("transactions",transactions,owner);
 const fr=await neon.from("favorites").select("tool_id");if(fr.error)throw fr.error;
 const remoteFav=new Set((fr.data||[]).map(x=>x.tool_id)),localFav=new Set(snapshot.favorites||[]);
 for(const id of localFav)if(!remoteFav.has(id)){const r=await neon.from("favorites").insert({owner_id:owner,tool_id:id});if(r.error)throw r.error}
 for(const id of remoteFav)if(!localFav.has(id)){const r=await neon.from("favorites").delete().eq("tool_id",id);if(r.error)throw r.error}
 const ur=await neon.from("tool_usage").select("tool_id");if(ur.error)throw ur.error;const remoteUsage=new Set((ur.data||[]).map(x=>x.tool_id));
 for(const [id,count] of Object.entries(snapshot.usage||{})){const row={owner_id:owner,tool_id:id,access_count:Number(count)||0,last_accessed_at:new Date().toISOString()};const r=remoteUsage.has(id)?await neon.from("tool_usage").update(row).eq("tool_id",id):await neon.from("tool_usage").insert(row);if(r.error)throw r.error}
 return true
}
export async function cloudCounts(){
 const s=await getSession();if(!s)return null;
 const [n,t,f,u]=await Promise.all([
  neon.from("notes").select("id"),
  neon.from("transactions").select("id"),
  neon.from("favorites").select("tool_id"),
  neon.from("tool_usage").select("tool_id")
 ]);
 for(const r of [n,t,f,u])if(r.error)throw r.error;
 return {notes:n.data?.length||0,transactions:t.data?.length||0,favorites:f.data?.length||0,usage:u.data?.length||0}
}

export async function getProfile(){
 const s=await getSession();if(!s)return null;const r=await neon.from("profiles").select("*").eq("auth_user_id",s.user.id).maybeSingle();if(r.error)throw r.error;return r.data
}
export async function saveProfile(input={}){
 const s=await getSession();if(!s)throw new Error("Sessão necessária");const row={auth_user_id:s.user.id,display_name:(input.display_name||"").trim()||s.user.name||"",avatar_url:(input.avatar_url||"").trim()||null};
 const current=await neon.from("profiles").select("id").eq("auth_user_id",s.user.id).maybeSingle();if(current.error)throw current.error;
 const r=current.data?await neon.from("profiles").update(row).eq("auth_user_id",s.user.id).select("*").single():await neon.from("profiles").insert(row).select("*").single();if(r.error)throw r.error;return r.data
}
export async function listWorkspaces(){const s=await getSession();if(!s)return[];const r=await neon.from("workspaces").select("*").order("updated_at",{ascending:false});if(r.error)throw r.error;return r.data||[]}
export async function saveWorkspace(input={}){
 const s=await getSession();if(!s)throw new Error("Sessão necessária");const name=(input.name||"").trim();if(!name)throw new Error("Nome obrigatório");const slug=(input.slug||name).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,64)||"workspace";
 const row={owner_id:s.user.id,name,slug};let r;if(input.id)r=await neon.from("workspaces").update(row).eq("id",input.id).select("*").single();else r=await neon.from("workspaces").insert(row).select("*").single();if(r.error)throw r.error;return r.data
}
export async function deleteWorkspace(id){const r=await neon.from("workspaces").delete().eq("id",id);if(r.error)throw r.error}
export async function listCloudProjects(){const s=await getSession();if(!s)return[];const r=await neon.from("projects").select("*").order("updated_at",{ascending:false});if(r.error)throw r.error;return r.data||[]}
export async function saveCloudProject(input={}){
 const s=await getSession();if(!s)throw new Error("Sessão necessária");const row={owner_id:s.user.id,workspace_id:input.workspace_id||null,name:(input.name||"").trim(),description:(input.description||"").trim(),status:input.status||"active",links:Array.isArray(input.links)?input.links:[]};if(!row.name)throw new Error("Nome obrigatório");const r=input.id?await neon.from("projects").update(row).eq("id",input.id).select("*").single():await neon.from("projects").insert(row).select("*").single();if(r.error)throw r.error;return r.data
}
export async function deleteCloudProject(id){const r=await neon.from("projects").delete().eq("id",id);if(r.error)throw r.error}
export async function listActivity(){const s=await getSession();if(!s)return[];const r=await neon.from("activity_logs").select("*").order("created_at",{ascending:false}).limit(100);if(r.error)throw r.error;return r.data||[]}
export async function addActivity(module,action,label="",metadata={}){const s=await getSession();if(!s)return;const r=await neon.from("activity_logs").insert({owner_id:s.user.id,module,action,label,metadata});if(r.error)throw r.error}

export async function listFlows(){const s=await getSession();if(!s)return[];const r=await neon.from("flows").select("*").order("updated_at",{ascending:false});if(r.error)throw r.error;return r.data||[]}
export async function saveFlowDocument(flow){
 const s=await getSession();if(!s?.user?.id)throw new Error("Sessão indisponível para sincronizar o fluxo");
 const row={owner_id:s.user.id,name:flow.name||"Sem título",document:{nodes:flow.nodes||[],edges:flow.edges||[]}};
 if(validUuid(flow.id)){
  const updated=await neon.from("flows").update(row).eq("id",flow.id).eq("owner_id",s.user.id).select("*").maybeSingle();
  if(updated.error)throw updated.error;
  if(updated.data)return updated.data;
 }
 const created=await neon.from("flows").insert(row).select("*").single();
 if(created.error)throw created.error;
 return created.data
}
export async function deleteFlowDocument(id){if(!validUuid(id))return;const r=await neon.from("flows").delete().eq("id",id);if(r.error)throw r.error}

export async function listSettings(){const s=await getSession();if(!s)return{};const r=await neon.from("user_settings").select("settings").eq("owner_id",s.user.id).maybeSingle();if(r.error)throw r.error;return r.data?.settings||{}}
export async function saveSettings(settings){const s=await getSession();if(!s)return;const row={owner_id:s.user.id,settings,updated_at:new Date().toISOString()};const cur=await neon.from("user_settings").select("owner_id").eq("owner_id",s.user.id).maybeSingle();if(cur.error)throw cur.error;const r=cur.data?await neon.from("user_settings").update(row).eq("owner_id",s.user.id):await neon.from("user_settings").insert(row);if(r.error)throw r.error}
export async function migrateProjects(seed=[]){const s=await getSession();if(!s)return[];const current=await listCloudProjects();if(current.length)return current;for(const p of seed){const r=await neon.from("projects").insert({owner_id:s.user.id,name:p.name,description:p.description||"",status:(p.status||"").toLowerCase().includes("operacional")?"active":"active",links:(p.links||[]).map(([label,url])=>({label,url}))});if(r.error)throw r.error}return listCloudProjects()}
export async function requestPasswordReset(email,redirectTo=location.href){const r=await auth.requestPasswordReset({email,redirectTo});if(r?.error)throw r.error;return r?.data}
