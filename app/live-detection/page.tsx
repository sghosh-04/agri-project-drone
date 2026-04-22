'use client'
const BACKEND_URL = "https://agri-backend-v8ch.onrender.com"


import { DashboardLayout } from '@/components/dashboard/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Camera,
  Upload,
  Leaf,
  Bug,
  AlertTriangle,
  CheckCircle,
  Wifi,
  WifiOff,
  Zap,
  RefreshCw,
  Eye,
  Activity,
  Clock,
  ImageIcon,
  Sprout,
  Microscope,
  ShieldAlert,
  FlaskConical,
  Worm,
  Info,
  MapPin,
  Layers,
} from 'lucide-react'
import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------
interface CropResult {
  leaf_detected: boolean
  detection_stage: number          // 1 = leaf check, 2 = disease classification
  is_leaf: boolean
  not_leaf_reason: string
  status: 'HEALTHY' | 'DISEASED' | 'UNCERTAIN' | 'NO_CROP' | 'MASKED_WEAK' | 'NOT_LEAF'
  label: string
  confidence: number
  class_index: number
  plant_type: string
  disease_name: string
  affected_part: string
  category: string
  treatment_hint: string
  severity: string
  bbox?: [number, number, number, number]
  annotated_image_base64?: string
}

interface DetectResponse {
  leaves: CropResult[]
  total_leaves: number
  processing_time_ms: number
  saved_detections?: unknown[]
  error?: string
  detail?: string
}

interface BoundaryPlot {
  plot_id: number
  area_sq_meters: number
  center_x: number
  center_y: number
}

interface BoundaryResponse {
  plots: BoundaryPlot[]
  annotated_image_base64: string
  processing_time_ms: number
  total_plots: number
  method: string
  model_used: string
  error?: string
}

