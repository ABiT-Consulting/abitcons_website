/* ABiT Support: data-driven presentation. No demo records or fabricated KPIs. */
const esc = (value) => String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const short = (value, max=58) => { const s=String(value || ""); return s.length>max ? s.slice(0,max-1)+"…" : s; };
const count = (list, fn) => list.filter(fn).length;
export const taskState = (value) => {
  const s = String(value || "").toLowerCase().trim();
  if (["completed","closed","resolved","done"].includes(s)) return "completed";
  if (["working","in progress","pending","started"].includes(s)) return "working";
  if (["blocked","hold","on hold"].includes(s)) return "blocked";
  if (["cancelled","canceled"].includes(s)) return "cancelled";
  return "open";
};
const dateText = (value) => {
  if (!value) return "Not set";
  const dt=new Date(value); return Number.isNaN(dt.getTime()) ? "Not set" :
    dt.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});
};
export const statusPill = (status) => '<span class="sp-status sp-status--'+taskState(status)+'">'+esc(status||"Open")+'</span>';
const initials = (name) => String(name||"AB").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase();
const avatar = (name) => '<span class="sp-avatar">'+esc(initials(name))+'</span>';
const bar = (pct) => '<span class="sp-progress"><i style="width:'+Math.min(100,Math.max(0,Number(pct)||0))+'%"></i></span>';
export const icon = (name) => {
  const paths={
    building:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h2m4 0h2M8 11h2m4 0h2M10 21v-5h4v5"/>',
    folder:'<path d="M3 7V5a2 2 0 0 1 2-2h4l3 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    tasks:'<rect x="3" y="4" width="18" height="17" rx="3"/><path d="m7 12 3 3 6-7"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/>',
    moon:'<path d="M20 15a8 8 0 0 1-11-11 8 8 0 1 0 11 11z"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    plus:'<path d="M12 4v16M4 12h16"/>',
    home:'<path d="m3 10 9-7 9 7v11h-7v-7h-4v7H3z"/>',
    chevron:'<path d="m9 6 6 6-6 6"/>',
    chat:'<path d="M4 4h16v13H9l-5 4zM8 9h8m-8 4h6"/>',
    refresh:'<path d="M20 11a8 8 0 0 0-14-5L4 8m0-5v5h5M4 13a8 8 0 0 0 14 5l2-2m0 5v-5h-5"/>'
  };
  return '<svg viewBox="0 0 24 24" class="sp-icon" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.tasks)+'</svg>';
};
const metrics = (items) => '<div class="sp-metrics">'+items.map((m)=>
  '<article class="sp-metric"><span class="sp-metric-icon sp-metric-icon--'+m.tone+'">'+icon(m.icon)+'</span>'+
  '<div><div class="sp-metric-label">'+esc(m.label)+'</div><div class="sp-metric-value">'+esc(m.value)+
  '</div><div class="sp-metric-note">'+esc(m.note||"Live ERPNext data")+'</div></div></article>').join("")+'</div>';
const hero = (eyebrow, title, subtitle) => '<header class="sp-hero"><div class="sp-hero-copy">'+
  '<span class="sp-eyebrow">'+esc(eyebrow)+'</span><h1>'+esc(title)+'</h1><p>'+esc(subtitle)+'</p></div>'+
  '<div class="sp-hero-decoration" aria-hidden="true"><i></i><i></i><i></i></div></header>';
const panel = (heading, subtitle, content, extra="") =>
  '<section class="sp-panel"><div class="sp-panel-head"><div><h2>'+esc(heading)+'</h2><p>'+esc(subtitle)+'</p></div>'+extra+
  '</div>'+content+'</section>';
const percent = (a,b) => b ? Math.round(a/b*100) : 0;
const taskRow = (task, admin=false) => {
  const id = task.erpTaskId||task.id;
  return '<tr data-admin-task-company="'+esc(task.company||"")+'" data-admin-task-status="'+esc(task.stage||"Open")+'" data-support-row>'+
   '<td><button class="sp-task-link" type="button" data-admin-open-task="'+esc(id)+'"><strong>'+esc(short(task.title,76))+'</strong><small>'+esc(id)+'</small></button></td>'+
   (admin?'<td>'+esc(short(task.company,32))+'</td>':"")+
   '<td>'+esc(short(task.project,30))+'</td><td>'+statusPill(task.stage)+'</td>'+
   '<td><div class="sp-assignee">'+avatar(task.assignedTo||"Unassigned")+'<span>'+esc(task.assignedTo||"Unassigned")+'</span></div></td>'+
   '<td>'+esc(dateText(task.deadline))+'</td>'+
   (admin?'<td><button class="sp-row-action" type="button" data-admin-notify-task="'+esc(id)+'">Notify</button></td>':"")+'</tr>';
};

