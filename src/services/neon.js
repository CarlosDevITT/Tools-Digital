import { createClient } from "https://esm.sh/@neondatabase/neon-js@0.7.0-beta?bundle";

const NEON_URL="https://ep-shy-hall-b4tnu7jl.c-6.us-east-2.aws.neon.tech/neondb";
export const neon=createClient(NEON_URL);

export async function getSession(){const {data,error}=await neon.auth.getSession();if(error)throw error;return data?.session?data:null}
export async function signIn(email,password){const r=await neon.auth.signIn.email({email,password,rememberMe:true});if(r.error)throw r.error;return r.data}
export async function signUp(name,email,password){const r=await neon.auth.signUp.email({name,email,password});if(r.error)throw r.error;return r.data}
export async function signOut(){const r=await neon.auth.signOut();if(r?.error)throw r.error}

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