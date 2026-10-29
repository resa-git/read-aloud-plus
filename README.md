# Read Aloud Plus

Reads web pages aloud with Azure neural voices, local Kokoro on your own GPU, or Edge's built-in voices. Click a word to start reading from it. The current sentence and word are highlighted on the page.

## Install (Chrome or Edge)
1. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge) and turn on **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Put your key in `.env` in this folder (it is git-ignored and is read every time the extension loads or reloads):
   ```
   AZURE_SPEECH_KEY=...
   AZURE_SPEECH_REGION=<your-region, e.g. westeurope or eastus>
   ```
   Or type the key and region in the popup instead. Then pick a voice and a speed in the popup.
4. Reload any tabs that were already open.

## Use
- **Alt+click** any text to read from that word.
- **Reading mode** (popup checkbox or `Alt+Shift+R`): a plain click reads from the clicked word. Links don't open while it's on.
- Floating bar (bottom right): pause/resume, stop, speed. **Esc** stops reading.

## What runs where

| File | Chrome | Edge | Job |
|---|---|---|---|
| `src/platform.js` | ✓ | ✓ | **The only browser switch** (`IS_EDGE`) |
| `src/player.js` | ✓ | ✓ | Shared gapless playback and word timing for Azure and Kokoro |
| `src/engine-azure.js` | ✓ | ✓ | Azure streaming WebSocket |
| `src/engine-local.js` | ✓ | ✓ | Kokoro on your GPU (`localhost:8880`, via `background.js`) |
| `src/engine-edge.js` | – | ✓ | Edge's free "Online (Natural)" voices (Web Speech API) |
| `src/text.js` | ✓ | ✓ | Page text from the clicked word onward, sentence splitting, mapping text positions back to the page |
| `src/reader.js` | ✓ | ✓ | Click handling, highlighting (CSS Custom Highlight API), floating bar |
| `background.js` | ✓ | ✓ | Loads `.env`, relays Kokoro requests, keyboard shortcut |

## Local voices (Kokoro)
Kokoro runs in Docker Desktop on your GPU at `http://localhost:8880`.

**1. Start Docker Desktop.** Open **Docker Desktop** from the Start menu and wait until the bottom-left corner shows **Engine running**.
To have it start automatically, go to Docker Desktop → **Settings → General** and turn on **Start Docker Desktop when you sign in to your computer**.

**2. Create the Kokoro container (first time only).** In PowerShell:
```powershell
docker run -d --gpus all -p 127.0.0.1:8880:8880 --name kokoro --restart unless-stopped ghcr.io/remsky/kokoro-fastapi-gpu:latest-cu128
```
- `--gpus all` lets Kokoro use the GPU.
- `127.0.0.1:8880` makes Kokoro reachable only from this PC.
- `--restart unless-stopped` starts Kokoro again whenever Docker Desktop starts.
- `latest-cu128` is the build for Blackwell / RTX 50-series GPUs.

The first run downloads several GB. Kokoro is ready when `docker logs -f kokoro` shows `Uvicorn running`, or when http://localhost:8880/web opens a test player. Then choose a Kokoro voice in the popup.

**Everyday commands** (PowerShell, with Docker Desktop running):

| What | Command |
|---|---|
| Is it running? | `docker ps --filter name=kokoro` |
| Restart | `docker restart kokoro` |
| Stop | `docker stop kokoro` |
| Start again after stopping | `docker start kokoro` |
| Watch the log | `docker logs -f kokoro` (Ctrl+C to exit) |
| Update to the newest version | `docker rm -f kokoro`, `docker pull ghcr.io/remsky/kokoro-fastapi-gpu:latest-cu128`, then the `docker run` command above |

You can also use Docker Desktop's **Containers** page: the ▶ / ■ / ↻ buttons next to `kokoro` start, stop and restart it.

**If the popup says "Kokoro isn't running":** make sure Docker Desktop shows **Engine running**, then run `docker start kokoro`.
| `popup.*` | ✓ | ✓ | Settings. The Edge voice group appears only in Edge |
