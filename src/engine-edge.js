// Edge's built-in "Online (Natural)" voices through the Web Speech API. EDGE ONLY.
// Free, no setup. The popup offers these voices only when the browser has them.
// Same interface as KokoroEngine (see player.js).
//
// Sentences are spoken one at a time, each started from the previous one's onend.
// Queuing them all at once broke when reading restarted mid-way (click elsewhere while reading):
// Chromium can drop queued utterances and their events right after cancel(), so the new text
// played without highlighting and stopped after one sentence.

const EdgeEngine = (() => {
  let sid = 0, utt; // keep the current utterance referenced: Chromium skips events of garbage-collected ones

  const voices = () => new Promise((ok) => {
    const v = speechSynthesis.getVoices();
    if (v.length) ok(v);
    else speechSynthesis.addEventListener('voiceschanged', () => ok(speechSynthesis.getVoices()), { once: true });
  });

  return {
    async start(chunks, { voice, rate }, cb) {
      this.stop();
      const s = sid;
      const all = await voices(); // exact name, else the same person under another name (e.g. Jenny)
      const v = all.find((x) => x.name === voice) ?? all.find((x) => x.lang === 'en-US' && x.name.includes(voice.split(' ')[1]));
      if (s !== sid) return;
      if (!v) return cb.onError(`Voice "${voice}" not found.`);
      await new Promise((ok) => setTimeout(ok, 50)); // let cancel() finish before speaking again
      if (s !== sid) return;
      const say = (i) => {
        if (i >= chunks.length) return cb.onEnd();
        const c = chunks[i], u = (utt = new SpeechSynthesisUtterance(c.text));
        u.voice = v;
        u.rate = rate;
        u.onstart = () => s === sid && cb.onChunk(i);
        u.onboundary = (e) => s === sid && e.name === 'word' &&
          cb.onWord(i, e.charIndex, e.charLength || /^\S*/.exec(c.text.slice(e.charIndex))[0].length);
        u.onend = () => s === sid && say(i + 1);
        u.onerror = (e) => s === sid && cb.onError(`Edge voice error: ${e.error}`);
        speechSynthesis.speak(u);
      };
      say(0);
    },
    pause: () => speechSynthesis.pause(),
    resume: () => speechSynthesis.resume(),
    stop() {
      sid++;
      utt = null;
      speechSynthesis.cancel();
    },
  };
})();
