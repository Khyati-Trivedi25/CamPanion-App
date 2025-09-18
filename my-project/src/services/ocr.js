// OCR service using tesseract.js with a singleton worker
import { createWorker } from 'tesseract.js';

class OCRService {
  constructor() {
    this.workerPromise = null;
    this.lang = 'eng';
  }

  async init(language = 'eng') {
    if (!this.workerPromise) {
      this.workerPromise = (async () => {
        const worker = await createWorker({ logger: () => {} });
        await worker.loadLanguage(language);
        await worker.initialize(language);
        return worker;
      })();
      this.lang = language;
    }
    return this.workerPromise;
  }

  async recognize(imageBitmapOrElement, { language = 'eng' } = {}) {
    const worker = await this.init(language);
    const { data } = await worker.recognize(imageBitmapOrElement);
    return data.text?.trim() || '';
  }
}

export const ocr = new OCRService();
