ts
// app/api/posts/generate/route.ts
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { generatePostsForClip } from '@/lib/post-generator'

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  try {
    const body = await request.json()
    const { clipId, formats } = body

    if (!clipId) return NextResponse.json({ error: 'clipId gerekli' }, { status: 400 })

    // formats validasyonu
    const validFormats = ['reels', 'shorts', 'post', 'tweet', 'story'] as const
    const targetFormats = formats?.filter((f: string) => validFormats.includes(f)) ?? validFormats

    const posts = await generatePostsForClip({ clipId, formats: targetFormats })
    return NextResponse.json({ success: true, posts })
  } catch (error: any) {
    console.error('Post generation error:', error)
    return NextResponse.json({ error: error?.message ?? 'Post üretimi başarısız' }, { status: 500 })
  }
}