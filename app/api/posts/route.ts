export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const where: any = {}
  if (status) where.status = status
  const posts = await prisma.socialPost.findMany({
    where,
    include: { clip: { select: { title: true, platformLink: true, thumbnailUrl: true, timestampStart: true, mediaUrl: true, source: { select: { name: true, type: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json(posts)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  try {
    const body = await request.json()
    const post = await prisma.socialPost.create({ data: body })
    return NextResponse.json(post)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Paylaşım oluşturulamadı' }, { status: 500 })
  }
}
