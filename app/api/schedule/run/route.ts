export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { scanKick, scanYoutube, scanWebsite, withRetry } from '@/lib/scanners'

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  try {
    const body = await request.json().catch(() => ({}))
    const scanType = body?.type ?? 'all'

    const results: Record<string, number> = {}

    if (scanType === 'all' || scanType === 'kick') {
      const sources = await withRetry(() =>
        prisma.source.findMany({ where: { type: 'kick', isActive: true } })
      )
      let count = 0
      for (const s of sources) count += await scanKick(s)
      results.kick = count
    }
    if (scanType === 'all' || scanType === 'youtube') {
      const sources = await withRetry(() =>
        prisma.source.findMany({ where: { type: 'youtube', isActive: true } })
      )
      let count = 0
      for (const s of sources) count += await scanYoutube(s)
      results.youtube = count
    }
    if (scanType === 'all' || scanType === 'websites') {
      const sources = await withRetry(() =>
        prisma.source.findMany({ where: { type: 'website', isActive: true } })
      )
      let count = 0
      for (const s of sources) count += await scanWebsite(s)
      results.websites = count
    }

    const total = Object.values(results).reduce((a, b) => a + b, 0)
    return NextResponse.json({ success: true, clipsFound: total, results })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Zamanlanmış tarama başarısız' }, { status: 500 })
  }
}
