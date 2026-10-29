// Edge's built-in "Online (Natural)" voices through the Web Speech API. EDGE ONLY.
// Free, needs no Azure key. Registered only when IS_EDGE (see platform.js).
// Same interface as AzureEngine.

const EdgeEngine = (() => {
  let sid = 0;

  const voices = () => new Promise((ok) => {
    const v = speechSynthesis.getVoices();
    if (v.length) ok(v);
    else speechSynthesis.addEventListener('voiceschanged', () => ok(speechSynthesis.getVoices()), { once: true });
  });

  return {
    async start(chunks, { voice, rate }, cb) {
      this.stop();
      const s = ++sid;
      const v = (await voices()).find((x) => x.name === voice);
      if (s !== sid) return;
      if (!v) return cb.onError(`Voice "${voice}" not found.`);
      chunks.forEach((c, i) => {
        const u = new SpeechSynthesisUtterance(c.text);
        u.voice = v;
        u.rate = rate;
        u.onstart = () => s === sid && cb.onChunk(i);
        u.onboundary = (e) => s === sid && e.name === 'word' &&
          cb.onWord(i, e.charIndex, e.charLength || /^\S*/.exec(c.text.slice(e.charIndex))[0].length);
        if (i === chunks.length - 1) u.onend = () => s === sid && cb.onEnd();
        speechSynthesis.speak(u); // queued; Edge plays them in order
      });
    },
    pause: () => speechSynthesis.pause(),
    resume: () => speechSynthesis.resume(),
    stop() {
      sid++;
      speechSynthesis.cancel();
    },
  };
})();
