# Vendored libraries

Extensions may not load code from a CDN, so in-browser Kokoro's code ships here. The model itself
(~90–330 MB) is downloaded from Hugging Face on first use and cached by the browser.

| File | From | License |
|---|---|---|
| `kokoro.web.js` | [kokoro-js](https://www.npmjs.com/package/kokoro-js) 1.2.1 `dist/kokoro.web.js` (bundles Transformers.js 3.5.1 and phonemizer / eSpeak NG) | Apache-2.0; eSpeak NG is GPL-3.0 |
| `ort-wasm-simd-threaded.jsep.mjs`, `.wasm` | [@huggingface/transformers](https://www.npmjs.com/package/@huggingface/transformers) 3.5.1 `dist/` (ONNX Runtime Web) | MIT |

To update: take the same files from newer versions of both packages, keeping their versions matched
(the `.wasm` must be the ONNX Runtime build that kokoro-js's Transformers.js expects).
