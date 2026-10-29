// Click-to-read, highlighting and the floating control bar. Same code in Chrome and Edge;
// the only browser-specific line is which engines get registered.

const ENGINES = { azure: AzureEngine, local: LocalEngine, ...(IS_EDGE && { edge: EdgeEngine }) };
const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const RELOAD = 'The extension was updated. Press F5 to reload this page.';
const settings = { voice: 'azure:en-US-JennyNeural', rate: 1, mode: false };

// CSS Custom Highlight API: paints ranges without touching the page's DOM.
const hlSentence = new Highlight(), hlWord = new Highlight();
hlWord.priority = 1;
CSS.highlights.set('tts-sentence', hlSentence);
CSS.highlights.set('tts-word', hlWord);

let doc, list, engine, cur, paused;

const setMode = () => document.documentElement.classList.toggle('tts-mode', !!settings.mode);

chrome.storage.local.get(Object.keys(settings)).then((s) => {
  Object.assign(settings, s);
  setMode();
});
chrome.storage.onChanged.addListener((ch) => {
  for (const k in ch) if (k in settings) settings[k] = ch[k].newValue;
  if (ch.mode) setMode();
  if ((ch.rate || ch.voice) && engine) restart(); // new speed/voice continues from the current word
});

function readFrom(node, off) {
  while (off > 0 && /\S/.test(node.data[off - 1])) off--; // back up to the start of the clicked word
  doc = collectText(node, off);
  run(splitSentences(doc.text));
}

function run(chunks) {
  engine?.stop();
  if (!chunks.length) return;
  if (!chrome.runtime?.id) return bar.show(RELOAD); // extension was reloaded after this page loaded
  const [kind, name] = settings.voice.split(/:(.*)/); // "azure:en-US-..." / "edge:Microsoft ..."
  engine = ENGINES[kind] ?? AzureEngine;
  list = chunks;
  cur = chunks[0].start;
  paused = false;
  bar.show();
  engine.start(chunks, { voice: name, rate: +settings.rate }, {
    onChunk: (i) => mark(hlSentence, chunks[i].start, chunks[i].text.length),
    onWord: (i, at, len) => {
      cur = chunks[i].start + at;
      follow(mark(hlWord, cur, len));
    },
    onEnd: stop,
    onError: (msg) => {
      stop();
      bar.show(chrome.runtime?.id ? msg : RELOAD);
    },
  });
}

function restart() {
  const k = list.findLastIndex((c) => c.start <= cur), c = list[k];
  run([{ start: cur, text: doc.text.slice(cur, c.start + c.text.length) }, ...list.slice(k + 1)]);
}

function stop() {
  engine?.stop();
  engine = null;
  hlSentence.clear();
  hlWord.clear();
  bar.hide();
}

function togglePause() {
  if (!engine) return;
  paused = !paused;
  paused ? engine.pause() : engine.resume();
  bar.paused(paused);
}

function mark(hl, start, len) {
  const r = rangeAt(doc.segs, start, start + len);
  hl.clear();
  hl.add(r);
  return r;
}

function follow(r) {
  const b = r.getBoundingClientRect();
  if (b.top < 80 || b.bottom > innerHeight - 80) scrollBy({ top: b.top - innerHeight / 3, behavior: 'smooth' });
}

// Alt+click always starts reading; a plain click does too while reading mode is on.
// After an extension reload, this page's old script is cut off and no longer hears setting changes,
// so it must not act on (possibly stale) reading mode. Alt+click still reaches it, to show "press F5".
const wantsRead = (e) => !e.button && !e.composedPath().includes(bar.host) &&
  (e.altKey || (settings.mode && !!chrome.runtime?.id));

// Swallow the press too, so the page doesn't select the word or open its own
// selection menu (e.g. CFA's "Mark unclear / Mark important").
for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup']) {
  addEventListener(type, (e) => {
    if (!wantsRead(e)) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);
}

addEventListener('click', (e) => {
  if (!wantsRead(e)) return;
  const [node, off] = caretAt(e.clientX, e.clientY) ?? [];
  if (node?.nodeType !== Node.TEXT_NODE || !readable(node)) return;
  e.preventDefault(); // in reading mode, don't follow links you click to read
  e.stopPropagation();
  readFrom(node, off);
}, true);

addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && engine) stop();
});

const bar = (() => {
  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'closed' }); // page CSS can't leak in
  root.innerHTML = `<style>
    :host { all: initial; position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; }
    div { display: flex; gap: 6px; align-items: center; padding: 6px 8px; border-radius: 10px;
          background: #222; color: #fff; font: 13px system-ui, sans-serif; box-shadow: 0 4px 16px #0005; }
    button, select { font: inherit; color: inherit; background: #444; border: 0; border-radius: 6px; padding: 4px 8px; cursor: pointer; }
    span { max-width: 260px; } span:empty { display: none; }
  </style><div>
    <button id="pp" title="Pause / resume">⏸</button>
    <button id="st" title="Stop (Esc)">⏹</button>
    <select id="rt" title="Speed">${RATES.map((r) => `<option value="${r}">${r}×</option>`).join('')}</select>
    <span id="msg"></span>
  </div>`;
  const $ = (id) => root.getElementById(id);
  $('pp').onclick = togglePause;
  $('st').onclick = stop;
  $('rt').onchange = (e) => chrome.storage.local.set({ rate: +e.target.value });
  return {
    host,
    show(msg = '') {
      $('msg').textContent = msg;
      $('rt').value = settings.rate;
      $('pp').textContent = '⏸';
      document.documentElement.append(host);
    },
    hide: () => host.remove(),
    paused: (p) => ($('pp').textContent = p ? '▶' : '⏸'),
  };
})();
