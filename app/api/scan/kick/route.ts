export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { scanKick, withRetry } from '@/lib/scanners'

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  try {
    const body = await request.json().catch(() => ({}))
    const sourceId = body?.sourceId

    const sources = sourceId
      ? [await withRetry(() => prisma.source.findUnique({ where: { id: sourceId } }))].filter(Boolean)
      : await withRetry(() => prisma.source.findMany({ where: { type: 'kick', isActive: true } }))

    let clipsFound = 0
    for (const source of sources) {
      if (!source) continue
      clipsFound += await scanKick(source)
    }

    return NextResponse.json({ success: true, clipsFound })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Tarama başarısız' }, { status: 500 })
  }
}
