// ASR service using Web Speech API (SpeechRecognition)
// Emits final transcript and simple intent parsing.

const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export class ASRService {
  constructor({ lang = 'en-US' } = {}) {
    this.lang = lang;
    this.rec = null;
    this.listening = false;
    this.onResult = null; // (text, isFinal)
    this.onError = null;
  }

  isSupported() {
    return Boolean(SpeechRecognition);
  }

  start() {
    if (!this.isSupported() || this.listening) return;
    this.rec = new SpeechRecognition();
    this.rec.lang = this.lang;
    this.rec.interimResults = true;
    this.rec.continuous = false;

    this.rec.onresult = (e) => {
      let transcript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      const isFinal = e.results[e.results.length - 1].isFinal;
      if (this.onResult) this.onResult(transcript.trim(), isFinal);
    };

    this.rec.onerror = (e) => {
      if (this.onError) this.onError(e);
      this.stop();
    };

    this.rec.onend = () => {
      this.listening = false;
    };

    this.rec.start();
    this.listening = true;
  }

  stop() {
    if (this.rec) {
      try { this.rec.stop(); } catch {}
    }
    this.listening = false;
  }
}
