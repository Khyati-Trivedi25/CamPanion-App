import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'

// Camera component that exposes capture() to return ImageData and a bitmap
const CameraView = forwardRef(function CameraView(props, ref) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let stream
    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setReady(true)
        }
      } catch (e) {
        console.error('Camera error', e)
        setReady(false)
      }
    }
    start()
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop())
    }
  }, [])

  useImperativeHandle(ref, () => ({
    capture: () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) return null
      const w = video.videoWidth
      const h = video.videoHeight
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, w, h)
      const imageData = ctx.getImageData(0, 0, w, h)
      const dataURL = canvas.toDataURL('image/jpeg', 0.9)
      return { imageData, canvas, dataURL, width: w, height: h }
    }
  }))

  return (
    <div className="w-full h-full relative">
      <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
      <canvas ref={canvasRef} className="hidden" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/50">Enabling camera…</div>
      )}
    </div>
  )
})

export default CameraView
