'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Map,
  Plane,
  Leaf,
  BarChart3,
  Calendar,
  AlertTriangle,
  Settings,
  ChevronLeft,
  ChevronRight,
  Tractor,
  ScanLine,
  Activity,
  Wifi,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const navigation = [
  { name: 'Dashboard',          href: '/',                   icon: LayoutDashboard },
  { name: 'Live Map',            href: '/map',                icon: Map },
  { name: 'Drones',              href: '/drones',             icon: Plane },
  { name: 'Fields',              href: '/fields',             icon: Tractor },
  { name: 'Detections',          href: '/detections',         icon: Leaf },
  { name: 'Live Detection',      href: '/live-detection',     icon: ScanLine },
  { name: 'Boundary / IP Cam',   href: '/boundary-detection', icon: Wifi },
  { name: 'Analytics',           href: '/analytics',          icon: BarChart3 },
  { name: 'Missions',            href: '/missions',           icon: Calendar },
  { name: 'Alerts',              href: '/alerts',             icon: AlertTriangle },
]

const bottomNavigation = [
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-screen flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <div className={cn('flex flex-col gap-6 px-6 py-8', collapsed && 'items-center px-2')}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary shadow-[0_0_20px_rgba(191,255,0,0.3)]">
              <Plane className="h-6 w-6 text-primary-foreground" />
            </div>
            {!collapsed && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-xl font-bold tracking-tight text-primary">Agri Drone</span>
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Precision</span>
              </div>
            )}
          </div>

          {!collapsed && (
            <div className="rounded-2xl bg-muted/30 p-4 ring-1 ring-white/5 transition-all hover:bg-muted/40">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
                  <Activity className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-foreground">Fleet Alpha</span>
                  <span className="text-[10px] text-muted-foreground">3 DRONES ACTIVE</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 px-2 py-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            const link = (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                  collapsed && 'justify-center px-2'
                )}
              >
                <item.icon className={cn('h-5 w-5 shrink-0', isActive && 'text-sidebar-primary')} />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            )

            if (collapsed) {
              return (
                <Tooltip key={item.name}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {item.name}
                  </TooltipContent>
                </Tooltip>
              )
            }

            return link
          })}
        </nav>

        <div className="border-t border-sidebar-border px-2 py-4 space-y-1">
          {bottomNavigation.map((item) => {
            const isActive = pathname === item.href
            const link = (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                  collapsed && 'justify-center px-2'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            )

            if (collapsed) {
              return (
                <Tooltip key={item.name}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {item.name}
                  </TooltipContent>
                </Tooltip>
              )
            }

            return link
          })}
        </div>

        <div className="mt-auto border-t border-white/5 px-4 py-6 space-y-4">
          <Button 
            variant="destructive" 
            className={cn(
              "w-full bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all shadow-[0_0_15px_rgba(239,68,68,0.1)]",
              collapsed ? "h-12 w-12 p-0" : "h-12 text-xs font-bold uppercase tracking-widest"
            )}
          >
            {collapsed ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              "Emergency Return"
            )}
          </Button>

          <div className="space-y-1 text-center">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-bold block mb-1">System</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(!collapsed)}
              className={cn(
                'w-full justify-center text-muted-foreground hover:bg-white/5 hover:text-foreground',
                !collapsed && 'justify-start px-3'
              )}
            >
              {collapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <>
                  <ChevronLeft className="h-5 w-5 mr-2" />
                  <span>Collapse Sidebar</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  )
}
