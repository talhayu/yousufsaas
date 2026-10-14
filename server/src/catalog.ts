import type { AppSpec } from "./compliance";

export type Risk = "Low" | "Medium" | "High" | "Critical";

export type CatalogApp = {
  name: string;
  category: string;
  risk: Risk;
  users: number;
  costPerUser: number;
  flatMonthly: number;
  billingCycle: "Monthly" | "Annual";
  renewal: string;
  spec: AppSpec;
};

const HALF = [
  "PDPL-RESIDENCY-01",
  "PDPL-NOTICE-01",
  "PDPL-CONSENT-01",
  "PDPL-RIGHTS-01",
  "NDMO-NOTICE-01",
  "NDMO-CONSENT-01",
  "NDMO-MINIMIZ-01",
  "GDPR-DPA-01",
];

const JISR = [
  "NDMO-NOTICE-01",
  "NDMO-CONSENT-01",
  "PDPL-NOTICE-01",
  "PDPL-CONSENT-01",
  "GDPR-LEGAL-01",
  "NCA-ECC-02",
];

const IDARATECH = [
  "PDPL-RESIDENCY-01",
  "PDPL-NOTICE-01",
  "NDMO-NOTICE-01",
  "NDMO-CONSENT-01",
  "GDPR-LEGAL-01",
  "GDPR-DPA-01",
  "SDAIA-SHARE-01",
  "NCA-ECC-03",
];

function app(
  name: string,
  category: string,
  risk: Risk,
  users: number,
  spec: AppSpec,
  extra?: Partial<Pick<CatalogApp, "costPerUser" | "flatMonthly" | "billingCycle" | "renewal">>,
): CatalogApp {
  return {
    name,
    category,
    risk,
    users,
    costPerUser: extra?.costPerUser ?? 0,
    flatMonthly: extra?.flatMonthly ?? 0,
    billingCycle: extra?.billingCycle ?? "Monthly",
    renewal: extra?.renewal ?? "2026-06-30",
    spec,
  };
}

const NAMED: CatalogApp[] = [
  app("Jira", "Productivity", "High", 5, { kind: "fails", fails: HALF }, { costPerUser: 32, renewal: "2026-09-01" }),
  app("Notion", "Productivity", "High", 6, { kind: "fails", fails: HALF }, { costPerUser: 18 }),
  app("Salesforce", "CRM", "High", 8, { kind: "fails", fails: HALF }, { costPerUser: 90, billingCycle: "Annual" }),
  app("jisr.net", "HR", "Medium", 1, { kind: "fails", fails: JISR }, { costPerUser: 4.72, renewal: "2026-03-14" }),
  app("Dropbox", "Storage", "High", 8, { kind: "zero" }, { costPerUser: 12 }),
  app("foodics.com", "Other", "High", 12, { kind: "zero" }),
  app("Slack", "Communication", "High", 15, { kind: "zero" }, { costPerUser: 8 }),
  app("GitHub", "Development", "Medium", 9, { kind: "weak", index: 2 }, { costPerUser: 4 }),
  app("Palm.hr", "HR", "Medium", 7, {
    kind: "fails",
    fails: ["PDPL-NOTICE-01", "NDMO-NOTICE-01", "NDMO-CONSENT-01", "GDPR-DPA-01"],
  }, { costPerUser: 6 }),
  app("OfficeClientService", "Productivity", "Medium", 3, { kind: "zero" }),
  app("M365 Admin Services", "Other", "Medium", 2, { kind: "zero" }),
  app("Substrate-FileWatcher", "Other", "Low", 1, { kind: "zero" }),
  app("Meeting Migration Service", "Other", "Low", 1, { kind: "zero" }),
  app("OMSAuthorizationServicePROD", "Other", "Medium", 2, { kind: "zero" }),
  app("IC3 Long Running Operations Service", "Other", "Low", 1, { kind: "zero" }),
  app("CABProvisioning", "Other", "Medium", 2, { kind: "zero" }),
  app("CAP Neptune Prod CM Prod", "Other", "Medium", 1, { kind: "zero" }),
  app("CompliancePolicy", "Other", "Medium", 1, { kind: "zero" }),
  app("Conference Auto Attendant", "Other", "Medium", 1, { kind: "zero" }),
  app("Customer Experience Platform PROD", "Other", "Medium", 4, { kind: "zero" }),
  app("Customer Service Trial PVA", "Other", "Medium", 2, { kind: "zero" }),
  app("Dataverse", "Other", "Medium", 3, { kind: "zero" }),
  app("DeploymentScheduler", "Other", "Critical", 1, { kind: "zero" }),
  app("discord", "comms", "Critical", 4, { kind: "zero" }),
  app("app.idaratech.sa", "Other", "Medium", 6, {
    kind: "fails",
    fails: ["PDPL-NOTICE-01", "NDMO-NOTICE-01", "SDAIA-SHARE-01", "GDPR-DPA-01"],
  }),
  app("Idaratech", "Other", "High", 5, { kind: "fails", fails: IDARATECH }),
  app("signup", "Other", "Low", 1, { kind: "zero" }),
  app("M365 License Manager", "Other", "Medium", 2, { kind: "zero" }),
  app("Skype for Business Online", "Communication", "Medium", 3, { kind: "zero" }),
  app("Qiwa", "HR", "Low", 20, { kind: "full" }),
  app("Mudad", "HR", "Low", 18, { kind: "full" }),
  app("GOSI", "HR", "Low", 16, { kind: "full" }),
  app("Tamm", "Other", "Low", 11, { kind: "full" }),
  app("Absher Business", "Other", "Low", 9, { kind: "full" }),
  app("Microsoft 365", "Productivity", "Low", 40, {
    kind: "fails",
    fails: ["PDPL-NOTICE-01", "NDMO-NOTICE-01", "NCA-ECC-02", "GDPR-DPA-01"],
  }, { flatMonthly: 0, costPerUser: 22 }),
  app("Oracle Fusion Cloud", "Productivity", "Medium", 10, {
    kind: "fails",
    fails: ["PDPL-RESIDENCY-01", "NDMO-NOTICE-01", "GDPR-LEGAL-01", "SDAIA-RECORD-01"],
  }),
];

