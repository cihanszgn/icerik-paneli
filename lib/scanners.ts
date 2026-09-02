import { prisma } from '@/lib/prisma'
import * as cheerio from 'cheerio'
import { callAi } from '@/lib/ai-router'
import { buildImagePrompt, generateImageUrl, absolutizeUrl } from '@/lib/image-gen'

// Transient DB hatalarında (idle-session timeout, kapanan bağlantı) yeniden dene
export async function withRetry<T>(fn: () => Promise<T>, retries = 4): Promise<T> {
  let lastErr: any
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err: any) {
      lastErr = err
      const msg = String(err?.message ?? '').toLowerCase()
      const code = err?.code
      const transient =
        msg.includes('idle-session') ||
        msg.includes('idle session') ||
        msg.includes('connection') ||
        msg.includes('closed') ||
        msg.includes('terminating') ||
        msg.includes('econnreset') ||
        code === 'P1001' ||
        code === 'P1017' ||
        code === 'P2024'
      if (transient && i < retries - 1) {
        await new Promise((r) => setTimeout(r, 300 * (i + 1)))
        continue
      }
      throw err
    }
  }
  throw lastErr
}

type ClipData = {
  sourceId: string
  title: string
  description: string
  platformLink: string
  engagementScore: number
  category: string
  status: string
  timestampStart?: number | null
  timestampEnd?: number | null
  thumbnailUrl?: string | null
  mediaUrl?: string | null
}

// Toplanan klip verilerini DB'ye hızlıca yaz (bağlantıyı uzun süre tutmadan)
async function persistClips(sourceId: string, scanType: string, clipData: ClipData[]) {
  const log = await withRetry(() =>
    prisma.scanLog.create({ data: { sourceId, scanType, status: 'running' } })
  )
  try {
    let created = 0
    if (clipData.length > 0) {
      const links = clipData.map((c) => c.platformLink)
      const existing = await withRetry(() =>
        prisma.clip.findMany({
          where: { sourceId, platformLink: { in: links } },
          select: { platformLink: true },
        })
      )
      const existingSet = new Set(existing.map((e) => e.platformLink))
      const toCreate = clipData.filter(
        (c, idx) =>
          !existingSet.has(c.platformLink) &&
          clipData.findIndex((x) => x.platformLink === c.platformLink) === idx
      )
      if (toCreate.length > 0) {
        await withRetry(() => prisma.clip.createMany({ data: toCreate, skipDuplicates: true }))
        created = toCreate.length
      }
    }
    await withRetry(() =>
      prisma.scanLog.update({
        where: { id: log.id },
        data: { status: 'completed', itemsFound: created, completedAt: new Date() },
      })
    )
    return created
  } catch (err: any) {
    await withRetry(() =>
      prisma.scanLog.update({
        where: { id: log.id },
        data: { status: 'failed', message: err?.message ?? 'Bilinmeyen hata', completedAt: new Date() },
      })
    ).catch(() => {})
    throw err
  }
}

// ============================================================================
// ETKİLEŞİM ANALİZİ — Gerçek veriye dayalı "dikkat çekici an" tespiti
// ----------------------------------------------------------------------------
// YouTube: "en çok tekrar izlenen" (most-replayed) ısı haritası + altyazıdaki
//   kahkaha/gülme sinyalleri -> zaman damgalı derin link (kök yayın linki DEĞİL).
// Kick: kullanıcıların oluşturduğu gerçek klipler (izlenme = gerçek etkileşim).
// Hiçbir uydurma içerik üretilmez; sadece gerçek etkileşim verisi analiz edilir.
// ============================================================================

