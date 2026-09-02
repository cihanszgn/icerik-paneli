'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { FadeIn, Stagger, StaggerItem, HoverLift } from '@/components/ui/animate'
import {
  Share2, Copy, Trash2, Check, Edit2, Save, X, Hash,
  Film, Instagram, Youtube, MessageSquare, Sparkles
} from 'lucide-react'
import { toast } from 'sonner'
import { SafeDate } from '@/components/safe-format'

const formatLabels: Record<string, { label: string; icon: any; color: string }> = {
  reels: { label: 'Reels', icon: Instagram, color: 'text-pink-500' },
  shorts: { label: 'Shorts', icon: Youtube, color: 'text-red-500' },
  post: { label: 'Post', icon: Instagram, color: 'text-purple-500' },
  tweet: { label: 'Tweet', icon: MessageSquare, color: 'text-blue-400' },
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  draft: { label: 'Taslak', variant: 'secondary' },
  ready: { label: 'Hazır', variant: 'default' },
  published: { label: 'Paylaşıldı', variant: 'outline' },
}

interface Post {
  id: string
  clipId: string
  format: string
  title: string
  description: string | null
  hashtags: string[]
  status: string
  createdAt: string
  imageUrl: string | null
  clip: { title: string; platformLink: string; thumbnailUrl: string | null; mediaUrl: string | null; timestampStart: number | null; source: { name: string; type: string } | null } | null
}

