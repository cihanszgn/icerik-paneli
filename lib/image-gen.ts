// ============================================================================
// GÖRSEL AJANI — Ücretsiz / Sıfır Token Görsel Üretimi (Pollinations.ai)
// ----------------------------------------------------------------------------
// Anahtar gerektirmez, kredi/token harcamaz. Üretilen görsel URL'i istemci
// tarafında <img> ile yüklenir; sunucu tarafında indirme yapılmaz.
// İçerikle alakalı görsel üreterek paylaşımları zenginleştirir.
// ============================================================================

const DIMS: Record<string, { w: number; h: number }> = {
  reels: { w: 720, h: 1280 },
  shorts: { w: 720, h: 1280 },
  post: { w: 1080, h: 1080 },
  tweet: { w: 1200, h: 675 },
}

// İçerikten görsel istemi (prompt) üret
export function buildImagePrompt(input: {
  title: string
  category?: string | null
  description?: string | null
}): string {
  const title = (input.title || '')
    .replace(/^🔴\s*/, '')
    .replace(/^🎬\s*/, '')
    .trim()
  const cat = (input.category || '').trim()
  const parts: string[] = []
  if (title) parts.push(title)
  if (cat) parts.push(`${cat} temalı`)
  parts.push(
    'sosyal medya kapağı',
    'canlı renkler',
    'yüksek kalite',
    'sinematik ışık',
    'dijital illüstrasyon'
  )
  return parts.filter(Boolean).join(', ')
}

// Ücretsiz görsel URL'i (Pollinations). Aynı istem + seed = aynı görsel.
export function generateImageUrl(prompt: string, format: string = 'post', seed?: number): string {
  const d = DIMS[format] ?? DIMS.post
  const s = typeof seed === 'number' ? seed : Math.floor(Math.random() * 1_000_000)
  const enc = encodeURIComponent((prompt || 'içerik').slice(0, 300))
  return `https://image.pollinations.ai/prompt/${enc}?width=${d.w}&height=${d.h}&nologo=true&seed=${s}`
}

// Bir clip/başlık için doğrudan kullanılabilir görsel URL'i üret
export function imageForContent(
  input: { title: string; category?: string | null; description?: string | null },
  format: string = 'post',
  seed?: number
): string {
  return generateImageUrl(buildImagePrompt(input), format, seed)
}

// Göreli görsel yolunu mutlak URL'e çevir
export function absolutizeUrl(src: string | undefined | null, base: string): string {
  if (!src) return ''
  try {
    if (/^https?:\/\//.test(src)) return src
    if (src.startsWith('//')) return 'https:' + src
    return new URL(src, base).href
  } catch {
    return ''
  }
}
