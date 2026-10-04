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

let sessionCache=null,familyContextCache=null;export async function getSession(){if(sessionCache)return sessionCache;const {data,error}=await auth.getSession();if(error)throw error;sessionCache=data?.session?data:null;return sessionCache}
export async function signIn(email,password){const r=await auth.signIn.email({email,password,rememberMe:true});if(r.error)throw r.error;sessionCache=null;familyContextCache=null;return r.data}
export async function signUp(name,email,password){const r=await auth.signUp.email({name,email,password});if(r.error)throw r.error;sessionCache=null;familyContextCache=null;return r.data}
export async function signOut(){const r=await auth.signOut();sessionCache=null;familyContextCache=null;if(r?.error)throw r.error}

const iso=n=>new Date(n||Date.now()).toISOString();
const validUuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v||"");
const uuid=()=>crypto.randomUUID();
export const makeCloudId=uuid;

function noteRow(n,owner){
 return {id:n.id,owner_id:owner,title:n.title||"",body:n.body||"",type:["book","event","concept","project","moc"].includes(n.type)?n.type:"concept",properties:n.properties&&typeof n.properties==="object"?n.properties:{},tags:Array.isArray(n.tags)?n.tags:[],pinned:!!n.pinned,favorite:!!n.favorite,created_at:iso(n.createdAt),updated_at:iso(n.updatedAt||n.createdAt)}
}
async function txRow(t,owner){
 const amount=Math.abs(Number(t.amount||0));const isFamily=t.financeScope!=="business"&&t.personalScope==="family";const family=isFamily?await getFamilyFinanceContext(true):null;if(isFamily&&!family?.id)throw new Error("Workspace familiar não encontrado. Sincronize o Workspace Família antes de salvar.");
 return {id:t.id,owner_id:owner,family_id:family?.id||null,description:t.description||"",category:t.category||"Geral",type:Number(t.amount)>=0?"in":"out",amount_cents:amount,occurred_on:new Date(t.createdAt||Date.now()).toISOString().slice(0,10),finance_scope:t.financeScope==="business"?"business":"personal",finance_entity_id:t.financeEntityId||null,counterparty:t.counterparty||null,finance_member_id:isFamily?(t.financeMemberId||family?.members?.find(m=>m.isMe)?.id||null):(t.financeMemberId||null),finance_account_id:t.financeAccountId||null,personal_scope:isFamily?"family":"individual",status:["paid","pending","overdue","cancelled"].includes(t.status)?t.status:"paid",recurrence:t.recurrence||null,due_on:t.dueOn||null,attachment_url:t.attachmentUrl||null,split_group_id:t.splitGroupId||null,notes:t.notes||null,metadata:t.metadata&&typeof t.metadata==="object"?t.metadata:{},created_at:iso(t.createdAt),updated_at:iso(t.updatedAt||t.createdAt)}
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
 return {user:s.user,notes:(notes.data||[]).map(n=>({id:n.id,title:n.title,body:n.body,type:n.type||"concept",properties:n.properties||{},tags:n.tags||[],pinned:n.pinned,favorite:n.favorite,createdAt:Date.parse(n.created_at),updatedAt:Date.parse(n.updated_at)})),transactions:(tx.data||[]).map(t=>({id:t.id,description:t.description,category:t.category,amount:(t.type==="out"?-1:1)*Number(t.amount_cents),financeScope:t.finance_scope||"personal",financeEntityId:t.finance_entity_id||null,counterparty:t.counterparty||"",financeMemberId:t.finance_member_id||null,financeAccountId:t.finance_account_id||null,personalScope:t.personal_scope||"individual",familyId:t.family_id||null,ownerId:t.owner_id||null,status:t.status||"paid",recurrence:t.recurrence||null,dueOn:t.due_on||null,attachmentUrl:t.attachment_url||null,splitGroupId:t.split_group_id||null,notes:t.notes||"",metadata:t.metadata||{},createdAt:Date.parse(t.created_at),updatedAt:Date.parse(t.updated_at)})),favorites:(favs.data||[]).map(x=>x.tool_id),usage:Object.fromEntries((usage.data||[]).map(x=>[x.tool_id,Number(x.access_count)]))}
}
async function upsertRows(table,rows){
 for(const row of rows){
  const exists=await neon.from(table).select("id").eq("id",row.id).maybeSingle();if(exists.error)throw exists.error;
  const r=exists.data?await neon.from(table).update(row).eq("id",row.id):await neon.from(table).insert(row);if(r.error)throw r.error
 }
}
export async function pushCloud(snapshot){
 const s=await getSession();if(!s)return false;const owner=s.user.id;
 const notes=(snapshot.notes||[]).map(n=>noteRow(n,owner)),ownTransactions=(snapshot.transactions||[]).filter(t=>!t.ownerId||t.ownerId===owner),transactions=await Promise.all(ownTransactions.map(t=>txRow(t,owner)));
 await upsertRows("notes",notes);await upsertRows("transactions",transactions);
 const fr=await neon.from("favorites").select("tool_id");if(fr.error)throw fr.error;const remoteFav=new Set((fr.data||[]).map(x=>x.tool_id));
 for(const id of snapshot.favorites||[])if(!remoteFav.has(id)){const r=await neon.from("favorites").insert({owner_id:owner,tool_id:id});if(r.error)throw r.error}
 const ur=await neon.from("tool_usage").select("tool_id");if(ur.error)throw ur.error;const remoteUsage=new Set((ur.data||[]).map(x=>x.tool_id));
 for(const [id,count] of Object.entries(snapshot.usage||{})){const row={owner_id:owner,tool_id:id,access_count:Number(count)||0,last_accessed_at:new Date().toISOString()};const r=remoteUsage.has(id)?await neon.from("tool_usage").update(row).eq("tool_id",id):await neon.from("tool_usage").insert(row);if(r.error)throw r.error}
 return true
}
export async function saveFinanceTransaction(transaction){const s=await getSession();if(!s)throw new Error("Sessão necessária");const row=await txRow(transaction,s.user.id);await upsertRows("transactions",[row]);return true}
export async function deleteCloudRecord(table,id){if(!["notes","transactions"].includes(table)||!validUuid(id))return false;const s=await getSession();if(!s)return false;const r=await neon.from(table).delete().eq("id",id).eq("owner_id",s.user.id);if(r.error)throw r.error;return true}
export async function deleteCloudFavorite(toolId){const s=await getSession();if(!s)return false;const r=await neon.from("favorites").delete().eq("owner_id",s.user.id).eq("tool_id",toolId);if(r.error)throw r.error;return true}
export async function replaceCloudFavorites(toolIds=[]){const s=await getSession();if(!s)return false;const cur=await neon.from("favorites").select("tool_id");if(cur.error)throw cur.error;const remote=new Set((cur.data||[]).map(x=>x.tool_id)),local=new Set(toolIds);for(const id of local)if(!remote.has(id)){const r=await neon.from("favorites").insert({owner_id:s.user.id,tool_id:id});if(r.error)throw r.error}for(const id of remote)if(!local.has(id)){const r=await neon.from("favorites").delete().eq("owner_id",s.user.id).eq("tool_id",id);if(r.error)throw r.error}return true}

