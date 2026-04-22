'use client'

import { Bell, Search, Settings, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import useSWR from 'swr'
import type { Alert } from '@/lib/db'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function DashboardHeader({ title }: { title: string }) {
  const { data: alerts } = useSWR<Alert[]>('/api/alerts', fetcher, { refreshInterval: 30000 })

  const unreadAlerts = Array.isArray(alerts) ? alerts.filter((a) => !a.is_read) : []

  return (
    <header className="sticky top-0 z-40 flex h-20 items-center justify-between gap-6 border-b border-white/5 bg-background/80 px-8 backdrop-blur-xl">
      <div className="flex items-center gap-8">
        <h1 className="hidden text-xl font-bold tracking-tight text-foreground lg:block">{title}</h1>
        <nav className="flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <a href="#" className="text-foreground transition-colors hover:text-primary">Field View</a>
          <a href="#" className="transition-colors hover:text-primary">Analytics</a>
          <a href="#" className="transition-colors hover:text-primary">Fleet</a>
        </nav>
      </div>

      <div className="flex flex-1 items-center justify-end gap-6">
        <div className="relative max-w-md flex-1 hidden md:block">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search telemetry..."
            className="h-11 w-full border-white/5 bg-white/5 pl-11 ring-offset-background transition-all focus:bg-white/10 focus:ring-primary/50"
          />
        </div>

        <div className="flex items-center gap-4">
          <Button className="h-10 rounded-lg bg-primary px-6 font-bold text-primary-foreground shadow-[0_0_20px_rgba(191,255,0,0.2)] transition-all hover:scale-105 hover:bg-primary/90 active:scale-95">
            Deploy Drone
          </Button>

          <div className="flex items-center gap-1 border-l border-white/10 pl-4">
            <Button variant="ghost" size="icon" className="relative h-10 w-10 text-muted-foreground hover:bg-white/5 hover:text-foreground">
              <Bell className="h-5 w-5" />
              {unreadAlerts.length > 0 && (
                <span className="absolute right-3 top-3 flex h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_rgba(191,255,0,0.5)]" />
              )}
              <span className="sr-only">Notifications</span>
            </Button>

            <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:bg-white/5 hover:text-foreground">
              <Settings className="h-5 w-5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="ml-2 h-10 w-10 rounded-full bg-white/5 p-0 ring-1 ring-white/10 transition-all hover:ring-primary/50">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 border-white/10 bg-background/95 backdrop-blur-xl">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem className="focus:bg-primary/10 focus:text-primary">Profile</DropdownMenuItem>
                <DropdownMenuItem className="focus:bg-primary/10 focus:text-primary">Settings</DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive">Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  )
}
