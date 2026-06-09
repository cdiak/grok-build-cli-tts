/*
INPUTS
├── task: async function(signal)
└── replace: boolean
          │
          ▼
┌────────────────────────────────────────┐
│  TRANSFORMER: enqueue speak request    │
└────────────────────────────────────────┘
          │
          ▼
OUTPUT
└── completion: void
*/

const speakQueue = [];
let speakBusy = false;
let currentCancel = null;
let generation = 0;

export function getQueueStatus() {
  return { busy: speakBusy, queued: speakQueue.length };
}

export function cancelActiveAndClear() {
  generation++;
  if (currentCancel) {
    try {
      currentCancel();
    } catch {}
    currentCancel = null;
  }
  speakQueue.length = 0;
  speakBusy = false;
  drainSpeakQueue();
}

export function enqueueSpeak(task, { replace = false } = {}) {
  if (replace) cancelActiveAndClear();
  return new Promise((resolve, reject) => {
    speakQueue.push({ task, resolve, reject, gen: generation });
    drainSpeakQueue();
  });
}

async function drainSpeakQueue() {
  if (speakBusy || speakQueue.length === 0) return;
  speakBusy = true;
  const job = speakQueue.shift();
  const { task, resolve, reject, gen } = job;
  const ac = new AbortController();
  currentCancel = () => ac.abort();
  try {
    await task(ac.signal);
    if (gen === generation) resolve();
    else resolve();
  } catch (err) {
    if (ac.signal.aborted || gen !== generation) resolve();
    else reject(err);
  } finally {
    if (currentCancel) currentCancel = null;
    speakBusy = false;
    drainSpeakQueue();
  }
}