function secondsToLabel(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

const LAUGH_CUES = [
  '[laughter]', '[laughs]', '[laughing]', '(laughs)', '(laughter)', '[gülüşmeler]',
  'hahaha', 'ahahah', 'jajaja', 'kahkaha', 'gülme', 'çok komik', 'gülmekten',
  'lmao', 'lol ', 'ölüyorum gülmekten',
]

function hasLaughter(text: string): boolean {
  const t = (text ?? '').toLowerCase()
  return LAUGH_CUES.some((c) => t.includes(c))
}

// ---- InnerTube (YouTube dahili API) ----
// İzleme sayfası HTML kazıması bu IP'den 429 (rate-limit) alıyor; bunun yerine
// YouTube'un kendi dahili API'sini (InnerTube) kullanıyoruz. Public web istemci anahtarı.
const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'

type HeatPeak = { startSec: number; durSec: number; intensity: number }

// InnerTube 'next' -> most-replayed ısı haritası + video başlığı
async function fetchInnertubeNext(
  videoId: string
): Promise<{ peaks: HeatPeak[]; videoTitle: string }> {
  const peaks: HeatPeak[] = []
  let videoTitle = ''
  try {
    const res = await fetch(`https://www.youtube.com/youtubei/v1/next?key=${INNERTUBE_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: '2.20240101.00.00', hl: 'tr' } },
        videoId,
      }),
    })
    if (!res.ok) return { peaks, videoTitle }
    const j: any = await res.json()
    // Başlık
    try {
      const contents =
        j?.contents?.twoColumnWatchNextResults?.results?.results?.contents ?? []
      for (const c of contents) {
        const t = c?.videoPrimaryInfoRenderer?.title?.runs?.[0]?.text
        if (t) { videoTitle = t; break }
      }
    } catch {}
    // Isı haritası: frameworkUpdates -> macroMarkersListEntity -> markersList (MARKER_TYPE_HEATMAP)
    const mutations = j?.frameworkUpdates?.entityBatchUpdate?.mutations ?? []
    for (const mut of mutations) {
      const ml = mut?.payload?.macroMarkersListEntity?.markersList
      if (ml?.markerType === 'MARKER_TYPE_HEATMAP' && Array.isArray(ml?.markers)) {
        for (const mk of ml.markers) {
          const startMillis = parseInt(mk?.startMillis ?? '0')
          const durationMillis = parseInt(mk?.durationMillis ?? '0')
          const intensity = Number(mk?.intensityScoreNormalized ?? 0)
          if (durationMillis > 0) {
            peaks.push({ startSec: startMillis / 1000, durSec: durationMillis / 1000, intensity })
          }
        }
      }
    }
  } catch {}
  return { peaks, videoTitle }
}

// InnerTube 'player' (ANDROID istemcisi) -> altyazı baseUrl (varsa)
async function fetchInnertubeCaptionUrl(videoId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '19.09.37',
            androidSdkVersion: 30,
            hl: 'tr',
          },
        },
        videoId,
      }),
    })
    if (!res.ok) return null
    const j: any = await res.json()
    const tracks =
      j?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
    if (!Array.isArray(tracks) || tracks.length === 0) return null
    const pick =
      tracks.find((t: any) => t?.languageCode === 'tr') ??
      tracks.find((t: any) => t?.languageCode?.startsWith?.('en')) ??
      tracks[0]
    return pick?.baseUrl ?? null
  } catch {
    return null
  }
}

type Caption = { t: number; text: string }

async function fetchCaptions(baseUrl: string): Promise<Caption[]> {
  try {
    const url = baseUrl.includes('fmt=') ? baseUrl : `${baseUrl}&fmt=json3`
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) return []
    const data = await res.json()
    const events = data?.events ?? []
    const caps: Caption[] = []
    for (const e of events) {
      const t = (e?.tStartMs ?? 0) / 1000
      const text = (e?.segs ?? []).map((s: any) => s?.utf8 ?? '').join('').replace(/\s+/g, ' ').trim()
      if (text) caps.push({ t, text })
    }
    return caps
  } catch {
    return []
  }
}

function captionTextAround(caps: Caption[], startSec: number, endSec: number): string {
  return caps
    .filter((c) => c.t >= startSec - 4 && c.t <= endSec + 4)
    .map((c) => c.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Bir YouTube videosunu analiz edip zaman damgalı "dikkat çekici an" klipleri üret
export async function analyzeYoutubeMoments(
  videoId: string,
  source: any,
  maxMoments = 4
): Promise<ClipData[]> {
  const clips: ClipData[] = []
  try {
    const { peaks, videoTitle: fetchedTitle } = await fetchInnertubeNext(videoId)
    const videoTitle = fetchedTitle || source.name || 'Video'
    const capUrl = await fetchInnertubeCaptionUrl(videoId)
    const caps = capUrl ? await fetchCaptions(capUrl) : []

    // 1) Isı haritası tepe noktaları (en çok tekrar izlenen anlar)
    let moments: { startSec: number; endSec: number; intensity: number; laugh: boolean }[] = []
    if (peaks.length > 0) {
      // Yoğunluğa göre sırala, ancak birbirine çok yakın (< 45sn) tepeleri ele —
      // böylece klipler videonun farklı anlarına dağılır, hepsi girişe yığılmaz.
      const sorted = [...peaks].sort((a, b) => b.intensity - a.intensity)
      const spaced: typeof sorted = []
      const MIN_GAP = 45
      for (const p of sorted) {
        if (spaced.every((s) => Math.abs(s.startSec - p.startSec) >= MIN_GAP)) {
          spaced.push(p)
        }
        if (spaced.length >= maxMoments * 2) break
      }
      const top = (spaced.length >= maxMoments ? spaced : sorted).slice(0, maxMoments * 2)
      for (const p of top) {
        const around = captionTextAround(caps, p.startSec, p.startSec + p.durSec)
        moments.push({
          startSec: Math.floor(p.startSec),
          endSec: Math.floor(p.startSec + p.durSec),
          intensity: p.intensity,
          laugh: hasLaughter(around),
        })
      }
      // Kahkaha içerenleri öne al, sonra yoğunluk
      moments.sort((a, b) => Number(b.laugh) - Number(a.laugh) || b.intensity - a.intensity)
      moments = moments.slice(0, maxMoments)
    } else if (caps.length > 0) {
      // 2) Isı haritası yoksa: altyazıdaki kahkaha sinyallerinden an çıkar
      for (const c of caps) {
        if (hasLaughter(c.text)) {
          moments.push({ startSec: Math.floor(c.t), endSec: Math.floor(c.t) + 20, intensity: 0.8, laugh: true })
        }
        if (moments.length >= maxMoments) break
      }
    }

    for (const mo of moments) {
      const snippet = captionTextAround(caps, mo.startSec, mo.endSec)
      let title = ''
      if (snippet && snippet.length > 8) {
        try {
          // Sıfır token: Yerel Motor altyazı parçasından başlık üretir
          const ai = await callAi(
            `Aşağıdaki video anını en fazla 8 kelimeyle, dikkat çekici tek bir Türkçe başlık olarak özetle: "${snippet.slice(0, 300)}"`,
            'simple'
          )
          title = (ai ?? '').split('\n')[0].replace(/^["'\-•\s]+|["'\s]+$/g, '').slice(0, 90)
        } catch {}
      }
      if (!title) {
        title = `${videoTitle.slice(0, 60)} — ${secondsToLabel(mo.startSec)}`
      }
      const emoji = mo.laugh ? '😂' : '🔥'
      clips.push({
        sourceId: source.id,
        title: `${emoji} ${title} (dk ${secondsToLabel(mo.startSec)})`,
        description: mo.laugh
          ? `Kahkaha/etkileşim yoğun an • ${secondsToLabel(mo.startSec)}${snippet ? ` — "${snippet.slice(0, 160)}"` : ''}`
          : `En çok tekrar izlenen an • ${secondsToLabel(mo.startSec)}${snippet ? ` — "${snippet.slice(0, 160)}"` : ''}`,
        platformLink: `https://youtube.com/watch?v=${videoId}&t=${mo.startSec}s`,
        timestampStart: mo.startSec,
        timestampEnd: mo.endSec,
        engagementScore: Math.round(Math.min(mo.intensity * 100 + (mo.laugh ? 15 : 0), 100)),
        category: source.categories?.[0] ?? 'eğlence',
        status: 'new',
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      })
    }
  } catch {}
  return clips
}

