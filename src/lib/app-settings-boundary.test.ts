import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const srcRoot = join(import.meta.dir, "..");
const allowedDirectSettingsFiles = new Set([
  "lib/app-settings.functions.ts",
  "lib/app-settings.server.ts",
]);

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      return /\.(?:ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [path] : [];
    }),
  );
  return nested.flat();
}

describe("app_settings direct-access boundary", () => {
  test("only the dedicated settings server/admin modules query the raw table", async () => {
    const offenders: string[] = [];
    for (const file of await sourceFiles(srcRoot)) {
      const rel = relative(srcRoot, file).replaceAll("\\", "/");
      const source = await readFile(file, "utf8");
      if (/\.from\(\s*["']app_settings["']\s*\)/.test(source) && !allowedDirectSettingsFiles.has(rel)) {
        offenders.push(rel);
      }
    }

    expect(offenders.sort()).toEqual([]);
  });
});
