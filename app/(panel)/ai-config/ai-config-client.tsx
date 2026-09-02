'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { FadeIn, Stagger, StaggerItem, HoverLift } from '@/components/ui/animate'
import {
  Brain, Cloud, Server, Zap, Settings2, Save, BarChart3, RefreshCw, Key, CheckCircle2, XCircle, Activity
} from 'lucide-react'
import { toast } from 'sonner'

const typeConfig: Record<string, { label: string; icon: any; color: string; badge: string }> = {
  builtin: { label: 'Yerel Motor (Sıfır Token)', icon: Server, color: 'text-primary', badge: 'Sıfır Token' },
  image: { label: 'Görsel Ajanı (Sıfır Token)', icon: Brain, color: 'text-fuchsia-500', badge: 'Ücretsiz Görsel' },
  cloud: { label: 'Ücretsiz Cloud', icon: Cloud, color: 'text-emerald-500', badge: 'Ücretsiz' },
  local: { label: 'Kendi Yerel Modelim (Ollama)', icon: Server, color: 'text-blue-500', badge: 'Local' },
  premium: { label: 'Premium', icon: Zap, color: 'text-amber-500', badge: 'Premium' },
}

interface AiConfig {
  id: string
  modelName: string
  endpoint: string
  apiKeyEnv: string | null
  type: string
  isActive: boolean
  config: any
  usageCount: number
}

