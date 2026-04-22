'use client'

import { DashboardSidebar } from './sidebar'
import { DashboardHeader } from './header'
import { ThemeProvider } from 'next-themes'

interface DashboardLayoutProps {
  children: React.ReactNode
  title: string
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false}>
      <div className="flex h-screen overflow-hidden bg-background text-foreground selection:bg-primary/30 selection:text-primary">
        <DashboardSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <DashboardHeader title={title} />
          <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
            <div className="mx-auto max-w-7xl space-y-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ThemeProvider>
  )
}
