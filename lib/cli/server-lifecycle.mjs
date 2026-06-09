/*
INPUTS
├── port: number
└── server_dir: path
          │
          ▼
┌────────────────────────────────────────┐
│  TRANSFORMER: spawn server if absent   │
└────────────────────────────────────────┘
          │
          ▼
OUTPUT
└── live_server: { port, ready }
*/

import { spawn } from "child_process";
import * as fsSync from "fs";
import * as path from "path";

async function fetchStatus(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/status`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function waitForReady(port, maxMs = 180000, logProgress = false) {
  const start = Date.now();
  let lastLog = 0;
  while (Date.now() - start < maxMs) {
    const j = await fetchStatus(port);
    if (j?.ready) return j;
    if (logProgress && Date.now() - lastLog >= 3000) {
      const sec = Math.round((Date.now() - start) / 1000);
      const err = j?.error ? ` (${j.error})` : "";
      const q =
        j?.queueBusy || j?.queueDepth
          ? `, queue busy=${!!j.queueBusy} depth=${j.queueDepth ?? 0}`
          : "";
      console.error(`[kokoro-speak] Waiting for server… ${sec}s${err}${q}`);
      lastLog = Date.now();
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

export async function ensureServer(opts) {
  const existing = await fetchStatus(opts.port);
  if (existing?.ready) {
    console.error(
      `[kokoro-speak] Server ready (warm${existing.loadSec != null ? `, loaded in ${existing.loadSec}s` : ""})`
    );
    return existing;
  }
  if (existing) {
    console.error("[kokoro-speak] Server up, model loading…");
    const meta = await waitForReady(opts.port, 180000, true);
    if (meta) {
      console.error(`[kokoro-speak] Model ready (${meta.loadSec ?? "?"}s load)`);
      return meta;
    }
    throw new Error("Server did not finish loading the model");
  }

  const script = path.join(opts.serverDir, "index.mjs");
  if (!fsSync.existsSync(script)) throw new Error(`Server not found: ${script}`);
  console.error(`[kokoro-speak] Starting server :${opts.port}…`);
  const child = spawn(opts.nodePath, [script, "--port", String(opts.port)], {
    cwd: opts.serverDir,
    stdio: ["ignore", "pipe", "pipe"],
    detached: opts.keepServer,
  });
  if (opts.keepServer) child.unref();
  else {
    child.stdout?.on("data", (d) => process.stderr.write(d));
    child.stderr?.on("data", (d) => process.stderr.write(d));
  }
  const meta = await waitForReady(opts.port, 180000, true);
  if (!meta) {
    if (!opts.keepServer) try { child.kill("SIGTERM"); } catch {}
    throw new Error("Server did not become ready in time");
  }
  console.error(`[kokoro-speak] Model ready (${meta.loadSec ?? "?"}s load)`);
  return meta;
}