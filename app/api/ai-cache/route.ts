export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  try {
    const count = await prisma.aiCache.count()
    const agg = await prisma.aiCache.aggregate({ _sum: { hits: true } })
    return NextResponse.json({ count, totalHits: agg._sum.hits ?? 0 })
  } catch {
    return NextResponse.json({ count: 0, totalHits: 0 })
  }
}
