export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [totalSources, activeSources, totalClips, todayClips, totalPosts, readyPosts, recentClips, lastScan] = await Promise.all([
      prisma.source.count(),
      prisma.source.count({ where: { isActive: true } }),
      prisma.clip.count(),
      prisma.clip.count({ where: { createdAt: { gte: today } } }),
      prisma.socialPost.count(),
      prisma.socialPost.count({ where: { status: 'ready' } }),
      prisma.clip.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: { source: { select: { name: true, type: true } } },
      }),
      prisma.scanLog.findFirst({ orderBy: { startedAt: 'desc' } }),
    ])

    const aiConfigs = await prisma.aiConfig.findMany({ where: { isActive: true }, select: { modelName: true, type: true, usageCount: true } })

    return NextResponse.json({
      totalSources,
      activeSources,
      totalClips,
      todayClips,
      totalPosts,
      readyPosts,
      recentClips,
      lastScan,
      activeModels: aiConfigs,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'İstatistik alınamadı' }, { status: 500 })
  }
}
