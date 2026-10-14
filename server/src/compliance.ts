export type ControlStatus = "pass" | "fail" | "unknown";

export type ControlDef = {
  code: string;
  framework: "PDPL" | "NDMO" | "NCA" | "SDAIA" | "GDPR";
  title: string;
};

export type ControlResult = ControlDef & {
  status: ControlStatus;
  evidence: string;
};

export type AppSpec =
  | { kind: "full" }
  | { kind: "zero" }
  | { kind: "fails"; fails: string[] }
  | { kind: "weak"; index: number }
  | { kind: "unscanned" }
  | { kind: "thin" };

export const FRAMEWORKS = ["PDPL", "SDAIA", "NCA", "NDMO", "GDPR"] as const;

export const CONTROLS: ControlDef[] = [
  { code: "PDPL-RESIDENCY-01", framework: "PDPL", title: "Data residency in the Kingdom" },
  { code: "PDPL-NOTICE-01", framework: "PDPL", title: "Privacy notice" },
  { code: "PDPL-CONSENT-01", framework: "PDPL", title: "Lawful basis and consent" },
  { code: "PDPL-RIGHTS-01", framework: "PDPL", title: "Data subject rights" },
  { code: "NDMO-NOTICE-01", framework: "NDMO", title: "Privacy notice disclosures" },
  { code: "NDMO-CONSENT-01", framework: "NDMO", title: "Consent granularity" },
  { code: "NDMO-RIGHTS-01", framework: "NDMO", title: "Data subject rights" },
  { code: "NDMO-MINIMIZ-01", framework: "NDMO", title: "Minimization and deletion" },
  { code: "NCA-ECC-01", framework: "NCA", title: "Access control" },
  { code: "NCA-ECC-02", framework: "NCA", title: "Logging and monitoring" },
  { code: "NCA-ECC-03", framework: "NCA", title: "Data protection" },
  { code: "SDAIA-GOV-01", framework: "SDAIA", title: "Assigned data owner" },
  { code: "SDAIA-SHARE-01", framework: "SDAIA", title: "Data sharing controls" },
  { code: "SDAIA-RECORD-01", framework: "SDAIA", title: "Processing records" },
  { code: "GDPR-LEGAL-01", framework: "GDPR", title: "Lawful basis" },
  { code: "GDPR-DPA-01", framework: "GDPR", title: "Processor terms" },
];

const FAIL_EVIDENCE: Record<string, string> = {
  "PDPL-RESIDENCY-01":
    "Data hosted externally outside the KSA: Unknown. Explicitly violates PDPL Article 29 without an approved exemption.",
  "PDPL-NOTICE-01":
    "Privacy notice does not cover the purposes, recipients, and retention period required for personal data processing.",
  "PDPL-CONSENT-01":
    "No evidenced lawful basis. Consent, where used, is not specific to the processing purpose.",
  "PDPL-RIGHTS-01":
    "Scanner found no process for access, correction, or deletion requests from data subjects.",
  "NDMO-NOTICE-01":
    "Privacy notice lacks mandatory NDMO-specific disclosures or Saudi-region data transfer transparency.",
  "NDMO-CONSENT-01":
    'Vendor uses bundled consent (global "I agree" for all purposes), violating NDMO granularity standards.',
  "NDMO-RIGHTS-01":
    "Data-subject rights workflow is not documented for this application.",
  "NDMO-MINIMIZ-01":
    "Vendor privacy policy does not include data deletion or destruction rights.",
  "NCA-ECC-01":
    "Access is broader than least privilege. No evidenced periodic access review.",
  "NCA-ECC-02":
    "Audit logging is missing or is not retained for security monitoring.",
  "NCA-ECC-03":
    "No evidenced encryption and key-handling standard for data in this application.",
  "SDAIA-GOV-01":
    "No named data owner is recorded for this application.",
  "SDAIA-SHARE-01":
    "Personal data is shared with a processor without a recorded sharing agreement.",
  "SDAIA-RECORD-01":
    "Processing record is incomplete for this application.",
  "GDPR-LEGAL-01":
    "Lawful basis is not recorded. Bundled consent is not specific enough where consent is the basis.",
  "GDPR-DPA-01":
    "No data processing terms were found for this vendor.",
};

const PASS_EVIDENCE: Record<string, string> = {
  "PDPL-RESIDENCY-01": "Processing location is evidenced inside the Kingdom of Saudi Arabia.",
  "PDPL-NOTICE-01": "Privacy notice covers purpose, recipients, and retention.",
  "PDPL-CONSENT-01": "A specific lawful basis is recorded for the processing.",
  "PDPL-RIGHTS-01": "Access, correction, and deletion requests have an owner and a path.",
  "NDMO-NOTICE-01": "Notice includes the NDMO disclosures the scanner checks for.",
  "NDMO-CONSENT-01": "Consent is collected per purpose rather than as a single bundle.",
  "NDMO-RIGHTS-01": "Data-subject rights are documented and assigned.",
  "NDMO-MINIMIZ-01":
    "Vendor privacy policy includes data deletion/destruction rights provisions.",
  "NCA-ECC-01": "Access is limited to named roles and is reviewed.",
  "NCA-ECC-02": "Security logs are enabled and retained.",
  "NCA-ECC-03": "Encryption in transit and at rest is evidenced.",
  "SDAIA-GOV-01": "A data owner is assigned for this application.",
  "SDAIA-SHARE-01": "Sharing with processors is covered by a recorded agreement.",
  "SDAIA-RECORD-01": "A processing record exists for this application.",
  "GDPR-LEGAL-01": "A lawful basis is recorded.",
  "GDPR-DPA-01": "Processor terms are on file.",
};

