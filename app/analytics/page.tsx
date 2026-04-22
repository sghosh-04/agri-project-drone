'use client'

import { DashboardLayout } from '@/components/dashboard/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import useSWR from 'swr'
import type { SensorData, PlantDetection, Flight } from '@/lib/db'
import { format } from 'date-fns'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const NEON_COLORS = ['#BFFF00', '#00CED1', '#FFA500', '#FF4500', '#9370DB']

export default function AnalyticsPage() {
  const { data: sensorData, isLoading: sensorLoading } = useSWR<SensorData[]>(
    '/api/sensor-data?limit=100',
    fetcher
  )
  const { data: detections, isLoading: detectionsLoading } = useSWR<PlantDetection[]>(
    '/api/detections',
    fetcher
  )
  const { data: flights, isLoading: flightsLoading } = useSWR<Flight[]>('/api/flights', fetcher)

  // Process sensor data for charts
  const environmentData = Array.isArray(sensorData)
    ? [...sensorData].reverse().map((d) => ({
        time: format(new Date(d.timestamp), 'HH:mm'),
        temperature: Number(d.temperature),
        humidity: Number(d.humidity),
        soilMoisture: Number(d.soil_moisture),
        ndvi: d.ndvi ? Number(d.ndvi) * 100 : null,
      }))
    : []

  // Process detection data for pie chart
  const detectionBySeverity = Array.isArray(detections)
    ? [
        { name: 'Low', value: detections.filter((d) => d.severity === 'low').length },
        { name: 'Medium', value: detections.filter((d) => d.severity === 'medium').length },
        { name: 'High', value: detections.filter((d) => d.severity === 'high').length },
        { name: 'Critical', value: detections.filter((d) => d.severity === 'critical').length },
      ].filter((d) => d.value > 0)
    : []

  // Process detection data by disease
  const detectionByDisease = Array.isArray(detections)
    ? Object.entries(
        detections.reduce((acc, d) => {
          const statusName = d.disease_name === 'Healthy' ? 'Healthy' : 'Diseased'
          acc[statusName] = (acc[statusName] || 0) + 1
          return acc
        }, {} as Record<string, number>)
      ).map(([name, count]) => ({ name, count }))
    : []

  // Flight statistics
  const flightStats = Array.isArray(flights)
    ? {
        totalFlights: flights.length,
        completedFlights: flights.filter((f) => f.status === 'completed').length,
        totalDistance: flights.reduce((sum, f) => sum + (Number(f.distance_km) || 0), 0),
        avgBatteryUsed:
          flights.filter((f) => f.battery_used).length > 0
            ? Math.round(
                flights.reduce((sum, f) => sum + (f.battery_used || 0), 0) /
                  flights.filter((f) => f.battery_used).length
              )
            : 0,
      }
    : null

  const isLoading = sensorLoading || detectionsLoading || flightsLoading

  return (
    <DashboardLayout title="Performance Analytics">
      <div className="space-y-8">
        {/* Summary Stats */}
        <div className="grid gap-6 md:grid-cols-4">
          {isLoading ? (
            Array(4).fill(0).map((_, i) => (
              <Card key={i} className="bg-white/5 border-white/5 h-28 animate-pulse" />
            ))
          ) : (
            <>
              <Card className="bg-white/5 border-white/5 backdrop-blur-md hover:bg-white/10 transition-colors">
                <CardContent className="p-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Flights</p>
                  <p className="text-3xl font-black tracking-tighter">{flightStats?.totalFlights || 0}</p>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/5 backdrop-blur-md hover:bg-white/10 transition-colors">
                <CardContent className="p-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Traversed Distance</p>
                  <p className="text-3xl font-black tracking-tighter text-primary">{flightStats?.totalDistance.toFixed(1) || 0} <span className="text-sm">KM</span></p>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/5 backdrop-blur-md hover:bg-white/10 transition-colors">
                <CardContent className="p-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Pathogen Hits</p>
                  <p className="text-3xl font-black tracking-tighter text-destructive">{detections?.length || 0}</p>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/5 backdrop-blur-md hover:bg-white/10 transition-colors">
                <CardContent className="p-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Power Consumption</p>
                  <p className="text-3xl font-black tracking-tighter text-blue-400">{flightStats?.avgBatteryUsed || 0}<span className="text-sm">% AVG</span></p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Charts */}
        <Tabs defaultValue="environment" className="space-y-6">
          <TabsList className="bg-white/5 p-1 border border-white/5 rounded-xl">
            <TabsTrigger value="environment" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-black font-bold">Environment</TabsTrigger>
            <TabsTrigger value="vegetation" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-black font-bold">Vegetation</TabsTrigger>
            <TabsTrigger value="detections" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-black font-bold">Pathogens</TabsTrigger>
          </TabsList>

          <TabsContent value="environment" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="bg-white/5 border-white/5 backdrop-blur-md rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-white/5 bg-white/[0.02] p-6">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    Atmospheric Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {sensorLoading ? (
                    <Skeleton className="h-[350px] w-full rounded-2xl" />
                  ) : (
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={environmentData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                          <XAxis
                            dataKey="time"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#ffffff40', fontSize: 10, fontWeight: 'bold' }}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#ffffff40', fontSize: 10, fontWeight: 'bold' }} 
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#000',
                              border: '1px solid #ffffff10',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="temperature"
                            stroke="#FF4500"
                            strokeWidth={3}
                            dot={false}
                            name="Temp (°C)"
                          />
                          <Line
                            type="monotone"
                            dataKey="humidity"
                            stroke="#00CED1"
                            strokeWidth={3}
                            dot={false}
                            name="Humidity (%)"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-white/5 border-white/5 backdrop-blur-md rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-white/5 bg-white/[0.02] p-6">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    Soil Saturation
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {sensorLoading ? (
                    <Skeleton className="h-[350px] w-full rounded-2xl" />
                  ) : (
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={environmentData}>
                           <defs>
                            <linearGradient id="colorMoisture" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00CED1" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#00CED1" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                          <XAxis
                            dataKey="time"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#ffffff40', fontSize: 10, fontWeight: 'bold' }}
                          />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#ffffff40', fontSize: 10, fontWeight: 'bold' }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#000',
                              border: '1px solid #ffffff10',
                              borderRadius: '12px',
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="soilMoisture"
                            stroke="#00CED1"
                            fill="url(#colorMoisture)"
                            strokeWidth={3}
                            name="Soil (%)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="vegetation" className="space-y-6">
            <Card className="bg-white/5 border-white/5 backdrop-blur-md rounded-[2.5rem] overflow-hidden">
              <CardHeader className="p-10 border-b border-white/5">
                <CardTitle className="text-lg font-black uppercase tracking-[0.2em] flex items-center gap-4">
                  <div className="h-4 w-4 rounded-full bg-primary shadow-[0_0_15px_rgba(191,255,0,0.5)]" />
                  NDVI BIOMASS INDEX
                </CardTitle>
              </CardHeader>
              <CardContent className="p-10">
                {sensorLoading ? (
                  <Skeleton className="h-[450px] w-full rounded-3xl" />
                ) : (
                  <div className="h-[450px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={environmentData}>
                        <defs>
                          <linearGradient id="colorNdvi" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#BFFF00" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#BFFF00" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis
                          dataKey="time"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#ffffff40', fontSize: 12, fontWeight: 'bold' }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#ffffff40', fontSize: 12, fontWeight: 'bold' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#000',
                            border: '1px solid #ffffff10',
                            borderRadius: '16px',
                            padding: '12px'
                          }}
                          formatter={(value: number) => [`${value.toFixed(1)}%`, 'NDVI']}
                        />
                        <Area
                          type="monotone"
                          dataKey="ndvi"
                          stroke="#BFFF00"
                          fill="url(#colorNdvi)"
                          strokeWidth={4}
                          name="NDVI"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="detections" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="bg-white/5 border-white/5 backdrop-blur-md rounded-3xl overflow-hidden">
                <CardHeader className="p-6 border-b border-white/5">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest">Severity Distribution</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {detectionsLoading ? (
                    <Skeleton className="h-[350px] w-full" />
                  ) : (
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={detectionBySeverity}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={120}
                            paddingAngle={8}
                            dataKey="value"
                            stroke="none"
                          >
                            {detectionBySeverity.map((_, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={NEON_COLORS[index % NEON_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                             contentStyle={{
                                backgroundColor: '#000',
                                border: '1px solid #ffffff10',
                                borderRadius: '12px',
                              }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-white/5 border-white/5 backdrop-blur-md rounded-3xl overflow-hidden">
                <CardHeader className="p-6 border-b border-white/5">
                   <CardTitle className="text-sm font-bold uppercase tracking-widest">Disease Prevalence</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {detectionsLoading ? (
                    <Skeleton className="h-[350px] w-full" />
                  ) : (
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={detectionByDisease} layout="vertical">
                          <XAxis type="number" hide />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={100}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#ffffff40', fontSize: 12, fontWeight: 'bold' }}
                          />
                          <Tooltip
                             contentStyle={{
                                backgroundColor: '#000',
                                border: '1px solid #ffffff10',
                                borderRadius: '12px',
                              }}
                          />
                          <Bar dataKey="count" fill="#BFFF00" radius={[0, 8, 8, 0]} barSize={20} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
