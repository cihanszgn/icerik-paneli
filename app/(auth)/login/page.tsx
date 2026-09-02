import { LoginForm } from './login-form'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export default async function LoginPage() {
  const session = await auth()
  if (session) redirect('/dashboard')
  return <LoginForm />
}
