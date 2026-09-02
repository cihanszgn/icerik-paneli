'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { FadeIn, SlideIn, Stagger, StaggerItem } from '@/components/ui/animate'
import {
  Radio, Film, Share2, Brain, RefreshCw, ExternalLink,
  TrendingUp, Clock, Zap, AlertCircle, Play
} from 'lucide-react'
import { toast } from 'sonner'
import { SafeDate } from '@/components/safe-format'
import { cn } from '@/lib/utils'

interface Stats {
  totalSources: number
  activeSources: number
  totalClips: number
  todayClips: number
  totalPosts: number
  readyPosts: number
  recentClips: any[]
  lastScan: any
  activeModels: any[]
}

function AnimatedCounter({ value, label, icon: Icon, color }: { value: number; label: string; icon: any; color: string }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const duration = 1000
    const steps = 30
    const increment = value / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= value) {
        setCount(value)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, duration / steps)
    return () => clearInterval(timer)
  }, [value])

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-display font-bold tracking-tight mt-1">{count}</p>
          </div>
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', color)}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const platformIcons: Record<string, string> = {
  kick: '🟢',
  youtube: '🔴',
  website: '🌐',
}

export function DashboardClient() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch {
      toast.error('İstatistikler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const handleScan = async () => {
    setScanning(true)
    try {
      const res = await fetch('/api/schedule/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'all' }),
      })
      if (res.ok) {
        toast.success('Tarama başlatıldı!')
        setTimeout(fetchStats, 2000)
      } else {
        toast.error('Tarama başlatılamadı')
      }
    } catch {
      toast.error('Tarama hatası')
    } finally {
      setScanning(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Panel</h1>
            <p className="text-muted-foreground mt-1">İçerik takip ve yönetim merkezin</p>
          </div>
          <Button onClick={handleScan} loading={scanning} className="gap-2">
            <RefreshCw className={cn('w-4 h-4', scanning && 'animate-spin')} />
            Tüm Kaynakları Tara
          </Button>
        </div>
      </FadeIn>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SlideIn from="bottom" delay={0}>
          <AnimatedCounter
            value={stats?.activeSources ?? 0}
            label="Aktif Kaynak"
            icon={Radio}
            color="bg-emerald-500/15 text-emerald-500"
          />
        </SlideIn>
        <SlideIn from="bottom" delay={0.1}>
          <AnimatedCounter
            value={stats?.todayClips ?? 0}
            label="Bugünü Tespit"
            icon={Film}
            color="bg-blue-500/15 text-blue-500"
          />
        </SlideIn>
        <SlideIn from="bottom" delay={0.2}>
          <AnimatedCounter
            value={stats?.totalClips ?? 0}
            label="Toplam İçerik"
            icon={TrendingUp}
            color="bg-primary/15 text-primary"
          />
        </SlideIn>
        <SlideIn from="bottom" delay={0.3}>
          <AnimatedCounter
            value={stats?.readyPosts ?? 0}
            label="Hazır Paylaşım"
            icon={Share2}
            color="bg-amber-500/15 text-amber-500"
          />
        </SlideIn>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Clips */}
        <div className="lg:col-span-2">
          <FadeIn delay={0.2}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-display">Son Tespit Edilen Anlar</CardTitle>
                <Badge variant="secondary">{stats?.recentClips?.length ?? 0} içerik</Badge>
              </CardHeader>
              <CardContent>
                {(stats?.recentClips?.length ?? 0) === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Film className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p>Henüz tespit edilen içerik yok</p>
                    <p className="text-sm mt-1">Kaynak ekleyip tarama başlatın</p>
                  </div>
                ) : (
                  <Stagger staggerDelay={0.05}>
                    <div className="space-y-3">
                      {(stats?.recentClips ?? []).map((clip: any, i: number) => (
                        <StaggerItem key={clip?.id ?? `clip-${i}`}>
                          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                            <span className="text-lg mt-0.5">
                              {platformIcons[clip?.source?.type ?? ''] ?? '📌'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{clip?.title ?? 'Başlıksız'}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {clip?.source?.name ?? 'Bilinmiyor'}
                                </Badge>
                                {clip?.category && (
                                  <Badge variant="secondary" className="text-xs">{clip.category}</Badge>
                                )}
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3" />
                                  {(clip?.engagementScore ?? 0)?.toFixed?.(0) ?? '0'}
                                </span>
                              </div>
                            </div>
                            {clip?.platformLink && (
                              <button
                                type="button"
                                onClick={() => window.open(clip.platformLink, '_blank', 'noopener,noreferrer')}
                                className="text-muted-foreground hover:text-primary transition-colors"
                                title="Aç"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </StaggerItem>
                      ))}
                    </div>
                  </Stagger>
                )}
              </CardContent>
            </Card>
          </FadeIn>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* AI Status */}
          <FadeIn delay={0.3}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-display flex items-center gap-2">
                  <Brain className="w-5 h-5 text-primary" />
                  AI Durumu
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(stats?.activeModels?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">Aktif model yok</p>
                ) : (
                  (stats?.activeModels ?? []).map((m: any, i: number) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'w-2 h-2 rounded-full',
                          m?.type === 'premium' ? 'bg-amber-500' : m?.type === 'local' ? 'bg-blue-500' : 'bg-emerald-500'
                        )} />
                        <span className="text-sm">{m?.modelName ?? 'Bilinmiyor'}</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        {m?.usageCount ?? 0} kullanım
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </FadeIn>

          {/* Last Scan */}
          <FadeIn delay={0.4}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-display flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Son Tarama
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.lastScan ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={stats.lastScan.status === 'completed' ? 'default' : 'destructive'}>
                        {stats.lastScan.status === 'completed' ? 'Başarılı' : stats.lastScan.status === 'running' ? 'Çalışıyor' : 'Başarısız'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{stats.lastScan.scanType}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <SafeDate date={stats.lastScan.startedAt} options={{ dateStyle: 'medium', timeStyle: 'short' }} />
                    </p>
                    {(stats.lastScan.itemsFound ?? 0) > 0 && (
                      <p className="text-sm">{stats.lastScan.itemsFound} içerik bulundu</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Henüz tarama yapılmadı</p>
                )}
              </CardContent>
            </Card>
          </FadeIn>
        </div>
      </div>
    </div>
  )
}