export function AiConfigClient() {
  const [configs, setConfigs] = useState<AiConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editEndpoint, setEditEndpoint] = useState('')
  const [keyEditId, setKeyEditId] = useState<string | null>(null)
  const [keyValue, setKeyValue] = useState('')
  const [cacheStats, setCacheStats] = useState<{ count: number; totalHits: number } | null>(null)
  const [health, setHealth] = useState<Record<string, { ok: boolean; message: string; latencyMs: number }>>({})
  const [healthLoading, setHealthLoading] = useState(false)
  const [healthCheckedAt, setHealthCheckedAt] = useState<string | null>(null)

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-config')
      if (res.ok) setConfigs(await res.json())
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchConfigs() }, [fetchConfigs])

  useEffect(() => {
    fetch('/api/ai-cache').then((r) => r.ok ? r.json() : null).then((d) => d && setCacheStats(d)).catch(() => {})
  }, [])

  const runHealthCheck = async () => {
    setHealthLoading(true)
    try {
      const res = await fetch('/api/ai-health')
      if (!res.ok) throw new Error('Kontrol başarısız')
      const data = await res.json()
      const map: Record<string, { ok: boolean; message: string; latencyMs: number }> = {}
      for (const r of data.results ?? []) map[r.id] = { ok: r.ok, message: r.message, latencyMs: r.latencyMs }
      setHealth(map)
      setHealthCheckedAt(data.checkedAt)
      const failed = (data.results ?? []).filter((r: any) => !r.ok)
      if (failed.length === 0) toast.success('Tüm aktif modeller yanıt veriyor')
      else toast.error(`${failed.length} model yanıt vermiyor — detaylar aşağıda`)
    } catch {
      toast.error('Sağlık kontrolü çalıştırılamadı')
    } finally {
      setHealthLoading(false)
    }
  }

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await fetch('/api/ai-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive }),
      })
      setConfigs((prev) => prev.map((c) => c.id === id ? { ...c, isActive } : c))
      toast.success(isActive ? 'Model aktifleştirildi' : 'Model pasifleştirildi')
    } catch { toast.error('Güncellenemedi') }
  }

  const handleSaveKey = async (cfg: AiConfig) => {
    try {
      const newConfig = { ...(cfg.config ?? {}), apiKey: keyValue.trim() }
      await fetch('/api/ai-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cfg.id, config: newConfig, isActive: true }),
      })
      setConfigs((prev) => prev.map((c) => c.id === cfg.id ? { ...c, config: newConfig, isActive: true } : c))
      setKeyEditId(null)
      setKeyValue('')
      toast.success('API anahtarı kaydedildi — bu model artık ücretsiz kullanılacak')
    } catch { toast.error('Kaydedilemedi') }
  }

  const handleSaveEndpoint = async (id: string) => {
    try {
      await fetch('/api/ai-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, endpoint: editEndpoint }),
      })
      setConfigs((prev) => prev.map((c) => c.id === id ? { ...c, endpoint: editEndpoint } : c))
      setEditingId(null)
      toast.success('Endpoint güncellendi')
    } catch { toast.error('Güncellenemedi') }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
      </div>
    )
  }

  const grouped = {
    builtin: configs.filter((c) => c.type === 'builtin'),
    cloud: configs.filter((c) => c.type === 'cloud'),
    local: configs.filter((c) => c.type === 'local'),
    premium: configs.filter((c) => c.type === 'premium'),
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">AI Modeller</h1>
          <p className="text-muted-foreground mt-1">AI model yapılandırması ve routing ayarları</p>
        </div>
      </FadeIn>

      {/* Routing Info */}
      <FadeIn delay={0.1}>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Brain className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-medium">Akıllı Yönlendirme</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  <span className="font-medium text-primary">Basit işlemler</span> (kategori, hashtag, sosyal metin) → Yerel Motor (sıfır token) &bull;
                  <span className="font-medium text-blue-500"> Kendi modeliniz</span> (Ollama) varsa öncelik onda &bull;
                  <span className="font-medium text-emerald-500"> Orta/karmaşık</span> → ücretsiz Groq/Gemini &bull;
                  <span className="font-medium text-amber-500"> Son çare</span> → Abacus AI (token cimri)
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  İpucu: Ücretsiz Cloud modellerini kullanmak için ücretsiz bir API anahtarı ekleyin —
                  Groq (<span className="font-mono">console.groq.com</span>) veya Gemini (<span className="font-mono">aistudio.google.com</span>).
                  Anahtar eklenmezse tüm işler sıfır token Yerel Motor ile yapılır.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Önbellek istatistiği */}
      {cacheStats && (
        <FadeIn delay={0.15}>
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-emerald-500 mt-0.5" />
                <div>
                  <h3 className="font-medium">Akıllı Önbellek (Sıfır Token)</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Daha önce işlenmiş <span className="font-medium text-emerald-500">{cacheStats.count}</span> istek önbellekte saklanıyor.
                    Bu sayede <span className="font-medium text-emerald-500">{cacheStats.totalHits}</span> kez tekrar işlem hiç token harcanmadan yapıldı.
                    Tüm modeller (yerel ve bağlı) aynı sonucu buradan çeker.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Sağlık Kontrolü */}
      <FadeIn delay={0.15}>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <Activity className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-medium">Model Sağlık Kontrolü</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Aktif modellere minimal bir "ping" gönderir (1 token) — bir model adı geçersiz
                    olduğunda veya bir anahtar çalışmadığında burada anında görürsün.
                  </p>
                  {healthCheckedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Son kontrol: {new Date(healthCheckedAt).toLocaleString('tr-TR')}
                    </p>
                  )}
                </div>
              </div>
              <Button size="sm" onClick={runHealthCheck} disabled={healthLoading} className="gap-1.5 shrink-0">
                <RefreshCw className={`w-3.5 h-3.5 ${healthLoading ? 'animate-spin' : ''}`} />
                {healthLoading ? 'Kontrol ediliyor...' : 'Modelleri Kontrol Et'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Model groups */}
      {Object.entries(grouped).map(([type, models]) => {
        const tCfg = typeConfig[type] ?? typeConfig.cloud
        const TIcon = tCfg.icon
        return (
          <FadeIn key={type} delay={0.1}>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TIcon className={`w-5 h-5 ${tCfg.color}`} />
                <h2 className="text-lg font-display font-semibold">{tCfg.label}</h2>
                <Badge variant="outline">{models.length} model</Badge>
              </div>

              <Stagger staggerDelay={0.05}>
                <div className="grid gap-3">
                  {models.map((cfg) => (
                    <StaggerItem key={cfg.id}>
                      <HoverLift>
                        <Card>
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-medium font-mono text-sm">{cfg.modelName}</h3>
                                  <Badge variant={cfg.isActive ? 'default' : 'secondary'}>
                                    {cfg.isActive ? 'Aktif' : 'Pasif'}
                                  </Badge>
                                  {health[cfg.id] && (
                                    <Badge
                                      variant="outline"
                                      title={health[cfg.id].message}
                                      className={`gap-1 ${health[cfg.id].ok ? 'text-emerald-500 border-emerald-500/30' : 'text-red-500 border-red-500/30'}`}
                                    >
                                      {health[cfg.id].ok
                                        ? <CheckCircle2 className="w-3 h-3" />
                                        : <XCircle className="w-3 h-3" />}
                                      {health[cfg.id].ok ? `${health[cfg.id].latencyMs}ms` : health[cfg.id].message.slice(0, 40)}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {(cfg.config as any)?.description ?? cfg.endpoint}
                                </p>
                                {editingId === cfg.id ? (
                                  <div className="flex gap-2 mt-3">
                                    <Input
                                      value={editEndpoint}
                                      onChange={(e) => setEditEndpoint(e.target.value)}
                                      placeholder="Endpoint URL"
                                      className="text-xs font-mono"
                                    />
                                    <Button size="sm" onClick={() => handleSaveEndpoint(cfg.id)} className="gap-1">
                                      <Save className="w-3.5 h-3.5" /> Kaydet
                                    </Button>
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground font-mono mt-2 truncate">
                                    {cfg.endpoint}
                                  </p>
                                )}
                                <div className="flex items-center gap-4 mt-3">
                                  {cfg.apiKeyEnv && (
                                    <span className="text-xs text-muted-foreground">
                                      Anahtar: <span className="font-mono">{cfg.apiKeyEnv}</span>
                                    </span>
                                  )}
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <BarChart3 className="w-3 h-3" />
                                    {cfg.usageCount} kullanım
                                  </span>
                                  {cfg.type === 'cloud' && (
                                    <span className={`text-xs flex items-center gap-1 ${(cfg.config as any)?.apiKey ? 'text-emerald-500' : 'text-amber-500'}`}>
                                      <Key className="w-3 h-3" />
                                      {(cfg.config as any)?.apiKey ? 'Anahtar tanımlı' : 'Anahtar gerekli'}
                                    </span>
                                  )}
                                </div>
                                {cfg.type === 'cloud' && (
                                  keyEditId === cfg.id ? (
                                    <div className="flex gap-2 mt-3">
                                      <Input
                                        value={keyValue}
                                        onChange={(e) => setKeyValue(e.target.value)}
                                        placeholder="Ücretsiz API anahtarını yapıştır"
                                        type="password"
                                        className="text-xs font-mono"
                                      />
                                      <Button size="sm" onClick={() => handleSaveKey(cfg)} className="gap-1">
                                        <Save className="w-3.5 h-3.5" /> Kaydet
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => { setKeyEditId(null); setKeyValue('') }}>İptal</Button>
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="gap-1 mt-3"
                                      onClick={() => { setKeyEditId(cfg.id); setKeyValue((cfg.config as any)?.apiKey ?? '') }}
                                    >
                                      <Key className="w-3.5 h-3.5" />
                                      {(cfg.config as any)?.apiKey ? 'Anahtarı değiştir' : 'Ücretsiz anahtar ekle'}
                                    </Button>
                                  )
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => {
                                    setEditingId(cfg.id)
                                    setEditEndpoint(cfg.endpoint)
                                  }}
                                  title="Endpoint düzenle"
                                >
                                  <Settings2 className="w-4 h-4" />
                                </Button>
                                <Switch
                                  checked={cfg.isActive}
                                  onCheckedChange={(checked) => handleToggle(cfg.id, checked)}
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </HoverLift>
                    </StaggerItem>
                  ))}
                </div>
              </Stagger>
            </div>
          </FadeIn>
        )
      })}
    </div>
  )
}
