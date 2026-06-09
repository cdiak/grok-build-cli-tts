/*
INPUTS
├── speakable_text: string
├── voice_id: string
└── port: number
          │
          ▼
┌────────────────────────────────────────┐
│  TRANSFORMER: post speak stream        │
└────────────────────────────────────────┘
          │
          ▼
OUTPUT
└── wav_parts: Buffer[]
*/

import { spawn } from "child_process";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function playWav(filePath) {
  if (process.platform !== "darwin") {
    throw new Error("Playback requires macOS afplay (or use --no-play)");
  }
  await new Promise((resolve, reject) => {
    const p = spawn("afplay", [filePath], { stdio: "ignore" });
    p.on("error", reject);
    p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`afplay exit ${c}`))));
  });
}

export function concatWav(buffers) {
  if (buffers.length === 1) return buffers[0];
  const pcmParts = [];
  let rate = 24000;
  for (const buf of buffers) {
    if (buf.length < 44) continue;
    rate = buf.readUInt32LE(24);
    pcmParts.push(buf.subarray(44));
  }
  const pcm = Buffer.concat(pcmParts);
  const out = Buffer.alloc(44 + pcm.length);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + pcm.length, 4);
  out.write("WAVE", 8);
  out.write("fmt ", 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(rate, 24);
  out.writeUInt32LE(rate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(pcm.length, 40);
  pcm.copy(out, 44);
  return out;
}

async function drainPlayQueue(queue, isDone) {
  let batchNum = 0;
  while (!isDone() || queue.length > 0) {
    if (queue.length === 0) {
      await sleep(8);
      continue;
    }
    const batch = queue.splice(0, queue.length);
    const combined = concatWav(batch);
    const tmp = path.join(os.tmpdir(), `kokoro-${process.pid}-b${batchNum++}.wav`);
    await fs.writeFile(tmp, combined);
    try {
      await playWav(tmp);
    } finally {
      try {
        await fs.unlink(tmp);
      } catch {}
    }
  }
}

export async function speakStream(opts, text) {
  const t0 = Date.now();
  const res = await fetch(`http://127.0.0.1:${opts.port}/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      voice: opts.voice,
      speed: 1.0,
      replace: opts.replaceQueue !== false,
    }),
  });
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const playQueue = [];
  const wavParts = [];
  let buffer = "";
  let streamDone = false;
  let firstChunk = true;

  const player =
    opts.play
      ? drainPlayQueue(playQueue, () => streamDone)
      : Promise.resolve();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        const event = JSON.parse(line);
        if (event.type === "error") throw new Error(event.error || "Stream error");
        if (event.type === "chunk") {
          if (firstChunk) {
            console.error(
              `[kokoro-speak] First audio chunk in ${((Date.now() - t0) / 1000).toFixed(1)}s`
            );
            firstChunk = false;
          }
          const wav = Buffer.from(event.audio, "base64");
          wavParts.push(wav);
          if (opts.play) playQueue.push(wav);
        }
      }
    }
  } finally {
    streamDone = true;
  }

  await player;
  return wavParts;
}