// Service worker. Same in Chrome and Edge.

// Coming from v0.1: forget the stored Azure key and an Azure voice; Docker Kokoro voices become in-browser ones.
chrome.runtime.onInstalled.addListener(async () => {
  chrome.storage.local.remove(['key', 'region']);
  const { voice } = await chrome.storage.local.get('voice');
  if (voice?.startsWith('azure:')) chrome.storage.local.remove('voice');
  if (voice?.startsWith('local:')) chrome.storage.local.set({ voice: voice.replace('local:', 'web:') });
});

// In-browser Kokoro runs in a hidden offscreen page (offscreen.js): a service worker has no WebGPU
// and is shut down when idle, which would drop the loaded model. Pages ask for it before connecting.
let opening;
const openOffscreen = () => (opening ??= (async () => {
  if (!(await chrome.offscreen.hasDocument())) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['WORKERS'],
      justification: 'Runs the Kokoro text-to-speech model locally (WebGPU / WebAssembly).',
    });
  }
})().finally(() => (opening = null)));
chrome.runtime.onMessage.addListener((msg, _, reply) => {
  if (msg !== 'offscreen') return;
  openOffscreen().then(() => reply(true), () => reply(false));
  return true; // reply comes later
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
