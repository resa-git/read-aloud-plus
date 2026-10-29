// Kokoro running on this PC (Kokoro-FastAPI on http://localhost:8880). Used in BOTH Chrome and Edge.
// Requests go through background.js, because pages like ChatGPT may not call localhost themselves.
// Playback and highlighting timing live in player.js.

const LocalEngine = streamEngine((() => {
  let port;

  const pcm = (b64) => {
    const s = atob(b64), b = new Uint8Array(s.length & ~1);
    for (let i = 0; i < b.length; i++) b[i] = s.charCodeAt(i);
    return new Int16Array(b.buffer);
  };

  return {
    speak(text, { voice, rate }, h) {
      port?.disconnect();
      port = chrome.runtime.connect({ name: 'kokoro' });
      port.onMessage.addListener((m) => {
        if (m.error) return h.fail(m.error);
        if (m.audio) h.audio(pcm(m.audio));
        for (const w of m.timestamps ?? []) h.word(w.word, w.start_time); // seconds from sentence start
        if (m.done) h.done();
      });
      port.postMessage({ text, voice, speed: rate });
    },
    close() {
      port?.disconnect();
      port = null;
    },
  };
})());
