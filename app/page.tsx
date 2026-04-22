'use client'

import { DashboardLayout } from '@/components/dashboard/layout'
import {
  Plane, Map, Leaf, AlertTriangle, Cpu, Globe, Battery,
  Signal, Thermometer, Droplets, Activity, Shield, Wind,
  CheckCircle2, XCircle, Clock, TrendingUp, Layers, Eye
} from 'lucide-react'
import useSWR from 'swr'
import type { DashboardStats, Drone, Alert, PlantDetection } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

// ── Tiny helpers ──────────────────────────────────────────────────────────────
function fmt(n: number | string | null | undefined, decimals = 0): string {
  const v = Number(n)
  return isNaN(v) ? '—' : v.toFixed(decimals)
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={cn(
      'inline-block h-2 w-2 rounded-full flex-shrink-0',
      ok ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]'
         : 'bg-red-500  shadow-[0_0_6px_rgba(239,68,68,0.7)]'
    )} />
  )
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  error:    'bg-red-500/15 text-red-400 border-red-500/30',
  warning:  'bg-amber-500/15 text-amber-400 border-amber-500/30',
  info:     'bg-sky-500/15 text-sky-400 border-sky-500/30',
}

const DRONE_STATUS_COLOR: Record<string, string> = {
  flying:      'text-emerald-400',
  idle:        'text-sky-400',
  charging:    'text-amber-400',
  maintenance: 'text-orange-400',
  offline:     'text-red-400',
}

// ── Backend health (Python servers) ──────────────────────────────────────────
type BackendHealth = { status: string; service?: string; dexined_available?: boolean } | null

