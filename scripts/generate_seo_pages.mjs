import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = "https://abitcons.com";
const publicDir = path.resolve("public");
const dateInDubai = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Dubai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const lastmod = process.env.SEO_LASTMOD || dateInDubai;

const company = {
  name: "ABiT Consulting",
  legalName: "ABIT Consulting (Pvt) Ltd.",
  url: baseUrl,
  logo: `${baseUrl}/abitlogo.png`,
  email: "info@abitcons.com",
  telephone: "+92 331 3133999",
  linkedIn: "https://www.linkedin.com/company/abitconsulting",
  facebook: "https://www.facebook.com/Abit.consultants",
};

const commonLinks = [
  { label: "ERP Implementation", href: "/erp-implementation-consultants-pakistan-uae/" },
  { label: "SAP Business One", href: "/sap-business-one-consultant-pakistan-uae/" },
  { label: "SAP B1 Support", href: "/sap-business-one-support-pakistan-uae/" },
  { label: "Odoo ERP", href: "/odoo-erp-consultant-pakistan-uae/" },
  { label: "Odoo Customization", href: "/odoo-customization-development-services/" },
  { label: "ERPNext", href: "/erpnext-implementation-services/" },
  { label: "ERP Migration", href: "/erp-data-migration-services/" },
  { label: "Cloud Hosting", href: "/erp-cloud-hosting-managed-support/" },
  { label: "Ecommerce ERP", href: "/ecommerce-erp-integration-services/" },
  { label: "AI Warehouse", href: "/ai-warehouse-management-system/" },
  { label: "Dedicated Developers", href: "/software-development-outsourcing-pakistan-uae/" },
];

