import type { VercelRequest, VercelResponse } from "@vercel/node";
import { app, boot } from "../server/src/index";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await boot();

  // Express writes to the response; wait until it finishes so Vercel doesn't cut the request off.
  await new Promise<void>((resolve, reject) => {
    const done = () => resolve();
    res.on("finish", done);
    res.on("close", done);
    try {
      app(req as unknown as import("express").Request, res as unknown as import("express").Response);
    } catch (error) {
      reject(error);
    }
  });
}
