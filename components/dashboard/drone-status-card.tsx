'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { Drone } from '@/lib/db'
import { Battery, Navigation, Plane, Wrench, Zap, WifiOff } from 'lucide-react'

const statusConfig = {
  flying: { label: 'Flying', color: 'bg-primary text-primary-foreground', icon: Plane },
  idle: { label: 'Idle', color: 'bg-secondary text-secondary-foreground', icon: Navigation },
  charging: { label: 'Charging', color: 'bg-accent text-accent-foreground', icon: Zap },
  maintenance: { label: 'Maintenance', color: 'bg-amber-500 text-white', icon: Wrench },
  offline: { label: 'Offline', color: 'bg-muted text-muted-foreground', icon: WifiOff },
}

interface DroneStatusCardProps {
  drone: Drone
  onClick?: () => void
}

export function DroneStatusCard({ drone, onClick }: DroneStatusCardProps) {
  const status = statusConfig[drone.status]
  const StatusIcon = status.icon

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md hover:border-primary/50',
        drone.status === 'flying' && 'ring-2 ring-primary/20'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{drone.name}</CardTitle>
          <Badge className={status.color}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {status.label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{drone.model}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Battery className="h-4 w-4" />
              Battery
            </span>
            <span className="font-medium">{drone.battery_level}%</span>
          </div>
          <Progress
            value={drone.battery_level}
            className={cn(
              'h-2',
              drone.battery_level < 20
                ? '[&>div]:bg-destructive'
                : drone.battery_level < 50
                ? '[&>div]:bg-amber-500'
                : '[&>div]:bg-primary'
            )}
          />
        </div>

        {drone.status === 'flying' && drone.current_altitude && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Altitude</span>
            <span className="font-medium">{drone.current_altitude}m</span>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Max Flight Time</span>
          <span className="font-medium">{drone.max_flight_time} min</span>
        </div>
      </CardContent>
    </Card>
  )
}
