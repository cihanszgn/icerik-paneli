'use client'

import { SessionProvider } from 'next-auth/react'
import { Sidebar } from '@/components/sidebar'

export function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="min-h-screen">
        <Sidebar />
        <main className="lg:ml-64 min-h-screen">
          <div className="max-w-[1200px] mx-auto p-6 pt-16 lg:pt-6">
            {children}
          </div>
        </main>
      </div>
    </SessionProvider>
  )
}
