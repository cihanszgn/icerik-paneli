export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email ve şifre gerekli' }, { status: 400 })
    }
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: 'Geçersiz kimlik bilgileri' }, { status: 401 })
    }
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return NextResponse.json({ error: 'Geçersiz kimlik bilgileri' }, { status: 401 })
    }
    return NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name } })
  } catch (error: any) {
    return NextResponse.json({ error: 'Giriş hatası' }, { status: 500 })
  }
}
