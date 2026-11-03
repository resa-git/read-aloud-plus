// Kokoro running inside the browser (offscreen.js), no install. Used in BOTH Chrome and Edge.
// The offscreen page replies with { audio: base64 PCM, timestamps } (estimated word times),
// then { done } or { error }. Playback and highlighting timing live in player.js.

const KokoroEngine = streamEngine((() => {
  let port, sid = 0;

  const pcm = (b64) => {
    const s = atob(b64), b = new Uint8Array(s.length & ~1);
    for (let i = 0; i < b.length; i++) b[i] = s.charCodeAt(i);
    return new Int16Array(b.buffer);
  };

  return {
    async speak(text, { voice, rate }, h) {
      port?.disconnect();
      port = null;
      const s = ++sid;
      try {
        await chrome.runtime.sendMessage('offscreen'); // background.js opens the offscreen page if needed
        if (s !== sid) return;
        port = chrome.runtime.connect({ name: 'kokoro' });
      } catch (e) {
        return s === sid && h.fail(e.message); // e.g. "Extension context invalidated"
      }
      port.onMessage.addListener((m) => {
        if (m.error) return h.fail(m.error);
        if (m.note) h.note(m.note);
        if (m.audio) h.audio(pcm(m.audio));
        for (const w of m.timestamps ?? []) h.word(w.word, w.start_time); // seconds from sentence start
        if (m.done) h.done();
      });
      port.postMessage({ text, voice, speed: rate });
    },
    close() {
      sid++;
      port?.disconnect();
      port = null;
    },
  };
})());