interface BackendStatus {
  backend_status: 'online' | 'offline'
  device?: string
  classes?: number
  mode?: string
  pipeline?: string
  total_models_loaded?: number
  yolo_detectors?: string[]
  cnn_classifiers?: string[]
  supported_targets?: string[]
  message?: string
  start_command?: string
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------
const statusConfig = {
  HEALTHY: {
    label: 'Healthy',
    color: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
    badgeColor: 'bg-emerald-500 text-white',
    icon: CheckCircle,
    glow: 'shadow-emerald-500/20',
  },
  DISEASED: {
    label: 'Disease Detected',
    color: 'bg-red-500/15 text-red-600 border-red-500/30',
    badgeColor: 'bg-red-500 text-white',
    icon: Bug,
    glow: 'shadow-red-500/20',
  },
  UNCERTAIN: {
    label: 'Uncertain',
    color: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
    badgeColor: 'bg-amber-500 text-white',
    icon: AlertTriangle,
    glow: 'shadow-amber-500/20',
  },
  NO_CROP: {
    label: 'No Crop Detected',
    color: 'bg-muted/50 text-muted-foreground border-border',
    badgeColor: 'bg-muted text-muted-foreground',
    icon: Sprout,
    glow: '',
  },
  MASKED_WEAK: {
    label: 'Weak Signal',
    color: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
    badgeColor: 'bg-blue-500 text-white',
    icon: Eye,
    glow: 'shadow-blue-500/20',
  },
  NOT_LEAF: {
    label: 'Not a Leaf',
    color: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    badgeColor: 'bg-violet-500 text-white',
    icon: Leaf,
    glow: 'shadow-violet-500/20',
  },
}

const severityConfig: Record<string, { label: string; color: string }> = {
  none: { label: 'None', color: 'bg-emerald-100/10 text-emerald-500 border-emerald-500/20' },
  low: { label: 'Low', color: 'bg-yellow-100/10 text-yellow-500 border-yellow-500/20' },
  medium: { label: 'Medium', color: 'bg-orange-100/10 text-orange-500 border-orange-500/20' },
  high: { label: 'High', color: 'bg-red-100/10 text-red-500 border-red-500/20' },
  critical: { label: 'Critical', color: 'bg-red-600/20 text-red-600 border-red-600/40 font-bold' },
}

function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------
export default function LiveDetectionPage() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)

  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [result, setResult] = useState<DetectResponse | null>(null)
  const [boundaryResult, setBoundaryResult] = useState<BoundaryResponse | null>(null)
  const [boundaryMode, setBoundaryMode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<(DetectResponse | BoundaryResponse)[]>([])

  // Webcam state
  const [webcamActive, setWebcamActive] = useState(false)
  const [liveLoopActive, setLiveLoopActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const boundaryModeRef = useRef(false)

  useEffect(() => {
    boundaryModeRef.current = boundaryMode
  }, [boundaryMode])

  // ---------- Backend health check ----------
  const checkBackend = useCallback(async () => {
    setStatusLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/health`)
      const data: BackendStatus = await res.json()
      setBackendStatus(data)
    } catch {
      setBackendStatus({ backend_status: 'offline', message: 'Cannot reach API' })
    } finally {
      setStatusLoading(false)
    }
  }, [])

  useEffect(() => {
    checkBackend()
    const interval = setInterval(checkBackend, 15000)
    return () => clearInterval(interval)
  }, [checkBackend])

  // ---------- File upload ----------
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const b64 = await imageToBase64(file)
    setSelectedImage(b64)
    setResult(null)
    setError(null)
  }

  // ---------- Webcam ----------
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setWebcamActive(true)
      setSelectedImage(null)
      setFileName(null)
      setResult(null)
      setError(null)
    } catch {
      setError('Could not access webcam. Please check permissions.')
    }
  }

  const stopWebcam = useCallback(() => {
    stopLiveDetection()
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((t) => t.stop())
      videoRef.current.srcObject = null
    }
    setWebcamActive(false)
  }, []) // eslint-disable-line

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

  // ---------- Detection call ----------
  const runDetection = useCallback(
    async (imageBase64: string) => {
      setDetecting(true)
      setError(null)
      const isBoundary = boundaryModeRef.current

      try {
        const endpoint = isBoundary
          ? `${BACKEND_URL}/detect-fields`
          : `${BACKEND_URL}/detect`
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: imageBase64,
            save_to_db: !isBoundary, // only save disease detections for now
          }),
        })
        const text = await res.text()

        let data
        try {
          data = JSON.parse(text)
        } catch (e) {
          console.error("❌ Backend returned HTML:", text)
          setError("Backend returned invalid response")
          return
        }

        if (data.error) {
          if (data.error === 'NO_FIELD') {
            setError("Target feed does not contain agricultural field layout. Awaiting valid drone target...")
          } else {
            setError(`${data.error}${data.detail ? ' — ' + data.detail : ''}`)
          }
          setResult(null)
          setBoundaryResult(null)
        } else {
          if (isBoundary) {
            setBoundaryResult(data as BoundaryResponse)
            setResult(null)
            // If the boundary server returns an annotated image, preview it
            if ((data as BoundaryResponse).annotated_image_base64) {
              setSelectedImage((data as BoundaryResponse).annotated_image_base64)
            }
          } else {
            setResult(data as DetectResponse)
            setBoundaryResult(null)
          }
          setHistory((prev) => [data, ...prev].slice(0, 10))
        }
      } catch (err) {
        console.error('Detection error:', err)
        setError('Backend error. Check API connection or logs.')
      } finally {
        setDetecting(false)
      }
    },
    []
  )

  const handleDetectUpload = async () => {
    if (!selectedImage) return
    await runDetection(selectedImage)
  }

  const handleCapture = async () => {
    const frame = captureFrame()
    if (!frame) { setError('Could not capture frame'); return }
    setSelectedImage(frame)
    await runDetection(frame)
  }

  // ---------- Live loop ----------
  const startLiveDetection = () => {
    if (liveLoopActive) return
    setLiveLoopActive(true)
    liveIntervalRef.current = setInterval(async () => {
      const frame = captureFrame()
      if (frame) await runDetection(frame)
    }, 5000)
  }

  const stopLiveDetection = () => {
    if (liveIntervalRef.current) {
      clearInterval(liveIntervalRef.current)
      liveIntervalRef.current = null
    }
    setLiveLoopActive(false)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopWebcam() }
  }, [stopWebcam])

  // ---------- Render ----------
  return (
    <DashboardLayout title="Live Discovery">
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white/5 border border-white/5 p-6 rounded-3xl backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className={cn(
              "h-12 w-12 rounded-2xl flex items-center justify-center transition-all shadow-[0_0_20px_rgba(191,255,0,0.2)]",
              backendStatus?.backend_status === 'online' ? "bg-primary text-black" : "bg-destructive text-white"
            )}>
              {backendStatus?.backend_status === 'online' ? <Wifi className="h-6 w-6" /> : <WifiOff className="h-6 w-6" />}
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Diagnostic Pipeline</h2>
              <p className="text-sm text-muted-foreground">
                {backendStatus?.backend_status === 'online'
                  ? `Active on ${backendStatus.device} · ${backendStatus.total_models_loaded ?? backendStatus.classes} models loaded · ${(backendStatus.yolo_detectors?.length ?? 0)} YOLO + ${(backendStatus.cnn_classifiers?.length ?? 0)} CNN`
                  : 'Vision server unavailable — Connect to local uplink'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "rounded-xl border transition-all h-9 px-4 font-black text-[10px] tracking-widest uppercase",
                boundaryMode ? "bg-primary text-black border-primary/20" : "bg-white/5 border-white/5 text-muted-foreground"
              )}
              onClick={() => {
                setBoundaryMode(!boundaryMode)
                setResult(null)
                setBoundaryResult(null)
              }}
            >
              <Layers className="h-3.5 w-3.5 mr-2" />
              Boundary Mode {boundaryMode ? 'ON' : 'OFF'}
            </Button>
            <Button variant="ghost" size="sm" className="rounded-xl border border-white/5 bg-white/5 h-9" onClick={checkBackend}>
              <RefreshCw className={cn('h-4 w-4 mr-2', statusLoading && 'animate-spin')} />
              Re-sync
            </Button>
            <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Alpha Channel Restricted
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Visualizer */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="bg-black/40 border-white/5 rounded-3xl overflow-hidden relative group">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent z-10" />

              <div className="relative aspect-video bg-muted/20 flex items-center justify-center">
                {/* Camera Scanner Effect */}
                {webcamActive && (
                  <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
                    <div className="absolute top-0 left-0 w-24 h-24 border-t-2 border-l-2 border-primary m-6 rounded-tl-2xl opacity-40 shadow-[-5px_-5px_15px_rgba(191,255,0,0.2)]" />
                    <div className="absolute top-0 right-0 w-24 h-24 border-t-2 border-r-2 border-primary m-6 rounded-tr-2xl opacity-40 shadow-[5px_-5px_15px_rgba(191,255,0,0.2)]" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 border-b-2 border-l-2 border-primary m-6 rounded-bl-2xl opacity-40 shadow-[-5px_5px_15px_rgba(191,255,0,0.2)]" />
                    <div className="absolute bottom-0 right-0 w-24 h-24 border-b-2 border-r-2 border-primary m-6 rounded-br-2xl opacity-40 shadow-[5px_5px_15px_rgba(191,255,0,0.2)]" />
                    <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-primary/20 animate-pulse" />
                    <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-primary/20 animate-pulse" />
                  </div>
                )}

                <video
                  ref={videoRef}
                  className={cn('w-full h-full object-cover', !webcamActive && 'hidden')}
                  muted
                  playsInline
                />

                {selectedImage && !webcamActive && (
                  <img
                    src={selectedImage}
                    alt="Input region"
                    className="w-full h-full object-contain"
                  />
                )}

                {!webcamActive && !selectedImage && (
                  <div className="flex flex-col items-center gap-6 p-12 text-center">
                    <div className="h-24 w-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center animate-pulse">
                      <Eye className="h-12 w-12 text-primary/30" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold tracking-tight">Awaiting Vision Input</h3>
                      <p className="text-muted-foreground text-sm max-w-sm mx-auto font-medium">Link a live feed or upload high-resolution field data for real-time diagnostic analysis.</p>
                    </div>
                    <Button onClick={startWebcam} className="h-12 rounded-xl bg-primary text-black font-bold px-8 shadow-lg shadow-primary/20 border-0 hover:scale-105 transition-all text-sm uppercase tracking-widest">
                      Initialize Live Feed
                    </Button>
                  </div>
                )}

                {detecting && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-6">
                    <div className="relative">
                      <div className="h-20 w-20 rounded-full border-2 border-primary/20 flex items-center justify-center">
                        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                      </div>
                      <div className="absolute inset-x-[-20px] top-full mt-4 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Scanning Neural Mesh</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <CardContent className="p-6 bg-white/5 border-t border-white/5">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                    <Button
                      variant="outline"
                      className="h-12 border-white/10 bg-white/5 rounded-xl px-6 font-bold hover:bg-white/10 group/up"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2 text-primary group-hover/up:scale-125 transition-all" />
                      Upload Frame
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    {webcamActive && (
                      <Button
                        className="h-12 bg-white/10 hover:bg-white/20 border-white/10 rounded-xl px-6 font-bold text-white uppercase tracking-widest text-xs"
                        onClick={stopWebcam}
                      >
                        Terminate Feed
                      </Button>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {webcamActive && (
                      <Button
                        size="lg"
                        className={cn(
                          "h-14 rounded-2xl font-black px-10 transition-all border-0 uppercase tracking-widest",
                          liveLoopActive ? "bg-red-600 text-white shadow-lg shadow-red-600/30" : "bg-primary text-black shadow-lg shadow-primary/30"
                        )}
                        onClick={liveLoopActive ? stopLiveDetection : startLiveDetection}
                      >
                        {liveLoopActive ? "DISENGAGE LIVE" : "ENGAGE LIVE SCAN"}
                      </Button>
                    )}
                    {selectedImage && !detecting && (
                      <Button
                        size="lg"
                        className="h-14 rounded-2xl bg-primary text-black font-black px-10 shadow-lg shadow-primary/30 border-0 hover:scale-105 transition-all uppercase tracking-widest"
                        onClick={handleDetectUpload}
                      >
                        START ANALYSIS
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results Display */}
            {result && !detecting && (
              <div className="space-y-6">
                {/* Two-Stage Pipeline Status Header */}
                {result.leaves?.length > 0 && (() => {
                  const firstResult = result.leaves[0]
                  const allLeaves = result.leaves.every(r => r.is_leaf)
                  const hasNotLeaf = result.leaves.some(r => r.status === 'NOT_LEAF')
                  const hasNoCrop = result.leaves.some(r => r.status === 'NO_CROP')
                  return (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                      <p className="text-[10px] font-black tracking-[0.25em] uppercase text-muted-foreground mb-4">Detection Pipeline</p>
                      <div className="flex items-center gap-3">
                        {/* Stage 1 */}
                        <div className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-xs",
                          (hasNoCrop)
                            ? "bg-muted/30 border-muted/30 text-muted-foreground"
                            : hasNotLeaf
                              ? "bg-violet-500/15 border-violet-500/30 text-violet-400"
                              : "bg-primary/15 border-primary/30 text-primary"
                        )}>
                          <Leaf className="h-3.5 w-3.5" />
                          <span>Stage 1: {hasNoCrop ? 'No Crop' : hasNotLeaf ? 'Not a Leaf' : 'Leaf ✓'}</span>
                        </div>
                        {/* Arrow */}
                        <div className={cn("text-lg font-black", allLeaves ? "text-primary" : "text-muted-foreground/30")}>
                          →
                        </div>
                        {/* Stage 2 */}
                        <div className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-xs",
                          !allLeaves
                            ? "bg-muted/20 border-muted/20 text-muted-foreground/40"
                            : firstResult.status === 'DISEASED'
                              ? "bg-red-500/15 border-red-500/30 text-red-400"
                              : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                        )}>
                          <Microscope className="h-3.5 w-3.5" />
                          <span>Stage 2: {!allLeaves ? 'Skipped' : 'Disease Check ✓'}</span>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {result.leaves?.slice(0, 4).map((crop, i) => {
                    const cfg = statusConfig[crop.status] ?? statusConfig.NO_CROP
                    const StatusIcon = cfg.icon
                    const isDiseased = crop.status === 'DISEASED'
                    const isNotLeaf = crop.status === 'NOT_LEAF'
                    const isNoCrop = crop.status === 'NO_CROP'

                    return (
                      <Card key={i} className="bg-white/5 border-white/5 rounded-3xl overflow-hidden backdrop-blur-md relative group/res hover:scale-[1.02] transition-all">
                        <div className={cn(
                          "absolute inset-y-0 left-0 w-1",
                          isDiseased ? "bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                            : isNotLeaf ? "bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.5)]"
                              : isNoCrop ? "bg-muted"
                                : "bg-primary shadow-[0_0_15px_rgba(191,255,0,0.5)]"
                        )} />
                        <CardContent className="p-6 space-y-4">
                          {/* Stage badge */}
                          <div className="flex items-center justify-between">
                            <span className={cn(
                              "text-[9px] font-black tracking-[0.2em] uppercase px-2 py-0.5 rounded-md border",
                              crop.detection_stage === 2
                                ? "bg-primary/10 text-primary border-primary/20"
                                : "bg-violet-500/10 text-violet-400 border-violet-500/20"
                            )}>
                              Stage {crop.detection_stage ?? 1}: {crop.detection_stage === 2 ? 'Disease Analysis' : 'Leaf Check'}
                            </span>
                            {crop.detection_stage === 2 && (
                              <span className="text-xl font-black tabular-nums">{(crop.confidence * 100).toFixed(0)}%</span>
                            )}
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="rounded-xl p-2 bg-white/5 border border-white/10">
                                <StatusIcon className={cn("h-5 w-5", isDiseased ? "text-red-500" : isNotLeaf ? "text-violet-400" : "text-primary")} />
                              </div>
                              <div>
                                <Badge className={cn("text-[10px] uppercase font-black tracking-widest px-2 py-0 h-5 mt-1 border-0", cfg.badgeColor)}>
                                  {cfg.label}
                                </Badge>
                              </div>
                            </div>
                            {crop.detection_stage === 2 && (
                              <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">Confidence</p>
                            )}
                          </div>

                          {/* NOT_LEAF: show redirect guidance */}
                          {isNotLeaf && (
                            <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                              <p className="text-[10px] font-black tracking-widest uppercase text-violet-400 mb-1">Stage 1 — Leaf Required</p>
                              <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                                {crop.not_leaf_reason || `A '${crop.plant_type}' was detected. Point the camera at a leaf surface.`}
                              </p>
                            </div>
                          )}

                          {/* NO_CROP */}
                          {isNoCrop && (
                            <div className="p-4 bg-muted/10 border border-muted/20 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
                              <Sprout className="h-8 w-8 text-muted-foreground/40" />
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No plant tissue detected</p>
                            </div>
                          )}

                          {/* DISEASED: Stage 2 result */}
                          {isDiseased && (
                            <div className="space-y-3">
                              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                <p className="text-[10px] font-black tracking-widest uppercase text-red-400 mb-1">Diagnosis</p>
                                <p className="text-sm font-bold text-foreground leading-tight">{crop.disease_name}</p>
                              </div>
                              <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                                <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground mb-1">Protocol Action</p>
                                <p className="text-xs font-medium text-muted-foreground leading-relaxed italic">&ldquo;{crop.treatment_hint || 'Observe and monitor region closely for progression.'}&rdquo;</p>
                              </div>
                            </div>
                          )}

                          {/* HEALTHY: Stage 2 result */}
                          {!isDiseased && !isNotLeaf && !isNoCrop && (
                            <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
                              <CheckCircle className="h-8 w-8 text-primary/40" />
                              <p className="text-xs font-bold text-primary/80 uppercase tracking-widest">Sector Nominal</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )}

            {boundaryResult && !detecting && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {boundaryResult.plots?.slice(0, 4).map((plot, i) => (
                  <Card key={i} className="bg-white/5 border-white/5 rounded-3xl overflow-hidden backdrop-blur-md relative group/res hover:scale-[1.02] transition-all">
                    <div className="absolute inset-y-0 left-0 w-1 bg-primary shadow-[0_0_15px_rgba(191,255,0,0.5)]" />
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="rounded-xl p-2 bg-white/5 border border-white/10">
                            <Layers className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <Badge className="text-[10px] uppercase font-black tracking-widest px-2 py-0 h-5 mt-1 border-0 bg-primary text-black">
                              FIELD PLOT #{plot.plot_id}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-black tabular-nums">{Math.round(plot.area_sq_meters)}</span>
                          <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">SQ. METERS</p>
                        </div>
                      </div>
                      <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                        <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground mb-1">Position Coordinates</p>
                        <p className="text-xs font-bold text-foreground">Rel: {plot.center_x}, {plot.center_y}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar Telemetry */}
          <div className="lg:col-span-4 space-y-8">
            {/* Engine Telemetry */}
            <Card className="bg-white/5 border-white/5 rounded-[2.5rem] p-8 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Activity className="h-24 w-24" />
              </div>
              <h3 className="text-sm font-black tracking-[0.2em] uppercase text-muted-foreground mb-8">Uplink Telemetry</h3>
              <div className="space-y-8">
                {[
                  { label: "Neural Load", value: detecting ? "78%" : "12%", icon: Zap, color: "text-amber-500" },
                  { label: "Diagnostic Mode", value: boundaryMode ? "BOUNDARY-SCAN" : "CROP-DISEASE", icon: Microscope, color: "text-primary" },
                  { label: "Frame Buffer", value: "HD-PRO 60fps", icon: Camera, color: "text-blue-500" },
                  { label: "Signal Latency", value: result || boundaryResult ? (result?.processing_time_ms || boundaryResult?.processing_time_ms) + "ms" : "4ms", icon: Wifi, color: "text-blue-500" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
                      <item.icon className={cn("h-4 w-4", item.color)} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{item.label}</p>
                      <p className="text-lg font-black tracking-tight">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Legend */}
            <Card className="bg-white/5 border-white/5 rounded-[2.5rem] p-8">
              <h3 className="text-sm font-black tracking-[0.2em] uppercase text-muted-foreground mb-6">Diagnostic Range</h3>
              <div className="space-y-3">
                {['🌿 Leaves', '🌱 Stems', '🍅 Fruits', '🥔 Roots', '🌾 Whole Plant', '🪨 Soil Patches'].map((t) => (
                  <div key={t} className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-2xl border border-white/5 text-xs font-bold transition-all hover:bg-white/10 hover:border-primary/20">
                    {t}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </DashboardLayout>
  )
}
