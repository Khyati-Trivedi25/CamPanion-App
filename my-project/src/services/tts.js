// Text-to-Speech service using the Web Speech API
// Provides a simple queue and barge-in capability

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

const defaultOptions = {
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  lang: 'en-US',
};

class TTSService {
  constructor() {
    this.queue = [];
    this.speaking = false;
    this.options = { ...defaultOptions };
  }

  setOptions(opts) {
    this.options = { ...this.options, ...opts };
  }

  cancel() {
    if (synth) synth.cancel();
    this.queue = [];
    this.speaking = false;
  }

  speak(text, { interrupt = true } = {}) {
    if (!synth) return Promise.resolve();
    if (!text) return Promise.resolve();

    if (interrupt) {
      this.cancel();
    }

    return new Promise((resolve) => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = this.options.rate;
      utter.pitch = this.options.pitch;
      utter.volume = this.options.volume;
      utter.lang = this.options.lang;
      utter.onend = () => {
        this.speaking = false;
        resolve();
      };
      this.speaking = true;
      synth.speak(utter);
    });
  }
}

export const tts = new TTSService();
