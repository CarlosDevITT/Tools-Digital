import { neon } from "@neondatabase/serverless";
import { tools as legacyTools } from "../src/data/tools.js";

if(!process.env.DATABASE_URL) throw new Error("DATABASE_URL ausente");
const sql=neon(process.env.DATABASE_URL);
const normalize=s=>(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/\s+/g," ");
const categoryMap={IA:"ia",Dev:"dev-infra-cloud","Automação":"automacao",Produtividade:"produtividade",Marketing:"marketing",Design:"design-documentacao","Segurança":"seguranca","Educação":"educacao",Utilidades:"utilidades"};
const special={"tidio":"vendas-crm","instaninja":"vendas-crm","vercel":"dev-infra-cloud","supabase":"dev-infra-cloud","canva - design grafico":"design-documentacao"};

const extra=[
 ["rd-station-crm","RD Station CRM","vendas-crm"],["infinitepay","InfinitePay","vendas-crm"],["nubank-pj","Nubank PJ","vendas-crm"],
 ["github-copilot","GitHub Copilot","dev-infra-cloud"],["codex","Codex","dev-infra-cloud"],["prisma","Prisma","dev-infra-cloud"],
 ["gamma","Gamma","design-documentacao"],["rustdesk","RustDesk","suporte-remoto-help-desk"],["anydesk","AnyDesk","suporte-remoto-help-desk"],["glpi","GLPI","suporte-remoto-help-desk"],
 ["ninite","Ninite","diagnostico-so"],["ventoy","Ventoy","diagnostico-so"],["crystaldiskinfo","CrystalDiskInfo","diagnostico-so"],["advanced-ip-scanner","Advanced IP Scanner","diagnostico-so"]
].map(([id,name,category])=>({id:"seed-"+id,name,category,url:null,icon:null,description:""}));

const rows=legacyTools.map(t=>({...t,category:special[normalize(t.name)]||categoryMap[t.category]||"utilidades"}));
const existing=new Set(rows.map(t=>normalize(t.name)));
rows.push(...extra.filter(t=>!existing.has(normalize(t.name))));

for(const t of rows){
 await sql`
  INSERT INTO public.tool_catalog(id,name,normalized_name,category_id,description,kind,launch_url,login_url,icon)
  SELECT ${t.id},${t.name},${normalize(t.name)},c.id,${t.description||""},'catalog',${t.url||null},NULL,${t.icon||null}
  FROM public.tool_categories c WHERE c.slug=${t.category}
  ON CONFLICT(id) DO UPDATE SET
   name=excluded.name, normalized_name=excluded.normalized_name, category_id=excluded.category_id,
   description=excluded.description, launch_url=COALESCE(public.tool_catalog.launch_url,excluded.launch_url),
   icon=COALESCE(public.tool_catalog.icon,excluded.icon), updated_at=now(), deleted_at=NULL
 `;
}
console.log(`Seed concluído: ${rows.length} registros processados; os 93 IDs legados foram preservados.`);
