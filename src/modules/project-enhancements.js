function labelFor(field,text,required=false){
 const wrapper=field.parentElement;
 if(!wrapper||field.dataset.projectLabel==="true")return;
 const label=document.createElement("label");
 label.className="project-field-label";
 label.textContent=text+(required?" *":"");
 field.insertAdjacentElement("beforebegin",label);
 field.classList.add("project-enhanced-field");field.dataset.projectLabel="true";
}

function decorateProjectModal(){
 const name=document.querySelector("#cpName"),description=document.querySelector("#cpDesc"),status=document.querySelector("#cpStatus"),workspace=document.querySelector("#cpWorkspace");
 if(!name||!description||!status||!workspace)return;
 const container=name.closest(".swal2-html-container");if(!container||container.dataset.enhanced==="true")return;
 container.dataset.enhanced="true";
 labelFor(name,"Nome do projeto",true);labelFor(description,"Descrição");labelFor(status,"Status");labelFor(workspace,"Workspace");
 const hint=document.createElement("small");hint.className="project-field-hint";hint.textContent="Descreva o objetivo, contexto e próximo passo do projeto.";
 description.insertAdjacentElement("afterend",hint);
 const counter=document.createElement("small");counter.className="project-description-counter";
 const updateCounter=()=>{counter.textContent=description.value.length+"/500 caracteres";counter.classList.toggle("limit",description.value.length>450)};
 description.maxLength=500;description.insertAdjacentElement("afterend",counter);description.addEventListener("input",updateCounter);updateCounter();
 name.focus();
}

if(typeof document!=="undefined")new MutationObserver(decorateProjectModal).observe(document.body,{childList:true,subtree:true});
