'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Zap, Mail, Lock } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export function SignupForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      toast.error('Şifre en az 6 karakter olmalı.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error ?? 'Kayıt başarısız')
        return
      }
      const result = await signIn('credentials', { email, password, redirect: false })
      if (result?.error) {
        toast.error('Kayıt başarılı ama giriş yapılamadı.')
        router.push('/login')
      } else {
        toast.success('Hoş geldiniz!')
        router.replace('/dashboard')
      }
    } catch {
      toast.error('Bir hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-4">
      <CardHeader className="text-center space-y-3">
        <div className="mx-auto w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center">
          <Zap className="w-7 h-7 text-primary" />
        </div>
        <CardTitle className="text-2xl font-display tracking-tight">Kayıt Ol</CardTitle>
        <CardDescription>İçerik paneline erişim için hesap oluştur</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className="pl-10" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Şifre</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="En az 6 karakter" className="pl-10" required minLength={6} />
            </div>
          </div>
          <Button type="submit" className="w-full" loading={loading}>Kayıt Ol</Button>
          <p className="text-center text-sm text-muted-foreground">
            Zaten hesabın var mı?{' '}<Link href="/login" className="text-primary hover:underline">Giriş Yap</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
