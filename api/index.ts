import type { VercelRequest, VercelResponse } from "@vercel/node";
import { app, boot } from "../server/src/index";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await boot();
  app(req as unknown as import("express").Request, res as unknown as import("express").Response);
}
