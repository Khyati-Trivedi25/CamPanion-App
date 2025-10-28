import { useEffect, useRef, useState } from "react";
import CameraView from "./components/CameraView.jsx";
import { ASRService } from "./services/asr.js";
import { tts } from "./services/tts.js";
import { ocr } from "./services/ocr.js";
import {
  averageCentralColor,
  nearestNamedColor,
  estimateBrightness,
} from "./services/color.js";
import { parseIntent } from "./app/intentGrammar.js";
import "./index.css"; // Tailwind global

function App() {
  const camRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState(
    "Double tap anywhere to speak. Say “open camera” to begin."
  );
  const [lastResult, setLastResult] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [captured, setCaptured] = useState(null);
  const capturedRef = useRef(null);
  const [showCaptured, setShowCaptured] = useState(false);
  const [awaitingAction, setAwaitingAction] = useState(false);
  const awaitingActionRef = useRef(false);
  const asrRef = useRef(null);
  const [showOverview, setShowOverview] = useState(true);

  useEffect(() => {
    (async () => {
      await tts.speak(
        "Campanion welcomes you. Good morning! How are you? I am here to help you."
      );
      await tts.speak(
        "Here is what you can say. Open camera. Capture. Read text. Identify color. Identify currency. Retake. Close camera. Help. Or Repeat."
      );
      setTimeout(() => setShowOverview(false), 8000);
    })();

    asrRef.current = new ASRService({ lang: "en-US" });
    const asr = asrRef.current;

    asr.onResult = async (text, isFinal) => {
      setStatus(text || "Listening…");
      if (!isFinal) return;
      const { intent } = parseIntent(text);

      if (awaitingActionRef.current) {
        await handlePostCaptureIntent(intent);
        setListening(false);
        return;
      }

      let handled = false;
      if (intent === "none") handled = true;
      else if (intent === "help") {
        await tts.speak(
          "You can say open camera or close camera. Say capture to take a photo. Say repeat to hear the last result. Say describe to hear only the color. Double tap anywhere to talk."
        );
        handled = true;
      } else if (intent === "open_camera") {
        setCameraOn(true);
        setStatus("Camera opened.");
        await tts.speak("Opening camera");
        handled = true;
      } else if (intent === "close_camera") {
        setCameraOn(false);
        setStatus("Camera closed.");
        await tts.speak("Closing camera");
        handled = true;
      } else if (intent === "repeat") {
        if (lastResult) await tts.speak(lastResult);
        else await tts.speak("No result yet. Say capture to take a photo.");
        handled = true;
      } else if (
        intent === "read_text" ||
        intent === "identify_color" ||
        intent === "identify_currency"
      ) {
        if (capturedRef.current) await handlePostCaptureIntent(intent);
        else await tts.speak("Please say capture first to take a photo.");
        handled = true;
      } else if (
        intent === "capture" ||
        intent === "describe" ||
        intent === "unknown"
      ) {
        if (!cameraOn) {
          setCameraOn(true);
          await tts.speak("Opening camera, then capturing");
          await new Promise((r) => setTimeout(r, 900));
        }
        await handleCapture();
        handled = true;
      }

      if (!handled)
        await tts.speak("Say open camera, capture, or help for more.");
      setListening(false);
    };

    asr.onError = async () => {
      setStatus("Listening error. Double tap to try again.");
      setListening(false);
      await tts.speak("I did not catch that. Double tap to try again.", {
        interrupt: false,
      });
    };
  }, []);

  async function handleCapture() {
    try {
      setStatus("Capturing…");
      await tts.speak("Capturing");
      const cap = camRef.current?.capture();
      if (!cap) {
        setStatus("Camera not ready.");
        await tts.speak("Camera not ready. Please allow camera access.");
        return;
      }
      setCaptured(cap);
      capturedRef.current = cap;
      setShowCaptured(true);
      setAwaitingAction(true);
      awaitingActionRef.current = true;
      setStatus(
        "Captured. Say: read text, identify color, or identify currency."
      );
      await tts.speak(
        "Captured. What do you want me to do? Read text, identify color, or identify currency?"
      );
      const asr = asrRef.current;
      if (asr?.isSupported()) {
        asr.start();
        setListening(true);
        setStatus("Listening for your choice…");
      }
    } catch (e) {
      console.error(e);
      setStatus("Error during capture.");
      await tts.speak("There was an error during capture.");
    }
  }

  async function handlePostCaptureIntent(intent) {
    const currentCap = capturedRef.current;
    if (!currentCap) {
      await tts.speak("No image available. Say capture to take a photo.");
      setAwaitingAction(false);
      awaitingActionRef.current = false;
      return;
    }
    const { imageData, canvas } = currentCap;
    if (intent === "read_text") {
      setStatus("Reading text…");
      const text = await ocr.recognize(canvas, { language: "eng" });
      const summary = text
        ? `Detected text: ${text}`
        : "No readable text detected.";
      setLastResult(summary);
      setStatus(summary);
      await tts.speak(summary);
    } else if (intent === "identify_color" || intent === "describe") {
      const rgb = averageCentralColor(imageData);
      const colorName = nearestNamedColor(rgb);
      const bright = estimateBrightness(rgb);
      let summary = `I see ${colorName}.`;
      if (bright < 40) summary += " Lighting is low.";
      setLastResult(summary);
      setStatus(summary);
      await tts.speak(summary);
    } else if (intent === "identify_currency") {
      const msg = "Currency detection will be handled later.";
      setLastResult(msg);
      setStatus(msg);
      await tts.speak(msg);
    }
    setAwaitingAction(false);
    awaitingActionRef.current = false;
  }

  const lastTapRef = useRef(0);
  function onSurfaceTap() {
    const now = Date.now();
    if (now - lastTapRef.current < 350) toggleListen();
    lastTapRef.current = now;
  }

  async function toggleListen() {
    const asr = asrRef.current;
    if (!asr?.isSupported()) {
      setStatus("Speech not supported.");
      await tts.speak("Speech recognition is not supported in this browser.");
      return;
    }
    if (listening) {
      asr.stop();
      setListening(false);
      await tts.speak("Stopped listening", { interrupt: false });
    } else {
      await tts.speak("Listening", { interrupt: true });
      setStatus("Listening…");
      asr.start();
      setListening(true);
    }
  }

  return (
    <div
      className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white select-none relative"
      onClick={onSurfaceTap}
    >
      {/* Camera background */}
      {cameraOn && (
        <div className="fixed inset-0 -z-10">
          <CameraView ref={camRef} />
        </div>
      )}

      {/* Quick Commands popup */}
      {showOverview && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 w-[90%] md:w-[500px] bg-black/70 border border-white/10 backdrop-blur-md rounded-2xl p-6 z-10 shadow-xl text-center space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-blue-400">
            Quick Commands
          </h2>
          <ul className="grid grid-cols-2 gap-2 text-sm text-gray-200">
            <li>Open camera</li>
            <li>Close camera</li>
            <li>Capture</li>
            <li>Retake</li>
            <li>Read text</li>
            <li>Identify color</li>
            <li>Identify currency</li>
            <li>Help / Repeat</li>
          </ul>
          <p className="text-xs text-gray-400 mt-1">
            Double tap anywhere to talk.
          </p>
        </div>
      )}

      {/* Listening pulse */}
      {listening && (
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center z-10">
          <div className="relative">
            <span className="absolute h-44 w-44 rounded-full bg-red-500/40 animate-ping"></span>
            <div className="relative h-44 w-44 rounded-full bg-red-600/80 flex items-center justify-center shadow-2xl">
              <svg
                width="72"
                height="72"
                viewBox="0 0 24 24"
                fill="white"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
                <path d="M5 11a1 1 0 1 0-2 0 9 9 0 0 0 8 8.944V22a1 1 0 1 0 2 0v-2.056A9 9 0 0 0 21 11a1 1 0 1 0-2 0 7 7 0 1 1-14 0Z" />
              </svg>
            </div>
            <p className="text-center text-lg mt-4 font-medium text-gray-100 drop-shadow">
              Listening… Double tap to stop
            </p>
          </div>
        </div>
      )}

      {/* Main hero section */}
      <div className="relative z-10 px-6 py-24 flex flex-col items-center justify-center text-center space-y-6 min-h-[80vh]">
        {!cameraOn && (
          <>
            <h1 className="text-6xl font-extrabold text-blue-400 drop-shadow-lg">
              Campanion
            </h1>
            <p className="text-gray-300 text-lg">
              Hands-free • Voice-controlled • Accessible
            </p>
            <p className="text-gray-400 text-base max-w-md">
              Say “open camera” to start. Double-tap anywhere to speak.
            </p>
          </>
        )}

        <div className="flex items-center gap-2 text-gray-200 mt-4">
          <span
            className={`w-3 h-3 rounded-full ${
              listening ? "bg-green-400 animate-pulse" : "bg-gray-500"
            }`}
          ></span>
          <p className="text-base font-semibold">
            {listening ? "Listening…" : "Idle"}
          </p>
        </div>

        <p className="text-gray-300 text-base">{status}</p>
      </div>
    </div>
  );
}

export default App;
