export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { imageForContent } from '@/lib/image-gen'

// Bir paylaşım için içerikle alakalı YENİ ücretsiz görsel üretir.
// Görsel Ajanı (Pollinations) sıfır token/kredi harcar; anahtar gerektirmez.
export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  try {
    const body = await request.json()
    const { postId, seed } = body ?? {}
    if (!postId) return NextResponse.json({ error: 'postId gerekli' }, { status: 400 })

    const post = await prisma.socialPost.findUnique({
      where: { id: postId },
      include: { clip: { select: { title: true, category: true, description: true } } },
    })
    if (!post) return NextResponse.json({ error: 'Paylaşım bulunamadı' }, { status: 404 })

    // Her çağrıda farklı görsel için rastgele seed (kullanıcı beğenmezse yenileyebilir)
    const s = typeof seed === 'number' ? seed : Math.floor(Math.random() * 1_000_000)
    const imageUrl = imageForContent(
      {
        title: post.clip?.title ?? post.title,
        category: post.clip?.category,
        description: post.clip?.description ?? post.description,
      },
      post.format,
      s
    )

    const updated = await prisma.socialPost.update({
      where: { id: postId },
      data: { imageUrl },
    })

    return NextResponse.json({ imageUrl: updated.imageUrl })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Görsel üretilemedi' }, { status: 500 })
  }
}
