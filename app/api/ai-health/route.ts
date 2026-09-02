export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { checkAllModels } from '@/lib/ai-healthcheck'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  try {
    const results = await checkAllModels()
    return NextResponse.json({ results, checkedAt: new Date().toISOString() })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Kontrol başarısız' }, { status: 500 })
  }
}
