'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { FadeIn, Stagger, StaggerItem, HoverLift } from '@/components/ui/animate'
import {
  Plus, Trash2, Radio, Play, Globe, RefreshCw, ExternalLink,
  Gamepad2, Beaker, Monitor, Trophy, DollarSign, Laugh, Settings2
} from 'lucide-react'
import { toast } from 'sonner'
import { SafeDate } from '@/components/safe-format'

const CATEGORIES = [
  { value: 'eğlence', label: 'Eğlence', icon: Laugh },
  { value: 'bilim', label: 'Bilim', icon: Beaker },
  { value: 'teknoloji', label: 'Teknoloji', icon: Monitor },
  { value: 'oyun', label: 'Oyun', icon: Gamepad2 },
  { value: 'spor', label: 'Spor', icon: Trophy },
  { value: 'finans', label: 'Finans', icon: DollarSign },
]

const SCAN_FREQUENCIES = [
  { value: '60', label: 'Saatte bir' },
  { value: '360', label: '6 saatte bir' },
  { value: '1440', label: 'Günde bir' },
]

interface Source {
  id: string
  name: string
  type: string
  url: string
  categories: string[]
  isActive: boolean
  config: any
  createdAt: string
}

export function SourcesClient() {
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('kick')
  const [formType, setFormType] = useState('kick')

  // Form state
  const [formName, setFormName] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formCategories, setFormCategories] = useState<string[]>(['eğlence'])
  const [formConfig, setFormConfig] = useState<any>({})
  const [saving, setSaving] = useState(false)

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch('/api/sources')
      if (res.ok) setSources(await res.json())
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchSources() }, [fetchSources])

  const handleAdd = async () => {
    if (!formName || !formUrl) { toast.error('Ad ve URL gerekli'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          type: formType,
          url: formUrl,
          categories: formCategories,
          config: formConfig,
        }),
      })
      if (res.ok) {
        toast.success('Kaynak eklendi!')
        setFormName(''); setFormUrl(''); setFormCategories(['eğlence']); setFormConfig({})
        setDialogOpen(false)
        fetchSources()
      } else {
        const data = await res.json()
        toast.error(data?.error ?? 'Eklenemedi')
      }
    } catch { toast.error('Hata oluştu') } finally { setSaving(false) }
  }

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await fetch(`/api/sources/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      setSources((prev) => prev.map((s) => s.id === id ? { ...s, isActive } : s))
    } catch { toast.error('Güncellenemedi') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu kaynağı silmek istediğinize emin misiniz?')) return
    try {
      await fetch(`/api/sources/${id}`, { method: 'DELETE' })
      setSources((prev) => prev.filter((s) => s.id !== id))
      toast.success('Kaynak silindi')
    } catch { toast.error('Silinemedi') }
  }

  const handleScan = async (sourceId: string, type: string) => {
    toast.info('Tarama başlatılıyor...')
    try {
      const res = await fetch(`/api/scan/${type === 'website' ? 'websites' : type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Tarama tamamlandı! ${data?.clipsFound ?? 0} içerik bulundu.`)
      } else {
        toast.error(data?.error ?? 'Tarama başarısız')
      }
    } catch { toast.error('Tarama hatası') }
  }

  const openAddDialog = () => { setFormType(activeTab); setDialogOpen(true) }

  const toggleCategory = (cat: string) => {
    setFormCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  const renderSources = (type: string) => {
    const list = sources.filter((s) => s.type === type)
    if (list.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <Globe className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-muted-foreground">Bu kategoride kaynak yok</p>
            <Button variant="outline" className="mt-4 gap-2" onClick={openAddDialog}>
              <Plus className="w-4 h-4" /> Kaynak Ekle
            </Button>
          </CardContent>
        </Card>
      )
    }
    return (
      <Stagger staggerDelay={0.05}>
        <div className="grid gap-4">
          {list.map((source) => (
            <StaggerItem key={source.id}>
              <HoverLift>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">{source.name}</h3>
                          <Badge variant={source.isActive ? 'default' : 'secondary'}>
                            {source.isActive ? 'Aktif' : 'Pasif'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-1">{source.url}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {(source.categories ?? []).map((cat: string) => (
                            <Badge key={cat} variant="outline" className="text-xs">{cat}</Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Eklendi: <SafeDate date={source.createdAt} options={{ dateStyle: 'medium' }} />
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={source.isActive}
                          onCheckedChange={(checked) => handleToggle(source.id, checked)}
                        />
                        <Button variant="ghost" size="icon-sm" onClick={() => handleScan(source.id, source.type)} title="Tara">
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                        <a href={source.url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon-sm" title="Aç">
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </a>
                        <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(source.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </HoverLift>
            </StaggerItem>
          ))}
        </div>
      </Stagger>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Kaynaklar</h1>
            <p className="text-muted-foreground mt-1">İzlenen platformları ve web sitelerini yönet</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> Kaynak Ekle</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Yeni Kaynak Ekle</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <Tabs value={formType} onValueChange={setFormType}>
                  <TabsList className="w-full">
                    <TabsTrigger value="kick" className="flex-1 gap-1.5"><Play className="w-3.5 h-3.5" /> Kick</TabsTrigger>
                    <TabsTrigger value="youtube" className="flex-1 gap-1.5"><Radio className="w-3.5 h-3.5" /> YouTube</TabsTrigger>
                    <TabsTrigger value="website" className="flex-1 gap-1.5"><Globe className="w-3.5 h-3.5" /> Website</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="space-y-3">
                  <div>
                    <Label>Ad</Label>
                    <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder={formType === 'kick' ? 'Yayıncı adı' : formType === 'youtube' ? 'Kanal / Video adı' : 'Site adı'} />
                  </div>
                  <div>
                    <Label>{formType === 'kick' ? 'Kick Username / URL' : formType === 'youtube' ? 'Kanal ID veya Video URL' : 'Site URL'}</Label>
                    <Input value={formUrl} onChange={(e) => setFormUrl(e.target.value)} placeholder={formType === 'kick' ? 'https://kick.com/username' : formType === 'youtube' ? 'https://youtube.com/@kanal veya video URL' : 'https://example.com'} />
                  </div>

                  {formType === 'kick' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Etkileşim Eşiği (mesaj/sn)</Label>
                        <Input type="number" defaultValue={5} onChange={(e) => setFormConfig((prev: any) => ({ ...(prev ?? {}), engagementThreshold: parseInt(e.target.value) || 5 }))} />
                      </div>
                      <div>
                        <Label>Kesit Süresi (sn)</Label>
                        <Input type="number" defaultValue={30} onChange={(e) => setFormConfig((prev: any) => ({ ...(prev ?? {}), clipDuration: parseInt(e.target.value) || 30 }))} />
                      </div>
                    </div>
                  )}

                  {formType === 'youtube' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Başlangıç (sn)</Label>
                        <Input type="number" defaultValue={0} onChange={(e) => setFormConfig((prev: any) => ({ ...(prev ?? {}), timestampStart: parseInt(e.target.value) || 0 }))} />
                      </div>
                      <div>
                        <Label>Bitiş (sn)</Label>
                        <Input type="number" defaultValue={0} onChange={(e) => setFormConfig((prev: any) => ({ ...(prev ?? {}), timestampEnd: parseInt(e.target.value) || 0 }))} />
                      </div>
                    </div>
                  )}

                  {formType === 'website' && (
                    <div>
                      <Label>Tarama Sıklığı</Label>
                      <Select defaultValue="360" onValueChange={(v) => setFormConfig((prev: any) => ({ ...(prev ?? {}), scanFrequency: parseInt(v) }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SCAN_FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <Label>Kategoriler</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => toggleCategory(cat.value)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            formCategories.includes(cat.value)
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          <cat.icon className="w-3.5 h-3.5" />
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <Button onClick={handleAdd} loading={saving} className="w-full">Ekle</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </FadeIn>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="kick" className="gap-1.5"><Play className="w-3.5 h-3.5" /> Kick ({sources.filter((s) => s.type === 'kick').length})</TabsTrigger>
          <TabsTrigger value="youtube" className="gap-1.5"><Radio className="w-3.5 h-3.5" /> YouTube ({sources.filter((s) => s.type === 'youtube').length})</TabsTrigger>
          <TabsTrigger value="website" className="gap-1.5"><Globe className="w-3.5 h-3.5" /> Web ({sources.filter((s) => s.type === 'website').length})</TabsTrigger>
        </TabsList>

        <TabsContent value="kick" className="mt-4">{renderSources('kick')}</TabsContent>
        <TabsContent value="youtube" className="mt-4">{renderSources('youtube')}</TabsContent>
        <TabsContent value="website" className="mt-4">{renderSources('website')}</TabsContent>
      </Tabs>
    </div>
  )
}