const pages = [
  {
    slug: "erp-implementation-consultants-pakistan-uae",
    title: "ERP Implementation Consultants in Pakistan & UAE | ABiT Consulting",
    description:
      "ABiT Consulting plans, implements, customizes and supports ERP systems for companies in Pakistan, UAE, Saudi Arabia and worldwide, including SAP Business One, Odoo, ERPNext, Microsoft Dynamics, NetSuite, Sage, Tally and custom ERP platforms.",
    keywords:
      "ERP implementation consultants Pakistan, ERP consultants UAE, ERP implementation Lahore, ERP implementation Dubai, SAP Business One Odoo ERPNext consultants",
    eyebrow: "ERP Implementation Consultants",
    h1: "ERP implementation consultants for Pakistan, UAE and global teams.",
    lead:
      "ABiT helps growing companies choose, implement, customize, integrate and support ERP platforms without losing control of daily operations.",
    tags: ["Pakistan", "UAE", "Saudi Arabia", "Worldwide", "SAP B1", "Odoo", "ERPNext"],
    serviceType: "ERP implementation consulting",
    sectionTitle: "ERP services built around business workflows",
    deliverables: [
      "Process discovery, fit-gap analysis and implementation roadmap",
      "ERP configuration, migration planning, master data cleanup and training",
      "Custom modules, reports, approvals, dashboards and API integrations",
      "Post-go-live support, performance tuning and continuous improvements",
    ],
    bestFor: [
      "Manufacturing, trading, distribution, services, healthcare and retail companies",
      "Teams replacing spreadsheets or disconnected legacy software",
      "Businesses that need ERP plus web portals, mobile apps or automation",
      "Companies operating across Pakistan, UAE, Saudi Arabia and remote markets",
    ],
    outcomes: [
      "Cleaner operating data and stronger management visibility",
      "Shorter manual workflows across sales, finance, inventory and procurement",
      "One implementation partner for functional consulting and development",
      "Support coverage for ERP, integrations, hosting and custom systems",
    ],
    faqs: [
      {
        q: "Which ERP platforms can ABiT implement?",
        a: "ABiT works with SAP Business One, Odoo, ERPNext, Microsoft Dynamics, NetSuite, Sage, Tally and custom ERP systems. The team also builds integrations and custom modules around these platforms.",
      },
      {
        q: "Do you support companies outside Pakistan?",
        a: "Yes. ABiT supports businesses in Pakistan, UAE, Saudi Arabia and worldwide through remote delivery, scheduled workshops and managed support.",
      },
      {
        q: "Can you improve an existing ERP setup?",
        a: "Yes. ABiT can audit current configuration, data quality, reports, integrations and user workflows, then prioritize improvements that reduce operational friction.",
      },
    ],
  },
  {
    slug: "sap-business-one-consultant-pakistan-uae",
    title: "SAP Business One Consultant Pakistan & UAE | ABiT Consulting",
    description:
      "SAP Business One implementation, add-on development, Service Layer integrations, B1if integrations, reporting, support and cloud hosting for businesses in Pakistan, UAE and worldwide.",
    keywords:
      "SAP Business One consultant Pakistan, SAP B1 consultant UAE, SAP Business One implementation, SAP B1 Service Layer, B1if integration",
    eyebrow: "SAP Business One",
    h1: "SAP Business One consultants for implementation, integrations and support.",
    lead:
      "ABiT delivers SAP Business One projects from process mapping to go-live, with technical development for add-ons, portals, reports and third-party integrations.",
    tags: ["SAP B1", "Service Layer", "B1if", "Add-ons", "Cloud Hosting"],
    serviceType: "SAP Business One consulting",
    sectionTitle: "SAP Business One delivery scope",
    deliverables: [
      "SAP Business One implementation, configuration and user enablement",
      "Add-on development for payroll, quality, gate pass and industry workflows",
      "Service Layer, B1if, ecommerce, WhatsApp, finance and reporting integrations",
      "Crystal Reports, dashboards, support, monitoring and cloud hosting",
    ],
    bestFor: [
      "Companies standardizing finance, purchasing, inventory, sales and production",
      "SAP B1 users who need portals, approvals or customer self-service",
      "Operations teams that need WMS, barcode, reporting or automated alerts",
      "Organizations looking for SAP B1 consultants in Pakistan, UAE or remote markets",
    ],
    outcomes: [
      "More reliable SAP Business One workflows and cleaner approvals",
      "Fewer disconnected spreadsheets and manual re-entry points",
      "Custom extensions that match how teams actually work",
      "One partner for SAP B1 consulting, development, integrations and support",
    ],
    faqs: [
      {
        q: "Can ABiT integrate SAP Business One with third-party systems?",
        a: "Yes. ABiT builds integrations using SAP Business One Service Layer, B1if, APIs, scheduled jobs and custom middleware depending on the use case.",
      },
      {
        q: "Do you build SAP Business One add-ons?",
        a: "Yes. ABiT develops add-ons and portals for workflows such as payroll, quality, gate pass, approvals, WMS, reporting and customer or vendor access.",
      },
      {
        q: "Can you host and support SAP Business One?",
        a: "Yes. ABiT provides managed hosting, backup, monitoring, performance support and ongoing enhancements for SAP Business One environments.",
      },
    ],
  },
  {
    slug: "odoo-erp-consultant-pakistan-uae",
    title: "Odoo ERP Consultant Pakistan & UAE | ABiT Consulting",
    description:
      "Odoo ERP implementation, customization, ecommerce integration, migration, reports, managed support and custom module development for Pakistan, UAE and worldwide businesses.",
    keywords:
      "Odoo ERP consultant Pakistan, Odoo implementation UAE, Odoo customization, Odoo ecommerce integration, Odoo development company",
    eyebrow: "Odoo ERP",
    h1: "Odoo ERP consultants for implementation, customization and support.",
    lead:
      "ABiT helps businesses roll out Odoo with the right modules, custom workflows, ecommerce integrations, reports and long-term support.",
    tags: ["Odoo ERP", "Customization", "Ecommerce", "Reports", "Support"],
    serviceType: "Odoo ERP consulting",
    sectionTitle: "Odoo services for growing teams",
    deliverables: [
      "Odoo module selection, configuration, migration and go-live support",
      "Custom Odoo modules, workflows, approval flows and print formats",
      "Ecommerce, payment, warehouse, finance and API integrations",
      "Dashboards, user training, support plans and performance improvements",
    ],
    bestFor: [
      "Companies moving from spreadsheets or disconnected systems to Odoo",
      "Retail, ecommerce, trading, services and distribution teams",
      "Businesses that need Odoo customization beyond standard modules",
      "Teams requiring Odoo support in Pakistan, UAE or remote markets",
    ],
    outcomes: [
      "Odoo configured around real processes rather than generic defaults",
      "Faster order, inventory, invoicing and approval workflows",
      "Connected ecommerce and finance data",
      "A delivery team that handles both implementation and custom development",
    ],
    faqs: [
      {
        q: "Can ABiT customize Odoo modules?",
        a: "Yes. ABiT builds custom Odoo modules, reports, workflows, integrations, print formats and automation around standard Odoo apps.",
      },
      {
        q: "Do you migrate data into Odoo?",
        a: "Yes. ABiT helps clean, map and migrate master data and transactional data as part of the implementation plan.",
      },
      {
        q: "Can Odoo connect with ecommerce or payment systems?",
        a: "Yes. ABiT integrates Odoo with ecommerce, payment, shipping, warehouse, reporting and finance systems through APIs and custom connectors.",
      },
    ],
  },
  {
    slug: "erpnext-implementation-services",
    title: "ERPNext Implementation Services | ABiT Consulting",
    description:
      "ERPNext implementation, customization, workflows, print formats, reports, integrations and managed support for manufacturing, trading, services and distribution businesses.",
    keywords:
      "ERPNext implementation, ERPNext consultant, ERPNext customization, ERPNext support, ERPNext integration",
    eyebrow: "ERPNext Implementation",
    h1: "ERPNext implementation services for flexible business operations.",
    lead:
      "ABiT configures and extends ERPNext for teams that want open-source ERP with practical workflows, clean reporting and support after launch.",
    tags: ["ERPNext", "Open Source ERP", "Workflows", "Reports", "Support"],
    serviceType: "ERPNext implementation",
    sectionTitle: "ERPNext delivery scope",
    deliverables: [
      "ERPNext setup, module configuration and role-based workflows",
      "Custom fields, doctypes, print formats, approvals and reports",
      "Accounting, inventory, sales, purchasing, manufacturing and HR workflows",
      "API integrations, hosting support, backups, monitoring and training",
    ],
    bestFor: [
      "Companies that want flexible open-source ERP",
      "Teams needing ERPNext customization and local process alignment",
      "Businesses that need dashboards, approvals and reliable reporting",
      "Organizations planning ERPNext support and continuous improvement",
    ],
    outcomes: [
      "Lower friction moving from manual operations to ERPNext",
      "Better control of approvals, stock, finance and procurement",
      "Custom workflows without losing maintainability",
      "Clear support path after go-live",
    ],
    faqs: [
      {
        q: "Can ABiT customize ERPNext?",
        a: "Yes. ABiT customizes ERPNext with custom fields, doctypes, workflows, print formats, dashboards, reports and integrations.",
      },
      {
        q: "Do you support ERPNext hosting?",
        a: "Yes. ABiT can support managed hosting, backups, monitoring and performance work for ERPNext deployments.",
      },
      {
        q: "Which teams fit ERPNext best?",
        a: "ERPNext can fit growing teams that need accounting, stock, sales, purchasing, manufacturing, HR and project workflows with strong customization flexibility.",
      },
    ],
  },
  {
    slug: "erp-cloud-hosting-managed-support",
    title: "ERP Cloud Hosting & Managed Support | ABiT Consulting",
    description:
      "Managed ERP cloud hosting, migration, backups, monitoring, performance tuning and support for SAP Business One, Odoo, ERPNext and custom business systems.",
    keywords:
      "ERP cloud hosting, SAP Business One hosting, Odoo hosting, ERPNext hosting, managed ERP support, bare metal ERP hosting",
    eyebrow: "ERP Cloud Hosting",
    h1: "Managed ERP cloud hosting and support for business-critical systems.",
    lead:
      "ABiT hosts, monitors and supports ERP workloads and custom applications so teams can focus on operations instead of infrastructure problems.",
    tags: ["Cloud Hosting", "Bare Metal", "Backups", "Monitoring", "Support"],
    serviceType: "Managed ERP cloud hosting",
    sectionTitle: "Hosting and support coverage",
    deliverables: [
      "Cloud or bare metal hosting for ERP and custom business systems",
      "Migration planning, backup strategy, monitoring and uptime checks",
      "Performance tuning for ERP, databases, APIs and web portals",
      "Support desk coordination for incidents, changes and enhancements",
    ],
    bestFor: [
      "SAP Business One, Odoo, ERPNext and custom ERP environments",
      "Companies that need stronger backups and monitoring",
      "Teams moving from on-premise servers to managed infrastructure",
      "Businesses requiring support across ERP, integrations and portals",
    ],
    outcomes: [
      "More predictable ERP performance",
      "Faster response when systems or integrations fail",
      "Cleaner ownership across application and infrastructure support",
      "Hosting plans aligned with business risk and growth",
    ],
    faqs: [
      {
        q: "Can ABiT host SAP Business One, Odoo and ERPNext?",
        a: "Yes. ABiT supports cloud and managed hosting patterns for SAP Business One, Odoo, ERPNext and custom business applications.",
      },
      {
        q: "Do you handle backups and monitoring?",
        a: "Yes. ABiT can design backup schedules, monitoring, alerts, restore checks and support procedures for business-critical environments.",
      },
      {
        q: "Can you support existing servers?",
        a: "Yes. ABiT can review current infrastructure, identify risks and provide managed support or migration planning.",
      },
    ],
  },
  {
    slug: "custom-erp-software-development",
    title: "Custom ERP Software Development | ABiT Consulting",
    description:
      "Custom ERP modules, portals, dashboards, mobile apps, approval workflows, reporting and API integrations for teams that need software built around their operations.",
    keywords:
      "custom ERP software development, ERP portal development, ERP integration, custom business software, ERP dashboard development",
    eyebrow: "Custom ERP Software",
    h1: "Custom ERP software development for workflows standard systems miss.",
    lead:
      "ABiT builds the modules, portals, apps, reports and integrations that help ERP users work faster without replacing the systems they already depend on.",
    tags: ["ERP Portals", "Dashboards", "Approvals", "Mobile Apps", "APIs"],
    serviceType: "Custom ERP software development",
    sectionTitle: "Custom development around ERP",
    deliverables: [
      "Customer, vendor, employee and management self-service portals",
      "Approval workflows, alerts, dashboards, reports and document automation",
      "Mobile apps and field workflows connected to ERP data",
      "API integrations with ecommerce, finance, warehouse and third-party tools",
    ],
    bestFor: [
      "Companies whose ERP is stable but daily workflows remain manual",
      "Teams using spreadsheets between departments or external partners",
      "Businesses needing customer portals or internal approval systems",
      "Operations requiring dashboards, reports or mobile capture",
    ],
    outcomes: [
      "Fewer manual handoffs between ERP and business teams",
      "Better visibility for managers, customers, vendors and field users",
      "ERP extensions that preserve core system stability",
      "Reusable software assets for future workflow expansion",
    ],
    faqs: [
      {
        q: "Can ABiT build portals around an existing ERP?",
        a: "Yes. ABiT builds customer, vendor, employee and management portals that connect with ERP data through APIs, middleware or scheduled sync patterns.",
      },
      {
        q: "Do you build mobile apps connected to ERP?",
        a: "Yes. ABiT develops mobile workflows for approvals, field data capture, inventory, reporting and customer-facing use cases.",
      },
      {
        q: "Can custom software work with SAP B1, Odoo or ERPNext?",
        a: "Yes. ABiT builds around SAP Business One, Odoo, ERPNext and custom ERP systems.",
      },
    ],
  },
  {
    slug: "zatca-e-invoicing-erp-integration",
    title: "ZATCA E-Invoicing ERP Integration | ABiT Consulting",
    description:
      "ZATCA Phase 1 and Phase 2 e-invoicing integration for Saudi Arabia businesses using SAP Business One, Odoo, ERPNext or custom ERP systems.",
    keywords:
      "ZATCA e invoicing integration, Saudi Arabia e invoicing ERP, FATOORA integration, SAP Business One ZATCA, Odoo ZATCA integration",
    eyebrow: "Saudi Arabia E-Invoicing",
    h1: "ZATCA e-invoicing integration for ERP systems in Saudi Arabia.",
    lead:
      "ABiT builds ERP-connected e-invoicing workflows for Saudi Arabia businesses that need compliant invoice generation, clearance, reporting and audit readiness.",
    tags: ["ZATCA", "FATOORA", "Saudi Arabia", "SAP B1", "Odoo", "ERPNext"],
    serviceType: "ZATCA e-invoicing ERP integration",
    sectionTitle: "ZATCA integration capabilities",
    deliverables: [
      "ZATCA Phase 1 and Phase 2 workflow planning and ERP field mapping",
      "UBL 2.1 XML generation, QR code, hash chaining and validation support",
      "Real-time clearance/reporting integration and submission status tracking",
      "Error handling, audit trail, secure archiving and user dashboards",
    ],
    bestFor: [
      "Saudi businesses running SAP Business One, Odoo, ERPNext or custom ERP",
      "Finance teams needing automated invoice clearance and reporting",
      "Multi-branch companies with high invoice volumes",
      "ERP users replacing manual e-invoicing export/import steps",
    ],
    outcomes: [
      "Reduced manual compliance handling",
      "Traceable invoice submission and re-submission workflows",
      "Cleaner ERP-to-tax authority data mapping",
      "Better readiness for audits and scale",
    ],
    faqs: [
      {
        q: "Which ERPs can ABiT connect with ZATCA?",
        a: "ABiT can integrate ZATCA e-invoicing workflows with SAP Business One, Odoo, ERPNext and custom ERP systems.",
      },
      {
        q: "Does the solution support invoice status tracking?",
        a: "Yes. ABiT can build dashboards, logs and re-submission workflows around clearance or reporting responses.",
      },
      {
        q: "Can this work for multi-branch businesses?",
        a: "Yes. ABiT designs field mapping, certificates, user roles and reporting with multi-branch requirements in mind.",
      },
    ],
  },
  {
    slug: "fbr-digital-invoicing-erp-integration",
    title: "FBR Digital Invoicing ERP Integration | ABiT Consulting",
    description:
      "FBR digital invoicing and tax integration for Pakistan businesses using SAP Business One, Odoo, ERPNext or custom ERP systems, with submission tracking and audit-ready reporting.",
    keywords:
      "FBR digital invoicing integration, Pakistan ERP tax integration, FBR invoice integration, SAP B1 FBR, Odoo FBR integration",
    eyebrow: "Pakistan Digital Invoicing",
    h1: "FBR digital invoicing integration for ERP systems in Pakistan.",
    lead:
      "ABiT connects business systems with FBR-ready invoicing workflows so finance teams can validate, submit, track and reconcile invoices with less manual work.",
    tags: ["FBR", "Pakistan", "Digital Invoicing", "SAP B1", "Odoo", "ERPNext"],
    serviceType: "FBR digital invoicing ERP integration",
    sectionTitle: "FBR integration capabilities",
    deliverables: [
      "ERP field mapping, invoice validation and submission workflow design",
      "Secure authentication, status tracking, retry handling and logs",
      "Admin dashboard for configuration, monitoring and reconciliation",
      "Sandbox testing, production readiness and reporting exports",
    ],
    bestFor: [
      "Pakistan businesses that need ERP-connected invoice compliance",
      "Finance teams managing high-volume invoicing or multiple locations",
      "Companies using SAP Business One, Odoo, ERPNext or custom systems",
      "Teams that need audit trails and reconciliation visibility",
    ],
    outcomes: [
      "Less manual invoice preparation and submission",
      "Clearer status visibility for finance and compliance users",
      "Better error handling when submissions fail",
      "Reusable integration architecture for future tax workflows",
    ],
    faqs: [
      {
        q: "Can ABiT integrate FBR workflows with SAP Business One or Odoo?",
        a: "Yes. ABiT can connect FBR-ready digital invoicing workflows with SAP Business One, Odoo, ERPNext and custom ERP systems.",
      },
      {
        q: "Do you support sandbox and production testing?",
        a: "Yes. ABiT can configure testing workflows, logs and transition steps before production rollout.",
      },
      {
        q: "Can users track invoice status?",
        a: "Yes. ABiT can build dashboards, logs and retry workflows so finance users can track submissions and errors.",
      },
    ],
  },
  {
    slug: "ai-warehouse-management-system",
    title: "AI Warehouse Management System & ERP Integration | ABiT",
    description:
      "AI-assisted warehouse management, inventory reporting, picking, receiving, dispatch workflows and ERP integration for SAP Business One, Odoo, ERPNext and custom systems.",
    keywords:
      "AI warehouse management system, WMS ERP integration, SAP Business One WMS, AI inventory chatbot, warehouse automation",
    eyebrow: "AI Warehouse Management",
    h1: "AI warehouse management and ERP integration for faster operations.",
    lead:
      "ABiT builds WMS workflows and AI-assisted reporting that connect warehouse teams with ERP data for inventory, picking, dispatch and exception handling.",
    tags: ["WMS", "AI Chatbot", "Inventory", "SAP B1", "Odoo", "ERPNext"],
    serviceType: "AI warehouse management system",
    sectionTitle: "Warehouse automation capabilities",
    deliverables: [
      "Receiving, put-away, picking, packing, dispatch and stock movement workflows",
      "ERP integration with SAP Business One, Odoo, ERPNext or custom systems",
      "AI chatbot for inventory questions, stock reports and operational actions",
      "Dashboards, exception alerts, role-based screens and audit-ready logs",
    ],
    bestFor: [
      "Warehouses relying on spreadsheets, paper or disconnected scanners",
      "SAP Business One users who need WMS and inventory visibility",
      "Distribution, manufacturing, retail and service operations",
      "Teams that need faster reporting without waiting on manual exports",
    ],
    outcomes: [
      "Faster access to stock, movement and fulfillment information",
      "Reduced manual reporting and fewer warehouse blind spots",
      "Better connection between warehouse teams and ERP records",
      "Practical AI workflows that support day-to-day operations",
    ],
    faqs: [
      {
        q: "Can the WMS connect with SAP Business One?",
        a: "Yes. ABiT can integrate WMS workflows with SAP Business One and also support Odoo, ERPNext or custom ERP platforms.",
      },
      {
        q: "What can the AI warehouse chatbot do?",
        a: "The chatbot can support inventory questions, stock reports and operational workflows when connected to approved ERP and warehouse data.",
      },
      {
        q: "Can the WMS run independently?",
        a: "Yes. ABiT can design WMS workflows that integrate with ERP but also support independent operation where needed.",
      },
    ],
  },
  {
    slug: "dedicated-development-team",
    title: "Dedicated Software Development Team | ABiT Consulting",
    description:
      "Hire a dedicated remote development team for ERP, web, mobile, integrations, support and automation projects with ABiT Consulting.",
    keywords:
      "dedicated development team, hire ERP developers, remote software development team, hire Odoo developer, hire SAP Business One developer",
    eyebrow: "Dedicated Development Team",
    h1: "Dedicated developers and ERP specialists for faster delivery.",
    lead:
      "ABiT provides remote teams of developers, analysts and support specialists for companies that need consistent delivery capacity without building every role in-house.",
    tags: ["Developers", "ERP Specialists", "Remote Team", "Support", "Delivery"],
    serviceType: "Dedicated software development team",
    sectionTitle: "Dedicated team coverage",
    deliverables: [
      "ERP consultants, developers, QA, integration engineers and support resources",
      "Web, mobile, portal, reporting, automation and API delivery",
      "Sprint planning, backlog execution, documentation and status reporting",
      "Ongoing support for SAP Business One, Odoo, ERPNext and custom systems",
    ],
    bestFor: [
      "Companies needing reliable development capacity",
      "Teams with ERP backlogs, integration work or reporting demand",
      "Businesses that need support coverage after go-live",
      "Founders and IT managers scaling delivery without long hiring cycles",
    ],
    outcomes: [
      "More consistent project throughput",
      "Access to ERP and software engineering skills in one team",
      "Flexible capacity for implementation, support and custom development",
      "Lower management overhead than assembling separate vendors",
    ],
    faqs: [
      {
        q: "Can ABiT provide ERP developers and consultants?",
        a: "Yes. ABiT can provide resources for ERP consulting, development, integrations, reporting, QA and support.",
      },
      {
        q: "Can the team work with our existing process?",
        a: "Yes. ABiT can align to your backlog, delivery cadence, communication tools and reporting expectations.",
      },
      {
        q: "Do dedicated teams support existing systems?",
        a: "Yes. Dedicated teams can support existing ERP, web, mobile, integration and reporting systems while also delivering new work.",
      },
    ],
  },
  {
    slug: "sap-business-one-support-pakistan-uae",
    title: "SAP Business One Support Pakistan & UAE | ABiT Consulting",
    description:
      "SAP Business One support, troubleshooting, reporting, add-on fixes, Service Layer integrations, performance tuning and managed support for Pakistan, UAE and remote teams.",
    keywords:
      "SAP Business One support Pakistan, SAP B1 support UAE, SAP Business One troubleshooting, SAP B1 reports, SAP Business One Service Layer support",
    eyebrow: "SAP Business One Support",
    h1: "SAP Business One support for teams that need stable daily operations.",
    lead:
      "ABiT supports SAP Business One users with issue resolution, reports, add-ons, integrations, hosting coordination and practical improvements after go-live.",
    tags: ["SAP B1", "Support", "Reports", "Integrations", "Hosting"],
    serviceType: "SAP Business One support",
    sectionTitle: "SAP Business One support coverage",
    deliverables: [
      "Functional support for finance, sales, purchasing, inventory and production workflows",
      "Technical fixes for add-ons, reports, Service Layer, B1if and API integrations",
      "Performance review, backup checks, user access review and hosting coordination",
      "Support desk process, issue triage, documentation and enhancement planning",
    ],
    bestFor: [
      "Companies already running SAP Business One but facing daily user friction",
      "Teams with slow reports, broken integrations or unstable add-ons",
      "Businesses that need a support partner across Pakistan, UAE or remote markets",
      "IT and finance teams planning phased SAP B1 improvements after go-live",
    ],
    outcomes: [
      "Faster response on SAP Business One issues",
      "Cleaner reporting, integrations and approval workflows",
      "Less disruption from recurring system problems",
      "A support path that covers both functional and technical work",
    ],
    faqs: [
      {
        q: "Can ABiT support an existing SAP Business One installation?",
        a: "Yes. ABiT can review the current setup, resolve issues, improve reports, support add-ons and maintain integrations for an existing SAP Business One environment.",
      },
      {
        q: "Do you support SAP B1 reports and dashboards?",
        a: "Yes. ABiT can improve Crystal Reports, dashboards, exports and operational reports connected to SAP Business One data.",
      },
      {
        q: "Can support include integrations?",
        a: "Yes. ABiT supports integrations built with Service Layer, B1if, APIs, middleware and scheduled data exchange patterns.",
      },
    ],
  },
  {
    slug: "odoo-customization-development-services",
    title: "Odoo Customization & Development Services | ABiT Consulting",
    description:
      "Odoo customization, module development, workflows, reports, print formats, ecommerce connectors, migration and managed support for Pakistan, UAE and worldwide businesses.",
    keywords:
      "Odoo customization services, Odoo development company, Odoo module development, Odoo reports, Odoo ecommerce integration",
    eyebrow: "Odoo Customization",
    h1: "Odoo customization and development for workflows standard modules miss.",
    lead:
      "ABiT extends Odoo with custom modules, reports, approvals, ecommerce connectors, migration support and integrations that match real operating processes.",
    tags: ["Odoo", "Custom Modules", "Reports", "Ecommerce", "APIs"],
    serviceType: "Odoo customization and development",
    sectionTitle: "Odoo development capabilities",
    deliverables: [
      "Custom Odoo modules, fields, workflows, approval flows and access rules",
      "Print formats, dashboards, reports, imports, exports and automation",
      "Ecommerce, payment, shipping, warehouse, finance and third-party API connectors",
      "Code review, migration support, performance fixes and managed support",
    ],
    bestFor: [
      "Businesses that use Odoo but still rely on spreadsheets or manual steps",
      "Ecommerce, trading, services, distribution and manufacturing teams",
      "Companies needing custom Odoo reports, connectors or approval flows",
      "Teams planning upgrades, migrations or cleanup of existing Odoo customizations",
    ],
    outcomes: [
      "Odoo screens and workflows aligned with how users work",
      "Reduced manual re-entry between Odoo and other systems",
      "Cleaner reporting for finance, sales, inventory and operations",
      "Custom development that can be supported after launch",
    ],
    faqs: [
      {
        q: "Can ABiT build custom Odoo modules?",
        a: "Yes. ABiT builds custom modules, reports, print formats, workflows and integrations around standard Odoo apps.",
      },
      {
        q: "Can you improve existing Odoo customizations?",
        a: "Yes. ABiT can review current custom code, identify stability or upgrade risks and prioritize fixes.",
      },
      {
        q: "Do you connect Odoo with ecommerce platforms?",
        a: "Yes. ABiT can connect Odoo with ecommerce, payment, warehouse, shipping and finance systems through APIs and custom connectors.",
      },
    ],
  },
  {
    slug: "erp-data-migration-services",
    title: "ERP Data Migration Services | ABiT Consulting",
    description:
      "ERP data migration planning, cleanup, mapping, imports, validation and go-live support for SAP Business One, Odoo, ERPNext and custom ERP systems.",
    keywords:
      "ERP data migration services, SAP Business One data migration, Odoo data migration, ERPNext migration, ERP master data cleanup",
    eyebrow: "ERP Data Migration",
    h1: "ERP data migration services for cleaner go-lives and better reporting.",
    lead:
      "ABiT helps businesses move customers, vendors, items, inventory, opening balances and transaction history into ERP with a practical migration plan.",
    tags: ["Migration", "Master Data", "Validation", "SAP B1", "Odoo", "ERPNext"],
    serviceType: "ERP data migration",
    sectionTitle: "ERP migration delivery scope",
    deliverables: [
      "Migration inventory, data templates, field mapping and ownership plan",
      "Master data cleanup for customers, vendors, items, chart of accounts and stock",
      "Import scripts, validation reports, reconciliation and user sign-off support",
      "Cutover planning, test migrations, go-live support and post-migration fixes",
    ],
    bestFor: [
      "Companies replacing spreadsheets, legacy systems or disconnected software",
      "Teams moving to SAP Business One, Odoo, ERPNext or a custom ERP",
      "Businesses with duplicate, incomplete or inconsistent master data",
      "Finance and operations teams that need reliable opening balances and stock",
    ],
    outcomes: [
      "Cleaner ERP master data from the first day of use",
      "Lower go-live risk from tested imports and reconciliations",
      "Better reporting accuracy after implementation",
      "A repeatable migration process for future branches or companies",
    ],
    faqs: [
      {
        q: "Which ERP systems can ABiT migrate data into?",
        a: "ABiT can support migration into SAP Business One, Odoo, ERPNext and custom ERP systems.",
      },
      {
        q: "Can you clean data before migration?",
        a: "Yes. ABiT can help identify duplicates, missing fields, inactive records and mapping issues before import.",
      },
      {
        q: "Do you run test migrations before go-live?",
        a: "Yes. ABiT recommends test imports, validation reports and user sign-off before production cutover.",
      },
    ],
  },
  {
    slug: "ecommerce-erp-integration-services",
    title: "Ecommerce ERP Integration Services | ABiT Consulting",
    description:
      "Connect Shopify, Magento, WooCommerce, custom ecommerce stores and marketplaces with SAP Business One, Odoo, ERPNext or custom ERP systems.",
    keywords:
      "ecommerce ERP integration, Shopify SAP Business One integration, Magento ERP integration, WooCommerce Odoo integration, marketplace ERP connector",
    eyebrow: "Ecommerce ERP Integration",
    h1: "Ecommerce ERP integration for cleaner orders, stock and finance data.",
    lead:
      "ABiT connects online stores and marketplaces with ERP workflows so sales, stock, customer, invoice and fulfillment data move with fewer manual handoffs.",
    tags: ["Shopify", "Magento", "WooCommerce", "Marketplaces", "ERP APIs"],
    serviceType: "Ecommerce ERP integration",
    sectionTitle: "Ecommerce integration capabilities",
    deliverables: [
      "Order, customer, product, inventory, invoice and payment sync planning",
      "Connectors for Shopify, Magento, WooCommerce, marketplaces and custom stores",
      "ERP integration with SAP Business One, Odoo, ERPNext or custom systems",
      "Error handling, retry queues, logs, dashboards and reconciliation reports",
    ],
    bestFor: [
      "Retailers and distributors selling through ecommerce and ERP at the same time",
      "Teams manually entering web orders into SAP Business One, Odoo or ERPNext",
      "Businesses needing accurate stock availability across channels",
      "Companies scaling marketplace, B2B portal or D2C operations",
    ],
    outcomes: [
      "Less duplicate order entry and fewer stock mismatches",
      "Faster fulfillment and finance reconciliation",
      "Better visibility across ecommerce, warehouse and ERP users",
      "Integration architecture that can expand to more channels",
    ],
    faqs: [
      {
        q: "Can ABiT connect Shopify with SAP Business One?",
        a: "Yes. ABiT can connect Shopify and other ecommerce platforms with SAP Business One using APIs, middleware and scheduled sync patterns.",
      },
      {
        q: "Can ecommerce integration update inventory?",
        a: "Yes. Integrations can be designed to sync available stock, product data, orders, invoices and fulfillment status based on business rules.",
      },
      {
        q: "Do you integrate custom ecommerce platforms?",
        a: "Yes. ABiT can work with custom stores and marketplaces where API or database integration access is available.",
      },
    ],
  },
  {
    slug: "software-development-outsourcing-pakistan-uae",
    title: "Software Development Outsourcing Pakistan & UAE | ABiT Consulting",
    description:
      "Outsource software development, ERP developers, web and mobile engineers, integration specialists and support teams for Pakistan, UAE and international projects.",
    keywords:
      "software development outsourcing Pakistan, software outsourcing UAE, hire remote developers, ERP developers Pakistan, dedicated development team UAE",
    eyebrow: "Software Development Outsourcing",
    h1: "Software development outsourcing for ERP, web, mobile and integration work.",
    lead:
      "ABiT provides developers, ERP specialists, QA, integration engineers and support resources for teams that need delivery capacity without long hiring cycles.",
    tags: ["Outsourcing", "Remote Developers", "ERP Developers", "QA", "Support"],
    serviceType: "Software development outsourcing",
    sectionTitle: "Outsourced team capabilities",
    deliverables: [
      "Dedicated developers for ERP, web, mobile, portals, APIs and reporting",
      "ERP functional and technical specialists for SAP Business One, Odoo and ERPNext",
      "QA, documentation, support desk coordination and sprint delivery",
      "Flexible engagement models for project delivery, backlog execution and support",
    ],
    bestFor: [
      "Companies that need more software delivery capacity",
      "IT managers with ERP customization, integration or support backlogs",
      "Founders building customer portals, SaaS products or mobile applications",
      "Businesses in Pakistan, UAE or remote markets needing reliable outsourced teams",
    ],
    outcomes: [
      "Faster backlog progress without permanent hiring delays",
      "One team for ERP knowledge and software engineering execution",
      "Flexible capacity for implementation, enhancement and support work",
      "Clearer ownership across delivery, QA and support",
    ],
    faqs: [
      {
        q: "Can ABiT provide remote developers for an existing team?",
        a: "Yes. ABiT can provide developers, ERP specialists, QA and support resources who align with an existing backlog and delivery process.",
      },
      {
        q: "Do outsourced teams handle ERP projects?",
        a: "Yes. ABiT outsourced teams can support SAP Business One, Odoo, ERPNext, custom ERP, portals, integrations and reporting work.",
      },
      {
        q: "Can the engagement include support after delivery?",
        a: "Yes. ABiT can provide ongoing support, enhancements and monitoring after a project or implementation goes live.",
      },
    ],
  },
];

