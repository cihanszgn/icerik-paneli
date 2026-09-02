export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  const sources = await prisma.source.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(sources)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  try {
    const body = await request.json()
    const source = await prisma.source.create({
      data: {
        name: body.name,
        type: body.type,
        url: body.url,
        categories: body.categories ?? [],
        isActive: body.isActive ?? true,
        config: body.config ?? {},
      },
    })
    return NextResponse.json(source)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Kaynak eklenemedi' }, { status: 500 })
  }
}
