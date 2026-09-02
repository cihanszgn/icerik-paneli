// ============================================================================
// YEREL MOTOR — Sıfır Token / Sıfır Maliyet AI
// ----------------------------------------------------------------------------
// Bu modül uygulama sunucusunun İÇİNDE çalışır. Hiçbir dış API çağrısı yapmaz,
// hiçbir token/kredi harcamaz. Kategorilendirme, puanlama, hashtag üretimi ve
// sosyal medya metni hazırlama gibi "basit" görevleri kural tabanlı (heuristik)
// olarak yürütür. Her cihazdan, bilgisayarınız kapalı olsa bile çalışır.
// ============================================================================

// Kategori -> anahtar kelime sözlüğü (TR + EN sinyaller)
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  eğlence: ['eğlence', 'komik', 'komedi', 'gül', 'şaka', 'fun', 'funny', 'meme', 'entertainment', 'dans', 'müzik', 'şarkı', 'film', 'dizi', 'vlog', 'challenge'],
  bilim: ['bilim', 'science', 'uzay', 'space', 'nasa', 'fizik', 'kimya', 'biyoloji', 'araştırma', 'keşif', 'gezegen', 'evren', 'deney', 'astronomi', 'research'],
  teknoloji: ['teknoloji', 'tech', 'yazılım', 'software', 'donanım', 'yapay zeka', ' ai ', 'telefon', 'bilgisayar', 'uygulama', 'robot', 'kod', 'coding', 'internet', 'iphone', 'android', 'gadget'],
  oyun: ['oyun', 'game', 'gaming', 'gamer', 'oyuncu', 'konsol', 'playstation', 'xbox', 'steam', 'valorant', 'league', 'lol', 'fps', 'minecraft', 'fortnite', 'gta', 'pubg'],
  spor: ['spor', 'sport', 'futbol', 'basketbol', 'maç', ' gol', 'lig', 'şampiyon', 'transfer', 'takım', 'tenis', 'formula', 'galatasaray', 'fenerbahçe', 'beşiktaş', 'nba'],
  finans: ['finans', 'finance', 'borsa', 'hisse', 'dolar', 'euro', 'bitcoin', 'kripto', 'crypto', 'ekonomi', 'yatırım', ' para', 'altın', 'faiz', 'ethereum', 'nasdaq'],
}

const STOPWORDS = new Set([
  'bir', 've', 'ile', 'bu', 'şu', 'için', 'gibi', 'çok', 'daha', 'en', 'de', 'da', 'ki', 'ne',
  'mı', 'mi', 'mu', 'mü', 'ama', 'veya', 'ya', 'the', 'a', 'an', 'of', 'to', 'in', 'on', 'and',
  'or', 'is', 'are', 'was', 'were', 'ile', 'her', 'çok', 'kadar', 'sonra', 'önce', 'olarak',
  'var', 'yok', 'oldu', 'canlı', 'video', 'yeni',
])

function normalize(s: string): string {
  return ` ${(s ?? '').toLowerCase()} `
}

// --- Kategorilendirme ---
export function localCategorize(text: string, categories?: string[]): string {
  const hay = normalize(text)
  const allowed = categories && categories.length > 0 ? categories.map((c) => c.toLowerCase()) : null

  const scores: Record<string, number> = {}
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (allowed && !allowed.includes(cat)) continue
    let s = 0
    for (const w of words) {
      if (hay.includes(w.toLowerCase())) s++
    }
    if (s > 0) scores[cat] = s
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]
  if (best) return best[0]
  // Eşleşme yoksa: izin verilen ilk kategori, yoksa 'genel'
  if (allowed && allowed.length > 0) return allowed[0]
  return 'genel'
}

