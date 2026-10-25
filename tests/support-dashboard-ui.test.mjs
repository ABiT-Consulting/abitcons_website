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
