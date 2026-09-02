export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const category = searchParams.get('category')
  const platform = searchParams.get('platform')
  const where: any = {}
  if (status) where.status = status
  if (category) where.category = category
  if (platform) where.source = { type: platform }
  const clips = await prisma.clip.findMany({
    where,
    include: { source: { select: { name: true, type: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json(clips)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  try {
    const body = await request.json()
    const clip = await prisma.clip.create({ data: body })
    return NextResponse.json(clip)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Klip eklenemedi' }, { status: 500 })
  }
}
