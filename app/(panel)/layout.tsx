import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShellLayout } from '@/components/app-shell-layout'

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')
  return <AppShellLayout>{children}</AppShellLayout>
}
