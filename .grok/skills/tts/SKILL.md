---
name: tts
description: >
  Produce a TTS-friendly natural-language script from code, terminal output, or a
  recent assistant reply—then optionally play it via local Kokoro (grok-build-cli-tts).
  Use when the user runs /tts, asks for a listenable explanation, TTS translation,
  or speech-ready narration of code or output.
metadata:
  short-description: "Speech-ready script + optional local Kokoro playback"
when-to-use: >
  User runs /tts; wants a listenable version of recent output, a file, a directory,
  or the whole repo; or asks for TTS-friendly / speech-ready narration.
argument-hint: "[path] | recent | last | no-play | <file-or-dir>"
user-invocable: true
compatibility: Requires grok-build-cli-tts, Node ≥18, macOS for playback
---

# `/tts` — TTS-friendly narration

**Deliverable:** One continuous markdown document (spoken script). By default, after you post it, **play it locally with Kokoro** via `grok-build-cli-tts` so audio starts without copy-paste into ElevenLabs.

**Prerequisites:** `grok-build-cli-tts` installed (`./bin/install`), `kokoro-speak` on PATH or `GROK_TTS_HOME` set. See repo README.

No code fences in the spoken body unless quoting a short identifier; the prose itself is the script.

When the user types **`/tts`** with no arguments, show the **CLI help** block below, then default to **recent** if they already pointed at something in the same message; otherwise ask what to narrate.

---

## CLI help (show on bare `/tts`)

```text
/tts — TTS-friendly narration (+ local Kokoro playback by default)

Modes (pick from context or argument):

  recent, last     Narrate your most recent substantive assistant message
                   (code changes, explanation, terminal summary). Default when
                   /tts follows implementation work.

  <file>           Single source file → ## file, ### each function/module unit.

  <directory>      Whole tree or repo → integrated walk, workflow order when possible.

  no-play          Write script only; skip Kokoro (ElevenLabs copy-paste mode).

Examples:
  /tts
  /tts recent
  /tts no-play src/lib/parser.ts
  /tts ./my-project
  /tts explain the test failure in the last terminal block

Output: one markdown script (## per file, ### per function), then Kokoro plays it
unless the user said no-play or playback fails.

Override Kokoro: GROK_TTS_HOME, KOKORO_PORT, KOKORO_VOICE, KOKORO_SERVER_DIR env vars.
```

---

## Detect scope (every invocation)

| Signal | Scope |
|--------|--------|
| `recent`, `last`, no path after bare `/tts` right after agent work | **RECENT** — last assistant turn with code/output |
| Path to existing file | **FILE** |
| Path to directory, or "repo", "codebase", "whole project" | **REPO** |
| "terminal", "command output", "build log" | **TERMINAL** — quoted or read from cited path / session |
| `no-play`, "elevenlabs only", "no kokoro" | **NO_PLAY** — script only, skip Kokoro step |
| Ambiguous | Ask once: recent reply, one file, directory, or terminal output? |

Read files with tools when needed. For **RECENT**, use conversation context first; re-read cited paths if the summary is thin.

---

## Voice and structure (all modes)

Write as **spoken technical narration**: complete sentences, present tense, second person optional ("this function takes…"). Integrate the story—do not bullet-dump unrelated facts.

**Headers (markdown for navigation; headers are not read aloud as symbols):**

- `##` — one per source file (basename + role in one short line after the title)
- `###` — one per function, method, class, or coherent module-level unit
- For non-code (terminal, recent reply): `##` major sections (e.g. "What ran", "Error", "Fix")

**Workflow order:** When covering multiple files, sequence **chronologically by runtime/workflow** (entrypoint → dependencies → leaves), not strict alphabetical order. State transitions between files ("Next, the parser calls…").

**Names:** Say real identifiers aloud when they aid recognition:

- Good: "the function `underscore_known`", "def underscore underscore known"
- Good: "a parameter named path, typed as Path"
- Bad: "open paren, path, colon, Path, close paren"

**Symbols → speech (defaults):**

| Written | Say |
|---------|-----|
| `snake_case` | snake case words or spell if short: "underscore known" |
| `camelCase` | camel case or split: "get user id" |
| `->` / `=>` | "returns" / "arrow" |
| `::` | "double colon" or "namespace" |
| `.` in chains | "dot" |
| `[]` | "list of" / "array of" |
| `{}` | "dict" / "map" / "object" |
| `//` `/* */` | skip comment text unless it states an invariant worth hearing |
| string literals | paraphrase content; read short literals verbatim |
| numbers | words for small ints; digit groups for IDs |

**Code to read literally:** Short defs and keywords (`def`, `class`, `async`, `import`) when it helps anchor the listener. Long blocks → paraphrase behavior, branches, and side effects.

**Omit:** Line numbers, column alignment, diff `+`/`-` markers (describe "added" / "removed" instead), URLs unless the user asked, boilerplate license headers.

---

## Mode: RECENT

Narrate the **last substantive assistant message** (patch summary, design explanation, command results).

1. Open with one sentence: what was accomplished or explained.
2. Walk changes in **logical execution order**, not file sort order.
3. For each touched file: `##` + integrated `###` sections per changed unit.
4. Close with outcome: tests, errors, or what the user should verify.

If the last turn was only a one-liner, say so and offer to expand from a path.

---

