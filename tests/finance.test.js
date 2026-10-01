import test from "node:test";
import assert from "node:assert/strict";
import {matchesPersonalFinanceFilter} from "../src/modules/finance.js";

const members=[
 {id:"me-member",isMe:true},
 {id:"wife-member",isMe:false}
];

test("Minha conta mostra somente os lançamentos do usuário autenticado",()=>{
 const mine={ownerId:"me",personalScope:"individual"};
 const wife={ownerId:"wife",personalScope:"individual"};
 assert.equal(matchesPersonalFinanceFilter(mine,{members,userId:"me"}),true);
 assert.equal(matchesPersonalFinanceFilter(wife,{members,userId:"me"}),false);
});

test("Família reúne somente lançamentos marcados como compartilhados",()=>{
 assert.equal(matchesPersonalFinanceFilter({ownerId:"me",personalScope:"family"},{memberFilter:"family",members,userId:"me"}),true);
 assert.equal(matchesPersonalFinanceFilter({ownerId:"wife",personalScope:"individual"},{memberFilter:"family",members,userId:"me"}),false);
});

test("Filtro por pessoa funciona para transações antigas sem owner_id",()=>{
 assert.equal(matchesPersonalFinanceFilter({financeMemberId:"wife-member",personalScope:"individual"},{memberFilter:"wife-member",members,userId:"me"}),true);
 assert.equal(matchesPersonalFinanceFilter({financeMemberId:"me-member",personalScope:"individual"},{memberFilter:"wife-member",members,userId:"me"}),false);
});
