'use client'

import { DashboardLayout } from '@/components/dashboard/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import useSWR from 'swr'
import type { PlantDetection } from '@/lib/db'
import {
  Bug,
  Sprout,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  Filter,
  FlaskConical,
  Microscope,
  ShieldAlert,
  Worm,
  Leaf,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const severityConfig = {
  low: { label: 'Low', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  medium: { label: 'Medium', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  high: { label: 'High', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  critical: { label: 'Critical', color: 'bg-destructive/10 text-destructive border-destructive/20' },
}

const statusConfig = {
  detected: { label: 'Detected', color: 'bg-blue-500 text-white' },
  confirmed: { label: 'Confirmed', color: 'bg-amber-500 text-white' },
  treated: { label: 'Treated', color: 'bg-primary text-primary-foreground' },
  resolved: { label: 'Resolved', color: 'bg-emerald-500 text-white' },
  false_positive: { label: 'False Positive', color: 'bg-muted text-muted-foreground' },
}

function getCategoryIcon(diseaseName: string) {
  const lower = (diseaseName || '').toLowerCase()
  if (lower.includes('virus') || lower.includes('mosaic') || lower.includes('curl')) {
    return { icon: ShieldAlert, color: 'text-red-500', label: 'Viral' }
  }
  if (lower.includes('bacterial') || lower.includes('spot') || lower.includes('blight') && lower.includes('bacterial')) {
    return { icon: Microscope, color: 'text-blue-500', label: 'Bacterial' }
  }
  if (lower.includes('mite') || lower.includes('pest') || lower.includes('worm') || lower.includes('insect')) {
    return { icon: Worm, color: 'text-amber-500', label: 'Pest' }
  }
  if (lower === 'healthy') {
    return { icon: CheckCircle, color: 'text-emerald-500', label: 'Healthy' }
  }
  return { icon: FlaskConical, color: 'text-purple-500', label: 'Fungal' }
}

export default function DetectionsPage() {
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { data: detections, isLoading, mutate } = useSWR<PlantDetection[]>(`${process.env.NEXT_PUBLIC_BACKEND_URL}/detect`, fetcher, {
    refreshInterval: 30000,
  })

  const stats = Array.isArray(detections)
    ? {
      total: detections.length,
      active: detections.filter((d) => d.status !== 'resolved' && d.status !== 'false_positive').length,
      critical: detections.filter((d) => d.severity === 'critical' || d.severity === 'high').length,
      resolved: detections.filter((d) => d.status === 'resolved').length,
    }
    : null

  const handleStatusChange = async (id: number, newStatus: string) => {
    await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/detect`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    })
    mutate()
  }

  const filteredDetections = Array.isArray(detections) ? detections.filter((d) => {
    if (severityFilter !== 'all' && d.severity !== severityFilter) return false
    if (statusFilter !== 'all' && d.status !== statusFilter) return false
    return true
  }) : []

  const DetectionCard = ({ detection }: { detection: PlantDetection }) => {
    const severity = severityConfig[detection.severity as keyof typeof severityConfig] ?? severityConfig.low
    const status = statusConfig[detection.status as keyof typeof statusConfig] ?? statusConfig.detected
    const catInfo = getCategoryIcon(detection.disease_name)
    const CatIcon = catInfo.icon
    const isHealthy = detection.disease_name === 'Healthy'

    return (
      <Card className={cn('transition-all hover:scale-[1.01] border-white/5 bg-white/5 backdrop-blur-md overflow-hidden relative group')}>
        <div className={cn('absolute inset-y-0 left-0 w-1', severity.color.split(' ')[1].replace('text-', 'bg-'))} />
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="rounded-xl p-3 bg-white/5 border border-white/10 shadow-inner group-hover:border-primary/50 transition-colors">
                {isHealthy
                  ? <CheckCircle className="h-6 w-6 text-primary" />
                  : <Bug className="h-6 w-6 text-destructive" />
                }
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold tracking-tight">
                    {isHealthy ? 'Healthy Vegetation' : (detection.disease_name || 'Anomaly Detected')}
                  </h3>
                  <Badge className={cn("rounded-md font-bold px-2 py-0 border-0", status.color)}>{status.label}</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    <ShieldAlert className="h-3 w-3" />
                    {(detection.confidence * 100).toFixed(0)}% Confidence
                  </div>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(detection.detection_time), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 text-right">
              <Badge variant="outline" className={cn("font-bold tracking-widest uppercase text-[10px] py-1 px-3", severity.color)}>
                {severity.label} Severity
              </Badge>
              {detection.lat && detection.lng && (
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground bg-white/5 px-2 py-1 rounded-md border border-white/5">
                  <MapPin className="h-3 w-3 text-primary" />
                  {Number(detection.lat).toFixed(4)}, {Number(detection.lng).toFixed(4)}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              {!isHealthy && (
                <div className="flex flex-wrap gap-2">
                  <span className={cn('flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-bold', catInfo.color)}>
                    <CatIcon className="h-4 w-4" />
                    {catInfo.label} Pathogen
                  </span>
                  {/* <span className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-muted-foreground">
                    <Leaf className="h-4 w-4" />
                    Leaf Tissue
                  </span> */}
                </div>
              )}

              {detection.recommendations && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 relative overflow-hidden group/rec">
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover/rec:opacity-20 transition-opacity">
                    <FlaskConical className="h-12 w-12" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Diagnostic Guidance</p>
                  <p className="text-sm font-medium text-foreground italic leading-relaxed">"{detection.recommendations}"</p>
                </div>
              )}
            </div>

            <div className="flex items-end justify-end gap-3 self-end">
              {detection.status !== 'resolved' && detection.status !== 'false_positive' && (
                <>
                  {detection.status === 'detected' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="bg-white/10 hover:bg-white/20 border-white/10 font-bold"
                      onClick={() => handleStatusChange(detection.id, 'confirmed')}
                    >
                      Verify Detection
                    </Button>
                  )}
                  {detection.status === 'confirmed' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="bg-primary/20 hover:bg-primary/30 text-primary border-primary/20 font-bold"
                      onClick={() => handleStatusChange(detection.id, 'treated')}
                    >
                      Log Treatment
                    </Button>
                  )}
                  {detection.status === 'treated' && (
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20"
                      onClick={() => handleStatusChange(detection.id, 'resolved')}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Resolve Alert
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 font-medium"
                    onClick={() => handleStatusChange(detection.id, 'false_positive')}
                  >
                    Flag as Mis-id
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <DashboardLayout title="Agriculture Disease Detections">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          {isLoading ? (
            Array(4).fill(0).map((_, i) => (
              <Card key={i} className="bg-white/5 border-white/5 h-24 animate-pulse" />
            ))
          ) : stats ? (
            <>
              <Card className="bg-white/5 border-white/5 backdrop-blur-md">
                <CardContent className="p-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Detections</p>
                  <p className="text-3xl font-bold tracking-tight">{stats.total}</p>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/5 backdrop-blur-md">
                <CardContent className="p-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Active Issues</p>
                  <p className="text-3xl font-bold tracking-tight text-primary">{stats.active}</p>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/5 backdrop-blur-md">
                <CardContent className="p-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">High / Critical</p>
                  <p className="text-3xl font-bold tracking-tight text-destructive">{stats.critical}</p>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/5 backdrop-blur-md">
                <CardContent className="p-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Resolved</p>
                  <p className="text-3xl font-bold tracking-tight text-primary/80">{stats.resolved}</p>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap bg-white/5 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Filters</span>
          </div>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-40 bg-white/5 border-white/10 rounded-xl">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent className="bg-background/95 backdrop-blur-xl border-white/10">
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 bg-white/5 border-white/10 rounded-xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-background/95 backdrop-blur-xl border-white/10">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="detected">Detected</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="treated">Treated</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="false_positive">False Positive</SelectItem>
            </SelectContent>
          </Select>
          {(severityFilter !== 'all' || statusFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              className="text-primary hover:text-primary hover:bg-primary/10 rounded-xl"
              onClick={() => { setSeverityFilter('all'); setStatusFilter('all') }}
            >
              Clear Filters
            </Button>
          )}
        </div>

        {/* Detections List */}
        <div className="space-y-4">
          {isLoading ? (
            Array(4).fill(0).map((_, i) => (
              <Card key={i} className="bg-white/5 border-white/5 h-48 animate-pulse rounded-2xl" />
            ))
          ) : filteredDetections?.length === 0 ? (
            <Card className="bg-white/5 border-white/5 border-dashed border-2 rounded-3xl">
              <CardContent className="flex flex-col items-center justify-center py-20">
                <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/10">
                  <Sprout className="h-8 w-8 text-primary/40" />
                </div>
                <h3 className="font-bold text-xl tracking-tight mb-2">No Detections Found</h3>
                <p className="text-muted-foreground text-center max-w-xs px-6">
                  {severityFilter !== 'all' || statusFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'System is currently reporting nominal health across all sectors.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredDetections?.map((detection) => (
              <DetectionCard key={detection.id} detection={detection} />
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
