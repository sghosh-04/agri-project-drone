'use client'

import { DashboardLayout } from '@/components/dashboard/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import useSWR from 'swr'
import type { Drone } from '@/lib/db'
import {
  Plane,
  Battery,
  Clock,
  Gauge,
  MapPin,
  Wrench,
  Plus,
  MoreHorizontal,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const statusConfig = {
  flying: { label: 'Flying', color: 'bg-primary text-primary-foreground' },
  idle: { label: 'Idle', color: 'bg-secondary text-secondary-foreground' },
  charging: { label: 'Charging', color: 'bg-amber-500 text-white' },
  maintenance: { label: 'Maintenance', color: 'bg-orange-500 text-white' },
  offline: { label: 'Offline', color: 'bg-muted text-muted-foreground' },
}

export default function DronesPage() {
  const { data: drones, isLoading } = useSWR<Drone[]>('/api/drones', fetcher, {
    refreshInterval: 10000,
  })

  const stats = Array.isArray(drones)
    ? {
        total: drones.length,
        flying: drones.filter((d) => d.status === 'flying').length,
        idle: drones.filter((d) => d.status === 'idle').length,
        charging: drones.filter((d) => d.status === 'charging').length,
        maintenance: drones.filter((d) => d.status === 'maintenance').length,
        avgBattery: drones.length > 0 ? Math.round(
          drones.reduce((sum, d) => sum + d.battery_level, 0) / drones.length
        ) : 0,
      }
    : null

  return (
    <DashboardLayout title="Drone Fleet">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {isLoading ? (
            Array(5)
              .fill(0)
              .map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-20 mb-2" />
                    <Skeleton className="h-8 w-12" />
                  </CardContent>
                </Card>
              ))
          ) : stats ? (
            <>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Total Drones</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Flying</p>
                  <p className="text-2xl font-bold text-primary">{stats.flying}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Idle</p>
                  <p className="text-2xl font-bold">{stats.idle}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Charging</p>
                  <p className="text-2xl font-bold text-amber-500">{stats.charging}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Avg Battery</p>
                  <p className="text-2xl font-bold">{stats.avgBattery}%</p>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">All Drones</h2>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Drone
          </Button>
        </div>

        {/* Drones Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Drone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Battery</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Max Flight Time</TableHead>
                  <TableHead>Last Maintenance</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(5)
                    .fill(0)
                    .map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-10 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-8 w-8" />
                        </TableCell>
                      </TableRow>
                    ))
                ) : (
                  Array.isArray(drones) && drones.map((drone) => {
                    const status = statusConfig[drone.status]
                    return (
                      <TableRow key={drone.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                              <Plane className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{drone.name}</p>
                              <p className="text-xs text-muted-foreground">{drone.model}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={status.color}>{status.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 w-32">
                            <Battery
                              className={cn(
                                'h-4 w-4',
                                drone.battery_level < 20
                                  ? 'text-destructive'
                                  : drone.battery_level < 50
                                  ? 'text-amber-500'
                                  : 'text-primary'
                              )}
                            />
                            <Progress
                              value={drone.battery_level}
                              className={cn(
                                'h-2 flex-1',
                                drone.battery_level < 20
                                  ? '[&>div]:bg-destructive'
                                  : drone.battery_level < 50
                                  ? '[&>div]:bg-amber-500'
                                  : '[&>div]:bg-primary'
                              )}
                            />
                            <span className="text-sm w-10">{drone.battery_level}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {drone.current_lat && drone.current_lng ? (
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span>
                                {Number(drone.current_lat).toFixed(4)}, {Number(drone.current_lng).toFixed(4)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {drone.max_flight_time} min
                          </div>
                        </TableCell>
                        <TableCell>
                          {drone.last_maintenance ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Wrench className="h-3 w-3 text-muted-foreground" />
                              {formatDistanceToNow(new Date(drone.last_maintenance), { addSuffix: true })}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>View Details</DropdownMenuItem>
                              <DropdownMenuItem>Start Mission</DropdownMenuItem>
                              <DropdownMenuItem>Schedule Maintenance</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive">Disable</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
