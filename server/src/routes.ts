import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { HttpError } from "./errors";
import { renderReport } from "./report";
import {
  addAssistantMessage,
  clearMessages,
  connectMicrosoft,
  createApplication,
  createUser,
  deleteApplications,
  deleteUser,
  disconnectMicrosoft,
  discover,
  findUserByEmail,
  findUserById,
  getApplication,
  getCompliance,
  getDashboard,
  getIntegrations,
  getMethodology,
  getReport,
  getSettings,
  listApplications,
  listMessages,
  listReports,
  listUsers,
  publicUser,
  ensureIssue,
  remediate,
  reportData,
  resolveIssue,
  risksFor,
  runScan,
  saveReport,
  toCsv,
  updateApplication,
  updateProfile,
  updateSettings,
  updateUser,
  type AppInput,
} from "./store";

const router = Router();
const secret = process.env.JWT_SECRET || "dev-only-change-me";

const appSchema = z.object({
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(80),
  risk: z.enum(["Low", "Medium", "High", "Critical"]),
  userCount: z.number().int().min(0).max(100000),
  costPerUser: z.number().min(0),
  flatMonthly: z.number().min(0),
  billingCycle: z.enum(["Monthly", "Annual"]),
  renewalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Renewal date must be YYYY-MM-DD"),
});

