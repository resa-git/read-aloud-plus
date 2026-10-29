// Shared streaming playback for engines that deliver raw 24 kHz PCM plus word timings
// (Azure and local Kokoro). Used in BOTH Chrome and Edge.
// Plays audio back-to-back on the Web Audio clock and fires onWord exactly when a word is heard.
//
// A "source" only turns one sentence into audio + words:
//   source.speak(text, { voice, rate }, { audio(Int16Array), word(text, seconds), done(), fail(msg) })
//   source.close()   // cancel whatever is in flight
//
// Engine interface (EdgeEngine has the same one):
//   start(chunks, { voice, rate }, { onChunk(i), onWord(i, start, len), onEnd(), onError(msg) })
//   pause(), resume(), stop()

function streamEngine(source) {
  const RATE = 24000; // both Azure and Kokoro send 24 kHz 16-bit mono
  const AHEAD = 15;   // seconds of audio to synthesize ahead of playback
  let ctx, timer, cb, cfg, chunks, next, queue, busy, playhead, sid = 0;
  let stopped = true;

  // Synthesize the next sentence, if we aren't too far ahead of playback.
  function pump() {
    if (stopped || busy || next >= chunks.length || playhead - ctx.currentTime > AHEAD) return;
    busy = true;
    const s = sid, turn = { i: next++, base: null, from: 0 };
    queue.push({ turn, t: 0 }); // "sentence starts" marker
    const handlers = {
      audio: (pcm) => s === sid && pcm.length && play(turn, pcm),
      word: (w, sec) => s === sid && word(turn, w, sec),
      done: () => {
        if (s !== sid) return;
        turn.base ??= playhead; // sentence produced no audio: don't block the queue
        busy = false;
        pump();
      },
      fail: (msg) => s === sid && fail(msg),
    };
    try {
      source.speak(chunks[turn.i].text, cfg, handlers);
    } catch (e) {
      fail(e.message); // e.g. "Extension context invalidated" from chrome.runtime.connect
    }
  }

  // Find the spoken word in our sentence to know what to highlight.
  function word(turn, w, sec) {
    if (!/[\p{L}\p{N}]/u.test(w)) return; // skip punctuation tokens
    const at = chunks[turn.i].text.indexOf(w, turn.from);
    if (at < 0) return;
    turn.from = at + w.length;
    queue.push({ turn, t: sec, start: at, len: w.length });
  }

  // Schedule PCM back-to-back; word times are relative to where the sentence starts.
  function play(turn, pcm) {
    const buf = ctx.createBuffer(1, pcm.length, RATE);
    buf.copyToChannel(Float32Array.from(pcm, (x) => x / 32768), 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    const now = ctx.currentTime;
    if (playhead < now) { // network/GPU fell behind: shift this sentence's remaining words by the gap
      if (turn.base !== null) turn.base += now - playhead;
      playhead = now;
    }
    turn.base ??= playhead;
    src.start(playhead);
    playhead += buf.duration;
  }

  function tick() {
    const now = ctx.currentTime;
    while (queue.length && queue[0].turn.base !== null && queue[0].turn.base + queue[0].t <= now) {
      const q = queue.shift();
      if (q.len === undefined) cb.onChunk(q.turn.i);
      else cb.onWord(q.turn.i, q.start, q.len);
    }
    if (!busy && next >= chunks.length && !queue.length && now >= playhead) {
      const done = cb.onEnd;
      api.stop();
      return done();
    }
    pump();
  }

  function fail(msg) {
    const onError = cb.onError;
    api.stop();
    onError(msg);
  }

  const api = {
    start(c, options, callbacks) {
      api.stop();
      chunks = c; cfg = options; cb = callbacks;
      next = 0; queue = []; busy = false; stopped = false;
      ctx = new AudioContext({ sampleRate: RATE }); // allowed: we're inside (or right after) a user click
      ctx.resume();
      playhead = ctx.currentTime + 0.05;
      timer = setInterval(tick, 30); // not rAF: keeps feeding audio when the tab is in the background
    },
    pause: () => ctx?.suspend(), // freezes the audio clock, so highlighting pauses with it
    resume: () => ctx?.resume(),
    stop() {
      stopped = true;
      sid++;
      clearInterval(timer);
      source.close();
      ctx?.close();
      ctx = null;
    },
  };
  return api;
}
