'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/dashboard/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import useSWR from 'swr'
import type { Field } from '@/lib/db'
import {
  Tractor,
  MapPin,
  Droplets,
  Calendar,
  Plus,
  MoreHorizontal,
  Wheat,
  Leaf,
  TreeDeciduous,
  Loader2,
} from 'lucide-react'
import { format } from 'date-fns'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const cropIcons: Record<string, typeof Wheat> = {
  Rice: Wheat,
  Corn: Wheat,
  Vegetables: Leaf,
  Mango: TreeDeciduous,
}

const cropColors: Record<string, string> = {
  Rice: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  Corn: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  Vegetables: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  Mango: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
}

const CROP_TYPES = ['Rice', 'Corn', 'Vegetables', 'Mango', 'Wheat', 'Soybean', 'Other']
const SOIL_TYPES = ['Clay', 'Sandy', 'Loamy', 'Silty', 'Peaty', 'Chalky']
const IRRIGATION_TYPES = ['Drip', 'Sprinkler', 'Flood', 'Rain-fed', 'Furrow']

interface AddFieldForm {
  name: string
  description: string
  area_hectares: string
  crop_type: string
  soil_type: string
  irrigation_type: string
  center_lat: string
  center_lng: string
  planting_date: string
  expected_harvest: string
}

const defaultForm: AddFieldForm = {
  name: '',
  description: '',
  area_hectares: '',
  crop_type: '',
  soil_type: '',
  irrigation_type: '',
  center_lat: '',
  center_lng: '',
  planting_date: '',
  expected_harvest: '',
}

export default function FieldsPage() {
  const { data: fields, isLoading, mutate } = useSWR<Field[]>('/api/fields', fetcher)

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<AddFieldForm>(defaultForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stats = Array.isArray(fields)
    ? {
        total: fields.length,
        totalArea: fields.reduce((sum, f) => sum + Number(f.area_hectares), 0),
        cropTypes: [...new Set(fields.map((f) => f.crop_type))].length,
      }
    : null

  const handleChange = (key: keyof AddFieldForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    setError(null)

    if (!form.name || !form.crop_type || !form.area_hectares) {
      setError('Please fill in Field Name, Crop Type, and Area.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        area_hectares: parseFloat(form.area_hectares),
        crop_type: form.crop_type,
        soil_type: form.soil_type || null,
        irrigation_type: form.irrigation_type || null,
        center_lat: form.center_lat ? parseFloat(form.center_lat) : null,
        center_lng: form.center_lng ? parseFloat(form.center_lng) : null,
        boundary_coords: [],
        planting_date: form.planting_date || null,
        expected_harvest: form.expected_harvest || null,
      }

      const res = await fetch('/api/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create field')
      }

      await mutate()
      setOpen(false)
      setForm(defaultForm)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardLayout title="Fields">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          {isLoading ? (
            Array(3)
              .fill(0)
              .map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-20 mb-2" />
                    <Skeleton className="h-8 w-24" />
                  </CardContent>
                </Card>
              ))
          ) : stats ? (
            <>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Total Fields</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Total Area</p>
                  <p className="text-2xl font-bold">{stats.totalArea.toFixed(1)} ha</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Crop Types</p>
                  <p className="text-2xl font-bold">{stats.cropTypes}</p>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        {/* Header with Add Field Dialog */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">All Fields</h2>

          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(defaultForm); setError(null) } }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Field
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Field</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Required */}
                <div className="space-y-2">
                  <Label htmlFor="field-name">
                    Field Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="field-name"
                    placeholder="e.g. North Rice Paddy"
                    value={form.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="crop-type">
                      Crop Type <span className="text-destructive">*</span>
                    </Label>
                    <Select value={form.crop_type} onValueChange={(v) => handleChange('crop_type', v)}>
                      <SelectTrigger id="crop-type">
                        <SelectValue placeholder="Select crop" />
                      </SelectTrigger>
                      <SelectContent>
                        {CROP_TYPES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="area">
                      Area (hectares) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="area"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="e.g. 5.5"
                      value={form.area_hectares}
                      onChange={(e) => handleChange('area_hectares', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="Optional notes about this field"
                    value={form.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="soil-type">Soil Type</Label>
                    <Select value={form.soil_type} onValueChange={(v) => handleChange('soil_type', v)}>
                      <SelectTrigger id="soil-type">
                        <SelectValue placeholder="Select soil" />
                      </SelectTrigger>
                      <SelectContent>
                        {SOIL_TYPES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="irrigation">Irrigation Type</Label>
                    <Select value={form.irrigation_type} onValueChange={(v) => handleChange('irrigation_type', v)}>
                      <SelectTrigger id="irrigation">
                        <SelectValue placeholder="Select irrigation" />
                      </SelectTrigger>
                      <SelectContent>
                        {IRRIGATION_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* GPS */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lat">Center Latitude</Label>
                    <Input
                      id="lat"
                      type="number"
                      step="any"
                      placeholder="e.g. 14.5995"
                      value={form.center_lat}
                      onChange={(e) => handleChange('center_lat', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lng">Center Longitude</Label>
                    <Input
                      id="lng"
                      type="number"
                      step="any"
                      placeholder="e.g. 120.9842"
                      value={form.center_lng}
                      onChange={(e) => handleChange('center_lng', e.target.value)}
                    />
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="planting-date">Planting Date</Label>
                    <Input
                      id="planting-date"
                      type="date"
                      value={form.planting_date}
                      onChange={(e) => handleChange('planting_date', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="harvest-date">Expected Harvest</Label>
                    <Input
                      id="harvest-date"
                      type="date"
                      value={form.expected_harvest}
                      onChange={(e) => handleChange('expected_harvest', e.target.value)}
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
                    'Add Field'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Fields Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array(6)
                .fill(0)
                .map((_, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <Skeleton className="h-6 w-32" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardContent>
                  </Card>
                ))
            : Array.isArray(fields) && fields.map((field) => {
                const CropIcon = cropIcons[field.crop_type] || Tractor
                const colorClass = cropColors[field.crop_type] || 'bg-muted text-muted-foreground'

                return (
                  <Card key={field.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`rounded-lg p-2 ${colorClass}`}>
                            <CropIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{field.name}</CardTitle>
                            <p className="text-sm text-muted-foreground">{field.crop_type}</p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Schedule Survey</DropdownMenuItem>
                            <DropdownMenuItem>Edit Field</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {field.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {field.description}
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span>{field.area_hectares} hectares</span>
                        </div>
                        {field.soil_type && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Tractor className="h-4 w-4" />
                            <span>{field.soil_type}</span>
                          </div>
                        )}
                        {field.irrigation_type && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Droplets className="h-4 w-4" />
                            <span>{field.irrigation_type}</span>
                          </div>
                        )}
                        {field.expected_harvest && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>{format(new Date(field.expected_harvest), 'MMM d')}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Badge variant="secondary" className="text-xs">
                          {field.planting_date
                            ? `Planted ${format(new Date(field.planting_date), 'MMM d')}`
                            : 'Not planted'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
        </div>

        {/* Empty state */}
        {!isLoading && Array.isArray(fields) && fields.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Leaf className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-2">No fields yet</p>
            <p className="text-sm mb-6">Add your first field to start monitoring it.</p>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Field
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
