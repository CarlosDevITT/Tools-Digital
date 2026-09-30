export function normalizeProjects(items=[]){
  return items.map(project=>({...project,links:(project.links||[]).map(link=>Array.isArray(link)?link:[link.label,link.url])}));
}
export function projectSource(state){return state.session?normalizeProjects(state.cloudProjects):[]}
export function projectsEmpty(){return '<div class="tools-empty"><strong>Nenhum projeto ainda.</strong><p>Crie seu primeiro projeto para organizar links, ambientes e informações do seu trabalho.</p><button class="primary" data-account-project>＋ Criar projeto</button></div>'}