const staticSitemapEntries = [
  { loc: "/", changefreq: "weekly", priority: "1.0" },
  { loc: "/sap-business-one-erp/", changefreq: "weekly", priority: "0.9" },
  { loc: "/odoo-erp/", changefreq: "weekly", priority: "0.9" },
  { loc: "/web-development-services/", changefreq: "weekly", priority: "0.8" },
  { loc: "/mobile-app-development-services/", changefreq: "weekly", priority: "0.8" },
  { loc: "/iotinternet-of-things/", changefreq: "weekly", priority: "0.8" },
  { loc: "/schedule-meeting/", changefreq: "monthly", priority: "0.7" },
  { loc: "/integration-of-shopify-sap-business-one/", changefreq: "monthly", priority: "0.7" },
  { loc: "/sap-business-one-integration-with-whatsapp-messenger/", changefreq: "monthly", priority: "0.7" },
];

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const pageUrl = (slug = "") => `${baseUrl}/${slug ? `${slug}/` : ""}`;

const list = (items) => items.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n");

const cardList = (title, items) => `
          <article class="seo-card">
            <h2>${escapeHtml(title)}</h2>
            <ul>
${list(items)}
            </ul>
          </article>`;

const relatedLinks = (currentSlug) =>
  commonLinks
    .filter((link) => !link.href.includes(currentSlug))
    .map((link) => `<a href="${link.href}">${escapeHtml(link.label)}</a>`)
    .join("\n");

