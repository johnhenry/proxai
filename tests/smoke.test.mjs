import { test } from "node:test";
import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RUN = fileURLToPath(new URL("../exec/run.mjs", import.meta.url));

test("module exports a start function", async () => {
  const mod = await import("../index.mjs");
  assert.strictEqual(typeof mod.default, "function");
});

test("CLI --help runs and lists the serve command", () => {
  const out = execFileSync(process.execPath, [RUN, "--help"], {
    encoding: "utf8",
  });
  assert.match(out, /serve/);
});
