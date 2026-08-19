import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const publicRoutes = join(import.meta.dir, "..", "routes", "api", "public");

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  }));
  return nested.flat();
}

describe("public API CORS boundary", () => {
  test("no public route grants wildcard browser origins", async () => {
    const offenders: string[] = [];
    for (const file of await sourceFiles(publicRoutes)) {
      const source = await readFile(file, "utf8");
      if (/Access-Control-Allow-Origin["']?\s*[:=]\s*["']\*["']/.test(source)) {
        offenders.push(relative(publicRoutes, file).replaceAll("\\", "/"));
      }
    }
    expect(offenders.sort()).toEqual([]);
  });
});