const jsonLd = (page) => {
  const url = pageUrl(page.slug);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Organization", "ProfessionalService"],
        "@id": `${baseUrl}/#organization`,
        name: company.name,
        legalName: company.legalName,
        url: company.url,
        logo: company.logo,
        email: company.email,
        telephone: company.telephone,
        foundingDate: "2017",
        numberOfEmployees: {
          "@type": "QuantitativeValue",
          value: "11-50",
        },
        address: {
          "@type": "PostalAddress",
          streetAddress: "Head Office 116 Block F1",
          addressLocality: "Johar Town",
          addressRegion: "Lahore",
          postalCode: "54000",
          addressCountry: "PK",
        },
        areaServed: ["Pakistan", "United Arab Emirates", "Saudi Arabia", "Worldwide"],
        sameAs: [company.facebook, company.linkedIn],
      },
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: page.title,
        description: page.description,
        dateModified: lastmod,
        isPartOf: {
          "@id": `${baseUrl}/#website`,
        },
        about: {
          "@id": `${url}#service`,
        },
        breadcrumb: {
          "@id": `${url}#breadcrumb`,
        },
      },
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: page.serviceType,
        serviceType: page.serviceType,
        description: page.description,
        provider: {
          "@id": `${baseUrl}/#organization`,
        },
        areaServed: ["Pakistan", "United Arab Emirates", "Saudi Arabia", "Worldwide"],
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: page.sectionTitle,
          itemListElement: page.deliverables.map((item) => ({
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: item,
            },
          })),
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: page.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.a,
          },
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: baseUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: page.h1,
            item: url,
          },
        ],
      },
    ],
  };
};

