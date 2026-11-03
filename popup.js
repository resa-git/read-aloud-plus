// Settings popup. Same in Chrome and Edge; the Edge voice group appears when the browser has those voices.

const $ = (id) => document.getElementById(id);
const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

// Edge's built-in US English natural voices, if this browser has them (Edge does, Chrome doesn't).
// Online ones stream from Microsoft; "(offline)" ones are downloaded to this PC.
const browserVoices = await new Promise((ok) => {
  const get = () => speechSynthesis.getVoices();
  if (get().length) return ok(get());
  speechSynthesis.addEventListener('voiceschanged', () => ok(get()), { once: true });
  setTimeout(() => ok(get()), 1000); // a browser with no voices never fires voiceschanged
});
const edge = {};
for (const v of browserVoices) {
  const name = v.lang === 'en-US' && /Natural/.test(v.name) && /\b(Jenny|Aria|Guy)\b/.exec(v.name)?.[1];
  if (name) edge[`edge:${v.name}`] = name + (v.localService ? ' (offline)' : '');
}

// A short, hand-picked list of US English voices. Value = "<engine>:<voice id>".
const VOICES = {
  ...(Object.keys(edge).length && { 'Edge built-in (free)': edge }),
  'Azure (your subscription)': {
    'azure:en-US-JennyNeural': 'Jenny',
    'azure:en-US-AvaMultilingualNeural': 'Ava',
    'azure:en-US-AndrewMultilingualNeural': 'Andrew',
  },
  'Kokoro (local GPU, free)': {
    'local:af_heart': 'Heart',
    'local:af_bella': 'Bella',
    'local:am_michael': 'Michael',
  },
};

const s = await chrome.storage.local.get(['key', 'region', 'voice', 'rate', 'mode']);

$('voice').innerHTML = Object.entries(VOICES).map(([group, list]) =>
  `<optgroup label="${group}">${Object.entries(list).map(([id, name]) => `<option value="${id}">${name}</option>`).join('')}</optgroup>`).join('');
$('voice').value = s.voice ?? DEFAULT_VOICE;
$('rate').innerHTML = RATES.map((r) => `<option value="${r}">${r}×</option>`).join('');
$('rate').value = s.rate ?? 1;
$('mode').checked = !!s.mode;
$('key').value = s.key ?? '';
$('region').value = s.region ?? '';

$('voice').onchange = (e) => chrome.storage.local.set({ voice: e.target.value });
$('rate').onchange = (e) => chrome.storage.local.set({ rate: +e.target.value });
$('mode').onchange = (e) => chrome.storage.local.set({ mode: e.target.checked });
$('key').onchange = $('region').onchange = () =>
  chrome.storage.local.set({ key: $('key').value.trim(), region: $('region').value.trim().toLowerCase() });
