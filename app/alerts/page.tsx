'use client'

import { DashboardLayout } from '@/components/dashboard/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import useSWR from 'swr'
import type { Alert } from '@/lib/db'
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  Info,
  XCircle,
  Clock,
  Plane,
  MapPin,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const severityConfig = {
  info: { icon: Info, color: 'text-blue-500', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/20' },
  warning: { icon: AlertTriangle, color: 'text-amber-500', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/20' },
  error: { icon: XCircle, color: 'text-destructive', bgColor: 'bg-destructive/10', borderColor: 'border-destructive/20' },
  critical: { icon: AlertTriangle, color: 'text-destructive', bgColor: 'bg-destructive/10', borderColor: 'border-destructive/20' },
}

export default function AlertsPage() {
  const { data: alerts, isLoading, mutate } = useSWR<Alert[]>('/api/alerts', fetcher, {
    refreshInterval: 30000,
  })

  const stats = Array.isArray(alerts)
    ? {
        total: alerts.length,
        unread: alerts.filter((a) => !a.is_read).length,
        unresolved: alerts.filter((a) => !a.is_resolved).length,
        critical: alerts.filter((a) => a.severity === 'critical' && !a.is_resolved).length,
      }
    : null

  const handleMarkAsRead = async (id: number) => {
    await fetch('/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_read: true }),
    })
    mutate()
  }

  const handleResolve = async (id: number) => {
    await fetch('/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_resolved: true }),
    })
    mutate()
  }

  const handleMarkAllAsRead = async () => {
    const unreadAlerts = Array.isArray(alerts) ? alerts.filter((a) => !a.is_read) : []
    await Promise.all(
      unreadAlerts.map((alert) =>
        fetch('/api/alerts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: alert.id, is_read: true }),
        })
      )
    )
    mutate()
  }

  const unresolvedAlerts = Array.isArray(alerts) ? alerts.filter((a) => !a.is_resolved) : []
  const resolvedAlerts = Array.isArray(alerts) ? alerts.filter((a) => a.is_resolved) : []

  const AlertCard = ({ alert }: { alert: Alert }) => {
    const severity = severityConfig[alert.severity]
    const SeverityIcon = severity.icon

    return (
      <Card
        className={cn(
          'transition-all hover:shadow-md',
          !alert.is_read && 'ring-1 ring-primary/20',
          severity.borderColor
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className={cn('rounded-full p-2', severity.bgColor)}>
              <SeverityIcon className={cn('h-5 w-5', severity.color)} />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{alert.title}</h3>
                  {alert.message && (
                    <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                  )}
                </div>
                <Badge
                  variant={
                    alert.severity === 'critical'
                      ? 'destructive'
                      : alert.severity === 'warning'
                      ? 'default'
                      : 'secondary'
                  }
                >
                  {alert.severity}
                </Badge>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                </span>
                {alert.drone_name && (
                  <span className="flex items-center gap-1">
                    <Plane className="h-3 w-3" />
                    {alert.drone_name}
                  </span>
                )}
                {alert.field_name && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {alert.field_name}
                  </span>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                {!alert.is_read && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMarkAsRead(alert.id)}
                  >
                    Mark as Read
                  </Button>
                )}
                {!alert.is_resolved && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleResolve(alert.id)}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Resolve
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <DashboardLayout title="Alerts">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          {isLoading ? (
            Array(4)
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
                  <p className="text-sm text-muted-foreground">Total Alerts</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Unread</p>
                  <p className="text-2xl font-bold text-blue-500">{stats.unread}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Unresolved</p>
                  <p className="text-2xl font-bold text-amber-500">{stats.unresolved}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Critical</p>
                  <p className="text-2xl font-bold text-destructive">{stats.critical}</p>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        {/* Alerts Tabs */}
        <Tabs defaultValue="active" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="active">
                Active
                {unresolvedAlerts.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {unresolvedAlerts.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
            </TabsList>
            {stats && stats.unread > 0 && (
              <Button variant="outline" onClick={handleMarkAllAsRead}>
                Mark All as Read
              </Button>
            )}
          </div>

          <TabsContent value="active" className="space-y-4">
            {isLoading ? (
              Array(3)
                .fill(0)
                .map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-5 w-48" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
            ) : unresolvedAlerts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-primary/30 mb-4" />
                  <h3 className="font-semibold text-lg">All Clear</h3>
                  <p className="text-muted-foreground">No active alerts at this time</p>
                </CardContent>
              </Card>
            ) : (
              unresolvedAlerts.map((alert) => <AlertCard key={alert.id} alert={alert} />)
            )}
          </TabsContent>

          <TabsContent value="resolved" className="space-y-4">
            {isLoading ? (
              Array(3)
                .fill(0)
                .map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-5 w-48" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
            ) : resolvedAlerts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Bell className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <h3 className="font-semibold text-lg">No Resolved Alerts</h3>
                  <p className="text-muted-foreground">Resolved alerts will appear here</p>
                </CardContent>
              </Card>
            ) : (
              resolvedAlerts.map((alert) => (
                <div key={alert.id} className="opacity-60">
                  <AlertCard alert={alert} />
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
