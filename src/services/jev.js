// JEV protocol adapter — OpenAI is the intelligence engine.
// Never expose a OpenAI API key in this PWA.
// The browser calls your own backend endpoint; backend calls JEV.
export const JEV_DECISION_TYPES=Object.freeze({CHOICE:"choice",SCORE:"score",NOUL:"noul"});
export function buildAgentDecisionState({task,agents=[],project=null}={}){
 return JSON.stringify({task:{title:task?.title||"",description:task?.description||"",priority:task?.priority||"normal"},project:project?.name||null,availableAgents:agents.map(a=>({name:a.name,role:a.role,status:a.status,tools:a.tools}))});
}
export function buildAgentQuestions(agents=[]){return[
 {id:"route",type:"choice",question:"Qual é o melhor destino para esta tarefa?",options:[...agents.map(a=>a.name),"human_review"]},
 {id:"priority",type:"choice",question:"Qual prioridade operacional esta tarefa exige?",options:["low","normal","high","critical"]},
 {id:"quality",type:"score",question:"Quão claro e executável está o pedido?",scale:{min:0,max:100}},
 {id:"safe_to_continue",type:"noul",question:"É seguro continuar automaticamente sem aprovação humana?"}
]}
export async function requestJevDecision(input,{endpoint="/api/ai/jev/decide",signal}={}){
 const r=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(input),signal});
 if(!r.ok)throw new Error("JEV decision endpoint unavailable ("+r.status+")");
 return r.json();
}
export function enforceDecisionPolicy(decision,{minConfidence=.78}={}){
 const confidence=Number(decision?.confidence??0);
 const human=decision?.route==="human_review"||decision?.safe_to_continue===false||confidence<minConfidence;
 return{...decision,confidence,requiresApproval:human,route:human?"human_review":decision.route};
}
