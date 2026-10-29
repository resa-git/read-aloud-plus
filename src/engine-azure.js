// Azure Speech over its streaming WebSocket. Used in BOTH Chrome and Edge.
// Audio arrives in small pieces while it is generated, with word timings alongside.
// This is the same protocol the official Speech SDK uses, without its ~1 MB of code.
// Playback and highlighting timing live in player.js.

const AzureEngine = streamEngine((() => {
  let ws, h, sid = 0; // h = handlers of the sentence being synthesized

  const uid = () => crypto.randomUUID().replaceAll('-', '');
  const esc = (s) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const XML = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  const unesc = (s) => s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => XML[e]); // Azure returns words escaped
  const send = (sock, path, type, body, req) =>
    sock.send(`X-RequestId:${req}\r\nPath:${path}\r\nX-Timestamp:${new Date().toISOString()}\r\nContent-Type:${type}\r\n\r\n${body}`);

  async function connect() {
    const { key, region } = await chrome.storage.local.get(['key', 'region']);
    if (!key || !region) throw new Error('Set your Azure key and region in .env or the extension popup.');
    // Browsers can't set WebSocket headers, so the key goes in the query string (as the SDK does).
    const sock = new WebSocket(`wss://${region}.tts.speech.microsoft.com/cognitiveservices/websocket/v1` +
      `?Ocp-Apim-Subscription-Key=${encodeURIComponent(key)}&X-ConnectionId=${uid()}`);
    sock.binaryType = 'arraybuffer';
    await new Promise((ok, fail) => {
      sock.onopen = ok;
      sock.onerror = () => fail(new Error('Could not connect to Azure Speech.'));
    });
    sock.onmessage = onMessage;
    sock.onclose = () => { // dropped mid-sentence: move on to the next one
      if (ws !== sock) return;
      ws = null;
      finish();
    };
    send(sock, 'speech.config', 'application/json', JSON.stringify({
      context: { system: { name: 'SpeechSDK', version: '1.0', build: 'JavaScript', lang: 'JavaScript' },
                 os: { platform: 'Browser', name: 'Browser', version: navigator.userAgent } },
    }), uid());
    return sock;
  }

  function finish() {
    const d = h;
    h = null;
    d?.done();
  }

  function onMessage({ data }) {
    if (!h) return;
    if (typeof data === 'string') {
      const split = data.indexOf('\r\n\r\n');
      const path = /Path:\s*([\w.]+)/i.exec(data.slice(0, split))?.[1];
      if (path === 'audio.metadata') {
        for (const m of JSON.parse(data.slice(split + 4)).Metadata)
          if (m.Type === 'WordBoundary') h.word(unesc(m.Data.text.Text), m.Data.Offset / 1e7); // Offset: 100 ns ticks
      } else if (path === 'turn.end') finish();
      return;
    }
    // Binary frame: 2-byte header length, text header, then raw 16-bit PCM.
    const n = new DataView(data).getUint16(0);
    const len = (data.byteLength - n - 2) & ~1;
    if (len > 0 && /Path:\s*audio/i.test(new TextDecoder().decode(new Uint8Array(data, 2, n))))
      h.audio(new Int16Array(data.slice(n + 2, n + 2 + len)));
  }

  return {
    async speak(text, { voice, rate }, handlers) {
      h = handlers;
      const s = sid;
      if (!ws) {
        try {
          const sock = await connect();
          if (s !== sid) return sock.close();
          ws = sock;
        } catch (e) {
          return s === sid && handlers.fail(e.message);
        }
      }
      const req = uid(), lang = voice.split('-').slice(0, 2).join('-');
      const pct = Math.round((rate - 1) * 100);
      send(ws, 'synthesis.context', 'application/json', JSON.stringify({
        synthesis: { audio: {
          metadataOptions: { wordBoundaryEnabled: true, sentenceBoundaryEnabled: false, punctuationBoundaryEnabled: false, bookmarkEnabled: false, visemeEnabled: false },
          outputFormat: 'raw-24khz-16bit-mono-pcm',
        } },
      }), req);
      send(ws, 'ssml', 'application/ssml+xml',
        `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}">` +
        `<voice name="${voice}"><prosody rate="${pct >= 0 ? '+' : ''}${pct}%">${esc(text)}</prosody></voice></speak>`, req);
    },
    close() {
      sid++;
      h = null;
      if (!ws) return;
      ws.onmessage = ws.onclose = null;
      ws.close();
      ws = null;
    },
  };
})());
