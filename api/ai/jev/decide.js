// Vercel serverless endpoint: JEV protocol powered by OpenAI Responses API.
// Requires OPENAI_API_KEY only on the server.
const schema={type:"object",additionalProperties:false,properties:{route:{type:"string"},priority:{type:"string",enum:["low","normal","high","critical"]},quality_score:{type:"number",minimum:0,maximum:100},safe_to_continue:{type:"boolean"},confidence:{type:"number",minimum:0,maximum:1},reason:{type:"string"},next_action:{type:"string"}},required:["route","priority","quality_score","safe_to_continue","confidence","reason","next_action"]};
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"method_not_allowed"});
 if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:"openai_not_configured"});
 const body=req.body||{},agents=Array.isArray(body.agents)?body.agents:[],task=body.task||{};
 const routes=[...agents.map(a=>a.name).filter(Boolean),"human_review"];
 const system="Você é o motor JEV do Tools Digital. Tome decisões operacionais estruturadas. Choice=route/priority; Score=quality_score/confidence; Noul=safe_to_continue. Ações de alto impacto (financeiro, credenciais, exclusão, publicação, envio externo, produção ou dados sensíveis) exigem human_review. Nunca alegue ter executado ferramenta. Responda somente no schema.";
 const input=JSON.stringify({task,available_routes:routes,mode:body.mode||"assisted"});
 try{
  const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"authorization":"Bearer "+process.env.OPENAI_API_KEY,"content-type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_JEV_MODEL||"gpt-5.6-luna",instructions:system,input,store:false,text:{format:{type:"json_schema",name:"jev_decision",strict:true,schema}}})});
  const data=await r.json();if(!r.ok)return res.status(r.status).json({error:"openai_error",detail:data?.error?.message||"request_failed"});
  const raw=data.output_text||data.output?.flatMap(x=>x.content||[]).find(x=>x.type==="output_text")?.text;
  const decision=JSON.parse(raw||"{}");return res.status(200).json({...decision,source:"openai",model:data.model||process.env.OPENAI_JEV_MODEL||"gpt-5.6-luna",response_id:data.id||null});
 }catch(e){return res.status(500).json({error:"jev_runtime_error",detail:e.message})}
}
