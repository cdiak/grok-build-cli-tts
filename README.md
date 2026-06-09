# grok-build-cli-tts

Local Kokoro TTS playback for Grok Build `/tts`. Turns markdown narration scripts into streamed speech via `kokoro-speak`.

## Install from a prompt

Copy everything inside the block below and paste it into Grok Build. It should clone this repo, install dependencies, wire up the `/tts` skill, and run a smoke test — no manual steps.

```text
Set up grok-build-cli-tts for local /tts playback. Do every step yourself in the shell; do not tell me what to run.

Repo: https://github.com/cdiak/grok-build-cli-tts
Install dir: ~/grok-build-cli-tts (create parent dirs if needed)

Steps:
1. If ~/grok-build-cli-tts exists, pull latest; otherwise git clone into that path.
2. cd ~/grok-build-cli-tts && ./bin/install
3. If port 19200 is occupied by a stuck process, kill it so our server can bind.
4. Install the skill: rm -rf ~/.grok/skills/tts if present, then cp -r .grok/skills/tts ~/.grok/skills/tts
5. Persist env in ~/.zshrc (or ~/.bashrc if that is my shell): append
     export GROK_TTS_HOME="$HOME/grok-build-cli-tts"
     export PATH="$HOME/grok-build-cli-tts/bin:$PATH"
   only if those lines are not already there.
6. Smoke test with a long timeout (first run downloads Kokoro weights, 1–3 min):
     kokoro-speak --text "Grok Build TTS is working."
7. Report: clone path, node version, whether audio played or --no-play fallback was needed, curl /status summary, and confirm /tts is ready.

Prerequisites: Node ≥18, macOS for audible playback, network on first run only.
If playback fails, diagnose and fix before reporting done.
```

After Grok finishes, try `/tts recent` on your next assistant reply.

---

## What the prompt does

| Step | Result |
|------|--------|
| Clone / pull | `~/grok-build-cli-tts` at latest `main` |
| `./bin/install` | `npm install`, chmod `bin/*` |
| Skill copy | `~/.grok/skills/tts/SKILL.md` (portable paths, no machine-specific dirs) |
| Shell profile | `GROK_TTS_HOME` + `bin/` on `PATH` |
| Smoke test | Downloads Kokoro-82M ONNX on first run, plays one sentence |

---

## Manual install

```bash
git clone https://github.com/cdiak/grok-build-cli-tts.git ~/grok-build-cli-tts
cd ~/grok-build-cli-tts
./bin/install
export GROK_TTS_HOME="$HOME/grok-build-cli-tts"
export PATH="$HOME/grok-build-cli-tts/bin:$PATH"
cp -r .grok/skills/tts ~/.grok/skills/tts
kokoro-speak --text "Grok Build TTS is working."
```

Or point Grok at the repo skill without copying:

```toml
# ~/.grok/config.toml
[skills]
paths = ["~/grok-build-cli-tts/.grok/skills/tts"]
```

---

## Prerequisites

- Node.js ≥ 18
- macOS for audible playback (Linux: `--no-play --out file.wav`)
- ~500 MB disk for Kokoro weights (auto-downloaded on first run)
- Network on first run only

---

## Usage in Grok Build

```
/tts recent
/tts no-play src/main.ts
/tts ./my-project
```

### Fast playback (avoid 30–90s “dead air”)

1. **Keep the server warm:** `kokoro-server` once per session (or rely on `KOKORO_KEEP_SERVER=1`, the default).
2. **Cold start is ~20–40s** while the ONNX model loads — stderr shows `Server loading model…` with elapsed seconds.
3. **New `/tts` replaces in-flight playback** — stale `kokoro-speak` clients are killed and the server queue is cleared automatically.
4. **Do not background `kokoro-speak` from agents** — cancelled turns used to orphan long playbacks and block the queue for minutes (fixed in current `lib/cli/speak.mjs` + `lib/server/speak-queue.mjs`).
5. **Gapless sentence batches** — the client now reads NDJSON chunks in parallel with playback and concatenates every buffered sentence into one `afplay` call, removing the old per-sentence two-second stall.

---

## Environment variables

| Variable | Default | Effect |
|----------|---------|--------|
| `GROK_TTS_HOME` | — | Repo root; resolves `bin/kokoro-speak` |
| `KOKORO_PORT` | `19200` | HTTP server port |
| `KOKORO_VOICE` | `af_sky` | Kokoro voice id |
| `KOKORO_SERVER_DIR` | `lib/server` | Server entry directory |
| `KOKORO_KEEP_SERVER` | `1` | Keep server process between runs |
| `HF_HOME` | `~/.cache/huggingface` | Model cache location |

---

## CLI reference

```bash
kokoro-speak script.md          # play markdown script
kokoro-speak --text "hello"     # play inline text
kokoro-speak --no-play --out out.wav script.md
kokoro-server                   # pre-warm daemon
```