// Kick kanalından gerçek kullanıcı kliplerini (izlenme = etkileşim) çek
async function fetchKickClips(username: string, source: any, maxClips = 5): Promise<ClipData[]> {
  const clips: ClipData[] = []
  try {
    const res = await fetch(`https://kick.com/api/v2/channels/${username}/clips?sort=view&time=all`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
    })
    if (!res.ok) return clips
    const data = await res.json()
    const list = data?.clips ?? data?.data ?? []
    for (const c of (list as any[]).slice(0, maxClips)) {
      const rawId = c?.id?.toString() ?? ''
      const views = c?.view_count ?? c?.views ?? 0
      const title = c?.title?.trim() || `${username} klip`
      // Doğrudan oynatılabilir HLS/mp4 (gömülü oynatıcı için)
      const media = c?.video_url || c?.clip_url || null
      // İzleme sayfası linki (m3u8 DEĞİL): m3u8 yolundan clip_xxx kimliğini çıkar
      const clipId =
        (typeof media === 'string' ? media.match(/(clip_[A-Za-z0-9]+)/)?.[1] : null) || rawId
      const link = clipId
        ? `https://kick.com/${username}/clips/${clipId}`
        : `https://kick.com/${username}`
      const thumb = c?.thumbnail_url || c?.thumbnail?.src || c?.thumbnail?.url || null
      const start = c?.start_time != null ? Math.floor(Number(c.start_time)) : null
      const dur = c?.duration != null ? Math.floor(Number(c.duration)) : null
      clips.push({
        sourceId: source.id,
        title: `🎬 ${title}`,
        description: `Kick klip • ${views.toLocaleString('tr-TR')} izlenme${c?.category?.name ? ` • ${c.category.name}` : ''}`,
        platformLink: link,
        timestampStart: start,
        timestampEnd: start != null && dur != null ? start + dur : null,
        engagementScore: Math.round(Math.min(views / 100, 100)),
        category: source.categories?.[0] ?? 'eğlence',
        status: 'new',
        thumbnailUrl: thumb,
        mediaUrl: media,
      })
    }
  } catch {}
  return clips
}

