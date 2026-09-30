export async function restoreSession({getSession,loadAccountData,hydrateCloud,state}) {
  const session=await getSession();
  if(!session) return null;
  state.session=session;
  await hydrateCloud({firstSync:false});
  await loadAccountData();
  return session;
}
export function clearSessionState(state){
  state.session=null;state.profile=null;state.workspaces=[];state.cloudProjects=[];
  state.cloudActivity=[];state.cloudFlows=[];
}
