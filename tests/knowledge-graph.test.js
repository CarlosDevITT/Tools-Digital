import test from"node:test";import assert from"node:assert/strict";
function graph(notes,links){return{nodes:notes.map(n=>({id:n.id,title:n.title,type:n.type,tags:n.tags||[]})),links:links.map(l=>({source:l.source,target:l.target}))}}
test("graph endpoint shape",()=>{const g=graph([{id:"1",title:"A",type:"concept"}],[{source:"1",target:"2"}]);assert.ok(Array.isArray(g.nodes));assert.ok(Array.isArray(g.links));assert.deepEqual(g.links[0],{source:"1",target:"2"})});
