'use client'

import { useState } from 'react'

import { DashboardLayout } from '@/components/dashboard/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import useSWR from 'swr'
import type { Mission, Drone, Field } from '@/lib/db'
import {
  Calendar,
  Plus,
  MoreHorizontal,
  Play,
  Pause,
  Clock,
  MapPin,
  Plane,
  Loader2,
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
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground' },
  scheduled: { label: 'Scheduled', color: 'bg-blue-500 text-white' },
  in_progress: { label: 'In Progress', color: 'bg-primary text-primary-foreground' },
  completed: { label: 'Completed', color: 'bg-emerald-500 text-white' },
  cancelled: { label: 'Cancelled', color: 'bg-destructive text-destructive-foreground' },
}

const missionTypeConfig = {
  survey: { label: 'Survey', color: 'bg-blue-500/10 text-blue-600' },
  spray: { label: 'Spray', color: 'bg-emerald-500/10 text-emerald-600' },
  monitor: { label: 'Monitor', color: 'bg-amber-500/10 text-amber-600' },
  mapping: { label: 'Mapping', color: 'bg-purple-500/10 text-purple-600' },
  inspection: { label: 'Inspection', color: 'bg-orange-500/10 text-orange-600' },
}

interface CreateMissionForm {
  name: string
  description: string
  mission_type: string
  status: string
  drone_id: string
  field_id: string
  scheduled_start: string
  scheduled_end: string
}

const defaultForm: CreateMissionForm = {
  name: '',
  description: '',
  mission_type: '',
  status: 'draft',
  drone_id: 'none',
  field_id: 'none',
  scheduled_start: '',
  scheduled_end: '',
}

export default function MissionsPage() {
  const { data: missions, isLoading, mutate } = useSWR<Mission[]>('/api/missions', fetcher, {
    refreshInterval: 30000,
  })
  
  const { data: drones } = useSWR<Drone[]>('/api/drones', fetcher)
  const { data: fields } = useSWR<Field[]>('/api/fields', fetcher)

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CreateMissionForm>(defaultForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stats = Array.isArray(missions)
    ? {
        total: missions.length,
        scheduled: missions.filter((m) => m.status === 'scheduled').length,
        inProgress: missions.filter((m) => m.status === 'in_progress').length,
        completed: missions.filter((m) => m.status === 'completed').length,
      }
    : null

  const handleStatusChange = async (id: number, newStatus: string) => {
    await fetch('/api/missions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    })
    mutate()
  }

  const handleChange = (key: keyof CreateMissionForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    setError(null)
    if (!form.name || !form.mission_type) {
      setError('Name and Mission Type are required.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        mission_type: form.mission_type,
        status: form.status,
        drone_id: form.drone_id !== 'none' ? form.drone_id : null,
        field_id: form.field_id !== 'none' ? form.field_id : null,
        scheduled_start: form.scheduled_start || null,
        scheduled_end: form.scheduled_end || null,
      }

      const res = await fetch('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create mission')
      }

      await mutate()
      setOpen(false)
      setForm(defaultForm)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardLayout title="Missions">
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
                  <p className="text-sm text-muted-foreground">Total Missions</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                  <p className="text-2xl font-bold text-blue-500">{stats.scheduled}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold text-primary">{stats.inProgress}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-emerald-500">{stats.completed}</p>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">All Missions</h2>
          
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(defaultForm); setError(null) } }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Mission
              </Button>
            </DialogTrigger>
            
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Mission</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 py-2">
                {/* Name & Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Mission Name <span className="text-destructive">*</span></Label>
                    <Input 
                      placeholder="e.g. Morning Scan" 
                      value={form.name} 
                      onChange={(e) => handleChange('name', e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mission Type <span className="text-destructive">*</span></Label>
                    <Select value={form.mission_type} onValueChange={(v) => handleChange('mission_type', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(missionTypeConfig).map(([key, conf]) => (
                          <SelectItem key={key} value={key}>{conf.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input 
                    placeholder="Optional details" 
                    value={form.description} 
                    onChange={(e) => handleChange('description', e.target.value)} 
                  />
                </div>

                {/* Status & Assignments */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => handleChange('status', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Assign Field</Label>
                    <Select value={form.field_id} onValueChange={(v) => handleChange('field_id', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {Array.isArray(fields) && fields.map((f) => (
                          <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Assign Drone</Label>
                    <Select value={form.drone_id} onValueChange={(v) => handleChange('drone_id', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {Array.isArray(drones) && drones.map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Scheduling */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Scheduled Start (Optional)</Label>
                    <Input 
                      type="datetime-local" 
                      value={form.scheduled_start} 
                      onChange={(e) => handleChange('scheduled_start', e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Scheduled End (Optional)</Label>
                    <Input 
                      type="datetime-local" 
                      value={form.scheduled_end} 
                      onChange={(e) => handleChange('scheduled_end', e.target.value)} 
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                    {error}
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Create Mission'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Missions Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mission</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Drone</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Scheduled</TableHead>
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
                          <Skeleton className="h-10 w-40" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-28" />
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
                  Array.isArray(missions) && missions.map((mission) => {
                    const status = statusConfig[mission.status]
                    const type = missionTypeConfig[mission.mission_type]
                    return (
                      <TableRow key={mission.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                              <Calendar className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{mission.name}</p>
                              {mission.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {mission.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={type.color}>{type.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={status.color}>{status.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {mission.drone_name ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Plane className="h-3 w-3 text-muted-foreground" />
                              {mission.drone_name}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {mission.field_name ? (
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              {mission.field_name}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {mission.scheduled_start ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {format(new Date(mission.scheduled_start), 'MMM d, HH:mm')}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Not scheduled</span>
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
                              <DropdownMenuItem>Edit Mission</DropdownMenuItem>
                              {mission.status === 'scheduled' && (
                                <DropdownMenuItem
                                  onClick={() => handleStatusChange(mission.id, 'in_progress')}
                                >
                                  <Play className="h-4 w-4 mr-2" />
                                  Start Mission
                                </DropdownMenuItem>
                              )}
                              {mission.status === 'in_progress' && (
                                <DropdownMenuItem
                                  onClick={() => handleStatusChange(mission.id, 'completed')}
                                >
                                  <Pause className="h-4 w-4 mr-2" />
                                  Complete Mission
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleStatusChange(mission.id, 'cancelled')}
                              >
                                Cancel Mission
                              </DropdownMenuItem>
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