const renderPage = (page) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(page.title)}</title>
    <meta name="description" content="${escapeHtml(page.description)}" />
    <meta name="keywords" content="${escapeHtml(page.keywords)}" />
    <meta name="robots" content="follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large" />
    <link rel="canonical" href="${pageUrl(page.slug)}" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(page.title)}" />
    <meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:url" content="${pageUrl(page.slug)}" />
    <meta property="og:site_name" content="ABiT Consulting" />
    <meta property="og:image" content="${baseUrl}/assets/hero-pic.png" />
    <meta property="og:image:alt" content="ABiT Consulting ERP and software development services" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(page.title)}" />
    <meta name="twitter:description" content="${escapeHtml(page.description)}" />
    <meta name="twitter:image" content="${baseUrl}/assets/hero-pic.png" />
    <meta name="theme-color" content="#0b1b3b" />
    <link rel="icon" href="/assets/favicon-32.png" sizes="32x32" />
    <link rel="icon" href="/assets/favicon-192.png" sizes="192x192" />
    <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
    <link rel="stylesheet" href="/assets/seo-landing.css?v=${lastmod.replaceAll("-", "")}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd(page))}</script>
  </head>
  <body>
    <header class="seo-header">
      <a class="seo-logo" href="/" aria-label="ABiT Consulting home">
        <img src="/abitlogo.png" alt="ABiT logo" />
        <span>ABiT Consulting</span>
      </a>
      <nav aria-label="Primary navigation">
        <a href="/#services">Services</a>
        <a href="/#products">Products</a>
        <a href="/#contact">Contact</a>
        <a class="nav-cta" href="/schedule-meeting/">Schedule Meeting</a>
      </nav>
    </header>

    <main>
      <section class="seo-hero">
        <div class="seo-hero__content">
          <p class="eyebrow">${escapeHtml(page.eyebrow)}</p>
          <h1>${escapeHtml(page.h1)}</h1>
          <p class="lead">${escapeHtml(page.lead)}</p>
          <div class="tag-row">
            ${page.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("\n            ")}
          </div>
          <div class="actions">
            <a class="button primary" href="/#contact">Talk to ABiT</a>
            <a class="button secondary" href="https://wa.me/923313133999" target="_blank" rel="noreferrer">WhatsApp</a>
          </div>
        </div>
        <aside class="seo-proof" aria-label="ABiT service highlights">
          <strong>ABIT Consulting (Pvt) Ltd.</strong>
          <p>ERP, integrations, cloud support and custom software delivery since 2017.</p>
          <dl>
            <div><dt>Platforms</dt><dd>SAP B1, Odoo, ERPNext and more</dd></div>
            <div><dt>Regions</dt><dd>Pakistan, UAE, Saudi Arabia, worldwide</dd></div>
            <div><dt>Contact</dt><dd><a href="mailto:info@abitcons.com">info@abitcons.com</a></dd></div>
          </dl>
        </aside>
      </section>

      <section class="seo-section">
        <div class="section-heading">
          <p class="eyebrow">What You Get</p>
          <h2>${escapeHtml(page.sectionTitle)}</h2>
        </div>
        <div class="seo-grid">
