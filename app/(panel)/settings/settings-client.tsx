'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { FadeIn } from '@/components/ui/animate'
import { Settings, Clock, Tag, Trash2, Save, Shield, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

export function SettingsClient() {
  const { data: session } = useSession()
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Password change
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')

  // Scan intervals
  const [kickInterval, setKickInterval] = useState(30)
  const [ytInterval, setYtInterval] = useState(60)
  const [webInterval, setWebInterval] = useState(360)

  // Categories
  const [categories, setCategories] = useState<string[]>([])
  const [newCategory, setNewCategory] = useState('')

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        setSettings(data)
        setKickInterval((data?.scan_interval_kick as any)?.minutes ?? 30)
        setYtInterval((data?.scan_interval_youtube as any)?.minutes ?? 60)
        setWebInterval((data?.scan_interval_website as any)?.minutes ?? 360)
        setCategories(Array.isArray(data?.default_categories) ? data.default_categories : ['eğlence', 'bilim', 'teknoloji', 'oyun', 'spor', 'finans'])
      }
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const handleSaveIntervals = async () => {
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scan_interval_kick: { minutes: kickInterval },
          scan_interval_youtube: { minutes: ytInterval },
          scan_interval_website: { minutes: webInterval },
        }),
      })
      toast.success('Tarama zamanlamaları kaydedildi')
    } catch { toast.error('Kaydedilemedi') } finally { setSaving(false) }
  }

  const handleSaveCategories = async () => {
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_categories: categories }),
      })
      toast.success('Kategoriler kaydedildi')
    } catch { toast.error('Kaydedilemedi') } finally { setSaving(false) }
  }

  const handleAddCategory = () => {
    if (!newCategory.trim()) return
    if (categories.includes(newCategory.trim().toLowerCase())) {
      toast.error('Bu kategori zaten var')
      return
    }
    setCategories([...categories, newCategory.trim().toLowerCase()])
    setNewCategory('')
  }

  const handleRemoveCategory = (cat: string) => {
    setCategories(categories.filter((c) => c !== cat))
  }

  const handleChangePassword = async () => {
    if (!currentPw || !newPw) { toast.error('Tüm alanları doldurun'); return }
    if (newPw !== confirmPw) { toast.error('Şifreler eşleşmiyor'); return }
    if (newPw.length < 6) { toast.error('Şifre en az 6 karakter olmalı'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      if (res.ok) {
        toast.success('Şifre değiştirildi!')
        setCurrentPw(''); setNewPw(''); setConfirmPw('')
      } else {
        const data = await res.json()
        toast.error(data?.error ?? 'Şifre değiştirilemedi')
      }
    } catch { toast.error('Hata oluştu') } finally { setSaving(false) }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Ayarlar</h1>
          <p className="text-muted-foreground mt-1">Panel yapılandırması ve tercihler</p>
        </div>
      </FadeIn>

      {/* Password */}
      <FadeIn delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="w-5 h-5 text-primary" />
              Şifre Değiştir
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Mevcut Şifre</Label>
                <Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
              </div>
              <div>
                <Label>Yeni Şifre</Label>
                <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
              </div>
              <div>
                <Label>Yeni Şifre (Tekrar)</Label>
                <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleChangePassword} loading={saving} className="gap-2">
              <Save className="w-4 h-4" /> Şifreyi Değiştir
            </Button>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Scan Intervals */}
      <FadeIn delay={0.15}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="w-5 h-5 text-primary" />
              Tarama Zamanlamaları
            </CardTitle>
            <CardDescription>Otomatik tarama sıklıklarını ayarla (dakika)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Kick Tarama (dk)</Label>
                <Input type="number" value={kickInterval} onChange={(e) => setKickInterval(parseInt(e.target.value) || 30)} min={5} />
              </div>
              <div>
                <Label>YouTube Tarama (dk)</Label>
                <Input type="number" value={ytInterval} onChange={(e) => setYtInterval(parseInt(e.target.value) || 60)} min={15} />
              </div>
              <div>
                <Label>Website Tarama (dk)</Label>
                <Input type="number" value={webInterval} onChange={(e) => setWebInterval(parseInt(e.target.value) || 360)} min={30} />
              </div>
            </div>
            <Button onClick={handleSaveIntervals} loading={saving} className="gap-2">
              <Save className="w-4 h-4" /> Zamanlamaları Kaydet
            </Button>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Categories */}
      <FadeIn delay={0.2}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Tag className="w-5 h-5 text-primary" />
              Varsayılan Kategoriler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <Badge key={cat} variant="secondary" className="gap-1.5 px-3 py-1.5">
                  {cat}
                  <button onClick={() => handleRemoveCategory(cat)} className="ml-1 hover:text-destructive">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Yeni kategori"
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
              />
              <Button variant="outline" onClick={handleAddCategory}>Ekle</Button>
            </div>
            <Button onClick={handleSaveCategories} loading={saving} className="gap-2">
              <Save className="w-4 h-4" /> Kategorileri Kaydet
            </Button>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
