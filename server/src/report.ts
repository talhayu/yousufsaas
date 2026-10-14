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

type ReportInput = {
  orgName: string;
  generatedAt: string;
  overall: number;
  frameworks: Array<{ code: string; score: number; label: string }>;
  apps: ReportApp[];
  issues: ReportIssue[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderReport(input: ReportInput): string {
  const frameworkRows = input.frameworks
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.code)}</td><td>${item.score}%</td><td>${escapeHtml(item.label)}</td></tr>`,
    )
    .join("");
  const issueRows = input.issues
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.app_name)}</td>
        <td>${escapeHtml(item.code)}</td>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(item.severity)}</td>
        <td>${escapeHtml(item.status)}</td>
        <td>${escapeHtml(item.due_date ?? "")}</td>
      </tr>`,
    )
    .join("");
  const appRows = input.apps
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.category)}</td>
        <td>${item.compliance_score ?? "—"}%</td>
        <td>${escapeHtml(item.risk)}</td>
        <td>${escapeHtml(item.status)}</td>
        <td>${item.user_count}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>YusrFlow compliance report</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; margin: 32px; color: #161616; }
    h1 { margin-bottom: 0; }
    p { color: #444; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0 28px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; vertical-align: top; }
    th { background: #f4f1ff; }
  </style>
</head>
<body>
  <h1>YusrFlow compliance report</h1>
  <p>${escapeHtml(input.orgName)} · Generated ${escapeHtml(input.generatedAt)} · Overall score ${input.overall}%</p>
  <h2>Regulatory scores</h2>
  <table><thead><tr><th>Framework</th><th>Score</th><th>Label</th></tr></thead><tbody>${frameworkRows}</tbody></table>
  <h2>Issues</h2>
  <table><thead><tr><th>Application</th><th>Control</th><th>Finding</th><th>Severity</th><th>Status</th><th>Due</th></tr></thead><tbody>${issueRows || "<tr><td colspan='6'>No issues in this scope.</td></tr>"}</tbody></table>
  <h2>Applications</h2>
  <table><thead><tr><th>Application</th><th>Category</th><th>Score</th><th>Risk</th><th>Status</th><th>Users</th></tr></thead><tbody>${appRows}</tbody></table>
  <p>Scores count only controls with evidence. Unknown controls are excluded.</p>
</body>
</html>`;
}
