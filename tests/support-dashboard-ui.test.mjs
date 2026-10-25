import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {renderSupportAdminDashboard,renderSupportClientDashboard,renderSupportSidebar,taskState} from "../src/support-dashboard-ui.js";

const task={id:"TASK-SAMPLE",erpTaskId:"TASK-SAMPLE",title:"A task assigned to a developer",project:"PROJ-SAMPLE",company:"Sample Client",stage:"Working",assignedTo:"Developer One",assignedUsers:["dev@example.test"],priority:"High",deadline:"2026-11-05"};
const overview={
 companies:[{name:"Sample Client",projectCount:1,totalTasks:1,openTasks:0,inProgressTasks:1,completedTasks:0,blockedTasks:0}],
 projects:[{id:"PROJ-SAMPLE",erpProjectId:"PROJ-SAMPLE",title:"Example Project",company:"Sample Client",openTasks:1,progress:40,stage:"Open"}],
 tasks:[task]
};
test("ERP status categories stay distinct",()=>{
 assert.equal(taskState("Working"),"working");
 assert.equal(taskState("Cancelled"),"cancelled");
 assert.equal(taskState("Completed"),"completed");
});
test("admin dashboard includes live assignee, company and task controls",()=>{
 const html=renderSupportAdminDashboard(overview,{name:"Admin User",login:"admin"});
 assert.match(html,/Developer One/);
 assert.match(html,/Sample Client/);
 assert.match(html,/data-admin-notify-task/);
 assert.match(html,/Task status/);
 assert.doesNotMatch(html,/T-1042/);
});
test("client dashboard includes its own assigned task and project",()=>{
 const html=renderSupportClientDashboard(overview,{company:{name:"Sample Client"}});
 assert.match(html,/Developer One/);
 assert.match(html,/Example Project/);
 assert.match(html,/data-admin-open-task/);
});
test("sidebar is company-scoped or admin-wide",()=>{
 assert.match(renderSupportSidebar(overview,true),/Sample Client/);
 assert.match(renderSupportSidebar(overview,false),/Example Project/);
});
test("signed-out view wins over forced app grid",()=>{
 const css=readFileSync(new URL("../src/support-dashboard-ui.css",import.meta.url),"utf8");
 assert.match(css,/\.support-app-shell\[hidden\]\{display:none!important\}/);
 assert.match(css,/not\(\.support-authenticated\).*data-support-signed-in/);
});

test("support task badges use explicit status-specific classes", () => {
 const source=readFileSync(new URL("../src/main.js",import.meta.url),"utf8");
 assert.match(source,/support-task-status--' \+ normalizeTaskStatus\(stage\)/);
});
test("light and dark status palettes meet WCAG AA text contrast", () => {
 const css=readFileSync(new URL("../src/support-dashboard-ui.css",import.meta.url),"utf8");
 const section=css.split("Contrast-safe task statuses and actions for both portal roles.")[1];
 assert.ok(section,"status-specific palette definitions exist");
 const parsePalette=(text) => {
   const values={};
   for (const match of text.matchAll(/--sp-state-(completed|open|working|blocked|cancelled)-(bg|fg):\s*(#[0-9a-f]{6})/gi)) {
     values[match[1]+"-"+match[2]]=match[3];
   }
   return values;
 };
 const blocks=[...section.matchAll(/html\.support-host(?:\[data-support-theme="dark"\])?\s*\{([^}]+)\}/g)].slice(0,2);
 assert.equal(blocks.length,2,"explicit light and dark palettes");
 const lum=(hex)=>{
   const channels=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
   const linear=channels.map(c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4);
   return linear[0]*0.2126+linear[1]*0.7152+linear[2]*0.0722;
 };
 for(const [theme,block] of ["light","dark"].map((x,i)=>[x,blocks[i][1]])) {
   const values=parsePalette(block);
   for(const status of ["completed","open","working","blocked","cancelled"]) {
     const bg=values[status+"-bg"],fg=values[status+"-fg"];
     assert.ok(bg&&fg,theme+" "+status+" palette");
     const l1=lum(bg),l2=lum(fg);
     const ratio=(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
     assert.ok(ratio>=4.5,theme+" "+status+" contrast="+ratio.toFixed(2));
   }
 }
});
