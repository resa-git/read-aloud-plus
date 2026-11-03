# Read Aloud Plus

Reads web pages aloud with Kokoro voices running in your browser, or Edge's built-in voices. Click a word to start reading from it. The current sentence and word are highlighted on the page.

## Install (Chrome or Edge)
1. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge) and turn on **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Reload any tabs that were already open.
4. Optional: pick a voice and a speed in the popup.

## Voices

| Popup group | Setup | Word highlight | Notes |
|---|---|---|---|
| **Edge built-in** (Jenny, Aria, Guy) | None (Edge only) | Exact | Default in Edge. Streams from Microsoft, needs internet. |
| **Kokoro** (Heart, Bella, Michael) | None | Estimated | Default in Chrome. Runs on your GPU (WebGPU) or CPU. The first read downloads the model once (~330 MB for GPU, ~90 MB for CPU), with progress shown on the bar. Text never leaves your PC. |

"Estimated": the sentence highlight is exact, but the word highlight is spread over the sentence by word length, so it can run slightly ahead or behind.

## Use
- **Alt+click** any text to read from that word.
- **Reading mode** (popup checkbox or `Alt+Shift+R`): a plain click reads from the clicked word. Links don't open while it's on.
- Floating bar (bottom right): pause/resume, stop, speed. **Esc** stops reading.

## What runs where

| File | Chrome | Edge | Job |
|---|---|---|---|
| `src/platform.js` | ✓ | ✓ | **The only browser switch** (`IS_EDGE`): default voice is Edge's Jenny in Edge, in-browser Heart in Chrome |
| `src/player.js` | ✓ | ✓ | Gapless playback and word timing for Kokoro |
| `src/engine-kokoro.js` | ✓ | ✓ | Kokoro engine: sends sentences to `offscreen.js` and receives audio |
| `src/engine-edge.js` | – | ✓ | Edge's free "Online (Natural)" voices (Web Speech API) |
| `src/text.js` | ✓ | ✓ | Page text from the clicked word onward, sentence splitting, mapping text positions back to the page |
| `src/reader.js` | ✓ | ✓ | Click handling, highlighting (CSS Custom Highlight API), floating bar |
| `offscreen.*` | ✓ | ✓ | Hidden page that runs in-browser Kokoro (WebGPU, else WebAssembly on the CPU) |
| `vendor/` | ✓ | ✓ | kokoro-js and ONNX Runtime, shipped with the extension (see `vendor/README.md`) |
| `background.js` | ✓ | ✓ | Opens the offscreen page, keyboard shortcut |
| `popup.*` | ✓ | ✓ | Settings. The Edge voice group appears when the browser has Edge's voices |

The last version with Azure voices (and Kokoro in Docker) is tagged `v0.1.0-azure` (`git checkout v0.1.0-azure`).
