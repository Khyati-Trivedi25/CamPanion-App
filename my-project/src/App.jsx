import { useEffect, useRef, useState } from 'react'
import CameraView from './components/CameraView.jsx'
import { ASRService } from './services/asr.js'
import { tts } from './services/tts.js'
import { ocr } from './services/ocr.js'
import { averageCentralColor, nearestNamedColor, estimateBrightness } from './services/color.js'
import { parseIntent } from './app/intentGrammar.js'
import './App.css'

function App() {
  const camRef = useRef(null)
  const [listening, setListening] = useState(false)
  const [status, setStatus] = useState('Double tap anywhere to speak. Say “open camera” to begin.')
  const [lastResult, setLastResult] = useState('')
  const [cameraOn, setCameraOn] = useState(false)
  const [captured, setCaptured] = useState(null) // { imageData, canvas, dataURL, width, height }
  const capturedRef = useRef(null)
  const [showCaptured, setShowCaptured] = useState(false)
  const [awaitingAction, setAwaitingAction] = useState(false)
  const awaitingActionRef = useRef(false)
  const asrRef = useRef(null)
  const [showOverview, setShowOverview] = useState(true)

  useEffect(() => {
    // Startup greeting + overview
    ;(async () => {
      await tts.speak('Campanion welcomes you. Good morning! How are you? I am here to help you.')
      await tts.speak('Here is what you can say. Open camera. Capture. Read text. Identify color. Identify currency. Retake. Close camera. Help. Or Repeat.')
      // Auto-hide the overview after a few seconds
      setTimeout(() => setShowOverview(false), 8000)
    })()

    asrRef.current = new ASRService({ lang: 'en-US' })
    const asr = asrRef.current

    asr.onResult = async (text, isFinal) => {
      // Show transcription for feedback
      setStatus(text || 'Listening…')
      if (!isFinal) return

      const { intent } = parseIntent(text)

      // If we're waiting for a post-capture choice, handle that exclusively (using ref for latest value)
      if (awaitingActionRef.current) {
        await handlePostCaptureIntent(intent)
        setListening(false)
        return
      }

      let handled = false
      if (intent === 'none') {
        handled = true // ignore spurious finals silently
      } else if (intent === 'help') {
        await tts.speak('You can say open camera or close camera. Say capture to take a photo. Say repeat to hear the last result. Say describe to hear only the color. Double tap anywhere to talk.')
        handled = true
      } else if (intent === 'open_camera') {
        setCameraOn(true)
        setStatus('Camera opened.')
        await tts.speak('Opening camera')
        handled = true
      } else if (intent === 'close_camera') {
        setCameraOn(false)
        setStatus('Camera closed.')
        await tts.speak('Closing camera')
        handled = true
      } else if (intent === 'repeat') {
        if (lastResult) await tts.speak(lastResult)
        else await tts.speak('No result yet. Say capture to take a photo.')
        handled = true
      } else if (intent === 'read_text' || intent === 'identify_color' || intent === 'identify_currency') {
        // If we already have a captured frame, operate on it; otherwise prompt to capture first
        if (capturedRef.current) {
          await handlePostCaptureIntent(intent)
        } else {
          await tts.speak('Please say capture first to take a photo, then say your choice.')
        }
        handled = true
      } else if (intent === 'capture' || intent === 'describe' || intent === 'unknown') {
        if (!cameraOn) {
          setCameraOn(true)
          await tts.speak('Opening camera, then capturing')
          // give camera a moment to initialize
          await new Promise(r => setTimeout(r, 900))
        }
        await handleCapture()
        handled = true
      }

      if (!handled) {
        // Only give guidance if absolutely nothing matched
        await tts.speak('Say open camera, capture, or help for more.')
      }

      setListening(false)
    }

    asr.onError = async () => {
      setStatus('Listening error. Double tap to try again.')
      setListening(false)
      await tts.speak('I did not catch that. Double tap to try again.', { interrupt: false })
    }
  }, [])

  async function handleCapture() {
    try {
      setStatus('Capturing…')
      await tts.speak('Capturing')
      const cap = camRef.current?.capture()
      if (!cap) {
        setStatus('Camera not ready.')
        await tts.speak('Camera not ready. Please allow camera access.')
        return
      }
      setCaptured(cap)
      capturedRef.current = cap
      setShowCaptured(true)
      setAwaitingAction(true)
      awaitingActionRef.current = true
      setStatus('Captured. Say: read text, identify color, or identify currency.')
      await tts.speak('Captured. What do you want me to do? Read text, identify color, or identify currency?')
      // Auto-start listening for the user's choice
      const asr = asrRef.current
      if (asr?.isSupported()) {
        asr.start()
        setListening(true)
        setStatus('Listening for your choice…')
      }
    } catch (e) {
      console.error(e)
      setStatus('Error during capture.')
      await tts.speak('There was an error during capture.')
    }
  }

  async function handlePostCaptureIntent(intent) {
    const currentCap = capturedRef.current
    if (!currentCap) {
      await tts.speak('No image available. Say capture to take a photo.')
      setAwaitingAction(false)
      awaitingActionRef.current = false
      return
    }
    const { imageData, canvas } = currentCap
    if (intent === 'read_text') {
      setStatus('Reading text…')
      const text = await ocr.recognize(canvas, { language: 'eng' })
      const summary = text ? `Detected text: ${text}` : 'No readable text detected.'
      setLastResult(summary)
      setStatus(summary)
      await tts.speak(summary)
      setAwaitingAction(false)
      awaitingActionRef.current = false
    } else if (intent === 'identify_color' || intent === 'describe') {
      const rgb = averageCentralColor(imageData)
      const colorName = nearestNamedColor(rgb)
      const bright = estimateBrightness(rgb)
      let summary = `I see ${colorName}.`
      if (bright < 40) summary += ' Lighting is low.'
      setLastResult(summary)
      setStatus(summary)
      await tts.speak(summary)
      setAwaitingAction(false)
      awaitingActionRef.current = false
    } else if (intent === 'identify_currency') {
      const msg = 'Currency detection will be handled later.'
      setLastResult(msg)
      setStatus(msg)
      await tts.speak(msg)
      setAwaitingAction(false)
      awaitingActionRef.current = false
    } else if (intent === 'retake') {
      if (!cameraOn) setCameraOn(true)
      await tts.speak('Retaking')
      await new Promise(r => setTimeout(r, 700))
      await handleCapture()
    } else if (intent === 'capture') {
      await handleCapture()
    } else if (intent === 'help') {
      await tts.speak('Say read text, identify color, or identify currency. You can also say retake to take another photo.')
    } else {
      await tts.speak('Please say read text, identify color, or identify currency.')
    }
  }

  // Double-tap gesture
  const lastTapRef = useRef(0)
  function onSurfaceTap() {
    const now = Date.now()
    if (now - lastTapRef.current < 350) {
      // double tap
      toggleListen()
    }
    lastTapRef.current = now
  }

  async function toggleListen() {
    const asr = asrRef.current
    if (!asr?.isSupported()) {
      setStatus('Speech not supported. Use capture via voice is unavailable.')
      await tts.speak('Speech recognition is not supported in this browser.')
      return
    }
    if (listening) {
      asr.stop()
      setListening(false)
      await tts.speak('Stopped listening', { interrupt: false })
    } else {
      await tts.speak('Listening', { interrupt: true })
      setStatus('Listening…')
      asr.start()
      setListening(true)
    }
  }

  return (
    <div className="min-h-screen w-full bg-black text-white select-none" onClick={onSurfaceTap} role="application" aria-label="Accessible camera">
      {/* Background: show camera when enabled */}
      {cameraOn ? (
        <div className="fixed inset-0 -z-10">
          <CameraView ref={camRef} />
        </div>
      ) : (
        <div className="fixed inset-0 -z-10 bg-gradient-to-b from-slate-900 via-slate-800 to-black" />
      )}
      {/* Quick commands overlay on startup */}
      {showOverview && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-10 p-4">
          <div className="mx-auto max-w-2xl rounded-2xl bg-black/60 border border-white/10 p-4 backdrop-blur">
            <div className="text-sm uppercase tracking-wider opacity-70">Quick commands</div>
            <ul className="mt-2 grid grid-cols-2 gap-2 text-sm opacity-90">
              <li>Open camera</li>
              <li>Close camera</li>
              <li>Capture</li>
              <li>Retake</li>
              <li>Read text</li>
              <li>Identify color</li>
              <li>Identify currency</li>
              <li>Help / Repeat</li>
            </ul>
            <div className="mt-2 text-xs opacity-70">Double tap anywhere to talk.</div>
          </div>
        </div>
      )}
      {/* Awaiting choice overlay */}
      {awaitingAction && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 p-4">
          <div className="mx-auto max-w-xl rounded-2xl bg-black/60 border border-white/10 p-4 text-center backdrop-blur">
            <div className="text-sm uppercase tracking-wider opacity-70">Captured • awaiting choice</div>
            <div className="mt-2 text-base">Say: <span className="font-semibold">read text</span>, <span className="font-semibold">identify color</span>, or <span className="font-semibold">identify currency</span>.</div>
            <div className="mt-2 text-xs opacity-70">You can also say <span className="font-semibold">retake</span> to capture again.</div>
          </div>
        </div>
      )}
      {/* Show captured still overlay for visual confirmation */}
      {showCaptured && captured?.dataURL && (
        <div className="fixed inset-0 z-0 flex items-center justify-center pointer-events-none">
          <img src={captured.dataURL} alt="Captured" className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-2xl object-contain" />
          <div className="absolute top-4 right-4 bg-white/20 text-white text-sm px-3 py-1 rounded-full backdrop-blur">Captured</div>
        </div>
      )}
      {/* Center mic overlay when listening */}
      {listening && (
        <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center">
          <div className="relative">
            <span className="absolute inline-flex h-44 w-44 rounded-full bg-red-500/30 animate-ping"></span>
            <div className="relative h-44 w-44 rounded-full bg-red-600/80 flex items-center justify-center shadow-2xl">
              {/* Mic icon */}
              <svg width="72" height="72" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" fill="white"/>
                <path d="M5 11a1 1 0 1 0-2 0 9 9 0 0 0 8 8.944V22a1 1 0 1 0 2 0v-2.056A9 9 0 0 0 21 11a1 1 0 1 0-2 0 7 7 0 1 1-14 0Z" fill="white"/>
              </svg>
            </div>
            <div className="mt-4 text-center w-full text-xl font-semibold text-white drop-shadow">Listening… Double tap to stop.</div>
          </div>
        </div>
      )}
      <div className="relative z-10 p-6 flex flex-col gap-4">
        {/* Welcome hero when camera is off */}
        {!cameraOn && (
          <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-4">
            <h1 className="text-4xl font-extrabold tracking-tight">Campanion</h1>
            <p className="text-lg opacity-90">Campanion welcomes you. We are here.</p>
            <p className="text-base opacity-80">Good morning! How are you? I am here to help you.</p>
            <p className="text-base opacity-80">You can say “open camera” or “close camera”. Double tap anywhere to talk.</p>
            <div className="mt-4 text-xs uppercase tracking-widest opacity-60">Hands-free • Voice controlled • Accessible</div>
          </div>
        )}

        {/* Status and tips */}
        <div className="inline-flex items-center gap-2">
          <span className={`inline-block w-3 h-3 rounded-full ${listening ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} aria-hidden="true" />
          <span className="sr-only">{listening ? 'Listening' : 'Idle'}</span>
          <p className="text-lg font-semibold">{listening ? 'Listening… Double tap to stop.' : 'Double tap anywhere to talk.'}</p>
        </div>
        <p className="text-base opacity-90">{status}</p>
        <ul className="text-sm opacity-80 list-disc pl-5">
          <li>Say “open camera” to enable the camera.</li>
          <li>Say “capture” to take a photo.</li>
          <li>Say “close camera” to hide the camera.</li>
          <li>Say “help” for guidance.</li>
        </ul>
      </div>
    </div>
  )
}

export default App