function asyncRoute(handler: (req: import("express").Request, res: import("express").Response) => Promise<unknown>) {
  return (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

function requireAuth(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    next(new HttpError(401, "Sign in required."));
    return;
  }
  void (async () => {
    try {
      const payload = jwt.verify(token, secret) as unknown as { sub: number };
      const user = await findUserById(Number(payload.sub));
      if (!user) {
        next(new HttpError(401, "Sign in required."));
        return;
      }
      req.user = publicUser(user);
      next();
    } catch {
      next(new HttpError(401, "Sign in required."));
    }
  })();
}

function requireAdmin(req: import("express").Request, _res: import("express").Response, next: import("express").NextFunction) {
  if (req.user?.role !== "Admin") {
    next(new HttpError(403, "Only an administrator can do that."));
    return;
  }
  next();
}

function toInput(body: z.infer<typeof appSchema>): AppInput {
  return body;
}

router.get("/health", (_req, res) => {
  res.json({ ok: true });
});

router.post("/auth/login", asyncRoute(async (req, res) => {
  const body = z
    .object({
      email: z.string().email(),
      password: z.string().min(1),
      remember: z.boolean().optional(),
    })
    .parse(req.body);
  const user = await findUserByEmail(body.email.toLowerCase());
  if (!user || !bcrypt.compareSync(body.password, String(user.password_hash))) {
    throw new HttpError(401, "Email or password is incorrect.");
  }
  const token = jwt.sign({ sub: user.id }, secret, { expiresIn: body.remember ? "30d" : "12h" });
  res.json({ token, user: publicUser(user) });
}));

router.post("/auth/forgot-password", asyncRoute(async (req, res) => {
  z.object({ email: z.string().email() }).parse(req.body);
  res.json({
    message:
      "If an account exists for that email, a reset link would be sent. Email delivery is not connected in this build.",
  });
}));

router.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.patch("/auth/me", requireAuth, asyncRoute(async (req, res) => {
  const body = z
    .object({
      name: z.string().trim().min(1).max(80),
      email: z.string().email(),
      currentPassword: z.string().optional(),
      newPassword: z.string().min(8).optional(),
    })
    .parse(req.body);
  res.json({ user: await updateProfile(req.user!.id, body) });
}));

router.use(requireAuth);

router.get("/dashboard", asyncRoute(async (_req, res) => {
  res.json(await getDashboard());
}));

router.get("/applications", asyncRoute(async (_req, res) => {
  res.json({ applications: await listApplications() });
}));

router.post("/applications", asyncRoute(async (req, res) => {
  res.status(201).json({ application: await createApplication(toInput(appSchema.parse(req.body))) });
}));

router.get("/applications/export", asyncRoute(async (req, res) => {
  const ids = String(req.query.ids || "")
    .split(",")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=yusrflow-applications.csv");
  res.send(await toCsv(ids.length ? ids : undefined));
}));

router.post("/applications/import", asyncRoute(async (req, res) => {
  const body = z.object({ csv: z.string().min(1) }).parse(req.body);
  const rows = parseCsv(body.csv);
  const created = [];
  const errors: string[] = [];
  for (const row of rows) {
    const name = row.application || row.name || "";
    if (!name) continue;
    try {
      const risk = normalizeRisk(row["risk level"] || row.risk);
      created.push(
        await createApplication({
          name,
          category: row.category || "Other",
          risk,
          userCount: Number(row.users || row["user count"] || 0) || 0,
          costPerUser: Number(row["cost per user (sar)"] || row.costperuser || 0) || 0,
          flatMonthly: Number(row["flat monthly cost (sar)"] || 0) || 0,
          billingCycle: row["billing cycle"] === "Annual" ? "Annual" : "Monthly",
          renewalDate: normalizeDate(row["renewal date"]),
        }),
      );
    } catch (error) {
      errors.push(`${name}: ${error instanceof Error ? error.message : "could not import"}`);
    }
  }
  res.json({ imported: created.length, errors });
}));

router.post("/applications/risks", asyncRoute(async (req, res) => {
  const body = z.object({ ids: z.array(z.number().int().positive()).min(1) }).parse(req.body);
  res.json({ applications: await risksFor(body.ids) });
}));

router.post("/applications/bulk-delete", asyncRoute(async (req, res) => {
  const body = z.object({ ids: z.array(z.number().int().positive()).min(1) }).parse(req.body);
  res.json(await deleteApplications(body.ids));
}));

router.get("/applications/:id", asyncRoute(async (req, res) => {
  res.json({ application: await getApplication(Number(req.params.id)) });
}));

router.patch("/applications/:id", asyncRoute(async (req, res) => {
  res.json({
    application: await updateApplication(Number(req.params.id), toInput(appSchema.parse(req.body))),
  });
}));

router.delete("/applications/:id", asyncRoute(async (req, res) => {
  res.json(await deleteApplications([Number(req.params.id)]));
}));

router.get("/compliance", asyncRoute(async (_req, res) => {
  res.json(await getCompliance());
}));

router.get("/compliance/methodology", (_req, res) => {
  res.json(getMethodology());
});

router.post("/compliance/scan", asyncRoute(async (_req, res) => {
  res.json(await runScan());
}));

router.post("/compliance/issues", asyncRoute(async (req, res) => {
  const body = z
    .object({
      issueId: z.number().int().positive().optional(),
      appId: z.number().int().positive().optional(),
      code: z.string().optional(),
    })
    .parse(req.body);
  res.status(201).json({ issue: await ensureIssue(body) });
}));

router.post("/compliance/remediate", asyncRoute(async (req, res) => {
  const body = z
    .object({
      issueId: z.number().int().positive().optional(),
      appId: z.number().int().positive().optional(),
      code: z.string().optional(),
    })
    .parse(req.body);
  res.json(await remediate(body));
}));

router.post("/compliance/issues/:id/resolve", asyncRoute(async (req, res) => {
  res.json({ issue: await resolveIssue(Number(req.params.id)) });
}));

router.get("/integrations", asyncRoute(async (_req, res) => {
  res.json({ integrations: await getIntegrations() });
}));

router.post("/integrations/microsoft/connect", asyncRoute(async (_req, res) => {
  res.json({ integrations: await connectMicrosoft() });
}));

router.post("/integrations/microsoft/disconnect", asyncRoute(async (_req, res) => {
  res.json({ integrations: await disconnectMicrosoft() });
}));

router.post("/integrations/discover", asyncRoute(async (_req, res) => {
  res.json(await discover());
}));

router.get("/reports", asyncRoute(async (_req, res) => {
  res.json({ reports: await listReports() });
}));

router.post("/reports", asyncRoute(async (req, res) => {
  const body = z.object({ ids: z.array(z.number().int().positive()).optional() }).parse(req.body ?? {});
  const data = await reportData(body.ids);
  const title = body.ids?.length
    ? `Compliance report · ${body.ids.length} applications`
    : "Compliance report · full estate";
  const html = renderReport(data);
  const report = (await saveReport(title, html)) as { id: number };
  res.status(201).json({ report: await getReport(report.id) });
}));

router.get("/reports/:id", asyncRoute(async (req, res) => {
  res.json({ report: await getReport(Number(req.params.id)) });
}));

router.get("/users", asyncRoute(async (_req, res) => {
  res.json({ users: await listUsers() });
}));

router.post("/users", requireAdmin, asyncRoute(async (req, res) => {
  const body = z
    .object({
      name: z.string().trim().min(1).max(80),
      email: z.string().email(),
      role: z.enum(["Admin", "Compliance Officer", "Security Analyst"]),
      password: z.string().min(8),
    })
    .parse(req.body);
  res.status(201).json({ user: await createUser(body) });
}));

router.patch("/users/:id", requireAdmin, asyncRoute(async (req, res) => {
  const body = z
    .object({
      name: z.string().trim().min(1).max(80),
      role: z.enum(["Admin", "Compliance Officer", "Security Analyst"]),
    })
    .parse(req.body);
  res.json({ user: await updateUser(Number(req.params.id), body) });
}));

router.delete("/users/:id", requireAdmin, asyncRoute(async (req, res) => {
  res.json(await deleteUser(Number(req.params.id), req.user!.id));
}));

router.get("/settings", asyncRoute(async (_req, res) => {
  res.json({ settings: await getSettings() });
}));

router.put("/settings", asyncRoute(async (req, res) => {
  const body = z
    .object({
      orgName: z.string().trim().min(1).max(120),
      alertOnScan: z.boolean(),
      locale: z.enum(["en", "ar"]),
    })
    .parse(req.body);
  res.json({ settings: await updateSettings(body) });
}));

router.get("/assistant/messages", asyncRoute(async (_req, res) => {
  res.json({ messages: await listMessages() });
}));

router.delete("/assistant/messages", asyncRoute(async (_req, res) => {
  res.json({ messages: await clearMessages() });
}));

router.post("/assistant/messages", asyncRoute(async (req, res) => {
  const body = z.object({ content: z.string().trim().min(1).max(4000) }).parse(req.body);
  res.json({ messages: await addAssistantMessage(body.content) });
}));

export default router;

function normalizeRisk(value: string): AppInput["risk"] {
  const risk = value.trim().toLowerCase();
  if (risk.startsWith("crit")) return "Critical";
  if (risk.startsWith("high")) return "High";
  if (risk.startsWith("low")) return "Low";
  if (risk.startsWith("med")) return "Medium";
  return "Medium";
}

function normalizeDate(value: string | undefined) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date().toISOString().slice(0, 10);
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new HttpError(400, "The CSV needs a header and at least one row.");
  const headers = splitCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? "").trim();
    });
    return row;
  });
}
