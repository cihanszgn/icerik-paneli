export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { callAi } from '@/lib/ai-router'
import { imageForContent } from '@/lib/image-gen'

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  try {
    const body = await request.json()
    const { clipId, format } = body

    if (!clipId || !format) {
      return NextResponse.json({ error: 'clipId ve format gerekli' }, { status: 400 })
    }

    const clip = await prisma.clip.findUnique({
      where: { id: clipId },
      include: { source: true },
    })

    if (!clip) return NextResponse.json({ error: 'Klip bulunamadı' }, { status: 404 })

    const prompt = `Şu içerik için ${format} formatında sosyal medya paylaşımı hazırla. Türkçe yanıtla.

Başlık: ${clip.title}
Açıklama: ${clip.description ?? ''}
Platform: ${clip.source?.type ?? 'bilinmiyor'}
Kategori: ${clip.category ?? 'genel'}

Yanıt formatı (sadece JSON):
{
  "title": "Kısa, dikkat çekici başlık",
  "description": "Açıklama metni",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
}

Sadece JSON yanıtla, başka bir şey yazma.`

    let title = clip.title
    let description = clip.description ?? ''
    let hashtags: string[] = []

    try {
      // 'medium' -> önce ücretsiz bulut modeli (Groq/Gemini), sonra Yerel Motor.
      // Daha zengin başlık/açıklama üretir; premium (ücretli) daima son çare.
      const aiResult = await callAi(prompt, 'medium')
      // Bulut modelleri bazen JSON öncesi/sonrası metin ekler; ilk {...} bloğunu ayıkla
      const raw = aiResult?.replace(/```json?\n?/g, '')?.replace(/```/g, '')?.trim() ?? '{}'
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw)
      title = parsed?.title ?? title
      description = parsed?.description ?? description
      hashtags = parsed?.hashtags ?? []
    } catch {
      // Fallback: basic generation
      hashtags = ['#içerik', `#${clip.category ?? 'video'}`, `#${clip.source?.type ?? 'clip'}`]
    }

    // İçerikle alakalı ücretsiz görsel (Görsel Ajanı - Pollinations, sıfır token).
    // Kick/YouTube gibi oynatılabilir medya yoksa bile payl-aşımı zenginleştirir.
    let imageUrl: string | null = null
    try {
      imageUrl = imageForContent(
        { title: clip.title, category: clip.category, description: clip.description },
        format
      )
    } catch {}

    const post = await prisma.socialPost.create({
      data: {
        clipId,
        format,
        title,
        description,
        hashtags,
        imageUrl,
        status: 'draft',
      },
    })

    return NextResponse.json(post)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Paylaşım hazırlanamadı' }, { status: 500 })
  }
}
