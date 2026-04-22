'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap, Circle, Polyline } from 'react-leaflet'
import L from 'leaflet'
import type { Drone, Field, PlantDetection, SensorData } from '@/lib/db'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import 'leaflet/dist/leaflet.css'

// Custom drone icon
const createDroneIcon = (status: string, isSelected: boolean) => {
  const color = status === 'flying' ? '#BFFF00' : status === 'idle' ? '#3b82f6' : status === 'charging' ? '#eab308' : '#6b7280'
  
  return L.divIcon({
    className: 'drone-marker',
    html: `
      <div style="
        width: ${isSelected ? '44px' : '36px'};
        height: ${isSelected ? '44px' : '36px'};
        background: ${color};
        border: 2px solid white;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 15px ${color}80;
        transition: all 0.3s ease;
      ">
        <svg width="${isSelected ? '20' : '16'}" height="${isSelected ? '20' : '16'}" viewBox="0 0 24 24" fill="black">
          <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
        </svg>
      </div>
    `,
    iconSize: [isSelected ? 44 : 36, isSelected ? 44 : 36],
    iconAnchor: [isSelected ? 22 : 18, isSelected ? 22 : 18],
  })
}

// Custom detection marker
const createDetectionIcon = (severity: string) => {
  const colors = {
    low: '#22c55e',
    medium: '#eab308',
    high: '#f97316',
    critical: '#ef4444',
  }
  const color = colors[severity as keyof typeof colors] || colors.medium

  return L.divIcon({
    className: 'detection-marker',
    html: `
      <div style="
        width: 24px;
        height: 24px;
        background: ${color};
        border: 2px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 10px ${color}80;
      ">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
          <path d="M12 2L2 22h20L12 2zm0 4l7.5 14h-15L12 6z"/>
        </svg>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

// Field polygon colors by crop type
const fieldColors: Record<string, string> = {
  Rice: '#BFFF00',
  Corn: '#FFD700',
  Vegetables: '#FFA500',
  Mango: '#9370DB',
  default: '#00CED1',
}

function MapController({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, 15)
  }, [center, map])
  return null
}

interface DroneMapProps {
  manualCenter?: [number, number] | null
  drones: Drone[]
  fields: Field[]
  detections?: PlantDetection[]
  sensorData?: SensorData[]
  selectedDrone?: Drone | null
  selectedField?: Field | null
  showDetections?: boolean
  showSensorPath?: boolean
  onDroneClick?: (drone: Drone) => void
  onFieldClick?: (field: Field) => void
}

export function DroneMap({
  manualCenter,
  drones,
  fields,
  detections = [],
  sensorData = [],
  selectedDrone,
  selectedField,
  showDetections = true,
  showSensorPath = false,
  onDroneClick,
  onFieldClick,
}: DroneMapProps) {
  const [mapEpoch, setMapEpoch] = useState(0)

  useEffect(() => {
    return () => {
      // Force a new map key on unmount to bypass React 18 Strict Mode DOM recycling bugs
      setMapEpoch((prev) => prev + 1)
    }
  }, [])

  // Calculate center from fields or use default
  const center: [number, number] = manualCenter ? manualCenter : Array.isArray(fields) && fields.length > 0
    ? [
        fields.reduce((sum, f) => sum + Number(f.center_lat), 0) / fields.length,
        fields.reduce((sum, f) => sum + Number(f.center_lng), 0) / fields.length,
      ]
    : [14.5995, 120.9842]

  // Build sensor path from data
  const sensorPath = sensorData.map((s) => [Number(s.lat), Number(s.lng)] as [number, number])

  return (
    <MapContainer
      key={`drone-map-${mapEpoch}`}
      center={center}
      zoom={14}
      style={{ height: '100%', width: '100%' }}
      className="rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      
      <MapController center={center} />

      {manualCenter && (
        <Marker position={manualCenter}>
          <Popup>Manual GPS Location</Popup>
        </Marker>
      )}

      {/* Field polygons */}
      {Array.isArray(fields) && fields.map((field) => {
        const coords = field.boundary_coords
        if (!coords || !Array.isArray(coords)) return null
        
        const positions = coords.map((c) => [c.lat, c.lng] as [number, number])
        const color = fieldColors[field.crop_type] || fieldColors.default
        const isSelected = selectedField?.id === field.id

        return (
          <Polygon
            key={field.id}
            positions={positions}
            pathOptions={{
              color: isSelected ? '#000' : color,
              fillColor: color,
              fillOpacity: isSelected ? 0.4 : 0.2,
              weight: isSelected ? 3 : 2,
            }}
            eventHandlers={{
              click: () => onFieldClick?.(field),
            }}
          >
            <Popup>
              <Card className="border-0 shadow-none">
                <CardContent className="p-2">
                  <h3 className="font-semibold">{field.name}</h3>
                  <p className="text-sm text-muted-foreground">{field.crop_type}</p>
                  <div className="mt-2 space-y-1 text-xs">
                    <p>Area: {field.area_hectares} ha</p>
                    {field.soil_type && <p>Soil: {field.soil_type}</p>}
                    {field.irrigation_type && <p>Irrigation: {field.irrigation_type}</p>}
                  </div>
                </CardContent>
              </Card>
            </Popup>
          </Polygon>
        )
      })}

      {/* Sensor data path */}
      {showSensorPath && sensorPath.length > 1 && (
        <Polyline
          positions={sensorPath}
          pathOptions={{
            color: '#3b82f6',
            weight: 3,
            opacity: 0.7,
            dashArray: '5, 10',
          }}
        />
      )}

      {/* Sensor data points */}
      {showSensorPath && Array.isArray(sensorData) && sensorData.map((s) => (
        <Circle
          key={s.id}
          center={[Number(s.lat), Number(s.lng)]}
          radius={10}
          pathOptions={{
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.8,
          }}
        >
          <Popup>
            <div className="text-xs space-y-1">
              <p>Temp: {s.temperature}°C</p>
              <p>Humidity: {s.humidity}%</p>
              <p>Soil: {s.soil_moisture}%</p>
              {s.ndvi && <p>NDVI: {(Number(s.ndvi) * 100).toFixed(1)}%</p>}
            </div>
          </Popup>
        </Circle>
      ))}

      {/* Disease detections */}
      {showDetections && Array.isArray(detections) && detections.map((detection) => (
        <Marker
          key={detection.id}
          position={[Number(detection.lat), Number(detection.lng)]}
          icon={createDetectionIcon(detection.severity)}
        >
          <Popup>
            <Card className="border-0 shadow-none">
              <CardContent className="p-2">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-sm">{detection.disease_name}</h3>
                  <Badge variant={detection.severity === 'critical' || detection.severity === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                    {detection.severity}
                  </Badge>
                </div>
                <div className="space-y-1 text-xs">
                  <p>Plant: {detection.plant_type}</p>
                  <p>Confidence: {(detection.confidence * 100).toFixed(0)}%</p>
                  {detection.affected_area_sqm && <p>Area: {detection.affected_area_sqm} sqm</p>}
                  <p>Status: {detection.status}</p>
                </div>
              </CardContent>
            </Card>
          </Popup>
        </Marker>
      ))}

      {/* Drone markers */}
      {Array.isArray(drones) && drones.map((drone) => {
        if (!drone.current_lat || !drone.current_lng) return null
        const isSelected = selectedDrone?.id === drone.id

        return (
          <Marker
            key={drone.id}
            position={[Number(drone.current_lat), Number(drone.current_lng)]}
            icon={createDroneIcon(drone.status, isSelected)}
            eventHandlers={{
              click: () => onDroneClick?.(drone),
            }}
          >
            <Popup>
              <Card className="border-0 shadow-none">
                <CardContent className="p-2">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{drone.name}</h3>
                    <Badge
                      variant={drone.status === 'flying' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {drone.status}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p>Model: {drone.model}</p>
                    <p>Battery: {drone.battery_level}%</p>
                    {drone.current_altitude && <p>Altitude: {drone.current_altitude}m</p>}
                  </div>
                </CardContent>
              </Card>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
