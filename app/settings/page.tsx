'use client'

import { DashboardLayout } from '@/components/dashboard/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Settings,
  Bell,
  Map,
  Plane,
  Shield,
  Database,
  Leaf,
} from 'lucide-react'

export default function SettingsPage() {
  return (
    <DashboardLayout title="Settings">
      <div className="max-w-4xl">
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general">
              <Settings className="h-4 w-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="drones">
              <Plane className="h-4 w-4 mr-2" />
              Drones
            </TabsTrigger>
            <TabsTrigger value="detection">
              <Leaf className="h-4 w-4 mr-2" />
              AI Detection
            </TabsTrigger>
            <TabsTrigger value="api">
              <Database className="h-4 w-4 mr-2" />
              API
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                  Configure general application settings and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="farm-name">Farm Name</Label>
                  <Input id="farm-name" defaultValue="AgriDrone Farm" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select defaultValue="asia-manila">
                    <SelectTrigger id="timezone">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asia-manila">Asia/Manila (UTC+8)</SelectItem>
                      <SelectItem value="asia-singapore">Asia/Singapore (UTC+8)</SelectItem>
                      <SelectItem value="america-newyork">America/New_York (UTC-5)</SelectItem>
                      <SelectItem value="europe-london">Europe/London (UTC+0)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="units">Measurement Units</Label>
                  <Select defaultValue="metric">
                    <SelectTrigger id="units">
                      <SelectValue placeholder="Select units" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="metric">Metric (km, ha, °C)</SelectItem>
                      <SelectItem value="imperial">Imperial (mi, ac, °F)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Dark Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable dark mode for the dashboard
                    </p>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-refresh Data</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically refresh dashboard data every 30 seconds
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Configure how and when you receive alerts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Critical Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications for critical system alerts
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Disease Detections</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when plant diseases are detected
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Low Battery Warnings</Label>
                    <p className="text-sm text-muted-foreground">
                      Alert when drone battery falls below 20%
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Mission Updates</Label>
                    <p className="text-sm text-muted-foreground">
                      Notifications for mission status changes
                    </p>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Send alerts via email
                    </p>
                  </div>
                  <Switch />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="email">Notification Email</Label>
                  <Input id="email" type="email" placeholder="admin@agridrone.com" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drones" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Drone Configuration</CardTitle>
                <CardDescription>
                  Default settings for drone operations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="max-altitude">Maximum Flight Altitude (m)</Label>
                  <Input id="max-altitude" type="number" defaultValue="120" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min-battery">Minimum Battery for Mission (%)</Label>
                  <Input id="min-battery" type="number" defaultValue="30" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="return-battery">Return Home Battery Level (%)</Label>
                  <Input id="return-battery" type="number" defaultValue="20" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default-speed">Default Flight Speed (m/s)</Label>
                  <Input id="default-speed" type="number" defaultValue="8" />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto Return on Low Battery</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically return drone when battery is low
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Weather Safety Check</Label>
                    <p className="text-sm text-muted-foreground">
                      Check weather conditions before flight
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="detection" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AI Disease Detection</CardTitle>
                <CardDescription>
                  Configure the plant disease detection AI system
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="confidence">Minimum Confidence Threshold (%)</Label>
                  <Input id="confidence" type="number" defaultValue="70" />
                  <p className="text-xs text-muted-foreground">
                    Only report detections above this confidence level
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">Detection Model</Label>
                  <Select defaultValue="yolo-custom">
                    <SelectTrigger id="model">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yolo-custom">YOLO + Custom CNN (38 classes)</SelectItem>
                      <SelectItem value="efficientnet">EfficientNet-B4</SelectItem>
                      <SelectItem value="resnet">ResNet-50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Real-time Detection</Label>
                    <p className="text-sm text-muted-foreground">
                      Process images during flight in real-time
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-generate Recommendations</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically suggest treatment based on detection
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Store Detection Images</Label>
                    <p className="text-sm text-muted-foreground">
                      Save images of detected diseases for review
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>API Configuration</CardTitle>
                <CardDescription>
                  Manage API keys and external integrations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="api-key">API Key</Label>
                  <div className="flex gap-2">
                    <Input id="api-key" type="password" defaultValue="sk-agri-xxxxxxxxxxxx" />
                    <Button variant="outline">Regenerate</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use this key to access the AgriDrone API
                  </p>
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label>Connected Services</Label>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Database className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">Neon Database</p>
                        <p className="text-sm text-muted-foreground">PostgreSQL database</p>
                      </div>
                    </div>
                    <Badge variant="default" className="bg-emerald-500">Connected</Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Map className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="font-medium">OpenStreetMap</p>
                        <p className="text-sm text-muted-foreground">Map tiles provider</p>
                      </div>
                    </div>
                    <Badge variant="default" className="bg-emerald-500">Connected</Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Leaf className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">Plant Disease AI</p>
                        <p className="text-sm text-muted-foreground">YOLO + Custom CNN model</p>
                      </div>
                    </div>
                    <Badge variant="default" className="bg-emerald-500">Active</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-4 mt-6">
          <Button variant="outline">Cancel</Button>
          <Button>Save Changes</Button>
        </div>
      </div>
    </DashboardLayout>
  )
}
