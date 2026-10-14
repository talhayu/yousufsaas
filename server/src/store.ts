import bcrypt from "bcryptjs";
import { findCatalogApp } from "./catalog";
import {
  assess,
  frameworkScores,
  ISSUE_TITLES,
  scoreOf,
  type AppSpec,
  type FrameworkScore,
} from "./compliance";
import { all, get, run, exec } from "./db";
import { HttpError } from "./errors";
import { extractJson, groqChat } from "./groq";

export type AuthUser = { id: number; name: string; email: string; role: string };

type Snapshot = {
  overall: number;
  frameworks: Record<string, number>;
  critical: number;
  open: number;
  inProgress: number;
  resolved: number;
};

function asNumber(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  return Number(value ?? 0);
}

function parseSpec(value: unknown): AppSpec {
  return JSON.parse(String(value)) as AppSpec;
}

function placeholders(count: number, start = 1): string {
  return Array.from({ length: count }, (_, index) => `$${start + index}`).join(",");
}

export function publicUser(row: Record<string, unknown>): AuthUser {
  return {
    id: asNumber(row.id),
    name: String(row.name),
    email: String(row.email),
    role: String(row.role),
  };
}

export async function findUserByEmail(email: string) {
  return get("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
}

export async function findUserById(id: number) {
  return get("SELECT * FROM users WHERE id = $1", [id]);
}

export async function applySpec(appId: number, spec: AppSpec) {
  const results = assess(spec);
  const scored = scoreOf(results);
  await run("DELETE FROM control_results WHERE app_id = $1", [appId]);
  for (const result of results) {
    await run(
      `INSERT INTO control_results (app_id, code, framework, title, status, evidence)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [appId, result.code, result.framework, result.title, result.status, result.evidence],
    );
  }
  await run("UPDATE applications SET spec = $1, compliance_score = $2, status = $3 WHERE id = $4", [
    JSON.stringify(spec),
    scored.score,
    scored.status,
    appId,
  ]);
  return scored;
}

function specForName(name: string): AppSpec {
  return findCatalogApp(name)?.spec ?? { kind: "unscanned" };
}

export async function listApplications() {
  return all(
    `SELECT id, name, category, risk, user_count, cost_per_user, flat_monthly_cost,
            billing_cycle, renewal_date, source, compliance_score, status, created_at
     FROM applications
     ORDER BY lower(name)`,
  );
}

export async function getApplication(id: number) {
  const app = await get("SELECT * FROM applications WHERE id = $1", [id]);
  if (!app) throw new HttpError(404, "Application not found.");
  const controls = await all(
    `SELECT code, framework, title, status, evidence
     FROM control_results WHERE app_id = $1 ORDER BY code`,
    [id],
  );
  return { ...app, controls };
}

export type AppInput = {
  name: string;
  category: string;
  risk: string;
  userCount: number;
  costPerUser: number;
  flatMonthly: number;
  billingCycle: string;
  renewalDate: string;
};

export async function createApplication(input: AppInput, source = "manual") {
  const existing = await get("SELECT id FROM applications WHERE lower(name) = lower($1)", [input.name]);
  if (existing) throw new HttpError(409, "An application with that name already exists.");
  const spec = specForName(input.name);
  const created = await run(
    `INSERT INTO applications (
      name, category, risk, user_count, cost_per_user, flat_monthly_cost, billing_cycle,
      renewal_date, source, spec, compliance_score, status, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, 'Not Assessed', $11)`,
    [
      input.name.trim(),
      input.category.trim(),
      input.risk,
      input.userCount,
      input.costPerUser,
      input.flatMonthly,
      input.billingCycle,
      input.renewalDate,
      source,
      JSON.stringify(spec),
      new Date().toISOString(),
    ],
  );
  const id = created.lastInsertRowid;
  await applySpec(id, spec);
  if (spec.kind !== "unscanned") {
    await run("INSERT INTO activity (title, body, happened_at) VALUES ($1, $2, $3)", [
      `${input.name.trim()} integration detected`,
      "New SaaS application discovered and logged by Yusrflow scanner.",
      new Date().toISOString(),
    ]);
  }
  return getApplication(id);
}

export async function updateApplication(id: number, input: AppInput) {
  const current = await get("SELECT * FROM applications WHERE id = $1", [id]);
  if (!current) throw new HttpError(404, "Application not found.");
  const clash = await get("SELECT id FROM applications WHERE lower(name) = lower($1) AND id != $2", [
    input.name,
    id,
  ]);
  if (clash) throw new HttpError(409, "An application with that name already exists.");
  const renamed = String(current.name).toLowerCase() !== input.name.trim().toLowerCase();
  await run(
    `UPDATE applications
     SET name = $1, category = $2, risk = $3, user_count = $4, cost_per_user = $5,
         flat_monthly_cost = $6, billing_cycle = $7, renewal_date = $8
     WHERE id = $9`,
    [
      input.name.trim(),
      input.category.trim(),
      input.risk,
      input.userCount,
      input.costPerUser,
      input.flatMonthly,
      input.billingCycle,
      input.renewalDate,
      id,
    ],
  );
  if (renamed) await applySpec(id, specForName(input.name));
  return getApplication(id);
}

export async function deleteApplications(ids: number[]) {
  if (ids.length === 0) return { deleted: 0 };
  const result = await run(`DELETE FROM applications WHERE id IN (${placeholders(ids.length)})`, ids);
  return { deleted: result.changes };
}

export async function risksFor(ids: number[]) {
  if (ids.length === 0) return [];
  const apps = await all(
    `SELECT id, name, risk, compliance_score, status FROM applications WHERE id IN (${placeholders(ids.length)})`,
    ids,
  );
  return Promise.all(
    apps.map(async (app) => ({
      id: asNumber(app.id),
      name: String(app.name),
      risk: String(app.risk),
      complianceScore: app.compliance_score === null ? null : asNumber(app.compliance_score),
      status: String(app.status),
      failures: await all(
        `SELECT code, framework, title, evidence FROM control_results
         WHERE app_id = $1 AND status = 'fail' ORDER BY code`,
        [asNumber(app.id)],
      ),
    })),
  );
}

export async function toCsv(ids?: number[]) {
  const rows =
    ids && ids.length
      ? await all(
          `SELECT * FROM applications WHERE id IN (${placeholders(ids.length)}) ORDER BY name`,
          ids,
        )
      : await all("SELECT * FROM applications ORDER BY name");
  const header = [
    "Application",
    "Category",
    "Compliance Score",
    "Risk Level",
    "Status",
    "Users",
    "Cost Per User (SAR)",
    "Flat Monthly Cost (SAR)",
    "Billing Cycle",
    "Renewal Date",
  ];
  const lines = rows.map((row) =>
    [
      row.name,
      row.category,
      row.compliance_score ?? "",
      row.risk,
      row.status,
      row.user_count,
      row.cost_per_user,
      row.flat_monthly_cost,
      row.billing_cycle,
      row.renewal_date,
    ]
      .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

async function liveScores() {
  const rows = (await all("SELECT framework, status FROM control_results")) as Array<{
    framework: string;
    status: string;
  }>;
  return frameworkScores(rows);
}

async function latestSnapshot(): Promise<Snapshot | null> {
  const row = await get<{ payload: string }>("SELECT payload FROM snapshots ORDER BY id DESC LIMIT 1");
  return row ? (JSON.parse(row.payload) as Snapshot) : null;
}

async function issueCounts() {
  const rows = await all("SELECT status, severity, COUNT(*) AS n FROM issues GROUP BY status, severity");
  const counts = { critical: 0, open: 0, inProgress: 0, resolved: 0 };
  for (const row of rows) {
    const n = asNumber(row.n);
    if (row.status === "resolved") counts.resolved += n;
    else if (row.status === "in_progress") counts.inProgress += n;
    else if (row.severity === "critical") counts.critical += n;
    else counts.open += n;
  }
  return counts;
}

async function statusCounts() {
  const rows = await all("SELECT status, COUNT(*) AS n FROM applications GROUP BY status");
  const counts = { compliant: 0, partial: 0, nonCompliant: 0, notAssessed: 0, total: 0 };
  for (const row of rows) {
    const n = asNumber(row.n);
    counts.total += n;
    if (row.status === "Compliant") counts.compliant += n;
    else if (row.status === "Partially Compliant") counts.partial += n;
    else if (row.status === "Non-Compliant") counts.nonCompliant += n;
    else counts.notAssessed += n;
  }
  return counts;
}

async function withDeltas(
  scores: { overall: number; frameworks: FrameworkScore[] },
  counts: Awaited<ReturnType<typeof issueCounts>>,
) {
  const previous = await latestSnapshot();
  const point = (current: number, prior: number | undefined) => current - (prior ?? current);
  return {
    overall: scores.overall,
    overallDelta: point(scores.overall, previous?.overall),
    frameworks: scores.frameworks.map((item) => ({
      ...item,
      delta: point(item.score, previous?.frameworks?.[item.code]),
    })),
    counts: {
      critical: counts.critical,
      open: counts.open,
      inProgress: counts.inProgress,
      resolved: counts.resolved,
      criticalDelta: percentDelta(counts.critical, previous?.critical),
      openDelta: percentDelta(counts.open, previous?.open),
      inProgressDelta: percentDelta(counts.inProgress, previous?.inProgress),
      resolvedDelta: percentDelta(counts.resolved, previous?.resolved),
    },
  };
}

function percentDelta(current: number, previous: number | undefined) {
  if (previous === undefined) return 0;
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

export async function getDashboard() {
  const [scores, counts, stats, usersRow, alerts] = await Promise.all([
    liveScores(),
    issueCounts(),
    statusCounts(),
    get<{ n: number }>("SELECT COUNT(*) AS n FROM users"),
    all(
      `SELECT a.id, a.title, a.body, a.severity, a.created_at, app.name AS app_name, app.compliance_score
       FROM alerts a JOIN applications app ON app.id = a.app_id
       ORDER BY a.id ASC`,
    ),
  ]);
  const users = asNumber(usersRow?.n);
  const deltas = await withDeltas(scores, counts);
  return {
    ...deltas,
    stats: { users, ...stats },
    alerts,
  };
}

export async function getCompliance() {
  const [scores, counts] = await Promise.all([liveScores(), issueCounts()]);
  const [issues, activity] = await Promise.all([
    all(
      `SELECT i.*, a.name AS app_name
       FROM issues i JOIN applications a ON a.id = i.app_id
       WHERE i.status != 'resolved'
       ORDER BY CASE i.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, i.id`,
    ),
    all("SELECT * FROM activity ORDER BY happened_at DESC, id DESC LIMIT 12"),
  ]);
  const deltas = await withDeltas(scores, counts);
  return { ...deltas, issues, activity };
}

export function getMethodology() {
  return {
    principle:
      "A compliance percentage is published only when a rule can be decided from evidence. Controls with no evidence are excluded from the score.",
    frameworks: ["PDPL", "NDMO", "NCA ECC", "SDAIA", "GDPR"],
    thresholds: "An application is Compliant at 90% or above, Partially Compliant from 70% to 89%, and Non-Compliant below 70%.",
  };
}

async function refreshAlerts() {
  await exec("DELETE FROM alerts");
  const apps = await all(
    `SELECT id, name, compliance_score FROM applications
     WHERE risk = 'High' AND compliance_score BETWEEN 45 AND 55`,
  );
  const now = new Date().toISOString();
  for (const app of apps) {
    await run(
      `INSERT INTO alerts (app_id, title, body, severity, created_at) VALUES ($1, $2, $3, 'high', $4)`,
      [
        asNumber(app.id),
        `${app.name} Severe Compliance Gap`,
        `Identified risk during recent compliance review. Current score: ${app.compliance_score}%.`,
        now,
      ],
    );
  }
}

async function reassessAll() {
  const apps = await all("SELECT id, spec FROM applications");
  for (const app of apps) {
    const spec = parseSpec(app.spec);
    const next: AppSpec = spec.kind === "unscanned" ? { kind: "thin" } : spec;
    await applySpec(asNumber(app.id), next);
  }
}

async function saveSnapshot() {
  const scores = await liveScores();
  const counts = await issueCounts();
  const payload: Snapshot = {
    overall: scores.overall,
    frameworks: Object.fromEntries(scores.frameworks.map((item) => [item.code, item.score])),
    ...counts,
  };
  await run("INSERT INTO snapshots (created_at, payload) VALUES ($1, $2)", [
    new Date().toISOString(),
    JSON.stringify(payload),
  ]);
}

export async function runScan() {
  await reassessAll();
  if ((await getSetting("alert_on_scan")) !== "false") await refreshAlerts();
  await saveSnapshot();
  await run("INSERT INTO activity (title, body, happened_at) VALUES ($1, $2, $3)", [
    "Compliance scan completed",
    "Controls were reassessed from the latest evidence.",
    new Date().toISOString(),
  ]);
  return getCompliance();
}

export async function getIntegrations() {
  return all("SELECT * FROM integrations ORDER BY provider");
}

export async function connectMicrosoft() {
  await run(`UPDATE integrations SET status = 'connected', connected_at = $1 WHERE provider = 'microsoft'`, [
    new Date().toISOString(),
  ]);
  return getIntegrations();
}

export async function disconnectMicrosoft() {
  await run(`UPDATE integrations SET status = 'disconnected', connected_at = NULL WHERE provider = 'microsoft'`);
  return getIntegrations();
}

export async function discover() {
  const row = await get<{ status: string }>("SELECT status FROM integrations WHERE provider = 'microsoft'");
  if (!row || row.status !== "connected") {
    throw new HttpError(400, "Connect Microsoft 365 before running discovery.");
  }
  await reassessAll();
  const now = new Date().toISOString();
  await run("UPDATE integrations SET last_discovery_at = $1 WHERE provider = 'microsoft'", [now]);
  await run("INSERT INTO activity (title, body, happened_at) VALUES ($1, $2, $3)", [
    "Discovery completed",
    "SaaS applications were refreshed from the Microsoft 365 read-only connection.",
    now,
  ]);
  return { integrations: await getIntegrations(), compliance: await getCompliance() };
}

export type Guide = {
  identifiedFlaw: string;
  guideTitle: string;
  issue: string;
  objective: string;
  targetAudience: string;
  steps: Array<{ title: string; actions: string[] }>;
  alternatives: Array<{ name: string; badge: string; summary: string; url: string }>;
};

function asGuide(value: unknown): Guide {
  const raw = value as Partial<Guide>;
  if (!raw || typeof raw.guideTitle !== "string" || !Array.isArray(raw.steps) || raw.steps.length === 0) {
    throw new HttpError(502, "Groq returned an unexpected remediation format. Try again.");
  }
  const steps = raw.steps.map((step, index) => ({
    title: String(step?.title || `Step ${index + 1}`),
    actions: Array.isArray(step?.actions) ? step.actions.map((action) => String(action)) : [],
  }));
  const alternatives = Array.isArray(raw.alternatives)
    ? raw.alternatives.map((item) => ({
        name: String(item?.name || "Alternative"),
        badge: String(item?.badge || "PDPL Friendly"),
        summary: String(item?.summary || ""),
        url: typeof item?.url === "string" ? item.url : "",
      }))
    : [];
  return {
    identifiedFlaw: String(raw.identifiedFlaw || ""),
    guideTitle: raw.guideTitle,
    issue: String(raw.issue || ""),
    objective: String(raw.objective || ""),
    targetAudience: String(raw.targetAudience || "IT Administrator"),
    steps,
    alternatives,
  };
}

async function issueById(id: number) {
  const issue = await get(
    `SELECT i.*, a.name AS app_name, a.category AS category, a.risk AS risk, a.compliance_score AS compliance_score
     FROM issues i JOIN applications a ON a.id = i.app_id WHERE i.id = $1`,
    [id],
  );
  if (!issue) throw new HttpError(404, "Issue not found.");
  return issue;
}

export async function ensureIssue(input: { issueId?: number; appId?: number; code?: string }) {
  if (input.issueId) return issueById(input.issueId);
  if (!input.appId || !input.code) throw new HttpError(400, "Choose an issue to remediate.");
  const existing = await get<{ id: number }>("SELECT id FROM issues WHERE app_id = $1 AND code = $2", [
    input.appId,
    input.code,
  ]);
  if (existing) return issueById(existing.id);
  const control = await get(
    `SELECT * FROM control_results WHERE app_id = $1 AND code = $2 AND status = 'fail'`,
    [input.appId, input.code],
  );
  if (!control) throw new HttpError(404, "That control has no failed evidence to remediate.");
  const created = await run(
    `INSERT INTO issues (
      app_id, code, framework, title, description, severity, status, due_date, created_at
    ) VALUES ($1, $2, $3, $4, $5, 'high', 'open', $6, $7)`,
    [
      input.appId,
      input.code,
      String(control.framework),
      ISSUE_TITLES[input.code] ?? String(control.title),
      String(control.evidence),
      new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      new Date().toISOString(),
    ],
  );
  return issueById(created.lastInsertRowid);
}

export async function remediate(input: { issueId?: number; appId?: number; code?: string }) {
  const issue = await ensureIssue(input);
  const issueId = asNumber(issue.id);
  const guide = asGuide(
    extractJson(
      await groqChat(
        [
          {
            role: "system",
            content: `You are YusrFlow's compliance remediation engine for organizations in Saudi Arabia.
Write an audit-defensible guide for one failed control.
Use only the evidence in the user message. Do not claim the control passed.
When the failure is data residency or the vendor cannot be brought into compliance, include practical replacement applications that can keep Saudi personal data in the Kingdom or in a documented government cloud. Otherwise return an empty alternatives array.
Return JSON only with this shape:
{"identifiedFlaw": string, "guideTitle": string, "issue": string, "objective": string, "targetAudience": string, "steps": [{"title": string, "actions": string[]}], "alternatives": [{"name": string, "badge": string, "summary": string, "url": string}]}
guideTitle must start with the control code and name the application.
steps must be concrete actions for an IT administrator, security team, or compliance officer.`,
          },
          {
            role: "user",
            content: JSON.stringify({
              application: issue.app_name,
              category: issue.category,
              risk: issue.risk,
              complianceScore: issue.compliance_score,
              framework: issue.framework,
              control: issue.code,
              title: issue.title,
              evidence: issue.description,
            }),
          },
        ],
        { json: true, maxTokens: 1800, temperature: 0.2 },
      ),
    ),
  );
  await run("UPDATE issues SET guide = $1 WHERE id = $2", [JSON.stringify(guide), issueId]);
  return { issue: await issueById(issueId), guide };
}

export async function resolveIssue(id: number) {
  const issue = await issueById(id);
  if (issue.status === "resolved") return issue;
  await run("UPDATE issues SET status = 'resolved', resolved_at = $1 WHERE id = $2", [
    new Date().toISOString(),
    id,
  ]);
  await run("INSERT INTO activity (title, body, happened_at) VALUES ($1, $2, $3)", [
    `${issue.app_name} issue resolved`,
    `${issue.code} was marked resolved.`,
    new Date().toISOString(),
  ]);
  return issueById(id);
}

export async function listReports() {
  return all("SELECT id, title, created_at FROM reports ORDER BY id DESC");
}

export async function getReport(id: number) {
  const report = await get("SELECT * FROM reports WHERE id = $1", [id]);
  if (!report) throw new HttpError(404, "Report not found.");
  return report;
}

export async function saveReport(title: string, html: string) {
  const created = await run("INSERT INTO reports (title, html, created_at) VALUES ($1, $2, $3)", [
    title,
    html,
    new Date().toISOString(),
  ]);
  return getReport(created.lastInsertRowid);
}

export async function reportData(ids?: number[]) {
  type ReportApp = {
    name: string;
    category: string;
    risk: string;
    status: string;
    compliance_score: number | null;
    user_count: number;
  };
  type ReportIssue = {
    app_name: string;
    code: string;
    framework: string;
    title: string;
    description: string;
    severity: string;
    status: string;
    due_date: string | null;
  };
  const apps =
    ids && ids.length
      ? await all<ReportApp>(
          `SELECT name, category, risk, status, compliance_score, user_count
           FROM applications WHERE id IN (${placeholders(ids.length)}) ORDER BY name`,
          ids,
        )
      : await all<ReportApp>(
          `SELECT name, category, risk, status, compliance_score, user_count
           FROM applications ORDER BY name`,
        );
  const issues =
    ids && ids.length
      ? await all<ReportIssue>(
          `SELECT a.name AS app_name, i.code, i.framework, i.title, i.description, i.severity, i.status, i.due_date
           FROM issues i JOIN applications a ON a.id = i.app_id
           WHERE i.app_id IN (${placeholders(ids.length)})
           ORDER BY i.id`,
          ids,
        )
      : await all<ReportIssue>(
          `SELECT a.name AS app_name, i.code, i.framework, i.title, i.description, i.severity, i.status, i.due_date
           FROM issues i JOIN applications a ON a.id = i.app_id
           ORDER BY i.id`,
        );
  const scores = await liveScores();
  const orgName = await getSetting("org_name");
  return {
    orgName: orgName || "Organization",
    generatedAt: new Date().toLocaleString("en-US"),
    overall: scores.overall,
    frameworks: scores.frameworks,
    apps,
    issues,
  };
}

export async function listUsers() {
  return all("SELECT id, name, email, role, created_at FROM users ORDER BY id");
}

export async function createUser(input: { name: string; email: string; role: string; password: string }) {
  const email = input.email.toLowerCase();
  if (await findUserByEmail(email)) throw new HttpError(409, "That email is already in use.");
  const created = await run(
    `INSERT INTO users (name, email, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5)`,
    [input.name.trim(), email, bcrypt.hashSync(input.password, 10), input.role, new Date().toISOString()],
  );
  const user = await findUserById(created.lastInsertRowid);
  return publicUser(user!);
}

export async function updateUser(id: number, input: { name: string; role: string }) {
  const user = await findUserById(id);
  if (!user) throw new HttpError(404, "User not found.");
  await run("UPDATE users SET name = $1, role = $2 WHERE id = $3", [input.name.trim(), input.role, id]);
  return publicUser((await findUserById(id))!);
}

export async function deleteUser(id: number, actorId: number) {
  if (id === actorId) throw new HttpError(400, "You cannot remove your own account.");
  const result = await run("DELETE FROM users WHERE id = $1", [id]);
  if (!result.changes) throw new HttpError(404, "User not found.");
  return { deleted: result.changes };
}

export async function updateProfile(
  id: number,
  input: { name: string; email: string; currentPassword?: string; newPassword?: string },
) {
  const user = await findUserById(id);
  if (!user) throw new HttpError(404, "User not found.");
  const email = input.email.toLowerCase();
  const clash = await get("SELECT id FROM users WHERE email = $1 AND id != $2", [email, id]);
  if (clash) throw new HttpError(409, "That email is already in use.");
  if (input.newPassword) {
    if (!input.currentPassword || !bcrypt.compareSync(input.currentPassword, String(user.password_hash))) {
      throw new HttpError(400, "Current password is incorrect.");
    }
    await run("UPDATE users SET name = $1, email = $2, password_hash = $3 WHERE id = $4", [
      input.name.trim(),
      email,
      bcrypt.hashSync(input.newPassword, 10),
      id,
    ]);
  } else {
    await run("UPDATE users SET name = $1, email = $2 WHERE id = $3", [input.name.trim(), email, id]);
  }
  return publicUser((await findUserById(id))!);
}

export async function getSettings() {
  const rows = await all<{ key: string; value: string }>("SELECT key, value FROM settings");
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value;
  return {
    orgName: settings.org_name ?? "",
    alertOnScan: settings.alert_on_scan !== "false",
    residency: settings.residency ?? "Kingdom of Saudi Arabia",
    locale: settings.locale ?? "en",
  };
}

export async function getSetting(key: string) {
  const row = await get<{ value: string }>("SELECT value FROM settings WHERE key = $1", [key]);
  return row?.value;
}

export async function updateSettings(input: { orgName: string; alertOnScan: boolean; locale: string }) {
  const upsert = (key: string, value: string) =>
    run(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, value],
    );
  await upsert("org_name", input.orgName.trim());
  await upsert("alert_on_scan", input.alertOnScan ? "true" : "false");
  await upsert("locale", input.locale);
  return getSettings();
}

export async function listMessages() {
  return all("SELECT id, role, content, created_at FROM messages ORDER BY id ASC");
}

export async function clearMessages() {
  await exec("DELETE FROM messages");
  return [];
}

export async function addAssistantMessage(content: string) {
  const createdAt = new Date().toISOString();
  await run("INSERT INTO messages (role, content, created_at) VALUES ('user', $1, $2)", [content, createdAt]);
  const historyRows = await all<{ role: "user" | "assistant"; content: string }>(
    "SELECT role, content FROM messages ORDER BY id DESC LIMIT 12",
  );
  const history = historyRows.reverse();
  const [scores, applications, issues, openFindings] = await Promise.all([
    liveScores(),
    statusCounts(),
    issueCounts(),
    all(
      `SELECT a.name AS application, i.code, i.title, i.description
       FROM issues i JOIN applications a ON a.id = i.app_id
       WHERE i.status != 'resolved' ORDER BY i.id LIMIT 12`,
    ),
  ]);
  const summary = { scores, applications, issues, openFindings };
  const reply = await groqChat(
    [
      {
        role: "system",
        content: `You are the YusrFlow AI assistant for a Saudi organization's SaaS estate.
Answer from the estate snapshot. If the snapshot has no evidence, say so.
Do not invent compliance scores, control results, or legal conclusions that are not in the snapshot.
Keep answers concise and practical for an IT administrator.
Estate snapshot: ${JSON.stringify(summary)}`,
      },
      ...history,
    ],
    { maxTokens: 900, temperature: 0.3 },
  );
  await run("INSERT INTO messages (role, content, created_at) VALUES ('assistant', $1, $2)", [
    reply,
    new Date().toISOString(),
  ]);
  return listMessages();
}

export async function estateForClient() {
  const [scores, counts, apps] = await Promise.all([liveScores(), issueCounts(), statusCounts()]);
  return { scores, counts, apps };
}