export const ISSUE_TITLES: Record<string, string> = {
  "PDPL-RESIDENCY-01": "Data Residency",
  "PDPL-NOTICE-01": "Privacy Notice",
  "PDPL-CONSENT-01": "Lawful Basis",
  "PDPL-RIGHTS-01": "Data Subject Rights",
  "NDMO-NOTICE-01": "Privacy Notice Disclosures",
  "NDMO-CONSENT-01": "Consent Granularity",
  "NDMO-RIGHTS-01": "Data Subject Rights",
  "NDMO-MINIMIZ-01": "Data Minimization",
  "NCA-ECC-01": "Access Control",
  "NCA-ECC-02": "Logging and Monitoring",
  "NCA-ECC-03": "Data Protection",
  "SDAIA-GOV-01": "Data Owner",
  "SDAIA-SHARE-01": "Data Sharing",
  "SDAIA-RECORD-01": "Processing Records",
  "GDPR-LEGAL-01": "Lawful Basis",
  "GDPR-DPA-01": "Processor Terms",
};

function evidenceFor(code: string, status: ControlStatus): string {
  if (status === "unknown") return "No evidence yet. This control is excluded from the score.";
  const table = status === "pass" ? PASS_EVIDENCE : FAIL_EVIDENCE;
  return table[code] ?? (status === "pass" ? "Evidence supports this control." : "This control failed.");
}

function result(def: ControlDef, status: ControlStatus): ControlResult {
  return { ...def, status, evidence: evidenceFor(def.code, status) };
}

export function assess(spec: AppSpec): ControlResult[] {
  if (spec.kind === "unscanned") {
    return CONTROLS.map((def) => result(def, "unknown"));
  }
  if (spec.kind === "thin") {
    return CONTROLS.map((def) =>
      result(def, def.code === "PDPL-RESIDENCY-01" ? "fail" : "unknown"),
    );
  }
  if (spec.kind === "full") {
    return CONTROLS.map((def) => result(def, "pass"));
  }
  if (spec.kind === "zero") {
    return CONTROLS.map((def) => result(def, "fail"));
  }
  if (spec.kind === "fails") {
    const failing = new Set(spec.fails);
    return CONTROLS.map((def) => result(def, failing.has(def.code) ? "fail" : "pass"));
  }
  const pass = new Set<string>();
  if (spec.index % 2 === 0) pass.add("NDMO-MINIMIZ-01");
  if (spec.index % 4 === 1) {
    pass.add("NDMO-RIGHTS-01");
    pass.add("NDMO-CONSENT-01");
  }
  if (spec.index % 5 === 0) {
    pass.add("NCA-ECC-01");
    pass.add("SDAIA-GOV-01");
  }
  if (spec.index % 7 === 0) pass.add("GDPR-DPA-01");
  if (spec.index % 6 === 1) pass.add("GDPR-LEGAL-01");
  return CONTROLS.map((def) => result(def, pass.has(def.code) ? "pass" : "fail"));
}

export function scoreOf(results: ControlResult[]): { score: number | null; status: string } {
  const evidenced = results.filter((item) => item.status !== "unknown");
  if (evidenced.length === 0) return { score: null, status: "Not Assessed" };
  const passed = evidenced.filter((item) => item.status === "pass").length;
  const score = Math.round((100 * passed) / evidenced.length);
  const status = score >= 90 ? "Compliant" : score >= 70 ? "Partially Compliant" : "Non-Compliant";
  return { score, status };
}

export type FrameworkScore = {
  code: string;
  score: number;
  label: string;
};

export function frameworkScores(
  rows: Array<{ framework: string; status: string }>,
): { overall: number; frameworks: FrameworkScore[] } {
  const grouped = new Map<string, { pass: number; total: number }>();
  for (const row of rows) {
    if (row.status === "unknown") continue;
    const current = grouped.get(row.framework) ?? { pass: 0, total: 0 };
    current.total += 1;
    if (row.status === "pass") current.pass += 1;
    grouped.set(row.framework, current);
  }
  const frameworks = FRAMEWORKS.map((code) => {
    const group = grouped.get(code) ?? { pass: 0, total: 0 };
    const score = group.total ? Math.round((100 * group.pass) / group.total) : 0;
    const label = score >= 90 ? "Compliant" : "Partially Compliant";
    return { code, score, label };
  });
  const overall = Math.round(
    frameworks.reduce((sum, item) => sum + item.score, 0) / frameworks.length,
  );
  return { overall, frameworks };
}
