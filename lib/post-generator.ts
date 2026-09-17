ts
// lib/post-generator.ts
// Clip'ten çoklu formatta post üretimi (metin + görsel + DB kaydı)
import { prisma } from '@/lib/prisma'
import { callAi } from '@/lib/ai-router'
import { searchRoyaltyFreeImage, generateImageWithAI } from '@/lib/image-finder'
import { varyAndUploadImage } from '@/lib/image-variator'

export type PostFormat = 'reels' | 'shorts' | 'post' | 'tweet' | 'story'

interface GeneratePostsInput {
  clipId: string
  formats?: PostFormat[]
  customPrompt?: string
}

interface PostContent {
  title: string
  description: string
  hashtags: string[]
}

const FORMAT_GUIDES: Record<PostFormat, string> = {
  reels: `Instagram Reels (9:19 dikey, 15-90 sn). İlk 3 sn "hook", ortası değer, son CTA. Trend ses/efekt öner. Hashtag: 5-10. JSON: {title, description, hashtags}`,
  shorts: `YouTube Shorts (9:16 dikey, ≤60 sn). Hızlı tempo, hook, trend ses. #Shorts zorunlu. Hashtag: 3-5. JSON: {title, description, hashtags}`,
  post: `Instagram/LinkedIn/FB post (1:1 kare veya 4:5). Başlık + 3-5 madde + CTA. Carousel uygun. Hashtag: 5-8. JSON: {title, description, hashtags}`,
  tweet: `Twitter/X (280 krk). Etkileşim odaklı, thread başlangıcı. Hashtag: 2-3. JSON: {title, description, hashtags}`,
  story: `Instagram Story serisi (3-5 kare, 9:16). Her kare: görsel önerisi + kısa metin + sticker (anket/soru). JSON: {title, description, hashtags}`
}

export async function generatePostsForClip({ clipId, formats, customPrompt }: GeneratePostsInput) {
  const clip = await prisma.clip.findUnique({
    where: { id: clipId },
    include: { source: true }
  })
  if (!clip) throw new Error('Clip bulunamadı')

  const targetFormats = formats ?? ['reels', 'shorts', 'post', 'tweet']
  const results = []

  for (const format of targetFormats) {
    // 1. Metin üret (AI)
    const content = await generatePostContent(clip, format, customPrompt)

    // 2. Görsel bul/üret + varyasyon + upload
    const imageUrl = await findOrGenerateImage(clip, format, clipId)

    // 3. DB'ye kaydet
    const post = await prisma.socialPost.create({
      data: {
        clipId,
        format,
        title: content.title,
        description: content.description,
        hashtags: content.hashtags,
        imageUrl,
        status: 'draft'
      }
    })
    results.push(post)
  }

  return results
}

async function generatePostContent(clip: any, format: PostFormat, customPrompt?: string): Promise<PostContent> {
  const prompt = customPrompt ?? `
${clip.title}
${clip.description ?? ''}
Kaynak: ${clip.source.name} (${clip.source.type})
Kategori: ${clip.category ?? 'genel'}

${FORMAT_GUIDES[format]}

SADECE GEÇERLİ JSON DÖNDÜR. Başka metin YOK.
`.trim()

  const response = await callAi(prompt, 'medium')

  try {
    const parsed = JSON.parse(response)
    return {
      title: String(parsed.title ?? clip.title).slice(0, 200),
      description: String(parsed.description ?? '').slice(0, 2000),
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.slice(0, 15).map(String) : ['#içerik', '#video']
    }
  } catch {
    // Fallback: prompt'tan basit çıkarım
    return {
      title: clip.title.slice(0, 200),
      description: response.slice(0, 2000),
      hashtags: ['#içerik', '#video', '#haber', `#${clip.category ?? 'genel'}`]
    }
  }
}

async function findOrGenerateImage(clip: any, format: PostFormat, clipId: string): Promise<string | null> {
  // Öncelik 1: Clip'in kendi thumbnail/media varsa varyasyona uğrat
  if (clip.thumbnailUrl) {
    try { return await varyAndUploadImage(clip.thumbnailUrl, format, clipId) } catch {}
  }
  if (clip.mediaUrl) {
    try { return await varyAndUploadImage(clip.mediaUrl, format, clipId) } catch {}
  }

  // Öncelik 2: Telifsiz görsel ara (Unsplash/Pexels/Pixabay)
  const searchQuery = buildSearchQuery(clip, format)
  const royaltyFreeUrl = await searchRoyaltyFreeImage(searchQuery, format)
  if (royaltyFreeUrl) {
    try { return await varyAndUploadImage(royaltyFreeUrl, format, clipId) } catch {}
  }

  // Öncelik 3: AI ile üret (Gemini) + varyasyon + upload
  const aiImageUrl = await generateImageWithAI(clip, format)
  if (aiImageUrl) {
    try { return await varyAndUploadImage(aiImageUrl, format, clipId) } catch {}
  }

  return null
}

function buildSearchQuery(clip: any, format: PostFormat): string {
  const keywords = [
    clip.category,
    clip.source.type,
    format === 'reels' || format === 'shorts' || format === 'story' ? 'vertical' : 'square'
  ].filter(Boolean)
  return `${clip.title} ${keywords.join(' ')}`.slice(0, 120)
}
