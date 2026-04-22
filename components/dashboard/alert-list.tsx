'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { Alert } from '@/lib/db'
import { AlertTriangle, Bell, CheckCircle, Info, XCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const severityConfig = {
  info: { icon: Info, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  warning: { icon: AlertTriangle, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  error: { icon: XCircle, color: 'text-destructive', bgColor: 'bg-destructive/10' },
  critical: { icon: AlertTriangle, color: 'text-destructive', bgColor: 'bg-destructive/10' },
}

interface AlertListProps {
  alerts: Alert[]
  onMarkAsRead?: (id: number) => void
  onResolve?: (id: number) => void
  maxHeight?: string
}

export function AlertList({ alerts, onMarkAsRead, onResolve, maxHeight = '400px' }: AlertListProps) {
  const safeAlerts = Array.isArray(alerts) ? alerts : []
  const unresolved = safeAlerts.filter((a) => !a.is_resolved)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5" />
            Recent Alerts
          </CardTitle>
          <Badge variant="secondary">{unresolved.length} active</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea style={{ height: maxHeight }}>
          <div className="space-y-1 p-4 pt-0">
            {safeAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle className="h-12 w-12 text-primary/30 mb-3" />
                <p className="text-muted-foreground">No alerts at this time</p>
              </div>
            ) : (
              safeAlerts.map((alert) => {
                const severity = severityConfig[alert.severity]
                const SeverityIcon = severity.icon

                return (
                  <div
                    key={alert.id}
                    className={cn(
                      'flex items-start gap-3 rounded-lg p-3 transition-colors',
                      !alert.is_read && 'bg-muted/50',
                      alert.is_resolved && 'opacity-60'
                    )}
                  >
                    <div className={cn('rounded-full p-2', severity.bgColor)}>
                      <SeverityIcon className={cn('h-4 w-4', severity.color)} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm leading-tight">{alert.title}</p>
                        <Badge
                          variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}
                          className="shrink-0 text-xs"
                        >
                          {alert.severity}
                        </Badge>
                      </div>
                      {alert.message && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{alert.message}</p>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                        </span>
                        <div className="flex gap-2">
                          {!alert.is_read && onMarkAsRead && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => onMarkAsRead(alert.id)}
                            >
                              Mark read
                            </Button>
                          )}
                          {!alert.is_resolved && onResolve && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-primary"
                              onClick={() => onResolve(alert.id)}
                            >
                              Resolve
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
