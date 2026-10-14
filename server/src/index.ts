import cors from "cors";
import express from "express";
import { ZodError } from "zod";
import { ensureSchema } from "./db";
import { HttpError } from "./errors";
import router from "./routes";
import { seedIfEmpty } from "./seed";

export const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use("/api", router);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error(error);
  res.status(500).json({ error: "Unexpected server error" });
});

let ready: Promise<void> | null = null;

export function boot(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await ensureSchema();
      await seedIfEmpty();
    })();
  }
  return ready;
}

async function start() {
  await boot();
  const port = Number(process.env.PORT || 4000);
  app.listen(port, () => {
    console.log(`YusrFlow API listening on http://localhost:${port}`);
  });
}

if (!process.env.VERCEL) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
