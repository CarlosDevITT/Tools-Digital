export async function bootstrapApp({restoreSession,render,onReady,onError}){
  document.body.classList.add("auth-boot");
  try{await restoreSession()}catch(error){onError?.(error)}
  finally{document.body.classList.remove("auth-boot");onReady?.();render()}
}