export function renderSupportAdminDashboard(overview, user) {
  const companies=overview.companies||[], projects=overview.projects||[], tasks=overview.tasks||[];
  const n={open:0,working:0,completed:0,blocked:0,cancelled:0};
  tasks.forEach(t=>{n[taskState(t.stage)]++;});
  const names=["open","working","completed","blocked","cancelled"];
  const labels=["Open","In progress","Completed","Blocked","Cancelled"];
  const colors=["#f34454","#3986fb","#13ba81","#f6b53c","#778aa8"];
  let x=0;
  const gradient=names.map((k,i)=>{const next=x+(tasks.length?n[k]*100/tasks.length:0);
    const stop=colors[i]+" "+x.toFixed(2)+"% "+next.toFixed(2)+"%";x=next;return stop;}).join(",");
  const rows=companies.map(c=>{
    const progress=percent(c.completedTasks,c.totalTasks);
    return '<tr data-admin-company-row="'+esc(c.name)+'"><td><button type="button" class="sp-company-btn" data-select-company="'+esc(c.name)+'">'+
       avatar(c.name)+'<span>'+esc(c.name)+'</span></button></td><td>'+c.projectCount+'</td><td>'+c.totalTasks+'</td>'+
       '<td><div class="sp-progress-cell">'+bar(progress)+'<span>'+progress+'%</span></div></td><td>'+c.openTasks+
       '</td><td>'+c.completedTasks+'</td><td><span class="sp-status sp-status--completed">Support enabled</span></td></tr>';
  }).join("");
  const companyTable='<div class="sp-scroll"><table class="sp-table"><thead><tr><th>Company</th><th>Projects</th><th>Tasks</th><th>Progress</th><th>Open</th><th>Done</th><th>Status</th></tr></thead>'+
    '<tbody>'+rows+'</tbody></table></div>';
  const statusLegend=names.map((k,i)=>'<div class="sp-legend-line"><span><i style="background:'+colors[i]+'"></i>'+labels[i]+
    '</span><strong>'+n[k]+'</strong><small>'+percent(n[k],tasks.length)+'%</small></div>').join("");
  const statusHtml='<div class="sp-donut-layout"><div class="sp-donut" style="background:conic-gradient('+
    (tasks.length?gradient:"#344860 0 100%")+')"><div class="sp-donut-core"><strong>'+tasks.length+
    '</strong><small>Total tasks</small></div></div><div class="sp-legend">'+statusLegend+'</div></div>';
  const recent=tasks.slice(0,4);
  const alerts='<div class="sp-activity"><div class="sp-activity-title">'+icon("bell")+
    '<strong>Latest support activity</strong></div>'+
    (recent.map(t=>'<button type="button" class="sp-activity-item" data-admin-open-task="'+esc(t.erpTaskId||t.id)+'">'+
      '<i class="sp-activity-dot"></i><span>'+esc(short(t.title,43))+
      '<small>'+esc(t.company||"")+' · '+esc(t.stage||"Open")+'</small></span></button>').join("")||
    '<div class="sp-empty">No task activity yet.</div>')+'</div>';
  const companySection=panel("Companies overview","Project and task health across all support-enabled companies.",
    companyTable,'<button class="sp-plain-btn" type="button" data-admin-scroll-tasks>View tasks '+icon("chevron")+'</button>');
  const statSection=panel("Task status","Live ERPNext task status breakdown.",statusHtml+alerts);
  const email=String(user?.email||user?.login||"").toLowerCase();
  const username=String(user?.login||"").toLowerCase();
  const mine=tasks.filter(t=>(t.assignedUsers||[]).some(id=>
    id.toLowerCase()===email||id.toLowerCase()===username||id.toLowerCase().split("@")[0]===username));
  const mineHtml=mine.length?mine.slice(0,6).map(t=>'<button type="button" class="sp-my-task" data-admin-open-task="'+esc(t.erpTaskId||t.id)+'">'+
    '<span class="sp-state-dot sp-state-dot--'+taskState(t.stage)+'"></span><span><strong>'+esc(short(t.title,50))+
    '</strong><small>'+esc(t.company)+' · '+esc(t.project)+'</small></span>'+statusPill(t.stage)+'</button>').join(""):
    '<p class="sp-empty">No ERP tasks currently assigned to your user.</p>';
  const projectsHtml=projects.slice(0,8).map(p=>
    '<div class="sp-project-row"><div><strong>'+esc(p.title)+'</strong><small>'+esc(p.company)+' · '+esc(p.stage)+'</small></div>'+
    bar(p.progress)+'<span>'+Math.round(Number(p.progress)||0)+'%</span></div>').join("")||
    '<p class="sp-empty">No projects linked to support-enabled companies.</p>';
  const filters='<div class="sp-filter-row"><select data-admin-company aria-label="Filter by company"><option value="">All companies</option>'+
    companies.map(c=>'<option value="'+esc(c.name)+'">'+esc(c.name)+'</option>').join("")+
    '</select><select data-admin-status aria-label="Filter by task status"><option value="">All statuses</option>'+
    [...new Set(tasks.map(t=>t.stage||"Open"))].sort().map(st=>'<option value="'+esc(st)+'">'+esc(st)+'</option>').join("")+'</select></div>';
  const taskTable='<div class="sp-scroll"><table class="sp-table sp-task-table"><thead><tr><th>Task</th><th>Company</th><th>Project</th><th>Status</th><th>Assigned to</th><th>Due</th><th></th></tr></thead>'+
    '<tbody>'+tasks.slice(0,80).map(t=>taskRow(t,true)).join("")+'</tbody></table></div>';
  const taskPanel='<div id="sp-admin-tasks">'+panel("Recent support tasks","Click a task to view comments, activity and ERP details.",filters+taskTable)+'</div>';
  return hero("SUPPORT OPERATIONS","Welcome back, "+(user?.name||user?.login||"Support Admin"),
      "Every support company, project and task in one place.")+
    metrics([{label:"Support companies",value:companies.length,icon:"building",tone:"blue",note:"Enabled customer workspaces"},
      {label:"Active projects",value:projects.length,icon:"folder",tone:"blue",note:"ERP-linked projects"},
      {label:"All support tasks",value:tasks.length,icon:"tasks",tone:"green",note:n.completed+" completed"},
      {label:"Open tasks",value:n.open,icon:"clock",tone:"red",note:n.working+" in progress"}])+
    '<div class="sp-columns"><div>'+companySection+'</div><div>'+statSection+'</div></div>'+
    taskPanel+'<div class="sp-columns sp-columns--secondary">'+panel("Projects snapshot","Live progress from ERPNext.",projectsHtml)+
    panel("My assigned tasks","Tasks assigned specifically to your ERP user.",mineHtml)+'</div>'+
    '<div class="support-admin-notice" role="status" data-admin-notice hidden></div>';
}

