import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createErpSupportService } from "../server/erp-support.js";

const mockResponse = (status, data, cookie) => new Response(JSON.stringify(data), {
  status,
  headers: {"content-type":"application/json", ...(cookie ? {"set-cookie":"sid=mock-erp-session; Path=/; HttpOnly"} : {})},
});

async function exercise({ privileged=true, supportAdmin=true, allowPassword=true, denyDirectRead=false, denyFallback=false } = {}) {
  const origFetch=globalThis.fetch;
  const origEnv={
    url:process.env.ERPNEXT_SUPPORT_URL,
    key:process.env.ERPNEXT_SUPPORT_API_KEY,
    secret:process.env.ERPNEXT_SUPPORT_API_SECRET,
    db:process.env.SUPPORT_SESSION_DB
  };
  const path=mkdtempSync(join(tmpdir(),"abit-support-auth-test-"));
  process.env.ERPNEXT_SUPPORT_URL="https://erp-login.test";
  process.env.ERPNEXT_SUPPORT_API_KEY="fixture-key";
  process.env.ERPNEXT_SUPPORT_API_SECRET="fixture-secret";
  process.env.SUPPORT_SESSION_DB="support-auth-test.sqlite";
  const requests=[];
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(String(input));
    const method=String(init.method||"GET");
    const authorization=String(init.headers?.Authorization||"");
    const cookie=String(init.headers?.Cookie||"");
    requests.push({path:url.pathname,method,hasServiceToken:authorization.startsWith("token "),
      hasVerifiedCookie:cookie.includes("sid=mock-erp-session")});
    if(url.pathname==="/api/method/login"){
      if(!allowPassword)return mockResponse(401,{exc_type:"AuthenticationError",message:"Invalid login credentials"});
      return mockResponse(200,{message:"Logged In"},true);
    }
    if(url.pathname==="/api/method/frappe.auth.get_logged_user"){
      return cookie.includes("sid=mock-erp-session")
        ? mockResponse(200,{message:privileged?"Administrator":"mimran@abitcons.com"})
        : mockResponse(403,{exc_type:"PermissionError"});
    }
    if(url.pathname==="/api/resource/User/Administrator"){
      if(authorization.startsWith("token "))
        return mockResponse(403,{exc_type:"PermissionError",message:"Not permitted"});
      if(!cookie.includes("sid=mock-erp-session"))
        return mockResponse(403,{exc_type:"PermissionError"});
      if(denyDirectRead)return mockResponse(403,{exc_type:"PermissionError"});
      return mockResponse(200,{data:{
        name:"Administrator",username:"Administrator",enabled:1,
        full_name:"Administrator",custom_support_admin:supportAdmin?1:0,
        custom_support_portal_enabled:0,
      }});
    }
    if(url.pathname==="/api/method/frappe.client.get_value"){
      if(denyFallback)return mockResponse(403,{exc_type:"PermissionError"});
      return mockResponse(200,{message:{
        name:"Administrator",enabled:1,username:"Administrator",
        full_name:"Administrator",custom_support_admin:supportAdmin?1:0,
        custom_support_portal_enabled:0,
      }});
    }    if(url.pathname==="/api/resource/User/mimran%40abitcons.com"){
      return mockResponse(200,{data:{
        name:"mimran@abitcons.com",username:"mimran",enabled:1,
        full_name:"Support User",custom_support_admin:supportAdmin?1:0,
      }});
    }
    throw new Error("Unexpected ERP route: "+url.pathname);
  };
  try {
    const svc=createErpSupportService({rootDir:path});
    return await (async()=>{
      if(!allowPassword){
        await assert.rejects(svc.login("Administrator","incorrect"),{status:401});
        return requests;
      }
      if(denyDirectRead && denyFallback){
        await assert.rejects(svc.login("Administrator","valid-fixture"),{status:403});
        return requests;
      }
      if(!supportAdmin){
        await assert.rejects(svc.login("Administrator","valid-fixture"),{status:403});
        return requests;
      }
      const logged=await svc.login(privileged?"Administrator":"mimran@abitcons.com","valid-fixture");
      assert.ok(logged.sessionToken);
      assert.equal(logged.isSupportAdmin,true);
      assert.equal(logged.clientCode,"ADMIN");
      const active=await svc.requireSession({headers:{authorization:"Bearer "+logged.sessionToken}});
      assert.equal(active.isSupportAdmin,true);
      assert.equal(active.erpUser,privileged?"Administrator":"mimran@abitcons.com");
      if(privileged){
        supportAdmin=false;
        await assert.rejects(svc.requireSession({headers:{authorization:"Bearer "+logged.sessionToken}}),{status:403});
      }
      return requests;
    })();
  }finally{
    globalThis.fetch=origFetch;
    const entries={ERPNEXT_SUPPORT_URL:origEnv.url,ERPNEXT_SUPPORT_API_KEY:origEnv.key,
      ERPNEXT_SUPPORT_API_SECRET:origEnv.secret,SUPPORT_SESSION_DB:origEnv.db};
    for(const [key,value] of Object.entries(entries)){
      if(value===undefined)delete process.env[key];else process.env[key]=value;
    }
    // Native SQLite handles remain open until this isolated Node test exits on Windows.
  }
}

test("built-in Administrator falls back only to its successfully authenticated ERP session",async()=>{
  const calls=await exercise();
  assert.ok(calls.some(r=>r.path==="/api/resource/User/Administrator"&&r.hasServiceToken));
  assert.ok(calls.some(r=>r.path==="/api/resource/User/Administrator"&&r.hasVerifiedCookie&&!r.hasServiceToken));
});

test("Administrator without Support Admin checkbox is denied",async()=>{
  await exercise({supportAdmin:false});
});
test("invalid ERPNext password is never bypassed by special Administrator fallback",async()=>{
  const calls=await exercise({allowPassword:false});
  assert.equal(calls.length,1);
});
test("normal Support Admin user still uses token-backed ERP record validation",async()=>{
  const calls=await exercise({privileged:false});
  assert.ok(calls.some(r=>r.path.includes("mimran%40abitcons.com")&&r.hasServiceToken));
  assert.ok(!calls.some(r=>r.path.includes("mimran%40abitcons.com")&&r.hasVerifiedCookie));
});

test("Administrator session can read Support Admin checkbox through authorized Frappe method when User resource is blocked",async()=>{
  const calls=await exercise({denyDirectRead:true});
  assert.ok(calls.some(r=>r.path==="/api/method/frappe.client.get_value"&&r.hasVerifiedCookie));
});
test("Administrator cannot enter support when both ERP role-read endpoints deny access",async()=>{
  const calls=await exercise({denyDirectRead:true,denyFallback:true});
  assert.ok(calls.some(r=>r.path==="/api/method/frappe.client.get_value"&&r.hasVerifiedCookie));
});
