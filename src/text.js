// Turns "everything after the clicked word" into one plain string for the TTS engine,
// and maps positions in that string back to DOM ranges for highlighting. Same in Chrome and Edge.

const BLOCKS = 'address,article,aside,blockquote,dd,div,dl,dt,figcaption,figure,footer,form,h1,h2,h3,h4,h5,h6,header,li,main,nav,ol,p,pre,section,table,td,th,tr,ul';
// Reading stops at the end of the closest of these around the clicked word.
// ChatGPT: each message is an <article>, so one answer is read. Canvas: the page body (.user_content),
// so the Previous/Next footer isn't read. Elsewhere: the main content area.
const SCOPE = '.user_content, article, [role=main], main';
// Never read: UI controls, screen-reader-only labels (ChatGPT "ChatGPT said:", Canvas "screenreader-only"),
// and KaTeX's duplicate copies of formulas (aria-hidden visual copy, LaTeX source annotation).
const SKIP = 'script, style, noscript, textarea, select, button, template, annotation, [aria-hidden="true"], .sr-only, .screenreader-only';
const PARA = ' '; // paragraph separator: the sentence splitter always breaks here

const readable = (n) => {
  const p = n.parentElement;
  return p && !p.closest(SKIP) && p.checkVisibility();
};

function caretAt(x, y) {
  if (document.caretPositionFromPoint) {
    const p = document.caretPositionFromPoint(x, y);
    return p && [p.offsetNode, p.offset];
  }
  const r = document.caretRangeFromPoint(x, y); // older Chromium
  return r && [r.startContainer, r.startOffset];
}

// segs[i] = { node, at, off }: node's text (from offset `off`) starts at text[at].
function collectText(node, off) {
  const walk = document.createTreeWalker(node.parentElement.closest(SCOPE) ?? document.body, NodeFilter.SHOW_TEXT);
  walk.currentNode = node;
  let text = '', block;
  const segs = [];
  for (let n = node; n; n = walk.nextNode(), off = 0) {
    if (!readable(n)) continue;
    const s = n.data.slice(off).replace(/[\r\n]/g, ' '); // source line breaks aren't sentence breaks
    if (!s.trim()) {
      if (text && !/\s$/.test(text)) text += ' ';
      continue;
    }
    const b = n.parentElement.closest(BLOCKS);
    if (block && b !== block) text += PARA;
    block = b;
    segs.push({ node: n, at: text.length, off });
    text += s;
  }
  return { text, segs };
}

const sentences = new Intl.Segmenter(undefined, { granularity: 'sentence' });

// -> [{ start, text }], one per sentence; `start` is the index into the full text.
function splitSentences(text) {
  const out = [];
  for (const { segment, index } of sentences.segment(text)) {
    const t = segment.trim();
    if (t) out.push({ start: index + segment.indexOf(t), text: t });
  }
  return out;
}

function pos(segs, i) {
  let lo = 0, hi = segs.length - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (segs[m].at <= i) lo = m;
    else hi = m - 1;
  }
  const s = segs[lo];
  return [s.node, Math.min(s.node.length, s.off + i - s.at)];
}

function rangeAt(segs, a, b) {
  const r = new Range();
  r.setStart(...pos(segs, a));
  r.setEnd(...pos(segs, b));
  return r;
}