// Kick klipleri HLS (.m3u8) formatındadır. hls.js ile tarayıcı içinde
// (indirmeden) oynatılır; Safari yerel HLS destekler. Desteklenmezse
// kapak görseline tıklayınca Kick sayfasında açılır.
function KickPlayer({ src, poster, title, link }: { src: string; poster: string | null; title: string; link: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return
    let hls: any = null
    let cancelled = false

    // Önce hls.js dene (Chrome/Firefox/Edge güvenilir HLS oynatımı).
    // hls.js desteklenmiyorsa yerel HLS'e (Safari/iOS) düş.
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return
      if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: true })
        hls.loadSource(src)
        hls.attachMedia(video)
        hls.on(Hls.Events.ERROR, (_e: any, data: any) => {
          if (data?.fatal) setFailed(true)
        })
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src
      } else {
        setFailed(true)
      }
    }).catch(() => {
      if (cancelled) return
      if (video.canPlayType('application/vnd.apple.mpegurl')) video.src = src
      else setFailed(true)
    })

    return () => {
      cancelled = true
      if (hls) { try { hls.destroy() } catch {} }
    }
  }, [src])

  if (failed) {
    return (
      <div role="button" tabIndex={0} onClick={() => window.open(link, '_blank', 'noopener,noreferrer')} className="block relative w-full max-w-md aspect-video rounded-lg overflow-hidden bg-muted mt-3 group cursor-pointer">
        {poster && <img src={poster} alt={title} className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
            <div className="w-0 h-0 border-y-8 border-y-transparent border-l-[14px] border-l-black ml-1" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full max-w-md aspect-video rounded-lg overflow-hidden bg-black mt-3">
      <video
        ref={videoRef}
        controls
        playsInline
        poster={poster ?? undefined}
        className="absolute inset-0 w-full h-full"
      />
    </div>
  )
}

function getYoutubeEmbed(link: string, start?: number | null): string | null {
  if (!link) return null
  let id = ''
  try {
    const u = new URL(link)
    if (u.hostname.includes('youtu.be')) id = u.pathname.slice(1)
    else if (u.searchParams.get('v')) id = u.searchParams.get('v') as string
    else if (u.pathname.includes('/embed/')) id = u.pathname.split('/embed/')[1]
    else if (u.pathname.includes('/shorts/')) id = u.pathname.split('/shorts/')[1]
  } catch { return null }
  if (!id) return null
  id = id.split('&')[0].split('?')[0]
  const s = start && start > 0 ? `?start=${Math.floor(start)}` : ''
  return `https://www.youtube.com/embed/${id}${s}`
}

function MediaPreview({ post, onRegen, regenning }: { post: Post; onRegen: () => void; regenning: boolean }) {
  const clip = post.clip
  const type = clip?.source?.type
  const isVideoFormat = post.format === 'reels' || post.format === 'shorts'

  // YouTube: gerçek video oynatıcı
  if (type === 'youtube' && clip) {
    const embed = getYoutubeEmbed(clip.platformLink, clip.timestampStart)
    if (embed) {
      return (
        <div className="relative w-full max-w-md aspect-video rounded-lg overflow-hidden bg-black mt-3">
          <iframe
            src={embed}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={clip.title}
          />
        </div>
      )
    }
  }

  // Kick: HLS klibini tarayıcı içinde oynat (indirme yok)
  if (type === 'kick' && clip?.mediaUrl) {
    return <KickPlayer src={clip.mediaUrl} poster={clip.thumbnailUrl} title={clip.title} link={clip.platformLink} />
  }

  // Oynatılabilir video yok (ör. web içeriği) -> içerikle alakalı görsel.
  // Öncelik: paylaşım için üretilen görsel (imageUrl) -> gerçek kapak (thumbnailUrl).
  // Görsel Ajanı (Pollinations) ile sıfır token’la yeni görsel üretilebilir.
  const img = post.imageUrl || clip?.thumbnailUrl || null
  const link = clip?.platformLink
  return (
    <div className="mt-3">
      {img ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => link && window.open(link, '_blank', 'noopener,noreferrer')}
          className="block relative w-full max-w-md aspect-video rounded-lg overflow-hidden bg-muted group cursor-pointer"
        >
          <img src={img} alt={clip?.title ?? post.title} className="absolute inset-0 w-full h-full object-cover" />
          {isVideoFormat && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
              <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                <div className="w-0 h-0 border-y-8 border-y-transparent border-l-[14px] border-l-black ml-1" />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center w-full max-w-md aspect-video rounded-lg bg-muted/60 border border-dashed border-border text-xs text-muted-foreground">
          Henüz görsel yok
        </div>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={onRegen}
        disabled={regenning}
        className="mt-2 gap-1.5"
      >
        <Sparkles className={`w-3.5 h-3.5 ${regenning ? 'animate-pulse' : ''}`} />
        {regenning ? 'Üretiliyor…' : img ? 'Yeni Görsel Üret' : 'AI Görsel Üret'}
      </Button>
    </div>
  )
}

export function PostsClient() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editHashtags, setEditHashtags] = useState('')
  const [regenId, setRegenId] = useState<string | null>(null)

  const fetchPosts = useCallback(async () => {
    try {
      const params = filterStatus !== 'all' ? `?status=${filterStatus}` : ''
      const res = await fetch(`/api/posts${params}`)
      if (res.ok) setPosts(await res.json())
    } catch {} finally { setLoading(false) }
  }, [filterStatus])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  const handleCopyAll = (post: Post) => {
    const text = `${post.title}\n\n${post.description ?? ''}\n\n${(post.hashtags ?? []).map((h: string) => `#${h}`).join(' ')}\n\n${post.clip?.platformLink ?? ''}`
    navigator.clipboard?.writeText?.(text)
    toast.success('Tüm metin kopyalandı!')
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await fetch(`/api/posts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setPosts((prev) => prev.map((p) => p.id === id ? { ...p, status } : p))
      toast.success('Durum güncellendi')
    } catch { toast.error('Güncellenemedi') }
  }

  const handleRegenImage = async (id: string) => {
    setRegenId(id)
    try {
      const res = await fetch('/api/social/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: id }),
      })
      if (res.ok) {
        const data = await res.json()
        setPosts((prev) => prev.map((p) => p.id === id ? { ...p, imageUrl: data.imageUrl } : p))
        toast.success('Yeni görsel üretildi (sıfır token)')
      } else {
        toast.error('Görsel üretilemedi')
      }
    } catch { toast.error('Görsel üretilemedi') } finally { setRegenId(null) }
  }

  const handleEdit = (post: Post) => {
    setEditingId(post.id)
    setEditTitle(post.title)
    setEditDesc(post.description ?? '')
    setEditHashtags((post.hashtags ?? []).join(', '))
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    try {
      await fetch(`/api/posts/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          description: editDesc,
          hashtags: editHashtags.split(',').map((h: string) => h.trim()).filter(Boolean),
        }),
      })
      setPosts((prev) => prev.map((p) => p.id === editingId ? {
        ...p,
        title: editTitle,
        description: editDesc,
        hashtags: editHashtags.split(',').map((h: string) => h.trim()).filter(Boolean),
      } : p))
      setEditingId(null)
      toast.success('Güncellendi!')
    } catch { toast.error('Güncellenemedi') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu paylaşımı silmek istediğinize emin misiniz?')) return
    try {
      await fetch(`/api/posts/${id}`, { method: 'DELETE' })
      setPosts((prev) => prev.filter((p) => p.id !== id))
      toast.success('Silindi')
    } catch { toast.error('Silinemedi') }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 w-full" />
        {[1, 2].map((i) => <Skeleton key={i} className="h-48" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Paylaşımlar</h1>
          <p className="text-muted-foreground mt-1">Hazırlanan sosyal medya içerikleri</p>
        </div>
      </FadeIn>

      <Tabs value={filterStatus} onValueChange={setFilterStatus}>
        <TabsList>
          <TabsTrigger value="all">Tümü ({posts.length})</TabsTrigger>
          <TabsTrigger value="draft">Taslak</TabsTrigger>
          <TabsTrigger value="ready">Hazır</TabsTrigger>
          <TabsTrigger value="published">Paylaşıldı</TabsTrigger>
        </TabsList>
      </Tabs>

      {posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Share2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-muted-foreground">Henüz paylaşım yok</p>
            <p className="text-sm text-muted-foreground mt-1">Toplanan Veriler sayfasından paylaşım hazırlayabilirsiniz</p>
          </CardContent>
        </Card>
      ) : (
        <Stagger staggerDelay={0.05}>
          <div className="grid gap-4">
            {posts.map((post) => {
              const fInfo = formatLabels[post.format] ?? formatLabels.post
              const sInfo = statusConfig[post.status] ?? statusConfig.draft
              const FIcon = fInfo.icon
              const isEditing = editingId === post.id

              return (
                <StaggerItem key={post.id}>
                  <HoverLift>
                    <Card>
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 ${fInfo.color}`}>
                            <FIcon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <div className="space-y-3">
                                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Başlık" />
                                <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Açıklama" rows={3} />
                                <Input value={editHashtags} onChange={(e) => setEditHashtags(e.target.value)} placeholder="Hashtag'ler (virgülle ayır)" />
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={handleSaveEdit} className="gap-1"><Save className="w-3.5 h-3.5" /> Kaydet</Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="w-3.5 h-3.5" /></Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-medium">{post.title}</h3>
                                  <Badge variant={sInfo.variant}>{sInfo.label}</Badge>
                                  <Badge variant="outline" className="text-xs">{fInfo.label}</Badge>
                                </div>
                                {post.description && (
                                  <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{post.description}</p>
                                )}
                                {(post.hashtags?.length ?? 0) > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    {(post.hashtags ?? []).map((h: string, i: number) => (
                                      <Badge key={i} variant="secondary" className="text-xs gap-1">
                                        <Hash className="w-3 h-3" />{h}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                                <MediaPreview post={post} onRegen={() => handleRegenImage(post.id)} regenning={regenId === post.id} />
                                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                  <span>İçerik: {post.clip?.title ?? 'Bilinmiyor'}</span>
                                  <span>•</span>
                                  <SafeDate date={post.createdAt} options={{ dateStyle: 'short' }} />
                                </div>
                              </>
                            )}
                          </div>
                          {!isEditing && (
                            <div className="flex items-center gap-1 shrink-0">
                              <Button variant="ghost" size="icon-sm" onClick={() => handleCopyAll(post)} title="Kopyala">
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon-sm" onClick={() => handleEdit(post)} title="Düzenle">
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              {post.status === 'draft' && (
                                <Button variant="ghost" size="icon-sm" onClick={() => handleStatusChange(post.id, 'ready')} title="Hazır olarak işaretle">
                                  <Check className="w-4 h-4 text-emerald-500" />
                                </Button>
                              )}
                              {post.status === 'ready' && (
                                <Button variant="ghost" size="icon-sm" onClick={() => handleStatusChange(post.id, 'published')} title="Paylaşıldı olarak işaretle">
                                  <Share2 className="w-4 h-4 text-primary" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(post.id)} className="text-destructive hover:text-destructive" title="Sil">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
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
    </div>
  )
}
