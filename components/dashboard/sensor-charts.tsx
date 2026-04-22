'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
} from 'recharts'
import type { SensorData } from '@/lib/db'
import { format } from 'date-fns'

interface SensorChartsProps {
  data: SensorData[]
}

export function SensorCharts({ data }: SensorChartsProps) {
  const safeData = Array.isArray(data) ? data : []
  const chartData = [...safeData].reverse().map((d) => ({
    time: format(new Date(d.timestamp), 'HH:mm'),
    temperature: d.temperature,
    humidity: d.humidity,
    soilMoisture: d.soil_moisture,
    ndvi: d.ndvi ? d.ndvi * 100 : null,
  }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Sensor Data</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="environment" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="environment">Environment</TabsTrigger>
            <TabsTrigger value="soil">Soil</TabsTrigger>
            <TabsTrigger value="ndvi">NDVI</TabsTrigger>
          </TabsList>

          <TabsContent value="environment" className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="time" className="text-xs" tick={{ fill: 'var(--muted-foreground)' }} />
                <YAxis className="text-xs" tick={{ fill: 'var(--muted-foreground)' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="temperature"
                  stroke="var(--chart-4)"
                  strokeWidth={2}
                  dot={false}
                  name="Temperature (C)"
                />
                <Line
                  type="monotone"
                  dataKey="humidity"
                  stroke="var(--chart-3)"
                  strokeWidth={2}
                  dot={false}
                  name="Humidity (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="soil" className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="time" className="text-xs" tick={{ fill: 'var(--muted-foreground)' }} />
                <YAxis className="text-xs" tick={{ fill: 'var(--muted-foreground)' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="soilMoisture"
                  stroke="var(--chart-1)"
                  fill="var(--chart-1)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                  name="Soil Moisture (%)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="ndvi" className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="time" className="text-xs" tick={{ fill: 'var(--muted-foreground)' }} />
                <YAxis domain={[0, 100]} className="text-xs" tick={{ fill: 'var(--muted-foreground)' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                  }}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'NDVI']}
                />
                <Area
                  type="monotone"
                  dataKey="ndvi"
                  stroke="var(--chart-1)"
                  fill="var(--chart-1)"
                  fillOpacity={0.3}
                  strokeWidth={2}
                  name="NDVI"
                />
              </AreaChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