${cardList("Delivery scope", page.deliverables)}
${cardList("Best fit", page.bestFor)}
${cardList("Business outcomes", page.outcomes)}
        </div>
      </section>

      <section class="seo-section band">
        <div class="section-heading">
          <p class="eyebrow">Delivery Model</p>
          <h2>How ABiT approaches ERP and software projects</h2>
        </div>
        <div class="process-grid">
          <article>
            <span>01</span>
            <h3>Discover</h3>
            <p>Map goals, pain points, users, data sources and system constraints before recommending a platform or build path.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Build</h3>
            <p>Configure the ERP, develop missing workflows, connect integrations and test business-critical scenarios with users.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Support</h3>
            <p>Monitor launch, resolve issues, improve reports and keep enhancements moving after the first go-live.</p>
          </article>
        </div>
      </section>

      <section class="seo-section">
        <div class="section-heading">
          <p class="eyebrow">FAQ</p>
          <h2>Common questions</h2>
        </div>
        <div class="faq-list">
          ${page.faqs
            .map(
              (faq) => `<details>
            <summary>${escapeHtml(faq.q)}</summary>
            <p>${escapeHtml(faq.a)}</p>
          </details>`
            )
            .join("\n          ")}
        </div>
      </section>

      <section class="seo-section related">
        <div class="section-heading">
          <p class="eyebrow">Related Services</p>
          <h2>Explore more ABiT services</h2>
        </div>
        <div class="related-links">
