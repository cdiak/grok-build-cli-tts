/*
INPUTS
├── cli_opts: object
└── raw_markdown: string
          │
          ▼
┌────────────────────────────────────────┐
│  TRANSFORMER: invoke kokoro-speak      │
└────────────────────────────────────────┘
          │
          ▼
OUTPUT
└── playback_result: ok | failed
*/

import { execSync } from "child_process";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { pathToFileURL } from "url";
import { parseArgs, readInput } from "./args.mjs";
import { markdownToSpeakable } from "./markdown-strip.mjs";
import { ensureServer } from "./server-lifecycle.mjs";
import { speakStream, concatWav } from "./stream-playback.mjs";

function cancelStaleClients() {
  if (process.env.KOKORO_KILL_STALE_CLIENTS === "0") return;
  try {
    const out = execSync('pgrep -f "lib/cli/speak.mjs"', { encoding: "utf8" }).trim();
    if (!out) return;
    for (const pid of out.split("\n")) {
      const n = Number(pid);
      if (n && n !== process.pid) {
        try {
          process.kill(n, "SIGTERM");
        } catch {}
      }
    }
  } catch {}
}

export async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const raw = await readInput(opts);
  const speakable = markdownToSpeakable(raw);
  if (!speakable) {
    console.error("[kokoro-speak] No speakable text.");
    process.exit(1);
  }
  console.error(
    `[kokoro-speak] ${speakable.length} chars, voice=${opts.voice}`
  );
  cancelStaleClients();
  await ensureServer(opts);
  const t0 = Date.now();
  const wavParts = await speakStream(opts, speakable);
  if (opts.out || !opts.play) {
    const combined = concatWav(wavParts);
    const outPath =
      opts.out || path.join(os.tmpdir(), `kokoro-speak-${Date.now()}.wav`);
    await fs.writeFile(outPath, combined);
    console.error(`[kokoro-speak] Wrote ${outPath}`);
  }
  console.error(
    `[kokoro-speak] Finished in ${((Date.now() - t0) / 1000).toFixed(1)}s`
  );
}

const isMain =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  main().catch((err) => {
    console.error("[kokoro-speak] Error:", err.message || err);
    process.exit(1);
  });
}