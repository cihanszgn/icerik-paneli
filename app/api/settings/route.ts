export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  const settings = await prisma.setting.findMany()
  const result: Record<string, any> = {}
  for (const s of settings ?? []) {
    result[s.key] = s.value
  }
  return NextResponse.json(result)
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  try {
    const body = await request.json()
    const results: any[] = []
    for (const [key, value] of Object.entries(body)) {
      const s = await prisma.setting.upsert({
        where: { key },
        update: { value: value as any },
        create: { key, value: value as any },
      })
      results.push(s)
    }
    return NextResponse.json({ success: true, updated: results.length })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Ayarlar güncellenemedi' }, { status: 500 })
  }
}