// ============ KICK ============
export async function scanKick(source: any): Promise<number> {
  const username = source.url?.replace('https://kick.com/', '')?.replace(/\/$/, '')?.replace('/', '') ?? source.name
  const clipData: ClipData[] = []

  // --- Dış veri çekme (DB bağlantısı tutmadan) ---
  try {
    const channelRes = await fetch(`https://kick.com/api/v2/channels/${username}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
    })
    if (channelRes.ok) {
      const channelData = await channelRes.json()
      const isLive = channelData?.livestream != null
      if (isLive) {
        const streamTitle = channelData?.livestream?.session_title ?? 'Canlı Yayın'
        const viewers = channelData?.livestream?.viewer_count ?? 0
        clipData.push({
          sourceId: source.id,
          title: `🔴 ${streamTitle}`,
          description: `Canlı: ${viewers} izleyici - ${username}`,
          platformLink: `https://kick.com/${username}`,
          engagementScore: Math.min(viewers / 100, 100),
          category: source.categories?.[0] ?? 'eğlence',
          status: 'new',
        })
      }
    }
  } catch {}

  // VOD'lar
  try {
    const vodRes = await fetch(`https://kick.com/api/v2/channels/${username}/videos`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
    })
    if (vodRes.ok) {
      const vodData = await vodRes.json()
      const videos = vodData?.data ?? vodData ?? []
      for (const vod of (videos as any[])?.slice(0, 5) ?? []) {
        const vodViews = vod?.views ?? vod?.viewer_count ?? 0
        const vodId = vod?.id?.toString() ?? vod?.video?.uuid ?? ''
        clipData.push({
          sourceId: source.id,
          title: vod?.session_title ?? vod?.title ?? `${username} VOD`,
          description: `${vodViews} görüntülenme`,
          platformLink: `https://kick.com/${username}?video=${vodId}`,
          engagementScore: Math.min(vodViews / 1000, 100),
          category: source.categories?.[0] ?? 'eğlence',
          status: 'new',
        })
      }
    }
  } catch {}

  // Gerçek kullanıcı klipleri (izlenme = dikkat çekici anlar). Kök yayın linki değil,
  // doğrudan klip linki ve küçük görsel ile.
  try {
    const kickClips = await fetchKickClips(username, source)
    clipData.push(...kickClips)
  } catch {}

  return persistClips(source.id, 'kick', clipData)
}