export async function saveKnowledgeNote(note){const s=await getSession();if(!s)throw new Error("Sessão necessária");if(!note?.id||!note?.title)throw new Error("Nota inválida");await upsertRows("notes",[noteRow(note,s.user.id)]);return note}
export async function syncNoteLinks(noteId,titles=[]){const s=await getSession();if(!s)throw new Error("Sessão necessária");if(!validUuid(noteId))throw new Error("ID de nota inválido");const clean=[...new Set((titles||[]).map(x=>String(x).trim().toLocaleLowerCase()).filter(Boolean))];const all=await neon.from("notes").select("id,title").neq("id",noteId);if(all.error)throw all.error;const targets=(all.data||[]).filter(n=>clean.includes((n.title||"").trim().toLocaleLowerCase()));const del=await neon.from("note_links").delete().eq("source_note_id",noteId).eq("owner_id",s.user.id);if(del.error)throw del.error;for(const target of targets){const r=await neon.from("note_links").insert({owner_id:s.user.id,source_note_id:noteId,target_note_id:target.id});if(r.error)throw r.error}return targets}
export async function getNoteBacklinks(noteId){const s=await getSession();if(!s)return[];const lr=await neon.from("note_links").select("source_note_id").eq("target_note_id",noteId);if(lr.error)throw lr.error;const ids=[...new Set((lr.data||[]).map(x=>x.source_note_id))];if(!ids.length)return[];const nr=await neon.from("notes").select("id,title,type,tags,updated_at").in("id",ids);if(nr.error)throw nr.error;return nr.data||[]}
export async function getKnowledgeGraph(){const s=await getSession();if(!s)return{nodes:[],links:[]};const [nr,lr]=await Promise.all([neon.from("notes").select("id,title,type,tags"),neon.from("note_links").select("source_note_id,target_note_id")]);if(nr.error)throw nr.error;if(lr.error)throw lr.error;return{nodes:(nr.data||[]).map(n=>({id:n.id,title:n.title||"Sem título",type:n.type||"concept",tags:n.tags||[]})),links:(lr.data||[]).map(l=>({source:l.source_note_id,target:l.target_note_id}))}}
export async function searchKnowledgeNotes(query=""){const s=await getSession();if(!s)return[];const q=String(query).trim();let req=neon.from("notes").select("id,title,body,type,tags,properties,created_at,updated_at").order("updated_at",{ascending:false}).limit(100);if(q)req=req.or("title.ilike.%"+q.replace(/[%_,]/g,"")+"%,body.ilike.%"+q.replace(/[%_,]/g,"")+"%");const r=await req;if(r.error)throw r.error;return r.data||[]}
export async function listFinanceEntities(){const s=await getSession();if(!s)return[];const r=await neon.from("finance_entities").select("*").order("kind").order("name");if(r.error)throw r.error;return(r.data||[]).map(x=>({id:x.id,kind:x.kind,name:x.name,document:x.document||"",isDefault:!!x.is_default,metadata:x.metadata||{},createdAt:Date.parse(x.created_at),updatedAt:Date.parse(x.updated_at)}))}
export async function saveFinanceEntity(entity){const s=await getSession();if(!s)throw new Error("Sessão necessária");const row={owner_id:s.user.id,kind:entity.kind==="business"?"business":"personal",name:String(entity.name||"").trim(),document:entity.kind==="business"?String(entity.document||"").replace(/\D/g,"")||null:null,is_default:!!entity.isDefault,metadata:entity.metadata||{},updated_at:new Date().toISOString()};if(!row.name)throw new Error("Nome obrigatório");if(entity.id){const r=await neon.from("finance_entities").update(row).eq("id",entity.id).eq("owner_id",s.user.id).select("*").single();if(r.error)throw r.error;return r.data}const r=await neon.from("finance_entities").insert(row).select("*").single();if(r.error)throw r.error;return r.data}
export async function deleteFinanceEntity(id){const s=await getSession();if(!s)return false;const r=await neon.from("finance_entities").delete().eq("id",id).eq("owner_id",s.user.id);if(r.error)throw r.error;return true}
export async function getFamilyFinanceContext(force=false){const s=await getSession();if(!s)return null;if(familyContextCache&&!force)return familyContextCache;const me=await neon.from("finance_members").select("id,family_id,owner_id").eq("linked_auth_user_id",s.user.id).eq("active",true).maybeSingle();if(me.error)throw me.error;let familyId=me.data?.family_id||null,ownerId=me.data?.owner_id||null;if(!familyId){const mine=await neon.from("finance_families").select("id,owner_id").eq("owner_id",s.user.id).maybeSingle();if(mine.error)throw mine.error;familyId=mine.data?.id||null;ownerId=mine.data?.owner_id||s.user.id}if(!familyId)return null;const mr=await neon.from("finance_members").select("*").eq("family_id",familyId).eq("active",true).order("created_at",{ascending:true});if(mr.error)throw mr.error;familyContextCache={id:familyId,ownerId,members:(mr.data||[]).map(x=>({id:x.id,ownerId:x.owner_id,name:x.name,relationship:x.relationship||"",linkedAuthUserId:x.linked_auth_user_id||null,colorKey:x.color_key||"",active:x.active,isMe:x.linked_auth_user_id===s.user.id,isOwner:x.linked_auth_user_id===ownerId}))};return familyContextCache}
export async function listFinanceMembers(){const ctx=await getFamilyFinanceContext();return ctx?.members||[]}
export async function saveFinanceMember(member){const s=await getSession();if(!s)throw new Error("Sessão necessária");const row={owner_id:s.user.id,name:String(member.name||"").trim(),relationship:String(member.relationship||"").trim()||null,color_key:member.colorKey||null,active:true,updated_at:new Date().toISOString()};if(!row.name)throw new Error("Nome obrigatório");if(member.id){const r=await neon.from("finance_members").update(row).eq("id",member.id).eq("owner_id",s.user.id).select("*").single();if(r.error)throw r.error;return r.data}const r=await neon.from("finance_members").insert(row).select("*").single();if(r.error)throw r.error;return r.data}
export async function deleteFinanceMember(id){const s=await getSession();if(!s)return false;const r=await neon.from("finance_members").update({active:false,updated_at:new Date().toISOString()}).eq("id",id).eq("owner_id",s.user.id);if(r.error)throw r.error;return true}
export async function listFinanceAccounts(){const s=await getSession();if(!s)return[];const r=await neon.from("finance_accounts").select("*").eq("active",true).order("name");if(r.error)throw r.error;return(r.data||[]).map(x=>({id:x.id,memberId:x.member_id||null,name:x.name,type:x.account_type,ownership:x.ownership,openingBalance:Number(x.opening_balance_cents)||0,metadata:x.metadata||{}}))}
export async function saveFinanceAccount(account){const s=await getSession();if(!s)throw new Error("Sessão necessária");const allowed=["checking","savings","cash","investment","credit","other"],row={owner_id:s.user.id,member_id:account.memberId||null,name:String(account.name||"").trim(),account_type:allowed.includes(account.type)?account.type:"checking",ownership:account.ownership==="shared"?"shared":"individual",opening_balance_cents:Number(account.openingBalance)||0,metadata:account.metadata||{},active:true,updated_at:new Date().toISOString()};if(!row.name)throw new Error("Nome obrigatório");const r=account.id?await neon.from("finance_accounts").update(row).eq("id",account.id).eq("owner_id",s.user.id).select("*").single():await neon.from("finance_accounts").insert(row).select("*").single();if(r.error)throw r.error;return r.data}
export async function deleteFinanceAccount(id){const s=await getSession();if(!s)return false;const r=await neon.from("finance_accounts").update({active:false,updated_at:new Date().toISOString()}).eq("id",id).eq("owner_id",s.user.id);if(r.error)throw r.error;return true}
export async function createFinanceInvite(input,emailLegacy=""){const s=await getSession();if(!s)throw new Error("Sessão necessária");const data=typeof input==="object"?input:{memberId:input,email:emailLegacy};const memberId=data.memberId||null,email=String(data.email||"").trim().toLowerCase(),name=String(data.name||"").trim(),relationship=String(data.relationship||"").trim();if(!email)throw new Error("Informe o e-mail da pessoa");if(memberId){const member=await neon.from("finance_members").select("id").eq("id",memberId).eq("owner_id",s.user.id).maybeSingle();if(member.error)throw member.error;if(!member.data)throw new Error("Pessoa não encontrada")}let revoke=neon.from("finance_invites").update({status:"revoked"}).eq("owner_id",s.user.id).eq("status","pending");revoke=memberId?revoke.eq("member_id",memberId):revoke.eq("email",email);await revoke;const payload={owner_id:s.user.id,email,invited_name:name||null,invited_relationship:relationship||null};if(memberId)payload.member_id=memberId;const r=await neon.from("finance_invites").insert(payload).select("*").single();if(r.error)throw r.error;return{id:r.data.id,token:r.data.token,status:r.data.status,expiresAt:r.data.expires_at,email:r.data.email||"",name:r.data.invited_name||name,relationship:r.data.invited_relationship||relationship}}
export async function listFinanceInvites(){const s=await getSession();if(!s)return[];const r=await neon.from("finance_invites").select("*").eq("owner_id",s.user.id).order("created_at",{ascending:false});if(r.error)throw r.error;return(r.data||[]).map(x=>({id:x.id,memberId:x.member_id||null,email:x.email||"",name:x.invited_name||"",relationship:x.invited_relationship||"",token:x.token,status:x.status,expiresAt:x.expires_at,acceptedBy:x.accepted_by||null}))}
export async function reconcileFamilyMemberships(){const s=await getSession();if(!s)return{repaired:0};const [inv,members]=await Promise.all([neon.from("finance_invites").select("*").eq("owner_id",s.user.id).eq("status","accepted"),neon.from("finance_members").select("*").eq("owner_id",s.user.id).eq("active",true)]);if(inv.error)throw inv.error;if(members.error)throw members.error;let repaired=0;for(const i of inv.data||[]){if(!i.accepted_by)continue;let m=(members.data||[]).find(x=>x.id===i.member_id)|| (members.data||[]).find(x=>String(x.name||"").trim().toLowerCase()===String(i.invited_name||"").trim().toLowerCase());if(!m)continue;if(m.linked_auth_user_id!==i.accepted_by){const u=await neon.from("finance_members").update({linked_auth_user_id:i.accepted_by,updated_at:new Date().toISOString()}).eq("id",m.id).eq("owner_id",s.user.id);if(u.error)throw u.error;repaired++}if(i.member_id!==m.id){const u=await neon.from("finance_invites").update({member_id:m.id}).eq("id",i.id).eq("owner_id",s.user.id);if(u.error)throw u.error}}familyContextCache=null;return{repaired}}
export async function getFinanceInvite(token){const s=await getSession();if(!s)return null;const r=await neon.from("finance_invites").select("*").eq("token",token).eq("status","pending").maybeSingle();if(r.error)throw r.error;return r.data||null}
export async function acceptFinanceInvite(token){const s=await getSession();if(!s)throw new Error("Faça login antes de aceitar o convite");const r=await neon.rpc("family_invite_accept",{p_token:token});if(r.error)throw new Error(r.error.message||"Falha ao aceitar convite");const data=Array.isArray(r.data)?r.data[0]:r.data;if(!data?.id)throw new Error("Convite inválido ou expirado");return data}
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

