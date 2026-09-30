import test from"node:test";import assert from"node:assert/strict";import{buildGraphData}from"../src/modules/knowledge-graph.js";
test("graph response is nodes and links",()=>{const g=buildGraphData([{id:"1",title:"A",type:"concept",tags:["x"]}],[{source_note_id:"1",target_note_id:"2"}]);assert.deepEqual(g.nodes[0],{id:"1",title:"A",type:"concept",tags:["x"]});assert.deepEqual(g.links[0],{source:"1",target:"2"})});
test("graph normalizes defaults",()=>{const g=buildGraphData([{id:"1",title:""}],[]);assert.equal(g.nodes[0].title,"Sem título");assert.equal(g.nodes[0].type,"concept")});
