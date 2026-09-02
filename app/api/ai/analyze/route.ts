export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { callAi } from '@/lib/ai-router'

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  try {
    const body = await request.json()
    const { prompt, level, stream } = body

    if (!prompt) return NextResponse.json({ error: 'Prompt gerekli' }, { status: 400 })

    if (stream) {
      // Streaming response via Abacus AI
      const apiKey = process.env.ABACUSAI_API_KEY
      if (!apiKey) return NextResponse.json({ error: 'API key eksik' }, { status: 500 })

      const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-5.4-mini',
          messages: [{ role: 'user', content: prompt }],
          stream: true,
          max_tokens: 1000,
        }),
      })

      const readableStream = new ReadableStream({
        async start(controller) {
          const reader = response.body?.getReader()
          const decoder = new TextDecoder()
          const encoder = new TextEncoder()
          try {
            while (true) {
              const { done, value } = await reader!.read()
              if (done) break
              const chunk = decoder.decode(value)
              controller.enqueue(encoder.encode(chunk))
            }
          } catch (error) {
            console.error('Stream hatası:', error)
            controller.error(error)
          } finally {
            controller.close()
          }
        },
      })

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    const result = await callAi(prompt, level ?? 'simple')
    return NextResponse.json({ result })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'AI analiz başarısız' }, { status: 500 })
  }
}
