'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/dashboard/layout'
import dynamic from 'next/dynamic'

const DroneMap = dynamic(
  () => import('@/components/map/drone-map').then((mod) => mod.DroneMap),
  { ssr: false }
)
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import useSWR from 'swr'
import type { Drone, Field, PlantDetection, SensorData } from '@/lib/db'
import {
  Plane,
  Map,
  Bug,
  Layers,
  Battery,
  Navigation,
  MapPin,
  Maximize2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const statusColors = {
  flying: 'bg-primary text-primary-foreground',
  idle: 'bg-secondary text-secondary-foreground',
  charging: 'bg-amber-500 text-white',
  maintenance: 'bg-orange-500 text-white',
  offline: 'bg-muted text-muted-foreground',
}

export default function MapPage() {
  const [manualLocation, setManualLocation] = useState<[number, number] | null>(null)
  const [latInput, setLatInput] = useState('')
  const [lngInput, setLngInput] = useState('')

  const [selectedDrone, setSelectedDrone] = useState<Drone | null>(null)
  const [selectedField, setSelectedField] = useState<Field | null>(null)
  const [showDetections, setShowDetections] = useState(true)
  const [showSensorPath, setShowSensorPath] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const { data: drones, isLoading: dronesLoading } = useSWR<Drone[]>('/api/drones', fetcher, {
    refreshInterval: 5000,
  })
  const { data: fields, isLoading: fieldsLoading } = useSWR<Field[]>('/api/fields', fetcher)
  const { data: detections } = useSWR<PlantDetection[]>('/api/detections', fetcher, {
    refreshInterval: 30000,
  })
  const { data: sensorData } = useSWR<SensorData[]>('/api/sensor-data?limit=50', fetcher, {
    refreshInterval: 10000,
  })

  const flyingDrones = Array.isArray(drones) ? drones.filter((d) => d.status === 'flying') : []
  const activeDetections = Array.isArray(detections) ? detections.filter((d) => d.status !== 'resolved' && d.status !== 'false_positive') : []

  const isLoading = dronesLoading || fieldsLoading

  return (
    <DashboardLayout title="Live Map">
      <div className={cn('flex gap-6 h-[calc(100vh-7rem)]', isFullscreen && 'fixed inset-0 z-50 bg-background p-6')}>
        {/* Map */}
        <div className="flex-1 relative">
          <Card className="h-full">
            <CardContent className="p-0 h-full flex flex-col items-center justify-center">
              {!manualLocation ? (
                <div className="max-w-md w-full p-6 space-y-4">
                  <div className="text-center space-y-2 mb-6">
                    <MapPin className="h-12 w-12 text-primary mx-auto opacity-50" />
                    <h2 className="text-2xl font-semibold">Enter Location</h2>
                    <p className="text-muted-foreground text-sm">Provide GPS coordinates to load the live map</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="latitude">Latitude</Label>
                      <Input
                        id="latitude"
                        placeholder="e.g., 14.5995"
                        value={latInput}
                        onChange={(e) => setLatInput(e.target.value)}
                        type="number"
                        step="any"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="longitude">Longitude</Label>
                      <Input
                        id="longitude"
                        placeholder="e.g., 120.9842"
                        value={lngInput}
                        onChange={(e) => setLngInput(e.target.value)}
                        type="number"
                        step="any"
                      />
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={() => {
                        const lat = parseFloat(latInput)
                        const lng = parseFloat(lngInput)
                        if (!isNaN(lat) && !isNaN(lng)) {
                          setManualLocation([lat, lng])
                        }
                      }}
                      disabled={!latInput || !lngInput}
                    >
                      Load Live Map
                    </Button>
                  </div>
                </div>
              ) : isLoading ? (
                <Skeleton className="h-full w-full rounded-lg" />
              ) : (
                <DroneMap
                  manualCenter={manualLocation}
                  drones={Array.isArray(drones) ? drones : []}
                  fields={Array.isArray(fields) ? fields : []}
                  detections={showDetections && Array.isArray(detections) ? detections : []}
                  sensorData={showSensorPath && Array.isArray(sensorData) ? sensorData : []}
                  selectedDrone={selectedDrone}
                  selectedField={selectedField}
                  showDetections={showDetections}
                  showSensorPath={showSensorPath}
                  onDroneClick={setSelectedDrone}
                  onFieldClick={setSelectedField}
                />
              )}
            </CardContent>
          </Card>

          {/* Map Controls */}
          <div className="absolute top-4 right-4 z-[1000] space-y-2">
            <Card className="shadow-lg">
              <CardContent className="p-3 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="show-detections" className="text-sm flex items-center gap-2">
                    <Bug className="h-4 w-4 text-destructive" />
                    Detections
                  </Label>
                  <Switch
                    id="show-detections"
                    checked={showDetections}
                    onCheckedChange={setShowDetections}
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="show-path" className="text-sm flex items-center gap-2">
                    <Navigation className="h-4 w-4 text-blue-500" />
                    Sensor Path
                  </Label>
                  <Switch
                    id="show-path"
                    checked={showSensorPath}
                    onCheckedChange={setShowSensorPath}
                  />
                </div>
              </CardContent>
            </Card>
            <Button
              variant="secondary"
              size="icon"
              className="shadow-lg"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Live Stats */}
          <div className="absolute bottom-4 left-4 z-[1000] flex gap-2">
            <Badge variant="secondary" className="bg-background/90 backdrop-blur shadow-lg py-2 px-3">
              <Plane className="h-3 w-3 mr-1 text-primary" />
              {flyingDrones.length} flying
            </Badge>
            <Badge variant="secondary" className="bg-background/90 backdrop-blur shadow-lg py-2 px-3">
              <Map className="h-3 w-3 mr-1 text-primary" />
              {fields?.length || 0} fields
            </Badge>
            <Badge variant="secondary" className="bg-background/90 backdrop-blur shadow-lg py-2 px-3">
              <Bug className="h-3 w-3 mr-1 text-destructive" />
              {activeDetections.length} issues
            </Badge>
          </div>
        </div>

        {/* Sidebar */}
        {!isFullscreen && (
          <div className="w-80 flex flex-col gap-4">
            <Tabs defaultValue="drones" className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="drones">
                  <Plane className="h-4 w-4 mr-1" />
                  Drones
                </TabsTrigger>
                <TabsTrigger value="fields">
                  <Layers className="h-4 w-4 mr-1" />
                  Fields
                </TabsTrigger>
                <TabsTrigger value="alerts">
                  <Bug className="h-4 w-4 mr-1" />
                  Issues
                </TabsTrigger>
              </TabsList>

              <TabsContent value="drones" className="flex-1 mt-4">
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Drone Fleet</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[calc(100vh-20rem)]">
                      <div className="space-y-2 p-4 pt-0">
                        {Array.isArray(drones) && drones.map((drone) => (
                          <div
                            key={drone.id}
                            className={cn(
                              'p-3 rounded-lg border cursor-pointer transition-colors',
                              selectedDrone?.id === drone.id
                                ? 'border-primary bg-primary/5'
                                : 'hover:bg-muted'
                            )}
                            onClick={() => setSelectedDrone(drone)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm">{drone.name}</span>
                              <Badge className={cn('text-xs', statusColors[drone.status])}>
                                {drone.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Battery className="h-3 w-3" />
                                {drone.battery_level}%
                              </span>
                              {drone.current_altitude && (
                                <span className="flex items-center gap-1">
                                  <Navigation className="h-3 w-3" />
                                  {drone.current_altitude}m
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="fields" className="flex-1 mt-4">
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Fields</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[calc(100vh-20rem)]">
                      <div className="space-y-2 p-4 pt-0">
                        {Array.isArray(fields) && fields.map((field) => (
                          <div
                            key={field.id}
                            className={cn(
                              'p-3 rounded-lg border cursor-pointer transition-colors',
                              selectedField?.id === field.id
                                ? 'border-primary bg-primary/5'
                                : 'hover:bg-muted'
                            )}
                            onClick={() => setSelectedField(field)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm">{field.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {field.crop_type}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {field.area_hectares} ha
                              </span>
                              {field.soil_type && <span>{field.soil_type}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="alerts" className="flex-1 mt-4">
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Active Issues</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[calc(100vh-20rem)]">
                      <div className="space-y-2 p-4 pt-0">
                        {activeDetections.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            No active issues
                          </div>
                        ) : (
                          activeDetections.map((detection) => (
                            <div
                              key={detection.id}
                              className="p-3 rounded-lg border hover:bg-muted cursor-pointer transition-colors"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-sm">
                                  {detection.disease_name === 'Healthy' ? 'Healthy' : 'Diseased'}
                                </span>
                                <Badge
                                  variant={
                                    detection.severity === 'critical' || detection.severity === 'high'
                                      ? 'destructive'
                                      : 'secondary'
                                  }
                                  className="text-xs"
                                >
                                  {detection.severity}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                <p>{detection.plant_type}</p>
                                <p>{(detection.confidence * 100).toFixed(0)}% confidence</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
