import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createErpSupportService } from "../server/erp-support.js";

const mockResponse = (status,data,setCookie=false) =>
  new Response(JSON.stringify(data),{
    status,headers:{
      "content-type":"application/json",
      ...(setCookie?{"set-cookie":"sid=fixture-session; Path=/; HttpOnly"}:{})
    }
  });

async function exercise(input,{ transientLookup=false, alwaysFailLookup=false }={}) {
  const initialFetch=globalThis.fetch;
  const envKeys=["ERPNEXT_SUPPORT_URL","ERPNEXT_SUPPORT_API_KEY","ERPNEXT_SUPPORT_API_SECRET","SUPPORT_SESSION_DB"];
  const initialEnv=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
  process.env.ERPNEXT_SUPPORT_URL="https://erp-login.test";
  process.env.ERPNEXT_SUPPORT_API_KEY="fixture-key";
  process.env.ERPNEXT_SUPPORT_API_SECRET="fixture-secret";
  process.env.SUPPORT_SESSION_DB="username-test.sqlite";
  const events=[],tmp=mkdtempSync(join(tmpdir(),"support-username-fixture-"));
  let lookupFailures=0;
  const canonicalId="jamkamran@abitcons.com";
  globalThis.fetch=async(inputUrl,options={})=>{
    const url=new URL(String(inputUrl));
    const method=options.method||"GET";
    events.push({path:url.pathname,method,submittedLogin:
      url.pathname==="/api/method/login"?new URLSearchParams(String(options.body)).get("usr"):null});
    if(url.pathname==="/api/resource/User" && url.searchParams.has("filters")){
      if(alwaysFailLookup) return mockResponse(503,{message:"Temporary failure"});
      if(transientLookup && lookupFailures++===0) return mockResponse(503,{message:"Temporary failure"});
      const filters=JSON.parse(url.searchParams.get("filters"));
      const username=filters[0][2];
      const data=username==="jamkamran"
        ?[{name:canonicalId,username:"jamkamran",enabled:1}]:[];
      return mockResponse(200,{data});
    }
    if(url.pathname==="/api/method/login"){
      const form=new URLSearchParams(String(options.body));
      return form.get("usr")===canonicalId && form.get("pwd")==="valid-fixture"
        ?mockResponse(200,{message:"Logged In"},true)
        :mockResponse(401,{message:"Invalid login credentials",exc_type:"AuthenticationError"});
    }
    if(url.pathname==="/api/method/frappe.auth.get_logged_user"){
      assert.match(options.headers.Cookie,/sid=fixture-session/);
      return mockResponse(200,{message:canonicalId});
    }
    if(url.pathname==="/api/resource/User/jamkamran%40abitcons.com"){
      return mockResponse(200,{data:{
        name:canonicalId,username:"jamkamran",enabled:1,
        full_name:"Muhammad Kamran",custom_support_admin:1,
      }});
    }
    throw new Error("Unexpected mocked ERP endpoint: "+url.pathname);
  };
  try {
    const svc=createErpSupportService({rootDir:tmp});
    let result=null,error=null;
    try { result=await svc.login(input,"valid-fixture"); }
    catch(e) { error=e; }
    return {result,error,events};
  } finally {
    globalThis.fetch=initialFetch;
    for(const [k,v] of Object.entries(initialEnv)){
      if(v===undefined)delete process.env[k];else process.env[k]=v;
    }
    // Node SQLite is kept open by the instance until this test process exits.
  }
}

test("exact ERP short username resolves to canonical email before password verification",async()=>{
  const {result,error,events}=await exercise("jamkamran");
  assert.equal(error,null);
  assert.equal(result.login,"jamkamran");
  assert.equal(result.isSupportAdmin,true);
  assert.equal(events.find(x=>x.path==="/api/method/login").submittedLogin,"jamkamran@abitcons.com");
});
test("canonical email login remains supported",async()=>{
  const {result,error,events}=await exercise("jamkamran@abitcons.com");
  assert.equal(error,null);
  assert.equal(result.login,"jamkamran");
  assert.equal(events.find(x=>x.path==="/api/method/login").submittedLogin,"jamkamran@abitcons.com");
  assert.equal(events.filter(x=>x.path==="/api/resource/User"&&x.method==="GET").length,0);
});
test("misspelled username is never silently remapped to another account",async()=>{
  const {result,error,events}=await exercise("jmkamran");
  assert.equal(result,null);
  assert.equal(error.status,401);
  assert.equal(events.find(x=>x.path==="/api/method/login").submittedLogin,"jmkamran");
});
test("temporary read-only ERP lookup error is retried but password POST once",async()=>{
  const {result,error,events}=await exercise("jamkamran",{transientLookup:true});
  assert.equal(error,null);
  assert.equal(result.login,"jamkamran");
  assert.equal(events.filter(x=>x.path==="/api/resource/User").length,2);
  assert.equal(events.filter(x=>x.path==="/api/method/login").length,1);
});

test("persistent ERP username lookup outage never turns into wrong-password or another login POST",async()=>{
 const {result,error,events}=await exercise("jamkamran",{alwaysFailLookup:true});
 assert.equal(result,null);
 assert.equal(error.status,503);
 assert.match(error.message,/username lookup is temporarily unavailable/);
 assert.equal(events.filter(x=>x.path==="/api/resource/User").length,2);
 assert.equal(events.filter(x=>x.path==="/api/method/login").length,0);
});
