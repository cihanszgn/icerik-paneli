'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { FadeIn, Stagger, StaggerItem, HoverLift } from '@/components/ui/animate'
import {
  Film, ExternalLink, Copy, Trash2, Archive, Share2, Search,
  TrendingUp, Filter, Play, Radio, Globe, ChevronDown
} from 'lucide-react'
import { toast } from 'sonner'
import { SafeDate } from '@/components/safe-format'

const platformIcons: Record<string, { icon: any; label: string; color: string }> = {
  kick: { icon: Play, label: 'Kick', color: 'text-emerald-500' },
  youtube: { icon: Radio, label: 'YouTube', color: 'text-red-500' },
  website: { icon: Globe, label: 'Web', color: 'text-blue-500' },
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  new: { label: 'Yeni', variant: 'default' },
  reviewed: { label: 'İncelendi', variant: 'secondary' },
  archived: { label: 'Arşiv', variant: 'outline' },
}

interface Clip {
  id: string
  title: string
  description: string | null
  platformLink: string
  timestampStart: number | null
  timestampEnd: number | null
  engagementScore: number
  category: string | null
  status: string
  notes: string | null
  createdAt: string
  source: { name: string; type: string } | null
}

export function ClipsClient() {
  const [clips, setClips] = useState<Clip[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [prepareDialog, setPrepareDialog] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)

  const fetchClips = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterPlatform !== 'all') params.set('platform', filterPlatform)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (filterCategory !== 'all') params.set('category', filterCategory)
      const res = await fetch(`/api/clips?${params}`)
      if (res.ok) setClips(await res.json())
    } catch {} finally { setLoading(false) }
  }, [filterPlatform, filterStatus, filterCategory])

  useEffect(() => { fetchClips() }, [fetchClips])

  const handleCopyLink = (link: string) => {
    navigator.clipboard?.writeText?.(link)
    toast.success('Link kopyalandı!')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu içeriği silmek istediğinize emin misiniz?')) return
    try {
      await fetch(`/api/clips/${id}`, { method: 'DELETE' })
      setClips((prev) => prev.filter((c) => c.id !== id))
      toast.success('İçerik silindi')
    } catch { toast.error('Silinemedi') }
  }

  const handleArchive = async (id: string) => {
    try {
      await fetch(`/api/clips/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      })
      setClips((prev) => prev.map((c) => c.id === id ? { ...c, status: 'archived' } : c))
      toast.success('Arşivlendi')
    } catch { toast.error('Arşivlenemedi') }
  }

  const handlePreparePost = async (clipId: string, format: string) => {
    setPreparing(true)
    try {
      const res = await fetch('/api/social/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipId, format }),
      })
      if (res.ok) {
        toast.success('Paylaşım hazırlandı!')
        setPrepareDialog(null)
      } else {
        const data = await res.json()
        toast.error(data?.error ?? 'Hazırlanamadı')
      }
    } catch { toast.error('Hata oluştu') } finally { setPreparing(false) }
  }

  const filtered = clips.filter((c) => {
    if (search) {
      const q = search.toLowerCase()
      return (c.title?.toLowerCase()?.includes(q) || c.description?.toLowerCase()?.includes(q) || c.category?.toLowerCase()?.includes(q))
    }
    return true
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="flex gap-3"><Skeleton className="h-10 flex-1" /><Skeleton className="h-10 w-32" /></div>
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Toplanan Veriler</h1>
          <p className="text-muted-foreground mt-1">Yayın anları, haber metinleri ve tespit edilen tüm içerikler</p>
        </div>
      </FadeIn>

      {/* Filters */}
      <FadeIn delay={0.1}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="İçerik ara..."
              className="pl-10"
            />
          </div>
          <Select value={filterPlatform} onValueChange={setFilterPlatform}>
            <SelectTrigger className="w-[140px]"><Filter className="w-4 h-4 mr-2" /><SelectValue placeholder="Platform" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="kick">Kick</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="website">Web</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Durum" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="new">Yeni</SelectItem>
              <SelectItem value="reviewed">İncelendi</SelectItem>
              <SelectItem value="archived">Arşiv</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </FadeIn>

      {/* Clips List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Film className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-muted-foreground">Henüz veri yok</p>
            <p className="text-sm text-muted-foreground mt-1">Kaynak ekleyip tarama başlatın</p>
          </CardContent>
        </Card>
      ) : (
        <Stagger staggerDelay={0.03}>
          <div className="grid gap-4">
            {filtered.map((clip) => {
              const pInfo = platformIcons[clip?.source?.type ?? ''] ?? platformIcons.website
              const sInfo = statusLabels[clip?.status ?? 'new'] ?? statusLabels.new
              const PIcon = pInfo.icon
              return (
                <StaggerItem key={clip.id}>
                  <HoverLift>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 ${pInfo.color}`}>
                            <PIcon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium truncate max-w-[400px]">{clip.title}</h3>
                              <Badge variant={sInfo.variant}>{sInfo.label}</Badge>
                            </div>
                            {clip.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{clip.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">{clip?.source?.name ?? 'Bilinmiyor'}</Badge>
                              {clip.category && <Badge variant="secondary" className="text-xs">{clip.category}</Badge>}
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" />
                                {clip.engagementScore?.toFixed?.(0) ?? '0'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                <SafeDate date={clip.createdAt} options={{ dateStyle: 'short', timeStyle: 'short' }} />
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="icon-sm" onClick={() => setPrepareDialog(clip.id)} title="Paylaşım Hazırla">
                              <Share2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => handleCopyLink(clip.platformLink)} title="Linki Kopyala">
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" title="Aç" onClick={() => window.open(clip.platformLink, '_blank', 'noopener,noreferrer')}>
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => handleArchive(clip.id)} title="Arşivle">
                              <Archive className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(clip.id)} className="text-destructive hover:text-destructive" title="Sil">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </HoverLift>
                </StaggerItem>
              )
            })}
          </div>
        </Stagger>
      )}

      {/* Prepare Post Dialog */}
      <Dialog open={!!prepareDialog} onOpenChange={() => setPrepareDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Paylaşım Formatı Seç</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {[
              { format: 'reels', label: 'Instagram Reels', icon: '🎥' },
              { format: 'shorts', label: 'YouTube Shorts', icon: '🎬' },
              { format: 'post', label: 'Instagram Post', icon: '🖼️' },
              { format: 'tweet', label: 'Tweet / X', icon: '📝' },
            ].map((f) => (
              <Button
                key={f.format}
                variant="outline"
                className="h-auto py-4 flex flex-col gap-2"
                onClick={() => prepareDialog && handlePreparePost(prepareDialog, f.format)}
                loading={preparing}
              >
                <span className="text-2xl">{f.icon}</span>
                <span className="text-sm">{f.label}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