function useBackendHealth(url: string): BackendHealth {
  const [health, setHealth] = useState<BackendHealth>(null)
  useEffect(() => {
    const check = () =>
      fetch(url, { signal: AbortSignal.timeout(3000) })
        .then(r => r.json())
        .then(setHealth)
        .catch(() => setHealth(null))
    check()
    const id = setInterval(check, 30_000)
    return () => clearInterval(id)
  }, [url])
  return health
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  title, value, sub, icon: Icon, accent = false, loading = false
}: {
  title: string; value: string; sub?: string
  icon: React.FC<any>; accent?: boolean; loading?: boolean
}) {
  return (
    <div className={cn(
      'rounded-2xl border p-4 flex flex-col gap-3 backdrop-blur-sm transition-all hover:scale-[1.01]',
      accent
        ? 'border-primary/30 bg-primary/5 hover:border-primary/50'
        : 'border-white/8 bg-white/[0.04] hover:border-white/15'
    )}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-xl',
          accent ? 'bg-primary/15' : 'bg-white/5'
        )}>
          <Icon className={cn('h-4 w-4', accent ? 'text-primary' : 'text-muted-foreground')} />
        </div>
      </div>
      {loading ? (
        <div className="h-8 w-20 rounded-md bg-white/10 animate-pulse" />
      ) : (
        <p className={cn('text-2xl font-black tracking-tight', accent ? 'text-primary' : 'text-foreground')}>{value}</p>
      )}
      {sub && !loading && <p className="text-[10px] text-muted-foreground leading-tight">{sub}</p>}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: rawStats, isLoading: statsLoading } =
    useSWR('/api/dashboard', fetcher, { refreshInterval: 30_000 })
  // Guard: if DB is down, API returns { error: "..." } — normalize to undefined
  const stats: DashboardStats | undefined = rawStats?.drones ? rawStats : undefined

  const { data: rawDrones, isLoading: dronesLoading } =
    useSWR('/api/drones', fetcher, { refreshInterval: 10_000 })
  const drones: Drone[] = Array.isArray(rawDrones) ? rawDrones : []

  const { data: rawAlerts, isLoading: alertsLoading } =
    useSWR('/api/alerts', fetcher, { refreshInterval: 20_000 })
  const alerts: Alert[] = Array.isArray(rawAlerts) ? rawAlerts : []

  const { data: rawDetections, isLoading: detectLoading } =
    useSWR('/api/detections', fetcher, { refreshInterval: 20_000 })
  const detections: PlantDetection[] = Array.isArray(rawDetections) ? rawDetections : []

  const diseaseHealth  = useBackendHealth('http://localhost:8001/health')
  const boundaryHealth = useBackendHealth('http://localhost:8002/health')

  // Derived data
  const unreadAlerts   = alerts.filter(a => !a.is_read).slice(0, 5)
  const recentDetections = detections.slice(0, 5)
  const flyingDrones   = drones.filter(d => d.status === 'flying')
  const avgBattery     = drones.length ? drones.reduce((s, d) => s + d.battery_level, 0) / drones.length : 0
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.is_resolved).length

  return (
    <DashboardLayout title="Mission Control">

      {/* ── Hero background banner ── */}
      <div className="relative mb-6 overflow-hidden rounded-3xl h-52 border border-white/8 shadow-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/agri-bg.jpg"
          alt="Aerial farm view"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Dark overlay + green tint gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col justify-between p-7">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80">AgriDrone Precision</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-white">Mission Control</h1>
              <p className="mt-1 text-sm text-white/60">Live telemetry · Disease intelligence · Field analytics</p>
            </div>
            {/* AI backend status pills */}
            <div className="flex flex-col gap-2 items-end">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 backdrop-blur-md text-xs">
                <StatusDot ok={diseaseHealth?.status === 'ok'} />
                <span className="text-white/80">Disease AI</span>
                <span className={cn('font-bold', diseaseHealth?.status === 'ok' ? 'text-emerald-400' : 'text-red-400')}>
                  {diseaseHealth ? (diseaseHealth.status === 'ok' ? 'Online' : 'Error') : 'Offline'}
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 backdrop-blur-md text-xs">
                <StatusDot ok={boundaryHealth?.status === 'ok'} />
                <span className="text-white/80">Boundary AI</span>
                <span className={cn('font-bold', boundaryHealth?.status === 'ok' ? 'text-emerald-400' : 'text-red-400')}>
                  {boundaryHealth ? (boundaryHealth.status === 'ok' ? 'Online' : 'Error') : 'Offline'}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom strip — live numbers */}
          <div className="flex items-center gap-6 flex-wrap">
            {[
              { label: 'Active Drones',    val: statsLoading ? '…' : fmt(stats?.drones?.flying), icon: '🛩️' },
              { label: 'Fields Monitored', val: statsLoading ? '…' : fmt(stats?.fields?.total), icon: '🌱' },
              { label: 'Detections Today', val: statsLoading ? '…' : fmt(stats?.detections?.detected), icon: '🔬' },
              { label: 'Critical Alerts',  val: statsLoading ? '…' : fmt(stats?.alerts?.critical_unresolved), icon: '⚠️' },
              { label: 'Total Area (ha)',  val: statsLoading ? '…' : fmt(stats?.fields?.total_area, 1), icon: '📐' },
            ].map(({ label, val, icon }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-base">{icon}</span>
                <div>
                  <p className="text-xs text-white/50 leading-none">{label}</p>
                  <p className="text-base font-black text-white leading-snug">{val}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Top stat grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard title="Drones Total"    value={fmt(stats?.drones?.total)}          icon={Plane}         loading={statsLoading} />
        <StatCard title="Flying Now"      value={fmt(stats?.drones?.flying)}         icon={Activity}      loading={statsLoading} accent />
        <StatCard title="Fields"          value={fmt(stats?.fields?.total)}          icon={Map}           loading={statsLoading} />
        <StatCard title="Disease Alerts"  value={fmt(stats?.detections?.high_severity)} icon={Leaf}       loading={statsLoading} />
        <StatCard title="Unread Alerts"   value={fmt(stats?.alerts?.unread)}         icon={AlertTriangle} loading={statsLoading} />
        <StatCard title="Missions Done"   value={fmt(stats?.flights?.completed)}     icon={CheckCircle2}  loading={statsLoading} />
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* Left: Drone Fleet */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="border-white/8 bg-white/[0.03] backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Plane className="h-4 w-4 text-primary" />
                Drone Fleet
                <Badge className="ml-auto bg-primary/10 text-primary border-primary/20 text-[10px]">
                  {drones.length} units
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {dronesLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
                ))
              ) : drones.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No drones in database</p>
              ) : (
                drones.map((drone) => (
                  <div key={drone.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 hover:border-white/10 transition-all">
                    <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-lg bg-white/5', DRONE_STATUS_COLOR[drone.status])}>
                      ✈️
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold truncate">{drone.name}</p>
                        <span className={cn('text-[10px] font-bold uppercase', DRONE_STATUS_COLOR[drone.status])}>
                          {drone.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{drone.model}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <Battery className="h-3 w-3 text-muted-foreground" />
                        <span className={cn('text-xs font-bold',
                          drone.battery_level > 50 ? 'text-emerald-400'
                          : drone.battery_level > 20 ? 'text-amber-400'
                          : 'text-red-400'
                        )}>
                          {drone.battery_level}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Fleet summary */}
              {!dronesLoading && drones.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { label: 'Flying',  val: stats?.drones?.flying,  color: 'text-emerald-400' },
                    { label: 'Idle',    val: stats?.drones?.idle,    color: 'text-sky-400' },
                    { label: 'Avg Bat', val: `${fmt(avgBattery, 0)}%`, color: 'text-amber-400' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="rounded-lg bg-white/[0.03] border border-white/5 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p className={cn('text-sm font-black', color)}>{val ?? '—'}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sensor Readings */}
          <Card className="border-white/8 bg-white/[0.03] backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4 text-primary" />
                Field Sensors (24h avg)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="grid grid-cols-2 gap-2">
                  {Array(4).fill(0).map((_, i) => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Temperature', val: stats?.sensorAverages?.avg_temp != null ? `${fmt(stats?.sensorAverages?.avg_temp, 1)}°C` : 'No data', icon: Thermometer, color: 'text-orange-400' },
                    { label: 'Humidity',    val: stats?.sensorAverages?.avg_humidity != null ? `${fmt(stats?.sensorAverages?.avg_humidity, 1)}%` : 'No data', icon: Droplets, color: 'text-sky-400' },
                    { label: 'Soil Moisture', val: stats?.sensorAverages?.avg_soil_moisture != null ? `${fmt(stats?.sensorAverages?.avg_soil_moisture, 1)}%` : 'No data', icon: Wind, color: 'text-emerald-400' },
                    { label: 'NDVI Index',  val: stats?.sensorAverages?.avg_ndvi != null ? fmt(stats?.sensorAverages?.avg_ndvi, 3) : 'No data', icon: Leaf, color: 'text-primary' },
                  ].map(({ label, val, icon: Icon, color }) => (
                    <div key={label} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className={cn('h-3 w-3', color)} />
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
                      </div>
                      <p className={cn('text-base font-black', color)}>{val}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Center: Disease Detections */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="border-white/8 bg-white/[0.03] backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Leaf className="h-4 w-4 text-primary" />
                Recent Disease Detections
                {!detectLoading && detections.length > 0 && (
                  <Badge className="ml-auto bg-red-500/10 text-red-400 border-red-500/20 text-[10px]">
                    {detections.filter(d => d.severity === 'high' || d.severity === 'critical').length} critical
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {detectLoading ? (
                Array(4).fill(0).map((_, i) => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)
              ) : recentDetections.length === 0 ? (
                <div className="flex flex-col items-center py-8 gap-3 text-center">
                  <Shield className="h-10 w-10 text-emerald-400 opacity-60" />
                  <p className="text-sm font-bold text-emerald-400">No detections recorded</p>
                  <p className="text-xs text-muted-foreground">All fields are healthy</p>
                </div>
              ) : (
                recentDetections.map((det) => {
                  const isHealthy = det.status === 'resolved' || det.status === 'false_positive'
                  return (
                    <div key={det.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 hover:border-white/10 transition-all">
                      <div className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-xl text-lg flex-shrink-0',
                        isHealthy ? 'bg-emerald-500/10' : 'bg-red-500/10'
                      )}>
                        {isHealthy ? '✅' : '⚠️'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'text-xs font-black uppercase px-2 py-0.5 rounded-full border',
                            isHealthy
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-red-500/15 text-red-400 border-red-500/30'
                          )}>
                            {isHealthy ? 'Healthy' : 'Diseased'}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {det.plant_type} · {(det.confidence * 100).toFixed(0)}% confidence
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full',
                          det.status === 'detected'  ? 'bg-amber-500/10 text-amber-400' :
                          det.status === 'treated'   ? 'bg-sky-500/10 text-sky-400' :
                          det.status === 'resolved'  ? 'bg-emerald-500/10 text-emerald-400' :
                          'bg-white/10 text-white/60'
                        )}>
                          {det.status}
                        </span>
                      </div>
                    </div>
                )
                })
              )}

              {/* Detection summary */}
              {!statsLoading && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    { label: 'Total',     val: fmt(stats?.detections?.total),        color: 'text-white' },
                    { label: 'Active',    val: fmt(stats?.detections?.detected),     color: 'text-amber-400' },
                    { label: 'Diseases',  val: fmt(stats?.detections?.unique_diseases), color: 'text-red-400' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="rounded-lg bg-white/[0.03] border border-white/5 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p className={cn('text-sm font-black', color)}>{val}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Field coverage */}
          <Card className="border-white/8 bg-white/[0.03] backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Layers className="h-4 w-4 text-primary" />
                Field & Crop Coverage
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="h-20 rounded-xl bg-white/5 animate-pulse" />
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Fields',      val: fmt(stats?.fields?.total), icon: Map, color: 'text-primary' },
                    { label: 'Crop Types',  val: fmt(stats?.fields?.crop_types), icon: Leaf, color: 'text-emerald-400' },
                    { label: 'Total Area',  val: `${fmt(stats?.fields?.total_area, 1)} ha`, icon: Globe, color: 'text-sky-400' },
                  ].map(({ label, val, icon: Icon, color }) => (
                    <div key={label} className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-center">
                      <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} />
                      <p className={cn('text-lg font-black', color)}>{val}</p>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Alerts & AI Status */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="border-white/8 bg-white/[0.03] backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Active Alerts
                {criticalAlerts > 0 && (
                  <Badge className="ml-auto bg-red-500/10 text-red-400 border-red-500/20 text-[10px]">
                    {criticalAlerts} critical
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alertsLoading ? (
                Array(4).fill(0).map((_, i) => <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />)
              ) : unreadAlerts.length === 0 ? (
                <div className="flex flex-col items-center py-8 gap-2">
                  <CheckCircle2 className="h-10 w-10 text-emerald-400 opacity-60" />
                  <p className="text-sm font-bold text-emerald-400">All Clear</p>
                  <p className="text-xs text-muted-foreground">No unread alerts</p>
                </div>
              ) : (
                unreadAlerts.map((alert) => (
                  <div key={alert.id} className={cn(
                    'rounded-xl border px-3 py-2.5 transition-all',
                    SEVERITY_COLOR[alert.severity] ?? 'border-white/10 bg-white/[0.03]'
                  )}>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{alert.title}</p>
                        {alert.message && (
                          <p className="text-[10px] opacity-70 mt-0.5 line-clamp-2">{alert.message}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-1">
                          <Clock className="h-2.5 w-2.5 opacity-50" />
                          <span className="text-[9px] opacity-50">
                            {new Date(alert.created_at).toLocaleDateString()}
                          </span>
                          {alert.drone_name && (
                            <span className="text-[9px] opacity-50">· {alert.drone_name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* AI Systems Status */}
          <Card className="border-white/8 bg-white/[0.03] backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Cpu className="h-4 w-4 text-primary" />
                AI System Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Disease Detection Server */}
              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <StatusDot ok={diseaseHealth?.status === 'ok'} />
                    <p className="text-xs font-bold">Disease Detection</p>
                  </div>
                  <span className={cn('text-[10px] font-bold',
                    diseaseHealth?.status === 'ok' ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {diseaseHealth ? (diseaseHealth.status === 'ok' ? 'ONLINE' : 'ERROR') : 'OFFLINE'}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">Port 8001 · YOLO + CNN Ensemble</p>
              </div>

              {/* Boundary Detection Server */}
              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <StatusDot ok={boundaryHealth?.status === 'ok'} />
                    <p className="text-xs font-bold">Field Boundary AI</p>
                  </div>
                  <span className={cn('text-[10px] font-bold',
                    boundaryHealth?.status === 'ok' ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {boundaryHealth ? (boundaryHealth.status === 'ok' ? 'ONLINE' : 'ERROR') : 'OFFLINE'}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Port 8002 · DexiNed
                  {boundaryHealth?.dexined_available === true && ' ✓'} · Gemini Vision
                </p>
              </div>

              {/* Flight statistics */}
              <div className="grid grid-cols-2 gap-2 mt-1">
                {[
                  { label: 'Flights Done',   val: fmt(stats?.flights?.completed),   color: 'text-emerald-400' },
                  { label: 'In Progress',    val: fmt(stats?.flights?.in_progress), color: 'text-primary' },
                  { label: 'Planned',        val: fmt(stats?.flights?.planned),     color: 'text-sky-400' },
                  { label: 'Dist. (km)',     val: fmt(stats?.flights?.total_distance, 1), color: 'text-white' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="rounded-lg bg-white/[0.03] border border-white/5 p-2">
                    <p className="text-[9px] text-muted-foreground uppercase">{label}</p>
                    <p className={cn('text-sm font-black', color)}>
                      {statsLoading ? '…' : val}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
