import bcrypt from "bcryptjs";
import { buildCatalog } from "./catalog";
import { assess, frameworkScores, ISSUE_TITLES, scoreOf, type AppSpec } from "./compliance";
import { get, withTransaction } from "./db";

const DEMO_PASSWORD = "Yusrflow2026!";

export async function seedIfEmpty() {
  const existing = await get<{ n: string | number }>("SELECT COUNT(*) AS n FROM users");
  if (Number(existing?.n ?? 0) > 0) return;

  await withTransaction(async (tx) => {
    const now = new Date().toISOString();
    const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);

    async function applySpec(appId: number, spec: AppSpec) {
      const results = assess(spec);
      const scored = scoreOf(results);
      await tx.run("DELETE FROM control_results WHERE app_id = ?", [appId]);
      for (const result of results) {
        await tx.run(
          `INSERT INTO control_results (app_id, code, framework, title, status, evidence)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [appId, result.code, result.framework, result.title, result.status, result.evidence],
        );
      }
      await tx.run("UPDATE applications SET spec = ?, compliance_score = ?, status = ? WHERE id = ?", [
        JSON.stringify(spec),
        scored.score,
        scored.status,
        appId,
      ]);
    }

    for (const [name, email, role] of [
      ["IT Administrator", "admin@yusrflow.com", "Admin"],
      ["Compliance Officer", "compliance@yusrflow.com", "Compliance Officer"],
      ["Security Analyst", "security@yusrflow.com", "Security Analyst"],
    ] as const) {
      await tx.run(
        `INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)`,
        [name, email, passwordHash, role, now],
      );
    }

    for (const item of buildCatalog()) {
      const created = await tx.run(
        `INSERT INTO applications (
          name, category, risk, user_count, cost_per_user, flat_monthly_cost, billing_cycle,
          renewal_date, source, spec, compliance_score, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'discovered', ?, NULL, 'Not Assessed', ?)`,
        [
          item.name,
          item.category,
          item.risk,
          item.users,
          item.costPerUser,
          item.flatMonthly,
          item.billingCycle,
          item.renewal,
          JSON.stringify(item.spec),
          now,
        ],
      );
      await applySpec(created.lastInsertRowid, item.spec);
    }

    const fails = (await tx.all(
      `SELECT a.id AS "appId", a.name AS "appName", a.risk AS risk, c.code AS code,
              c.framework AS framework, c.evidence AS evidence
       FROM control_results c
       JOIN applications a ON a.id = c.app_id
       WHERE c.status = 'fail'`,
    )) as Array<{
      appId: number;
      appName: string;
      risk: string;
      code: string;
      framework: string;
      evidence: string;
    }>;

    const rank = (row: (typeof fails)[number]) => {
      if (row.appName === "jisr.net" && row.code === "NDMO-NOTICE-01") return 100;
      if (row.appName === "jisr.net" && row.code === "NDMO-CONSENT-01") return 85;
      if (row.code === "PDPL-RESIDENCY-01" && (row.risk === "High" || row.risk === "Critical")) return 90;
      if (row.risk === "High" || row.risk === "Critical") return 40;
      return 10;
    };

    const critical = fails
      .filter((row) => row.code === "PDPL-RESIDENCY-01" && (row.risk === "High" || row.risk === "Critical"))
      .sort((a, b) => rank(b) - rank(a))
      .slice(0, 9);
    const used = new Set(critical.map((row) => `${row.appId}:${row.code}`));
    const open = fails
      .filter((row) => !used.has(`${row.appId}:${row.code}`))
      .sort((a, b) => rank(b) - rank(a))
      .slice(0, 20);

    const due = (index: number, appName: string, code: string) => {
      if (appName === "jisr.net" && code === "NDMO-NOTICE-01") return "2026-03-21";
      const day = Math.min(28, 8 + index);
      return `2026-03-${String(day).padStart(2, "0")}`;
    };

    for (const [index, row] of critical.entries()) {
      await tx.run(
        `INSERT INTO issues (
          app_id, code, framework, title, description, severity, status, due_date, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
        [
          row.appId,
          row.code,
          row.framework,
          ISSUE_TITLES[row.code] ?? row.code,
          row.evidence,
          "critical",
          due(index, row.appName, row.code),
          now,
        ],
      );
    }
    for (const [index, row] of open.entries()) {
      await tx.run(
        `INSERT INTO issues (
          app_id, code, framework, title, description, severity, status, due_date, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
        [
          row.appId,
          row.code,
          row.framework,
          ISSUE_TITLES[row.code] ?? row.code,
          row.evidence,
          row.risk === "High" || row.risk === "Critical" ? "high" : "medium",
          due(index + 3, row.appName, row.code),
          now,
        ],
      );
    }

    for (const name of ["Jira", "Notion", "Salesforce"]) {
      await tx.run(
        `INSERT INTO alerts (app_id, title, body, severity, created_at)
         SELECT id, ?, ?, 'high', ? FROM applications WHERE name = ?`,
        [
          `${name} Severe Compliance Gap`,
          "Identified risk during recent compliance review. Current score: 50%.",
          now,
          name,
        ],
      );
    }

    const discovered = "New SaaS application discovered and logged by Yusrflow scanner.";
    for (const [title, happenedAt] of [
      ["jisr.net integration detected", "2026-03-14T13:08:00"],
      ["app.idaratech.sa integration detected", "2026-03-08T12:15:00"],
      ["Idaratech integration detected", "2026-03-08T12:05:00"],
      ["Palm.hr integration detected", "2026-03-08T11:56:00"],
    ] as const) {
      await tx.run("INSERT INTO activity (title, body, happened_at) VALUES (?, ?, ?)", [
        title,
        discovered,
        happenedAt,
      ]);
    }

    await tx.run(
      `INSERT INTO integrations (provider, name, status, connected_at, last_discovery_at, detail)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        "microsoft",
        "Microsoft 365",
        "connected",
        "2026-03-01T09:00:00",
        "2026-03-14T19:45:00",
        "Read-only OAuth. Directory and application consent. No mailbox content.",
      ],
    );
    await tx.run(
      `INSERT INTO integrations (provider, name, status, connected_at, last_discovery_at, detail)
       VALUES ('google', 'Google Workspace', 'coming_soon', NULL, NULL, ?)`,
      ["Shown as coming soon in the product demo."],
    );

    for (const [key, value] of [
      ["org_name", "Pilot Organization"],
      ["alert_on_scan", "true"],
      ["residency", "Kingdom of Saudi Arabia"],
      ["locale", "en"],
    ] as const) {
      await tx.run("INSERT INTO settings (key, value) VALUES (?, ?)", [key, value]);
    }

    const rows = (await tx.all("SELECT framework, status FROM control_results")) as Array<{
      framework: string;
      status: string;
    }>;
    const live = frameworkScores(rows);
    const points: Record<string, number> = { PDPL: 1, SDAIA: 2, NCA: -1, NDMO: 1, GDPR: 2 };
    const previous = {
      overall: live.overall - 5,
      frameworks: Object.fromEntries(
        live.frameworks.map((item) => [item.code, Math.max(0, item.score - (points[item.code] ?? 0))]),
      ),
      critical: critical.length,
      open: open.length,
      inProgress: 0,
      resolved: 0,
    };
    await tx.run("INSERT INTO snapshots (created_at, payload) VALUES (?, ?)", [
      "2026-03-01T08:00:00",
      JSON.stringify(previous),
    ]);

    console.log(
      `Seeded YusrFlow. Overall ${live.overall}. ` +
        live.frameworks.map((item) => `${item.code} ${item.score}`).join(", "),
    );
  });
}