const FILLER_NAMES = [
  "Zoom", "Asana", "Figma", "HubSpot", "Zendesk", "DocuSign", "Monday.com", "Canva", "Miro",
  "Mailchimp", "Intercom", "ServiceNow", "Workday", "SAP SuccessFactors", "Webex", "Power BI",
  "Power Automate", "SharePoint Online", "OneDrive", "Exchange Online", "Microsoft Forms",
  "Microsoft Planner", "Microsoft Stream", "Microsoft Bookings", "Viva Engage", "Microsoft Intune",
  "Microsoft Sentinel", "Microsoft Purview", "Microsoft Loop", "Microsoft Whiteboard",
  "Adobe Acrobat", "Calendly", "Typeform", "Airtable", "ClickUp", "Basecamp", "Trello",
  "Smartsheet", "Freshworks", "Zoho CRM",
];

const FILLER_CATEGORIES = [
  "Analytics", "CRM", "Communication", "Customer Support", "Development", "Other",
  "Productivity", "Storage", "Design", "design",
];

export function buildCatalog(): CatalogApp[] {
  const fillers = FILLER_NAMES.map((name, index) =>
    app(
      name,
      FILLER_CATEGORIES[index % FILLER_CATEGORIES.length],
      index % 6 === 0 ? "High" : index % 5 === 0 ? "Low" : "Medium",
      (index % 9) + 1,
      index % 3 === 0 ? { kind: "zero" } : { kind: "weak", index },
      { costPerUser: index % 4 === 0 ? 10 + index : 0 },
    ),
  );
  const all = [...NAMED, ...fillers];
  if (all.length < 76) {
    while (all.length < 76) {
      const index = all.length;
      all.push(app(`Discovered Service ${index}`, "Other", "Medium", 1, { kind: "weak", index }));
    }
  }
  return all.slice(0, 76);
}

export function findCatalogApp(name: string): CatalogApp | undefined {
  return buildCatalog().find((item) => item.name.toLowerCase() === name.trim().toLowerCase());
}
