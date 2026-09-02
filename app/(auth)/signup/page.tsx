import { SignupForm } from './signup-form'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export default async function SignupPage() {
  const session = await auth()
  if (session) redirect('/dashboard')
  return <SignupForm />
}