export async function getInfrastructureStatus(){const s=await getSession();if(!s)return null;const r=await neon.rpc("app_infrastructure_status");if(r.error)throw r.error;return r.data||null}

export async function getCurrentModuleAccess(){const s=await getSession();if(!s)return null;const r=await neon.rpc("current_module_access");if(r.error)throw r.error;return r.data||null}
export async function adminListUsers(){const s=await getSession();if(!s)return[];const r=await neon.rpc("admin_list_users");if(r.error)throw r.error;return r.data||[]}
export async function adminSetUserAccess(userId,modules,active=true,role="user"){const s=await getSession();if(!s)throw new Error("Sessão necessária");const r=await neon.rpc("admin_set_user_access",{p_user_id:userId,p_modules:modules,p_active:active,p_role:role});if(r.error)throw r.error;if(r.data?.ok===false)throw new Error(r.data.error||"Acesso negado");return r.data}

export async function listToolCockpitSnapshot(since=null){
 const s=await getSession();if(!s)return null;const after=q=>since?q.gt("updated_at",since):q;
 const [tools,stacks,quickLinks,checklists,knowledge]=await Promise.all([
  after(neon.from("tool_catalog").select("*,tool_categories(name,slug),tool_tag_links(tool_tags(name,slug))").is("deleted_at",null)),
  after(neon.from("tool_stacks").select("*,tool_stack_items(tool_id,position)").is("deleted_at",null)),
  after(neon.from("tool_quick_links").select("id,tool_id,label,url,type,updated_at").is("deleted_at",null)),
  after(neon.from("tool_checklist_templates").select("id,tool_id,title,description,updated_at,tool_checklist_items(id,label,position)").is("deleted_at",null)),
  after(neon.from("tool_knowledge_entries").select("id,tool_id,title,error_code,tags,updated_at").is("deleted_at",null))
 ]);
 for(const r of [tools,stacks,quickLinks,checklists,knowledge])if(r.error)throw r.error;
 return{userId:s.user.id,tools:tools.data||[],stacks:stacks.data||[],quickLinks:quickLinks.data||[],checklists:checklists.data||[],knowledge:knowledge.data||[],serverTime:new Date().toISOString()}
}
export async function getToolKnowledgeEntry(id){const s=await getSession();if(!s)return null;const r=await neon.from("tool_knowledge_entries").select("id,tool_id,title,body,error_code,tags,updated_at").eq("id",id).maybeSingle();if(r.error)throw r.error;return r.data||null}

