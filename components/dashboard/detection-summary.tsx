'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { PlantDetection } from '@/lib/db'
import { Bug, Leaf, AlertTriangle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

const severityColors = {
  low: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  high: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
}

const statusColors = {
  detected: 'bg-blue-500 text-white',
  confirmed: 'bg-amber-500 text-white',
  treated: 'bg-primary text-primary-foreground',
  resolved: 'bg-emerald-500 text-white',
  false_positive: 'bg-muted text-muted-foreground',
}

interface DetectionSummaryProps {
  detections: PlantDetection[]
  maxHeight?: string
}

export function DetectionSummary({ detections, maxHeight = '400px' }: DetectionSummaryProps) {
  const safeDetections = Array.isArray(detections) ? detections : []
  const activeDetections = safeDetections.filter((d) => d.status !== 'resolved' && d.status !== 'false_positive')

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bug className="h-5 w-5" />
            Disease Detections
          </CardTitle>
          <Badge variant="secondary">{activeDetections.length} active</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea style={{ height: maxHeight }}>
          <div className="space-y-3 p-4 pt-0">
            {safeDetections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Leaf className="h-12 w-12 text-primary/30 mb-3" />
                <p className="text-muted-foreground">No detections recorded</p>
                <p className="text-xs text-muted-foreground mt-1">Fields are healthy</p>
              </div>
            ) : (
              safeDetections.map((detection) => (
                <div
                  key={detection.id}
                  className={cn(
                    'rounded-lg border p-4 transition-colors',
                    severityColors[detection.severity]
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-semibold text-sm">{detection.disease_name}</span>
                      </div>
                      <p className="text-xs opacity-80">
                        {detection.plant_type} - {(detection.confidence * 100).toFixed(0)}% confidence
                      </p>
                    </div>
                    <Badge className={statusColors[detection.status]}>
                      {detection.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs opacity-70">
                    <span>
                      {detection.affected_area_sqm && `${detection.affected_area_sqm} sqm affected`}
                    </span>
                    <span>
                      {formatDistanceToNow(new Date(detection.detection_time), { addSuffix: true })}
                    </span>
                  </div>
                  {detection.recommendations && (
                    <p className="mt-2 text-xs opacity-80 border-t border-current/10 pt-2">
                      {detection.recommendations}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