export function renderSupportClientDashboard(overview, user) {
  const projects=overview.projects||[], tasks=overview.tasks||[];
  const n={open:0,working:0,completed:0,blocked:0,cancelled:0};
  tasks.forEach(t=>n[taskState(t.stage)]++);
  const company=user?.company?.name||overview.companyName||"your company";
  const projectRows=projects.map(p=>
    '<tr><td><div class="sp-project-name">'+avatar(p.title)+'<span><strong>'+esc(p.title)+'</strong><small>'+esc(p.erpProjectId||p.id)+'</small></span></div></td>'+
    '<td>'+esc(p.stage||"Active")+'</td><td><div class="sp-progress-cell">'+bar(p.progress)+'<small>'+Math.round(Number(p.progress)||0)+'%</small></div></td>'+
    '<td>'+p.openTasks+'</td><td>'+statusPill(p.stage||"Active")+'</td></tr>').join("");
  const projectsHtml='<div class="sp-scroll"><table class="sp-table"><thead><tr><th>Project</th><th>Stage</th><th>Progress</th><th>Open tasks</th><th>Status</th></tr></thead>'+
    '<tbody>'+projectRows+'</tbody></table></div>';
  const names=["open","working","completed","blocked","cancelled"];
  const colors=["#f34454","#3986fb","#13ba81","#f6b53c","#778aa8"];
  let x=0;
  const gradient=names.map((k,i)=>{const next=x+(tasks.length?n[k]*100/tasks.length:0);
    const stop=colors[i]+" "+x.toFixed(2)+"% "+next.toFixed(2)+"%"; x=next; return stop;}).join(",");
  const donut='<div class="sp-donut-layout"><div class="sp-donut" style="background:conic-gradient('+
    (tasks.length?gradient:"#344860 0 100%")+')"><div class="sp-donut-core"><strong>'+tasks.length+
    '</strong><small>Total tickets</small></div></div><div class="sp-legend">'+
    names.map((key,i)=>'<div class="sp-legend-line"><span><i style="background:'+colors[i]+'"></i>'+
      ["Open","In progress","Resolved","Blocked","Cancelled"][i]+'</span><strong>'+n[key]+'</strong><small>'+
      percent(n[key],tasks.length)+'%</small></div>').join("")+'</div></div>';
  const recent='<div class="sp-timeline">'+tasks.slice(0,5).map(t=>
    '<button type="button" data-admin-open-task="'+esc(t.erpTaskId||t.id)+'">'+
    '<span class="sp-state-dot sp-state-dot--'+taskState(t.stage)+'"></span><span><strong>'+
    esc(short(t.title,62))+'</strong><small>'+esc(t.project)+' · '+esc(t.stage||"Open")+
    ' · Updated '+esc(dateText(t.updatedAt))+'</small></span></button>').join("")+
    (tasks.length===0?'<p class="sp-empty">No task activity yet.</p>':"")+'</div>';
  const projectPanel=panel("Active projects","Your ERP-linked projects and progress.",projectsHtml,
    '<button type="button" class="sp-plain-btn" data-client-go-projects>View projects '+icon("chevron")+'</button>');
  const statusPanel=panel("Ticket status","Live overview of your support tasks.",donut);
  const taskTable='<div class="sp-scroll"><table class="sp-table sp-task-table"><thead>'+
    '<tr><th>Task</th><th>Project</th><th>Status</th><th>Assigned to</th><th>Due</th></tr></thead><tbody>'+
    tasks.slice(0,15).map(t=>taskRow(t,false)).join("")+'</tbody></table></div>';
  return hero("CLIENT WORKSPACE","Welcome back, "+company,
      "Track your projects, follow task progress and collaborate with ABiT Support.")+
    metrics([{label:"Active projects",value:projects.length,icon:"folder",tone:"blue",note:"Mapped to your company"},
      {label:"Total support tasks",value:tasks.length,icon:"tasks",tone:"blue",note:"All ERP task statuses"},
      {label:"Resolved tasks",value:n.completed,icon:"tasks",tone:"green",note:percent(n.completed,tasks.length)+"% complete"},
      {label:"Open tasks",value:n.open,icon:"clock",tone:"red",note:n.working+" in progress"}])+
    '<div class="sp-columns"><div>'+projectPanel+'</div><div>'+statusPanel+'</div></div>'+
    '<div class="sp-columns sp-columns--secondary"><div>'+
    panel("My support tickets","Latest tickets and their assigned team members.",taskTable,
      '<button type="button" class="sp-plain-btn" data-client-go-tasks>View all '+icon("chevron")+'</button>')+
    '</div><div>'+panel("Recent activity","Latest ERPNext updates on your tasks.",recent)+'</div></div>';
}

export function renderSupportSidebar(overview, admin) {
  const items=admin?(overview.companies||[]).map(c=>({
    name:c.name,count:c.totalTasks,company:c.name
  })):(overview.projects||[]).map(p=>({
    name:p.title,count:p.openTasks,project:p.erpProjectId||p.id
  }));
  return '<div class="sp-sidebar-section"><h3>'+ (admin?"CUSTOMER COMPANIES":"MY PROJECTS")+'</h3>'+
    items.slice(0,12).map(item=>
    '<button class="sp-sidebar-link" type="button" '+(admin?'data-select-company="'+esc(item.company)+'"':
      'data-client-go-projects')+'>'+avatar(item.name)+'<span>'+esc(short(item.name,28))+
    '</span><b>'+item.count+'</b></button>').join("")+
    '<button class="sp-sidebar-all" type="button" data-sidebar-open-list="'+(admin?"dashboard":"projects")+'">'+
    (admin?"View all companies":"View all projects")+' '+icon("chevron")+'</button></div>';
}
