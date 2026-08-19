import { readFileSync, writeFileSync } from "node:fs";
import { auditSupabaseAuthConfig } from "../src/lib/supabase-auth-audit";

const inputPath = process.argv[2];
const outputPath = process.argv[3] ?? "test-results/supabase-auth-audit.json";

if (!inputPath) {
  console.error("Usage: bun scripts/audit-supabase-auth.ts <raw-config.json> [report.json]");
  process.exit(2);
}

let parsed: unknown;
try {
  parsed = JSON.parse(readFileSync(inputPath, "utf8"));
} catch (error) {
  console.error("Unable to parse Supabase Auth configuration JSON.");
  if (error instanceof Error) console.error(error.message);
  process.exit(2);
}

if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
  console.error("Supabase Auth configuration must be a JSON object.");
  process.exit(2);
}

const report = auditSupabaseAuthConfig(parsed as Record<string, unknown>);
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

for (const check of report.checks) {
  const status = check.pass === true ? "PASS" : check.pass === false ? "FAIL" : "REVIEW";
  console.log(`${status.padEnd(6)} ${check.id}: observed=${JSON.stringify(check.observed)} expected=${check.expected}`);
}

console.log(`Sanitized report written to ${outputPath}`);

if (report.blocking_failures.length > 0) {
  console.error(`Blocking Auth configuration failures: ${report.blocking_failures.join(", ")}`);
  process.exit(1);
}