## Mode: FILE

1. Read the full file.
2. `## <filename>` — purpose of the file in the system (2–4 sentences).
3. For each top-level function/class/method (in **call-friendly order** when inferable): `### <name>` — parameters in plain language, control flow, return value, errors, who calls it.
4. Mention imports only when they define behavior (not every import line).

---

## Mode: REPO

Mirror the user's original workflow: **full, integrated discussion** of the codebase.

1. Skim layout (entrypoints, config, tests) — do not narrate every config key unless load-bearing.
2. One `##` per file worth hearing; skip generated/vendor/binary unless asked.
3. `###` per function (or class + its public methods as subsections).
4. Thread a **single narrative**: data and control from start to finish.
5. Cap enormous repos: prioritize user-named paths, or entrypoint + reachable graph; state what was skipped.

---

## Mode: TERMINAL

1. `## What ran` — command intent in plain language.
2. `## Output` — narrate stdout/stderr: success lines briefly, errors with cause and fix hints.
3. Do not read every progress bar tick; summarize counts and failures.

---

## Output format rules

- Reply with **one markdown document** only (no preamble like "here is your TTS file").
- No nested skill invocation.
- Length: proportional to scope; RECENT/FILE stay tight; REPO may be long.
- End with a single line the user can ignore when pasting: `<!-- tts:end -->`

Do not attach a separate file unless they explicitly ask to write `something.tts.md` to disk.

---

## Kokoro auto-play (default unless NO_PLAY)

After the markdown script is written, **start local playback** so the user hears it immediately.

### Resolve `kokoro-speak` (in order)

1. `$GROK_TTS_HOME/bin/kokoro-speak` if `GROK_TTS_HOME` is set
2. `kokoro-speak` on `PATH` (after `./bin/install`)
3. If this skill is repo-scoped: `<repo-root>/bin/kokoro-speak` (three levels up from `.grok/skills/tts/`)

If none resolve, tell the user to clone https://github.com/cdiak/grok-build-cli-tts and run `./bin/install`.

Optional warm server: `kokoro-server` (same resolution rules for `bin/`).

Env: `KOKORO_SERVER_DIR` (default `lib/server` in repo), `KOKORO_PORT`, `KOKORO_VOICE`, `KOKORO_KEEP_SERVER=1` (default).

### Agent workflow (required unless NO_PLAY)

1. Write the full TTS markdown reply in the chat (as today).
2. Save the **same body** to a temp file, e.g. `/tmp/grok-tts-<timestamp>.md` (include everything through `<!-- tts:end -->`; the player strips headers and that comment).
3. **Pre-warm** (fast path when server already loaded): if `curl -sf http://127.0.0.1:${KOKORO_PORT:-19200}/status` shows `"ready":true`, skip to step 4. Otherwise run `kokoro-server` once and wait for Ready (cold model load is ~20–40s; first-ever download can take 1–3 min).
4. Run kokoro-speak in the **foreground** with a long `block_until_ms` (long REPO scripts take several minutes to play). Do **not** background kokoro-speak — cancelled agent turns leave orphan clients that used to block the speak queue for minutes.

   ```bash
   kokoro-speak /tmp/grok-tts-<timestamp>.md
   ```

   New invocations auto-cancel stale `kokoro-speak` clients and replace any in-flight server queue (`KOKORO_REPLACE_QUEUE=1` default). stderr shows progress: server warm/loading, first audio chunk timing.

5. If synthesis fails, append **one short line** after the script: `Playback failed: <reason>. Use no-play or check Kokoro server.` Do not replace the script.
6. Do **not** narrate the shell command in the spoken markdown; keep playback out of band.

### Slow start troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| 20–40s before first audio, stderr says "Starting server" / "model loading" | Cold server — ONNX model not in memory | Run `kokoro-server` at session start, or leave `KOKORO_KEEP_SERVER=1` (default) |
| 30–90s with no "First audio chunk" line | Prior `/tts` still playing or orphaned client held the queue | Fixed in current kokoro-speak (auto-kill stale clients + `replace` queue). Restart server if on old code: `pkill -f 'lib/server/index.mjs'; kokoro-server` |
| Instant stderr but long wait on 10k+ char scripts | Normal — first chunk synthesis after long text split | Watch for `First audio chunk in Xs` |

### Flags the user can pass via `/tts`

| User intent | Behavior |
|-------------|----------|
| default | Script + kokoro-speak |
| `no-play` | Script only (ElevenLabs / manual) |
| env `KOKORO_VOICE=am_adam` | Pass through when invoking kokoro-speak |

### Server contract (for debugging)

- Server: `lib/server/index.mjs` — `GET /status`, `POST /speak` (NDJSON stream), `POST /synthesize` (batch).
- macOS: ONNX CoreML EP + q4 weights; sentence-level streaming.
- Default port `19200`, voice `af_sky`.

---

## Quality bar

Before sending, check:

- [ ] A listener who cannot see the screen understands what each piece does and how pieces connect.
- [ ] Identifiers are spoken, not spelled letter-by-letter, unless conventional (e.g. `i`, `n`, `API`).
- [ ] Types and signatures are **described**, not synthetically punctuated.
- [ ] Order follows **workflow**, not directory sort.
- [ ] No raw markdown tables or code blocks longer than ~3 lines in the spoken flow.