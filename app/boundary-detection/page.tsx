'use client'
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL
import { useState, useRef, useCallback, useEffect } from 'react'
import { DashboardLayout } from '@/components/dashboard/layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Upload, Map, Loader2, Maximize, Camera, Video, CheckCircle,
  Ruler, Layers, Wifi, WifiOff, RefreshCw, Link as LinkIcon,
  Play, Square, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface PlotData {
  plot_id: number
  center_x: number
  center_y: number
  area_sq_meters: number
  area_hectares: number
  pixel_count: number
}

interface DetectionResponse {
  plots: PlotData[]
  annotated_image_base64: string
  processing_time_ms: number
  total_area_sq_meters: number
  total_area_hectares: number
  gsd_m_per_px: number
  area_accuracy: 'gps_exif' | 'user_altitude' | 'estimated'
  method: string
  error?: string
}

// Common drone camera presets [label, altitude_m, hfov_deg]
const DRONE_PRESETS: [string, number, number][] = [
  ['DJI Phantom 4 @ 50m', 50, 84],
  ['DJI Phantom 4 @ 100m', 100, 84],
  ['DJI Mini 3 @ 50m', 50, 82],
  ['DJI Mini 3 @ 100m', 100, 82],
  ['DJI Mavic 3 @ 100m', 100, 84],
  ['DJI Mavic 3 @ 150m', 150, 84],
  ['Generic Drone @ 80m', 80, 75],
  ['Custom…', 0, 0],
]

