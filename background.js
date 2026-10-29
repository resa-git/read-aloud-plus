// Service worker. Same in Chrome and Edge.

const KOKORO = 'http://localhost:8880';

// Copy AZURE_SPEECH_KEY / AZURE_SPEECH_REGION from .env (in this folder) into settings.
// Runs on install, on every extension reload, and on browser start, so .env wins over the popup.
async function loadEnv() {
  try {
    const env = Object.fromEntries((await (await fetch('.env')).text())
      .split('\n').map((l) => l.trim().split(/=(.*)/)).filter(([k, v]) => k && v));
    const key = env.AZURE_SPEECH_KEY, region = env.AZURE_SPEECH_REGION;
    if (key && region) chrome.storage.local.set({ key, region: region.toLowerCase() });
  } catch {} // no .env: use the key typed in the popup
}
chrome.runtime.onInstalled.addListener(loadEnv);
chrome.runtime.onStartup.addListener(loadEnv);

// Local Kokoro: stream one sentence, forwarding each NDJSON line ({ audio: base64 PCM, timestamps }) to the page.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'kokoro') return;
  const abort = new AbortController();
  port.onDisconnect.addListener(() => abort.abort());
  port.onMessage.addListener(async ({ text, voice, speed }) => {
    try {
      const r = await fetch(`${KOKORO}/dev/captioned_speech`, {
        method: 'POST',
        signal: abort.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'kokoro', input: text, voice, speed, response_format: 'pcm', stream: true }),
      });
      if (!r.ok) throw new Error(`Kokoro error (HTTP ${r.status}): ${(await r.text()).slice(0, 200)}`);
      const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = '';
      for (let x; !(x = await reader.read()).done; ) {
        const lines = (buf += x.value).split('\n');
        buf = lines.pop();
        for (const l of lines) if (l.trim()) port.postMessage(JSON.parse(l));
      }
      if (buf.trim()) port.postMessage(JSON.parse(buf));
      port.postMessage({ done: true });
    } catch (e) {
      if (abort.signal.aborted) return;
      port.postMessage({ error: e instanceof TypeError ? `Kokoro isn't running on ${KOKORO}.` : e.message });
    }
  });
});

// "READ" badge on the toolbar icon while reading mode (plain click reads) is on.
const badge = (on) => chrome.action.setBadgeText({ text: on ? 'READ' : '' });
chrome.storage.local.get('mode').then(({ mode }) => badge(mode));
chrome.storage.onChanged.addListener((ch) => ch.mode && badge(ch.mode.newValue));

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== 'toggle-mode') return;
  const { mode } = await chrome.storage.local.get('mode');
  chrome.storage.local.set({ mode: !mode });
});
