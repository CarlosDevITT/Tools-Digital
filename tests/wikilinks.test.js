import test from"node:test";import assert from"node:assert/strict";import{extractWikilinks,replaceWikilinkTitle,wikilinkQuery}from"../src/modules/wikilinks.js";
test("extracts unique wikilinks",()=>assert.deepEqual(extractWikilinks("Veja [[Alpha]] e [[Beta|B]] e [[Alpha]]"),["Alpha","Beta"]));
test("renames wikilinks safely",()=>assert.equal(replaceWikilinkTitle("[[Antiga]] [[Antiga|alias]]","Antiga","Nova"),"[[Nova]] [[Nova|alias]]"));
test("detects autocomplete query",()=>assert.deepEqual(wikilinkQuery("texto [[Al",10),{start:6,query:"Al"}));
