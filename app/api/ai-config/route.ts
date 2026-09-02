export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  const configs = await prisma.aiConfig.findMany({ orderBy: { type: 'asc' } })
  return NextResponse.json(configs)
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  try {
    const body = await request.json()
    const config = await prisma.aiConfig.update({
      where: { id: body.id },
      data: { isActive: body.isActive, config: body.config, endpoint: body.endpoint },
    })
    return NextResponse.json(config)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Güncellenemedi' }, { status: 500 })
  }
}
