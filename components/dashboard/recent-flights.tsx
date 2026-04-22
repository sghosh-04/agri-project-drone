'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Flight } from '@/lib/db'
import { Plane, MapPin, Clock, Route } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const statusColors = {
  planned: 'bg-secondary text-secondary-foreground',
  in_progress: 'bg-primary text-primary-foreground',
  completed: 'bg-emerald-500 text-white',
  aborted: 'bg-amber-500 text-white',
  failed: 'bg-destructive text-destructive-foreground',
}

const missionTypeLabels: Record<string, string> = {
  survey: 'Survey',
  spray: 'Spraying',
  mapping: 'Mapping',
  monitor: 'Monitoring',
  inspection: 'Inspection',
}

interface RecentFlightsProps {
  flights: Flight[]
  maxHeight?: string
}

export function RecentFlights({ flights, maxHeight = '400px' }: RecentFlightsProps) {
  const safeFlights = Array.isArray(flights) ? flights : []
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Plane className="h-5 w-5" />
          Recent Flights
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea style={{ height: maxHeight }}>
          <div className="space-y-3 p-4 pt-0">
            {safeFlights.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Plane className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">No flights recorded</p>
              </div>
            ) : (
              safeFlights.map((flight) => (
                <div
                  key={flight.id}
                  className="flex items-start gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Route className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">
                          {missionTypeLabels[flight.mission_type] || flight.mission_type}
                        </p>
                        <p className="text-xs text-muted-foreground">{flight.drone_name}</p>
                      </div>
                      <Badge className={statusColors[flight.status]}>
                        {flight.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {flight.field_name && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {flight.field_name}
                        </span>
                      )}
                      {flight.start_time && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(flight.start_time), { addSuffix: true })}
                        </span>
                      )}
                      {flight.distance_km && (
                        <span>{flight.distance_km} km</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
