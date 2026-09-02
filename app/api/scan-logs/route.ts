export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  const logs = await prisma.scanLog.findMany({
    include: { source: { select: { name: true, type: true } } },
    orderBy: { startedAt: 'desc' },
    take: 50,
  })
  return NextResponse.json(logs)
}