// --- Etkileşim / önem puanı (0-100) ---
export function localScore(text: string, opts?: { views?: number; isLive?: boolean }): number {
  let score = 30
  const t = text ?? ''
  if (opts?.isLive) score += 30
  if (opts?.views && opts.views > 0) score += Math.min(opts.views / 1000, 40)
  // Dikkat çekici sinyaller
  if (/[!?]{1,}/.test(t)) score += 5
  if (/\d/.test(t)) score += 5
  if (t.length > 40) score += 5
  // Güçlü kelimeler
  if (/(rekor|ilk|son dakika|şok|inanılmaz|büyük|dev|müthiş|record|breaking|huge|amazing)/i.test(t)) score += 10
  return Math.max(0, Math.min(Math.round(score), 100))
}

// --- Anahtar kelime / hashtag üretimi ---
export function localHashtags(text: string, extra: string[] = [], max = 6): string[] {
  const words = (text ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))

  const freq: Record<string, number> = {}
  for (const w of words) freq[w] = (freq[w] ?? 0) + 1

  const top = Object.entries(freq)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, max)
    .map(([w]) => `#${w.replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')}`)

  const tags = [...extra.map((e) => (e.startsWith('#') ? e : `#${e}`)), ...top]
  return Array.from(new Set(tags)).slice(0, max)
}

// --- Çıkarımsal özet (ilk anlamlı cümleler) ---
export function localSummarize(text: string, maxLen = 220): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim()
  if (clean.length <= maxLen) return clean
  const sentences = clean.split(/(?<=[.!?])\s+/)
  let out = ''
  for (const s of sentences) {
    if ((out + ' ' + s).trim().length > maxLen) break
    out = (out + ' ' + s).trim()
  }
  return out || clean.slice(0, maxLen).trim() + '…'
}

// --- Sosyal medya paylaşımı üret ---
export function localSocialPost(input: {
  title: string
  description?: string
  category?: string
  platform?: string
  format?: string
}): { title: string; description: string; hashtags: string[] } {
  const rawTitle = (input.title ?? '').replace(/^🔴\s*/, '').trim()
  const title = rawTitle.length > 80 ? rawTitle.slice(0, 77).trim() + '…' : rawTitle

  const base = input.description && input.description.trim().length > 0
    ? input.description
    : rawTitle
  const description = localSummarize(base, 240)

  const extras: string[] = []
  if (input.category) extras.push(input.category)
  if (input.platform) extras.push(input.platform)
  const hashtags = localHashtags(`${rawTitle} ${input.description ?? ''}`, extras, 6)

  return { title: title || 'İçerik', description, hashtags }
}

// ============================================================================
// Drop-in yanıtlayıcı: callAi ile aynı imzada kullanılabilir.
// Prompt'un şeklini tanıyıp uygun heuristik fonksiyonu çağırır.
// ============================================================================
export function localAiRespond(prompt: string): string {
  const p = prompt ?? ''

  // 1) Kategorilendirme prompt'u
  if (/kategorize et/i.test(p) || /Kategoriler:/i.test(p)) {
    const titleMatch = p.match(/"([^"]+)"/)
    const catsMatch = p.match(/Kategoriler:\s*([^\n]+)/i)
    const cats = catsMatch?.[1]?.split(/[,،]/).map((c) => c.trim()).filter(Boolean)
    return localCategorize(titleMatch?.[1] ?? p, cats)
  }

  // 2) Sosyal medya JSON prompt'u
  if (/"hashtags"/i.test(p) && /"title"/i.test(p)) {
    const title = p.match(/Başlık:\s*([^\n]+)/i)?.[1]?.trim() ?? 'İçerik'
    const desc = p.match(/Açıklama:\s*([^\n]+)/i)?.[1]?.trim() ?? ''
    const platform = p.match(/Platform:\s*([^\n]+)/i)?.[1]?.trim() ?? ''
    const category = p.match(/Kategori:\s*([^\n]+)/i)?.[1]?.trim() ?? ''
    const format = p.match(/için\s+(\S+)\s+formatında/i)?.[1] ?? ''
    const post = localSocialPost({ title, description: desc, category, platform, format })
    return JSON.stringify(post)
  }

  // 3) Tanınmayan serbest metin: çıkarımsal özet döndür
  return localSummarize(p, 400)
}