${relatedLinks(page.slug)}
        </div>
      </section>

      <section class="seo-cta">
        <h2>Need a practical plan for ${escapeHtml(page.eyebrow.toLowerCase())}?</h2>
        <p>Share your current system, goals and timeline. ABiT will help outline the right next step.</p>
        <div class="actions">
          <a class="button primary" href="/schedule-meeting/">Schedule a Meeting</a>
          <a class="button secondary" href="mailto:info@abitcons.com">Email ABiT</a>
        </div>
      </section>
    </main>

    <footer class="seo-footer">
      <div>
        <strong>ABiT Consulting</strong>
        <p>ERP consulting, custom software, integrations, cloud hosting and managed support.</p>
      </div>
      <div>
        <a href="${company.linkedIn}" target="_blank" rel="noreferrer">LinkedIn</a>
        <a href="${company.facebook}" target="_blank" rel="noreferrer">Facebook</a>
        <a href="/privacy-policy/">Privacy Policy</a>
      </div>
    </footer>
  </body>
</html>
`;

const renderSitemap = () => {
  const entries = [
    ...staticSitemapEntries,
    ...pages.map((page) => ({
      loc: `/${page.slug}/`,
      changefreq: "monthly",
      priority: page.slug.includes("erp-implementation") ? "0.9" : "0.8",
    })),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) => `  <url>
    <loc>${baseUrl}${entry.loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;
};

for (const page of pages) {
  const dir = path.join(publicDir, page.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), renderPage(page), "utf8");
}

await writeFile(path.join(publicDir, "sitemap.xml"), renderSitemap(), "utf8");

console.log(`Generated ${pages.length} SEO pages and sitemap.xml`);
