// Kokoro running inside the browser: WebGPU if there is a GPU, otherwise WebAssembly on the CPU.
// Lives in a hidden offscreen page that background.js opens on first use. Same in Chrome and Edge.
// Replies per sentence with { audio: base64 PCM, timestamps }, then { done } (see src/engine-kokoro.js).
// Word times are estimated (kokoro-js reports none), so the word highlight is approximate.

import { KokoroTTS, TextSplitterStream, env } from './vendor/kokoro.web.js';

env.wasmPaths = chrome.runtime.getURL('vendor/'); // ONNX Runtime ships with the extension, not from a CDN
const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
let tts;                       // Promise<KokoroTTS>, loaded on first use
let queue = Promise.resolve(); // one sentence at a time: the model can't run two at once
let status = '';               // what loading is doing right now, shown on the reading bar
let notify = () => {};         // sends to the page that is waiting for the model
const note = (msg) => notify({ note: (status = msg) });

const getModel = () => (tts ??= load().then(
  (m) => ((status = ''), m),
  (e) => { status = ''; tts = null; throw e; }, // try loading again next time
));

async function load() {
  note('⏳ Loading the voice model…');
  let shown = -1;
  const progress_callback = (p) => { // Hugging Face sends no file size, so count megabytes
    if (!p.file?.endsWith('.onnx')) return;
    const mb = Math.floor(p.loaded / 10e6) * 10;
    if (p.status === 'progress' && mb > shown) note(`⏳ Downloading the voice model (first time only): ${(shown = mb)} MB`);
    if (p.status === 'done') note('⏳ Preparing the voice model…');
  };
  if (await navigator.gpu?.requestAdapter().catch(() => null)) {
    try {
      return await KokoroTTS.from_pretrained(MODEL, { device: 'webgpu', dtype: 'fp32', progress_callback });
    } catch {} // no usable WebGPU: fall back to the CPU
  }
  return KokoroTTS.from_pretrained(MODEL, { device: 'wasm', dtype: 'q8', progress_callback });
}

// Spread the speech between the first and last audible sample over the words, by length,
// with a little extra for the pause after punctuation.
function guessWords(text, pcm, base) {
  const loud = (x) => Math.abs(x) > 0.01;
  const head = Math.max(0, pcm.findIndex(loud)) / 24000, tail = (pcm.findLastIndex(loud) + 1) / 24000;
  const words = text.match(/\S+/g) ?? [];
  const weight = words.map((w) => w.length + (/[,;:]$/.test(w) ? 3 : /[.!?]$/.test(w) ? 5 : 1));
  const total = weight.reduce((a, b) => a + b, 0);
  let sum = 0;
  return words.map((w, i) => {
    const start_time = base + head + (tail - head) * (sum / total);
    sum += weight[i];
    return { word: w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''), start_time };
  });
}

function base64(pcm) {
  const b = new Uint8Array(Int16Array.from(pcm, (x) => Math.max(-1, Math.min(1, x)) * 32767).buffer);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'kokoro') return;
  let gone = false;
  port.onDisconnect.addListener(() => (gone = true));
  const send = (m) => gone || port.postMessage(m);
  port.onMessage.addListener(({ text, voice, speed }) => {
    notify = send;
    if (status) send({ note: status }); // the model is still loading for an earlier request
    queue = queue.then(async () => {
      if (gone) return; // reading moved on before this sentence's turn
      try {
        const model = await getModel();
        // Pass a closed splitter: given a plain string, stream() never ends its input and waits forever.
        const input = new TextSplitterStream();
        input.push(text);
        input.close();
        let base = 0; // long sentences come back in pieces
        for await (const { text: t, audio } of model.stream(input, { voice, speed })) {
          if (gone) return;
          send({ audio: base64(audio.audio), timestamps: guessWords(t, audio.audio, base) });
          base += audio.audio.length / 24000;
        }
        send({ done: true });
      } catch (e) {
        send({ error: `In-browser Kokoro failed: ${e.message}` });
      }
    });
  });
});