// ============ YOUTUBE ============
async function resolveYoutubeChannelId(url: string): Promise<string | null> {
  // channel/UC... doğrudan
  const direct = url.match(/channel\/(UC[\w-]+)/)
  if (direct) return direct[1]
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) return null
    const html = await res.text()
    const m =
      html.match(/"channelId":"(UC[\w-]+)"/) ??
      html.match(/channel\/(UC[\w-]+)/) ??
      html.match(/"externalId":"(UC[\w-]+)"/)
    return m?.[1] ?? null
  } catch {
    return null
  }
}

export async function scanYoutube(source: any): Promise<number> {
  const config = (source.config as any) ?? {}
  const url = source.url ?? ''
  const clipData: ClipData[] = []

  const videoIdMatch = url.match(/[?&]v=([^&]+)/) ?? url.match(/youtu\.be\/([^?&]+)/)

  if (videoIdMatch) {
    // Spesifik video — etkileşim analizi (most-replayed + kahkaha) ile zaman damgalı anlar
    const videoId = videoIdMatch[1]
    const moments = await analyzeYoutubeMoments(videoId, source)
    if (moments.length > 0) {
      clipData.push(...moments)
    } else {
      // Analiz sonuç vermezse en azından videoyu ekle
      const timestampStart = config?.timestampStart ?? 0
      const link =
        timestampStart > 0
          ? `https://youtube.com/watch?v=${videoId}&t=${timestampStart}s`
          : `https://youtube.com/watch?v=${videoId}`
      clipData.push({
        sourceId: source.id,
        title: source.name ?? 'YouTube Video',
        description: `Video: ${videoId}`,
        platformLink: link,
        timestampStart,
        timestampEnd: null,
        engagementScore: 50,
        category: source.categories?.[0] ?? 'eğlence',
        status: 'new',
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      })
    }
  } else {
    // Kanal - channel_id çöz, RSS ile son videolar
    const channelId = await resolveYoutubeChannelId(url)
    if (channelId) {
      try {
        const rssRes = await fetch(
          `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        )
        if (rssRes.ok) {
          const rssText = await rssRes.text()
          const entries = rssText.split('<entry>').slice(1, 8)
          const videoIds: string[] = []
          for (const entry of entries) {
            const vid = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
            const title = entry.match(/<title>([^<]+)<\/title>/)?.[1] ?? `Video: ${vid}`
            const views = entry.match(/views count="(\d+)"/)?.[1]
            if (!vid) continue
            videoIds.push(vid)
            const viewNum = views ? parseInt(views) : 0
            clipData.push({
              sourceId: source.id,
              title,
              description: `Kanal: ${source.name}${viewNum ? ` • ${viewNum.toLocaleString('tr-TR')} görüntülenme` : ''}`,
              platformLink: `https://youtube.com/watch?v=${vid}`,
              engagementScore: viewNum ? Math.min(viewNum / 10000, 100) : 30,
              category: source.categories?.[0] ?? 'eğlence',
              status: 'new',
              thumbnailUrl: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
            })
          }
          // En son 2 videoyu etkileşim analizi ile zaman damgalı anlara böl
          for (const vid of videoIds.slice(0, 2)) {
            try {
              const moments = await analyzeYoutubeMoments(vid, source, 3)
              clipData.push(...moments)
            } catch {}
          }
        }
      } catch {}
    }
  }

  return persistClips(source.id, 'youtube', clipData)
}

