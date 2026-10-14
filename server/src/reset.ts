import { exec, ensureSchema } from "./db";
import { seedIfEmpty } from "./seed";

async function main() {
  await ensureSchema();
  await exec(`
    TRUNCATE TABLE
      messages, reports, snapshots, settings, activity, alerts, issues,
      control_results, applications, integrations, users
    RESTART IDENTITY CASCADE
  `);
  await seedIfEmpty();
  console.log("Supabase database reset and re-seeded.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