export async function searchToolKnowledge(query,limit=30){const s=await getSession();if(!s)return[];const q=String(query||"").trim().replace(/[,%()]/g," ");if(!q)return[];const pattern="%"+q+"%";const r=await neon.from("tool_knowledge_entries").select("id,tool_id,title,error_code,tags,updated_at").is("deleted_at",null).or(`title.ilike.${pattern},body.ilike.${pattern},error_code.ilike.${pattern}`).order("updated_at",{ascending:false}).limit(limit);if(r.error)throw r.error;return r.data||[]}

export async function saveToolKnowledgeEntry(entry){
 const s=await getSession();if(!s)throw new Error("Sessão necessária");
 const row={id:entry.id||makeCloudId(),owner_id:s.user.id,tool_id:entry.toolId||null,title:entry.title?.trim()||"Sem título",body:entry.body||"",error_code:entry.errorCode?.trim()||null,tags:(entry.tags||[]).map(x=>String(x).trim().toLowerCase()).filter(Boolean),updated_at:new Date().toISOString()};
 const r=await neon.from("tool_knowledge_entries").upsert(row,{onConflict:"id"}).select("*").single();if(r.error)throw r.error;return r.data
}
export async function deleteToolKnowledgeEntry(id){const s=await getSession();if(!s)throw new Error("Sessão necessária");const r=await neon.from("tool_knowledge_entries").update({deleted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);if(r.error)throw r.error}
export async function saveToolChecklistTemplate(input){
 const s=await getSession();if(!s)throw new Error("Sessão necessária");const id=input.id||makeCloudId();
 const r=await neon.from("tool_checklist_templates").upsert({id,owner_id:s.user.id,tool_id:input.toolId||null,title:input.title?.trim()||"Checklist",description:input.description||"",updated_at:new Date().toISOString()},{onConflict:"id"});if(r.error)throw r.error;
 const old=await neon.from("tool_checklist_items").delete().eq("template_id",id);if(old.error)throw old.error;
 const items=(input.items||[]).map((label,position)=>({id:makeCloudId(),template_id:id,label:String(label).trim(),position})).filter(x=>x.label);if(items.length){const ir=await neon.from("tool_checklist_items").insert(items);if(ir.error)throw ir.error}return id
}
export async function startToolChecklist(templateId){
 const s=await getSession();if(!s)throw new Error("Sessão necessária");const r=await neon.from("tool_checklist_runs").insert({id:makeCloudId(),owner_id:s.user.id,template_id:templateId}).select("*").single();if(r.error)throw r.error;
 const items=await neon.from("tool_checklist_items").select("id").eq("template_id",templateId);if(items.error)throw items.error;if(items.data?.length){const x=await neon.from("tool_checklist_run_items").insert(items.data.map(i=>({run_id:r.data.id,item_id:i.id,completed:false})));if(x.error)throw x.error}return r.data
}
export async function setToolChecklistItem(runId,itemId,completed){const r=await neon.from("tool_checklist_run_items").update({completed:!!completed,completed_at:completed?new Date().toISOString():null}).eq("run_id",runId).eq("item_id",itemId);if(r.error)throw r.error}
export async function saveToolQuickLink(input){const s=await getSession();if(!s)throw new Error("Sessão necessária");const row={id:input.id||makeCloudId(),owner_id:s.user.id,tool_id:input.toolId||null,label:input.label?.trim()||"Link",url:input.url,type:["iso","driver","installer","other"].includes(input.type)?input.type:"other",updated_at:new Date().toISOString()};const r=await neon.from("tool_quick_links").upsert(row,{onConflict:"id"}).select("*").single();if(r.error)throw r.error;return r.data}

export async function listVaultItems(){const s=await getSession();if(!s)return[];const r=await neon.from("tool_vault_items").select("id,ciphertext,iv,salt,kdf,kdf_iterations,created_at,updated_at").is("deleted_at",null).order("updated_at",{ascending:false});if(r.error)throw r.error;return r.data||[]}
export async function saveVaultItem(input){const s=await getSession();if(!s)throw new Error("Sessão necessária");const row={id:input.id||makeCloudId(),owner_id:s.user.id,ciphertext:input.ciphertext,iv:input.iv,salt:input.salt,kdf:"PBKDF2-SHA256",kdf_iterations:input.iterations||310000,updated_at:new Date().toISOString()};const r=await neon.from("tool_vault_items").upsert(row,{onConflict:"id"}).select("id,updated_at").single();if(r.error)throw r.error;return r.data}
export async function deleteVaultItem(id){const r=await neon.from("tool_vault_items").update({deleted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);if(r.error)throw r.error}
export async function logVaultAccess(itemId,action){const s=await getSession();if(!s)return;const r=await neon.from("tool_vault_audit").insert({owner_id:s.user.id,vault_item_id:itemId||null,action:String(action||"access").slice(0,80)});if(r.error)console.warn("Vault audit:",r.error)}
export async function listVaultAudit(limit=50){const s=await getSession();if(!s)return[];const r=await neon.from("tool_vault_audit").select("id,vault_item_id,action,created_at").order("created_at",{ascending:false}).limit(limit);if(r.error)throw r.error;return r.data||[]}
export async function listServiceOrders(){const s=await getSession();if(!s)return[];const r=await neon.from("tool_service_orders").select("*,tool_service_order_items(*)").is("deleted_at",null).order("created_at",{ascending:false});if(r.error)throw r.error;return r.data||[]}
export async function saveServiceOrder(input){const s=await getSession();if(!s)throw new Error("Sessão necessária");const id=input.id||makeCloudId(),row={id,owner_id:s.user.id,customer_name:input.customerName?.trim()||"Cliente",customer_contact:input.customerContact?.trim()||null,equipment:input.equipment?.trim()||"",problem:input.problem||"",actions_performed:input.actionsPerformed||"",status:["open","in_progress","waiting","done","delivered","cancelled"].includes(input.status)?input.status:"open",notes:input.notes||"",updated_at:new Date().toISOString()};const r=await neon.from("tool_service_orders").upsert(row,{onConflict:"id"});if(r.error)throw r.error;const d=await neon.from("tool_service_order_items").delete().eq("service_order_id",id);if(d.error)throw d.error;const items=(input.items||[]).filter(x=>x.description?.trim()).map((x,position)=>({id:makeCloudId(),service_order_id:id,description:x.description.trim(),quantity:Number(x.quantity)||1,unit_price:Number(x.unitPrice)||0,position}));if(items.length){const ir=await neon.from("tool_service_order_items").insert(items);if(ir.error)throw ir.error}return id}
export async function deleteServiceOrder(id){const r=await neon.from("tool_service_orders").update({deleted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);if(r.error)throw r.error}
export async function listToolStacks(){const s=await getSession();if(!s)return[];const r=await neon.from("tool_stacks").select("*,tool_stack_items(tool_id,position)").is("deleted_at",null).order("updated_at",{ascending:false});if(r.error)throw r.error;return r.data||[]}
export async function saveToolStack(input){const s=await getSession();if(!s)throw new Error("Sessão necessária");const id=input.id||makeCloudId(),row={id,owner_id:s.user.id,name:input.name?.trim()||"Workspace",description:input.description||"",updated_at:new Date().toISOString()};const r=await neon.from("tool_stacks").upsert(row,{onConflict:"id"});if(r.error)throw r.error;const d=await neon.from("tool_stack_items").delete().eq("stack_id",id);if(d.error)throw d.error;const items=[...new Set(input.toolIds||[])].map((tool_id,position)=>({stack_id:id,tool_id,position}));if(items.length){const ir=await neon.from("tool_stack_items").insert(items);if(ir.error)throw ir.error}return id}
export async function deleteToolStack(id){const r=await neon.from("tool_stacks").update({deleted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);if(r.error)throw r.error}

export async function listToolCategories(){const s=await getSession();if(!s)return[];const r=await neon.from("tool_categories").select("id,name,slug,position").is("deleted_at",null).order("position");if(r.error)throw r.error;return r.data||[]}
export async function saveCustomTool(input){const s=await getSession();if(!s)throw new Error("Sessão necessária");const id=input.id||("custom-"+crypto.randomUUID()),cycle=["monthly","annual","none"].includes(input.billingCycle)?input.billingCycle:"none",cost=input.saasCost===""||input.saasCost==null?null:Number(input.saasCost),currency=input.currency?String(input.currency).trim().toUpperCase():null;const row={id,owner_id:s.user.id,name:input.name?.trim()||"Ferramenta",normalized_name:(input.name?.trim()||"Ferramenta").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase(),category_id:Number(input.categoryId),description:input.description||"",kind:["custom_link","internal_system"].includes(input.kind)?input.kind:"custom_link",launch_url:input.launchUrl?.trim()||null,login_url:input.loginUrl?.trim()||null,icon:input.icon?.trim()||null,saas_cost:Number.isFinite(cost)?cost:null,currency:currency||null,billing_cycle:cycle,updated_at:new Date().toISOString(),deleted_at:null};const r=await neon.from("tool_catalog").upsert(row,{onConflict:"id"}).select("*").single();if(r.error)throw r.error;return r.data}
export async function deleteCustomTool(id){const s=await getSession();if(!s)throw new Error("Sessão necessária");const r=await neon.from("tool_catalog").update({deleted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id).eq("owner_id",s.user.id);if(r.error)throw r.error}