// ============ WEBSITE ============
export async function scanWebsite(source: any): Promise<number> {
  const clipData: ClipData[] = []

  try {
    const res = await fetch(source.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ContentPanel/1.0)' },
    })
    if (res.ok) {
      const html = await res.text()
      const $ = cheerio.load(html)

      // Sayfa geneli kapak görseli (og:image / twitter:image)
      const pageOgImage = absolutizeUrl(
        $('meta[property="og:image"]').attr('content') ||
          $('meta[name="twitter:image"]').attr('content') ||
          $('meta[property="og:image:url"]').attr('content'),
        source.url
      )

      const articles: { title: string; link: string; description: string; image: string }[] = []
      $('article, .post, .entry, .article, [role="article"]').each((_: any, el: any) => {
        const title = $(el).find('h1, h2, h3, .title, .headline').first().text()?.trim()
        const link = $(el).find('a').first().attr('href')
        const desc = $(el).find('p, .excerpt, .summary, .description').first().text()?.trim()
        const imgEl = $(el).find('img').first()
        const rawImg =
          imgEl.attr('src') ||
          imgEl.attr('data-src') ||
          imgEl.attr('data-lazy-src') ||
          (imgEl.attr('srcset')?.split(',')[0]?.trim()?.split(' ')[0] ?? '')
        if (title && link) {
          try {
            const fullLink = link?.startsWith('http') ? link : new URL(link, source.url).href
            articles.push({ title, link: fullLink, description: desc ?? '', image: absolutizeUrl(rawImg, source.url) })
          } catch {}
        }
      })

      if (articles.length === 0) {
        $('a[href]').each((_: any, el: any) => {
          const text = $(el).text()?.trim()
          const href = $(el).attr('href')
          if (text && text.length > 20 && href && !href?.startsWith('#') && !href?.includes('javascript:')) {
            try {
              const fullLink = href?.startsWith('http') ? href : new URL(href, source.url).href
              if (articles.length < 10) articles.push({ title: text, link: fullLink, description: '', image: '' })
            } catch {}
          }
        })
      }

      // AI kategorilendirme dış aşamada (DB bağlantısı tutmadan)
      for (const article of articles.slice(0, 5)) {
        let category = source.categories?.[0] ?? 'genel'
        let score = 30
        try {
          const aiResult = await callAi(
            `Bu içeriği kategorize et (sadece kategori adını yaz): "${article.title}". Kategoriler: ${source.categories?.join(', ') ?? 'eğlence, bilim, teknoloji, oyun, spor, finans'}`,
            'simple'
          )
          if (aiResult) {
            category = aiResult.trim().toLowerCase().replace(/["'.]/g, '').split('\n')[0].slice(0, 30)
            score = 50
          }
        } catch {}
        // Her web içeriğine mutlaka bir görsel: makale görseli -> sayfa kapağı
        // -> ücretsiz Görsel Ajanı (Pollinations, sıfır token) ile üretilen görsel
        const thumbnailUrl =
          article.image ||
          pageOgImage ||
          generateImageUrl(buildImagePrompt({ title: article.title, category }), 'post')
        clipData.push({
          sourceId: source.id,
          title: article.title.slice(0, 200),
          description: article.description?.slice(0, 500) ?? '',
          platformLink: article.link,
          engagementScore: score,
          category,
          status: 'new',
          thumbnailUrl,
        })
      }
    }
  } catch {}

  return persistClips(source.id, 'website', clipData)
}
