// Settings popup. Same in Chrome and Edge, except the Edge voice group (IS_EDGE).

const $ = (id) => document.getElementById(id);
const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

// A short, hand-picked list of US English voices. Value = "<engine>:<voice id>".
const VOICES = {
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
  ...(IS_EDGE && {
    'Edge built-in (free, Edge only)': {
      'edge:Microsoft Jenny Online (Natural) - English (United States)': 'Jenny',
      'edge:Microsoft Aria Online (Natural) - English (United States)': 'Aria',
    },
  }),
};

const s = await chrome.storage.local.get(['key', 'region', 'voice', 'rate', 'mode']);

$('voice').innerHTML = Object.entries(VOICES).map(([group, list]) =>
  `<optgroup label="${group}">${Object.entries(list).map(([id, name]) => `<option value="${id}">${name}</option>`).join('')}</optgroup>`).join('');
$('voice').value = s.voice ?? 'azure:en-US-JennyNeural';
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