const ACCURACY_INFO: Record<string, { label: string; color: string; hint: string }> = {
  gps_exif: { label: 'GPS EXIF', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30', hint: 'Altitude read from image EXIF — high accuracy' },
  user_altitude: { label: 'User Input', color: 'text-primary bg-primary/10 border-primary/30', hint: 'Altitude provided by user — high accuracy' },
  estimated: { label: 'Estimated', color: 'text-amber-400 bg-amber-400/10 border-amber-400/30', hint: 'Using default 100 m altitude — set drone altitude for better accuracy' },
}

type InputMode = 'upload' | 'webcam' | 'ipcam'

// IP-cam example URLs shown as placeholder hints
const IPCAM_EXAMPLES = [
  'http://192.168.1.100/video',
  'http://192.168.1.100:8080/mjpeg',
  'rtsp://admin:pass@192.168.1.100/stream',
]

export default function BoundaryDetectionPage() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [result, setResult] = useState<DetectionResponse | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inputMode, setInputMode] = useState<InputMode>('upload')

  // Altitude / FOV settings
  const [presetIdx, setPresetIdx] = useState(1)
  const [customAlt, setCustomAlt] = useState<string>('100')
  const [customFov, setCustomFov] = useState<string>('84')

  // Webcam state
  const [webcamActive, setWebcamActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // IP-cam state
  const [ipcamUrl, setIpcamUrl] = useState<string>('')
  const [ipcamConnected, setIpcamConnected] = useState(false)
  const [ipcamStreaming, setIpcamStreaming] = useState(false)   // continuous auto-capture
  const [ipcamInterval, setIpcamInterval] = useState<number>(5)  // seconds between captures
  const ipcamAutoRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const ipcamVideoRef = useRef<HTMLVideoElement>(null)
  const ipcamImgRef = useRef<HTMLImageElement>(null)
  const ipcamCanvasRef = useRef<HTMLCanvasElement>(null)

  const isCustom = presetIdx === DRONE_PRESETS.length - 1

  const getAltFov = () => {
    if (isCustom) {
      return { alt: parseFloat(customAlt) || null, fov: parseFloat(customFov) || null }
    }
    const [, alt, fov] = DRONE_PRESETS[presetIdx]
    return { alt, fov }
  }

  // ─── Webcam ───────────────────────────────────────────────────────────────
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setWebcamActive(true)
      setSelectedImage(null)
      setResult(null)
      setError(null)
    } catch {
      setError('Could not access webcam. Please check permissions.')
    }
  }

  const stopWebcam = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((t) => t.stop())
      videoRef.current.srcObject = null
    }
    setWebcamActive(false)
  }, [])

  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null
    const { videoWidth, videoHeight } = videoRef.current
    if (videoWidth === 0) return null
    canvasRef.current.width = videoWidth
    canvasRef.current.height = videoHeight
    const ctx = canvasRef.current.getContext('2d')!
    ctx.drawImage(videoRef.current, 0, 0)
    return canvasRef.current.toDataURL('image/jpeg', 0.8)
  }

  useEffect(() => { return () => { stopWebcam() } }, [stopWebcam])

  // ─── Upload ───────────────────────────────────────────────────────────────
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string)
      setResult(null)
      setError(null)
    }
    reader.readAsDataURL(file)
  }

  // ─── Core detection ───────────────────────────────────────────────────────
  const runDetection = async (imageOverride?: string) => {
    const img = imageOverride || selectedImage
    if (!img) return
    setIsProcessing(true)
    setError(null)

    const { alt, fov } = getAltFov()
    const base64Data = img.split(',')[1]

    try {
      const res = await fetch(`${BACKEND}/detect-fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: base64Data,
          altitude_m: alt,
          camera_hfov_deg: fov,
        }),
      })
      if (!res.ok) throw new Error(`Detection failed with status: ${res.status}`)
      const data: DetectionResponse = await res.json()
      if (data.error === 'NO_FIELD') {
        setError('Target image does not appear to contain an agricultural field. Please ensure the feed displays a clear aerial view of farm plots or soil.')
        return
      }
      if (data.error) { setError(data.error); return }
      setResult(data)
    } catch (err: any) {
      setError(err.message || 'Failed to detect farm plots. Ensure Python backend is running on port 8002.')
    } finally {
      setIsProcessing(false)
    }
  }

  // ─── IP Camera helpers ────────────────────────────────────────────────────
  /**
   * Capture a frame from the IP cam via the Python backend's /ipcam-snapshot
   * endpoint which handles RTSP / MJPEG / HLS internally with OpenCV.
   * Falls back to drawing the <img> element if the browser can display it.
   */
  const captureIpcamFrame = useCallback(async (): Promise<string | null> => {
    if (!ipcamUrl) return null

    // Attempt 1: ask the backend to grab a frame (works for RTSP, MJPEG, etc.)
    try {
      const res = await fetch(`${BACKEND}/ipcam-snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: ipcamUrl }),
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const json = await res.json()
        if (json.frame_base64) {
          return `data:image/jpeg;base64,${json.frame_base64}`
        }
      }
    } catch {/* fall through */ }

    // Attempt 2: draw the <img> or <video> element on a canvas (MJPEG in browser)
    const canvas = ipcamCanvasRef.current
    if (!canvas) return null

    if (ipcamImgRef.current && ipcamImgRef.current.naturalWidth > 0) {
      canvas.width = ipcamImgRef.current.naturalWidth
      canvas.height = ipcamImgRef.current.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(ipcamImgRef.current, 0, 0)
      return canvas.toDataURL('image/jpeg', 0.85)
    }

    if (ipcamVideoRef.current && ipcamVideoRef.current.readyState >= 2) {
      canvas.width = ipcamVideoRef.current.videoWidth
      canvas.height = ipcamVideoRef.current.videoHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(ipcamVideoRef.current, 0, 0)
      return canvas.toDataURL('image/jpeg', 0.85)
    }

    return null
  }, [ipcamUrl])

  const connectIpcam = () => {
    if (!ipcamUrl.trim()) {
      setError('Please enter a valid IP camera URL.')
      return
    }
    setError(null)
    setIpcamConnected(true)
    setResult(null)
    setSelectedImage(null)
  }

  const disconnectIpcam = useCallback(() => {
    setIpcamConnected(false)
    setIpcamStreaming(false)
    if (ipcamAutoRef.current) {
      clearInterval(ipcamAutoRef.current)
      ipcamAutoRef.current = null
    }
  }, [])

  const captureAndAnalyze = useCallback(async () => {
    const frame = await captureIpcamFrame()
    if (!frame) {
      setError('Could not capture frame from IP camera. Check the URL and try again.')
      return
    }
    setSelectedImage(frame)
    await runDetection(frame)
  }, [captureIpcamFrame]) // eslint-disable-line

  // Continuous streaming mode — auto-capture every N seconds
  const toggleStreaming = useCallback(() => {
    if (ipcamStreaming) {
      setIpcamStreaming(false)
      if (ipcamAutoRef.current) {
        clearInterval(ipcamAutoRef.current)
        ipcamAutoRef.current = null
      }
    } else {
      setIpcamStreaming(true)
      captureAndAnalyze() // fire immediately
      ipcamAutoRef.current = setInterval(() => {
        captureAndAnalyze()
      }, ipcamInterval * 1000)
    }
  }, [ipcamStreaming, ipcamInterval, captureAndAnalyze])

  // Restart interval when ipcamInterval changes while streaming
  useEffect(() => {
    if (!ipcamStreaming) return
    if (ipcamAutoRef.current) clearInterval(ipcamAutoRef.current)
    ipcamAutoRef.current = setInterval(() => { captureAndAnalyze() }, ipcamInterval * 1000)
    return () => { if (ipcamAutoRef.current) clearInterval(ipcamAutoRef.current) }
  }, [ipcamInterval, ipcamStreaming, captureAndAnalyze])

  // Cleanup on unmount
  useEffect(() => () => {
    disconnectIpcam()
  }, [disconnectIpcam])

  // Switch between modes
  const switchMode = (mode: InputMode) => {
    stopWebcam()
    disconnectIpcam()
    setSelectedImage(null)
    setResult(null)
    setError(null)
    setInputMode(mode)
    if (mode === 'upload') fileInputRef.current?.click()
    if (mode === 'webcam') startWebcam()
  }

  // ─── Derived ──────────────────────────────────────────────────────────────
  const accInfo = result ? ACCURACY_INFO[result.area_accuracy] ?? ACCURACY_INFO.estimated : null

  // Is the IP cam URL an MJPEG stream the browser can show natively?
  const isMjpeg = ipcamUrl.toLowerCase().includes('mjpeg') ||
    ipcamUrl.toLowerCase().includes('/video') ||
    ipcamUrl.toLowerCase().endsWith('.mjpg')

  return (
    <DashboardLayout title="Boundary Detection">
      <div className="grid gap-6 md:grid-cols-12">
        {/* ─── Left panel ─────────────────────────────────────────────────── */}
        <div className="md:col-span-4 space-y-4">

          {/* Input source card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Map className="h-5 w-5 text-primary" />
                Farm Plot Analysis
              </CardTitle>
              <CardDescription>
                Upload an aerial drone image, start a live webcam feed, or connect any IP / RTSP camera to automatically segment and measure farm plots.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />

              {/* Mode selector */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  id="mode-upload"
                  onClick={() => switchMode('upload')}
                  className={cn(
                    'flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-semibold transition-all',
                    inputMode === 'upload'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground'
                  )}
                >
                  <Upload className="h-4 w-4" />
                  Upload
                </button>
                <button
                  id="mode-webcam"
                  onClick={() => switchMode('webcam')}
                  className={cn(
                    'flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-semibold transition-all',
                    inputMode === 'webcam'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground'
                  )}
                >
                  <Camera className="h-4 w-4" />
                  Webcam
                </button>
                <button
                  id="mode-ipcam"
                  onClick={() => { setInputMode('ipcam'); stopWebcam(); setSelectedImage(null); setResult(null); setError(null) }}
                  className={cn(
                    'flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-semibold transition-all',
                    inputMode === 'ipcam'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground'
                  )}
                >
                  <Wifi className="h-4 w-4" />
                  IP Cam
                </button>
              </div>

              {/* ── UPLOAD mode actions ── */}
              {inputMode === 'upload' && (
                <>
                  <Button variant="outline" className="w-full border-primary/30 bg-primary/5 hover:bg-primary/10"
                    onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" /> Choose Image File
                  </Button>
                  <Button
                    id="btn-run-detection"
                    className="w-full bg-primary text-black font-bold h-12"
                    disabled={!selectedImage || isProcessing}
                    onClick={() => runDetection()}
                  >
                    {isProcessing
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Segmenting Plots…</>
                      : <><Maximize className="h-4 w-4 mr-2" />Run Boundary Detection</>}
                  </Button>
                </>
              )}

              {/* ── WEBCAM mode actions ── */}
              {inputMode === 'webcam' && (
                <>
                  <Button variant="outline" className="w-full"
                    onClick={webcamActive ? stopWebcam : startWebcam}>
                    {webcamActive
                      ? <><Video className="h-4 w-4 mr-2 text-primary" />Stop Feed</>
                      : <><Camera className="h-4 w-4 mr-2" />Start Webcam</>}
                  </Button>
                  {webcamActive && (
                    <Button
                      id="btn-capture-webcam"
                      className="w-full bg-primary text-black font-bold h-12"
                      disabled={isProcessing}
                      onClick={async () => {
                        const frame = captureFrame()
                        if (frame) { setSelectedImage(frame); await runDetection(frame) }
                      }}
                    >
                      {isProcessing
                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing…</>
                        : <><Camera className="h-4 w-4 mr-2" />Capture & Analyze</>}
                    </Button>
                  )}
                </>
              )}

              {/* ── IP CAM mode actions ── */}
              {inputMode === 'ipcam' && (
                <div className="space-y-3">
                  {/* URL input */}
                  <div>
                    <label className="text-xs text-muted-foreground uppercase font-semibold mb-1.5 block">
                      Camera Stream URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="ipcam-url-input"
                        type="url"
                        value={ipcamUrl}
                        onChange={e => setIpcamUrl(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !ipcamConnected) connectIpcam() }}
                        placeholder={IPCAM_EXAMPLES[0]}
                        disabled={ipcamConnected}
                        className="flex-1 text-sm rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 font-mono"
                      />
                      <Button
                        id="btn-ipcam-connect"
                        size="sm"
                        variant={ipcamConnected ? 'outline' : 'default'}
                        className={cn(
                          'shrink-0 font-bold',
                          ipcamConnected
                            ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                            : 'bg-primary text-black'
                        )}
                        onClick={ipcamConnected ? disconnectIpcam : connectIpcam}
                      >
                        {ipcamConnected ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
                      </Button>
                    </div>
                    {!ipcamConnected && (
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        Supports: MJPEG, RTSP, HLS — any device on the same network
                      </p>
                    )}
                  </div>

                  {/* Connection status */}
                  {ipcamConnected && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                      <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-semibold text-emerald-400">IP CAM CONNECTED</span>
                      <span className="text-[10px] text-muted-foreground ml-auto font-mono truncate max-w-[120px]">{ipcamUrl}</span>
                    </div>
                  )}

                  {/* Actions when connected */}
                  {ipcamConnected && (
                    <>
                      {/* One-shot capture */}
                      <Button
                        id="btn-ipcam-capture"
                        className="w-full bg-primary text-black font-bold h-11"
                        disabled={isProcessing || ipcamStreaming}
                        onClick={captureAndAnalyze}
                      >
                        {isProcessing
                          ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing Frame…</>
                          : <><Camera className="h-4 w-4 mr-2" />Capture & Analyze</>}
                      </Button>

                      {/* Continuous streaming section */}
                      <div className="rounded-xl border border-white/10 bg-white/3 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Auto-Detect Loop
                          </span>
                          <span className={cn(
                            'text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full',
                            ipcamStreaming
                              ? 'text-red-400 bg-red-500/10 border border-red-500/20 animate-pulse'
                              : 'text-muted-foreground bg-white/5 border border-white/10'
                          )}>
                            {ipcamStreaming ? '● LIVE' : '○ IDLE'}
                          </span>
                        </div>

                        {/* Interval slider */}
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-12 shrink-0">Every {ipcamInterval}s</span>
                          <input
                            type="range"
                            min={3} max={60} step={1}
                            value={ipcamInterval}
                            onChange={e => setIpcamInterval(Number(e.target.value))}
                            disabled={ipcamStreaming}
                            className="flex-1 accent-primary"
                          />
                        </div>

                        <Button
                          id="btn-ipcam-stream-toggle"
                          className={cn(
                            'w-full h-10 font-bold text-xs uppercase tracking-widest',
                            ipcamStreaming
                              ? 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20'
                              : 'bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20'
                          )}
                          variant="outline"
                          disabled={isProcessing && !ipcamStreaming}
                          onClick={toggleStreaming}
                        >
                          {ipcamStreaming
                            ? <><Square className="h-3.5 w-3.5 mr-2" />Stop Live Detection</>
                            : <><Play className="h-3.5 w-3.5 mr-2" />Start Live Detection</>}
                        </Button>
                      </div>
                    </>
                  )}

                  {/* Quick-fill examples */}
                  {!ipcamConnected && (
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Quick Examples</p>
                      {IPCAM_EXAMPLES.map((ex) => (
                        <button
                          key={ex}
                          onClick={() => setIpcamUrl(ex)}
                          className="w-full text-left text-[10px] font-mono text-muted-foreground hover:text-primary px-2 py-1 rounded-md hover:bg-primary/5 transition-colors truncate"
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Drone calibration card */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Ruler className="h-4 w-4 text-primary" />
                Area Calibration
              </CardTitle>
              <CardDescription className="text-xs">
                Select your drone model for accurate GSD-based area calculation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground uppercase font-semibold mb-1 block">Drone Preset</label>
                <select
                  className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                  value={presetIdx}
                  onChange={e => setPresetIdx(Number(e.target.value))}
                >
                  {DRONE_PRESETS.map(([label], i) => (
                    <option key={i} value={i}>{label}</option>
                  ))}
                </select>
              </div>

              {isCustom && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Altitude (m)</label>
                    <input type="number" min={10} max={600} value={customAlt} onChange={e => setCustomAlt(e.target.value)}
                      className="w-full text-sm rounded-md border border-input bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">H-FOV (°)</label>
                    <input type="number" min={30} max={150} value={customFov} onChange={e => setCustomFov(e.target.value)}
                      className="w-full text-sm rounded-md border border-input bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                </div>
              )}

              {(() => {
                const { alt, fov } = getAltFov()
                if (!alt || !fov) return null
                const gsd = (2 * alt * Math.tan((fov * Math.PI / 180) / 2)) / 3840
                return (
                  <p className="text-xs text-muted-foreground">
                    Est. GSD ≈ <span className="text-primary font-bold">{(gsd * 100).toFixed(1)} cm/px</span> at {alt} m
                  </p>
                )
              })()}
            </CardContent>
          </Card>

          {/* Results card */}
          {result && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Detection Results
                  {ipcamStreaming && (
                    <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-red-400 animate-pulse">
                      ● AUTO-UPDATING
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col p-3 bg-secondary/50 rounded-lg">
                    <span className="text-xs text-muted-foreground uppercase mb-1">Total Plots</span>
                    <span className="text-2xl font-bold">{result.plots.length}</span>
                  </div>
                  <div className="flex flex-col p-3 bg-secondary/50 rounded-lg">
                    <span className="text-xs text-muted-foreground uppercase mb-1">Process Time</span>
                    <span className="text-2xl font-bold">{result.processing_time_ms.toFixed(0)} ms</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
                  <p className="text-xs text-muted-foreground uppercase mb-1">Total Farm Area</p>
                  <p className="text-xl font-bold text-primary">
                    {result.total_area_hectares.toFixed(3)} ha
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({result.total_area_sq_meters.toFixed(0)} m²)
                    </span>
                  </p>
                </div>

                {accInfo && (
                  <div className={cn('px-3 py-2 rounded-lg border text-xs', accInfo.color)}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-bold uppercase">{accInfo.label}</span>
                      <span className="opacity-70">GSD {(result.gsd_m_per_px * 100).toFixed(1)} cm/px</span>
                    </div>
                    <span className="opacity-70">{accInfo.hint}</span>
                  </div>
                )}

                <div className="max-h-[220px] overflow-y-auto pr-1 space-y-1">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Plot Breakdown</h4>
                  {result.plots.map((plot) => (
                    <div key={plot.plot_id} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0">
                      <span className="font-medium">Plot #{plot.plot_id}</span>
                      <div className="text-right">
                        <span className="text-muted-foreground">{plot.area_sq_meters.toFixed(0)} m²</span>
                        <span className="text-xs text-muted-foreground/60 ml-1">({plot.area_hectares.toFixed(4)} ha)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ─── Right visualizer ─────────────────────────────────────────────── */}
        <div className="md:col-span-8">
          <Card className="h-[calc(100vh-140px)] flex flex-col overflow-hidden bg-black/20 border-white/5 shadow-2xl">
            <CardContent className="flex-1 p-0 relative bg-muted/5 flex flex-col items-center justify-center min-h-[500px]">

              {/* Scanline overlay for any live feed */}
              {(webcamActive || ipcamConnected) && (
                <div className="absolute inset-0 pointer-events-none z-10 opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]" />
              )}

              {/* Empty state */}
              {!selectedImage && !result && !webcamActive && !ipcamConnected && (
                <div className="text-center text-muted-foreground p-8 flex flex-col items-center">
                  <div className="h-20 w-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                    <Map className="h-10 w-10 opacity-30 text-primary" />
                  </div>
                  <p className="font-bold text-xl tracking-tight">System Awaiting Data</p>
                  <p className="text-sm mt-2 max-w-sm text-balance text-muted-foreground">
                    Link a live tactical feed (webcam or IP camera) or upload top-down drone imagery to begin neural boundary extraction.
                  </p>
                  <div className="mt-6 grid grid-cols-3 gap-3 w-full max-w-sm">
                    {[
                      { icon: Upload, label: 'Upload Image' },
                      { icon: Camera, label: 'Webcam Feed' },
                      { icon: Wifi, label: 'IP / RTSP Cam' },
                    ].map(({ icon: Icon, label }) => (
                      <div key={label} className="flex flex-col items-center gap-2 p-3 rounded-xl border border-white/5 bg-white/2 text-xs text-muted-foreground">
                        <Icon className="h-5 w-5 opacity-50" />
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Webcam live feed */}
              <div className={cn('relative w-full h-full flex items-center justify-center bg-black', !webcamActive && 'hidden')}>
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                <div className="absolute inset-0 border-[20px] border-black/20 pointer-events-none" />
                <div className="absolute top-8 left-8 flex items-center gap-3 bg-red-600 px-3 py-1.5 rounded-md shadow-lg animate-pulse z-20">
                  <div className="h-2 w-2 rounded-full bg-white" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">Live Webcam Active</span>
                </div>
              </div>

              {/* IP Cam live feed */}
              {inputMode === 'ipcam' && ipcamConnected && !result && (
                <div className="relative w-full h-full flex flex-col items-center justify-center bg-black gap-4">
                  {/* Show live stream in browser if it's a MJPEG URL */}
                  {isMjpeg ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      ref={ipcamImgRef}
                      src={ipcamUrl}
                      alt="IP Camera Live Feed"
                      crossOrigin="anonymous"
                      className="w-full h-full object-cover"
                      onError={() => setError('Cannot load stream directly in browser. The backend will still capture frames via OpenCV.')}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-center px-8">
                      <div className="h-24 w-24 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <Wifi className="h-12 w-12 text-emerald-400" />
                      </div>
                      <div>
                        <p className="font-black text-lg tracking-tight text-emerald-400">IP Camera Connected</p>
                        <p className="text-sm text-muted-foreground mt-1 font-mono">{ipcamUrl}</p>
                        <p className="text-xs text-muted-foreground/60 mt-2">
                          RTSP/HLS streams are captured server-side via OpenCV.<br />
                          Click "Capture & Analyze" or start the auto-detect loop.
                        </p>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs font-black uppercase tracking-widest text-emerald-400">
                          {ipcamStreaming ? `Auto-detecting every ${ipcamInterval}s` : 'Ready for capture'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Live badge */}
                  <div className="absolute top-8 left-8 flex items-center gap-3 bg-emerald-600/80 backdrop-blur px-3 py-1.5 rounded-md shadow-lg z-20">
                    <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">
                      {ipcamStreaming ? 'Live Detection Active' : 'IP Cam Connected'}
                    </span>
                  </div>

                  {/* Quick capture overlay button */}
                  <div className="absolute bottom-8 right-8 z-20">
                    <Button
                      size="sm"
                      className="bg-primary text-black font-bold shadow-xl"
                      disabled={isProcessing}
                      onClick={captureAndAnalyze}
                    >
                      {isProcessing
                        ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Analyzing</>
                        : <><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Capture Now</>}
                    </Button>
                  </div>
                </div>
              )}

              {/* Uploaded image (awaiting detection) */}
              {selectedImage && !result && !webcamActive && inputMode !== 'ipcam' && (
                <div className="relative w-full h-full p-8 flex items-center justify-center">
                  <img src={selectedImage} alt="Original Upload" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-white/10" />
                  {isProcessing && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center z-20 rounded-2xl m-8">
                      <div className="relative">
                        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                        <div className="absolute inset-0 blur-xl bg-primary/20 rounded-full" />
                      </div>
                      <p className="font-black text-xs uppercase tracking-[0.3em] text-primary animate-pulse">Running Neural Segmentation</p>
                    </div>
                  )}
                </div>
              )}

              {/* IP cam captured frame (processing) */}
              {selectedImage && isProcessing && inputMode === 'ipcam' && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-30">
                  <div className="relative">
                    <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                    <div className="absolute inset-0 blur-xl bg-primary/20 rounded-full" />
                  </div>
                  <p className="font-black text-xs uppercase tracking-[0.3em] text-primary animate-pulse mt-4">
                    Analyzing IP Camera Frame
                  </p>
                  {ipcamStreaming && (
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Next capture in ~{ipcamInterval}s
                    </p>
                  )}
                </div>
              )}

              {/* Detection result */}
              {result && (
                <div className="relative w-full h-full p-8 flex flex-col gap-6 overflow-auto">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
                    {selectedImage && (
                      <div className="flex flex-col gap-3 group">
                        <div className="flex items-center justify-between px-2">
                          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">
                            {inputMode === 'ipcam' ? 'IP Cam Captured Frame' : 'Raw Input Stream'}
                          </p>
                          <Badge variant="outline" className="text-[8px] h-4 border-white/10 text-muted-foreground">
                            {inputMode === 'ipcam' ? 'IPCAM_FRAME' : 'SENSOR_ALPHA'}
                          </Badge>
                        </div>
                        <div className="relative rounded-2xl overflow-hidden border border-white/5 shadow-xl group-hover:border-primary/20 transition-all">
                          <img src={selectedImage} alt="Original" className="w-full object-contain bg-black/40" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col gap-3 group">
                      <div className="flex items-center justify-between px-2">
                        <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em]">Segmented Neural Boundary</p>
                        <Badge className="text-[8px] h-4 bg-primary text-black font-black">PROCESS_COMPLETE</Badge>
                      </div>
                      <div className="relative rounded-2xl overflow-hidden border-2 border-primary/20 shadow-[0_0_40px_rgba(191,255,0,0.1)] group-hover:shadow-[0_0_60px_rgba(191,255,0,0.15)] transition-all">
                        <img src={result.annotated_image_base64} alt="Analyzed Farm Boundary" className="w-full object-contain bg-black/40" />
                        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-primary/5 to-transparent h-20 w-full top-0 animate-[scan_3s_linear_infinite]" />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center mt-4">
                    <div className="flex items-center gap-3 text-xs text-primary font-black bg-primary/10 px-6 py-3 rounded-2xl border border-primary/20 shadow-lg backdrop-blur-xl uppercase tracking-widest">
                      <CheckCircle className="h-4 w-4" />
                      Extraction Finalized — {result.plots.length} plots · {result.total_area_hectares.toFixed(3)} ha total
                      {inputMode === 'ipcam' && ipcamStreaming && (
                        <span className="text-red-400 ml-2 animate-pulse">● LIVE</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hidden canvases for frame capture */}
      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={ipcamCanvasRef} className="hidden" />
    </DashboardLayout>
  )
}

function Badge({ children, className, variant = 'default' }: any) {
  return (
    <span className={cn(
      'px-2 py-0.5 rounded text-xs font-medium',
      variant === 'default' ? 'bg-primary text-black' : 'border border-input bg-background',
      className
    )}>
      {children}
    </span>
  )
}
