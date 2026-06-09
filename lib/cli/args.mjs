/*
INPUTS
├── argv: string[]
└── stdin: stream | null
          │
          ▼
┌────────────────────────────────────────┐
│  TRANSFORMER: parse cli arguments      │
└────────────────────────────────────────┘
          │
          ▼
OUTPUT
└── cli_opts: object
*/

import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 19200;
const DEFAULT_VOICE = "af_sky";

export function usage() {
  console.error(`Usage: kokoro-speak [--text STRING | file.md | -]
  --port N        HTTP port (default ${DEFAULT_PORT})
  --voice ID      Kokoro voice (default ${DEFAULT_VOICE})
  --server-dir    Path to lib/server/
  --no-play       Synthesize only; write combined WAV (--out optional)
  --out PATH      Save combined WAV
  -h, --help`);
}

export function parseArgs(argv) {
  const opts = {
    text: null,
    file: null,
    port: Number(process.env.KOKORO_PORT) || DEFAULT_PORT,
    voice: process.env.KOKORO_VOICE || DEFAULT_VOICE,
    serverDir: process.env.KOKORO_SERVER_DIR || path.resolve(__dirname, "../server"),
    nodePath: process.env.KOKORO_NODE || "node",
    play: true,
    out: null,
    keepServer: process.env.KOKORO_KEEP_SERVER !== "0",
    replaceQueue: process.env.KOKORO_REPLACE_QUEUE !== "0",
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") {
      usage();
      process.exit(0);
    }
    if (a === "--text") {
      opts.text = argv[++i] ?? "";
      continue;
    }
    if (a === "--port") opts.port = Number(argv[++i]);
    else if (a === "--voice") opts.voice = argv[++i] ?? DEFAULT_VOICE;
    else if (a === "--server-dir") opts.serverDir = path.resolve(argv[++i] ?? "");
    else if (a === "--node") opts.nodePath = argv[++i] ?? "node";
    else if (a === "--no-play") opts.play = false;
    else if (a === "--out") opts.out = path.resolve(argv[++i] ?? "");
    else if (a.startsWith("-")) {
      console.error("Unknown option:", a);
      usage();
      process.exit(1);
    } else positional.push(a);
  }
  if (opts.text === null && positional.length === 1) opts.file = positional[0];
  else if (opts.text === null && positional.length > 0) {
    console.error("Unexpected arguments:", positional.join(" "));
    usage();
    process.exit(1);
  }
  return opts;
}

export async function readInput(opts) {
  if (opts.text !== null) return opts.text;
  if (opts.file === "-") {
    return await new Promise((resolve, reject) => {
      let data = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (c) => (data += c));
      process.stdin.on("end", () => resolve(data));
      process.stdin.on("error", reject);
    });
  }
  if (opts.file) return await fs.readFile(opts.file, "utf8");
  throw new Error("No input");
}