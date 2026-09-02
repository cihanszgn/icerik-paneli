import { prisma } from '@/lib/prisma'

// AI Sağlık Kontrolü — mevcut ai-router.ts mantığına DOKUNMAZ.
// Her aktif modele minimal (max_tokens:1 veya sadece bağlantı) bir "ping"
// atar ve gerçekten yanıt verip vermediğini raporlar. Amaç: model adı
// decommission olduğunda (Groq/Gemini'de daha önce yaşandığı gibi) bunu
// panelde sessizce değil, açıkça görmek.

export interface HealthResult {
  id: string
  modelName: string
  type: string
  ok: boolean
  message: string
  latencyMs: number
}

function hasKey(v?: string | null) {
  return !!v && v !== 'placeholder'
}

async function pingCloud(model: any): Promise<{ ok: boolean; message: string }> {
  const inlineKey = (model.config as any)?.apiKey
  const isGemini = /gemini/i.test(model.modelName ?? '') || /generativelanguage/i.test(model.endpoint ?? '')
  const apiKey = hasKey(inlineKey) ? inlineKey : (isGemini ? process.env.GEMINI_API_KEY : process.env.GROQ_API_KEY)
  if (!hasKey(apiKey)) return { ok: false, message: 'API anahtarı tanımlı değil' }

  try {
    if (isGemini) {
      const res = await fetch(`${model.endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'ping' }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
      })
      if (res.ok) return { ok: true, message: 'Yanıt veriyor' }
      const detail = await res.text().catch(() => '')
      return { ok: false, message: `HTTP ${res.status}${detail ? ' — ' + detail.slice(0, 100) : ''}` }
    }
    // Groq / OpenAI-uyumlu
    const res = await fetch(model.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model.modelName,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
    })
    if (res.ok) return { ok: true, message: 'Yanıt veriyor' }
    let detail = ''
    try {
      const d = await res.json()
      detail = d?.error?.message ?? ''
    } catch {}
    return { ok: false, message: `HTTP ${res.status}${detail ? ' — ' + detail.slice(0, 100) : ''}` }
  } catch (e: any) {
    return { ok: false, message: e?.message ?? 'Bağlantı hatası' }
  }
}

async function pingLocal(model: any): Promise<{ ok: boolean; message: string }> {
  let base =
    (model.endpoint && /^https?:\/\//.test(model.endpoint) ? model.endpoint : '') ||
    process.env.OLLAMA_ENDPOINT ||
    'http://localhost:11434'
  base = base.replace(/\/$/, '')
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(base)) {
    return { ok: false, message: 'Bulut sunucusundan localhost erişilemez — tünel (Cloudflare/ngrok) gerekli' }
  }
  try {
    const tagsUrl = base.replace(/\/(api\/generate|v1\/chat\/completions|chat\/completions)$/, '') + '/api/tags'
    const res = await fetch(tagsUrl, { method: 'GET' })
    if (res.ok) return { ok: true, message: 'Erişilebilir' }
    return { ok: false, message: `HTTP ${res.status}` }
  } catch (e: any) {
    return { ok: false, message: e?.message ?? 'Bağlantı hatası' }
  }
}

async function pingPremium(model: any): Promise<{ ok: boolean; message: string }> {
  const apiKey = process.env.ABACUSAI_API_KEY
  if (!hasKey(apiKey)) return { ok: false, message: 'ABACUSAI_API_KEY tanımlı değil' }
  try {
    const res = await fetch(model.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-5.4-mini',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
    })
    if (res.ok) return { ok: true, message: 'Yanıt veriyor' }
    return { ok: false, message: `HTTP ${res.status}` }
  } catch (e: any) {
    return { ok: false, message: e?.message ?? 'Bağlantı hatası' }
  }
}

async function pingImage(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch('https://image.pollinations.ai/prompt/test', { method: 'HEAD' })
    if (res.ok || res.status === 405) return { ok: true, message: 'Erişilebilir' }
    return { ok: false, message: `HTTP ${res.status}` }
  } catch {
    return { ok: false, message: 'Bağlantı hatası' }
  }
}

export async function checkAllModels(): Promise<HealthResult[]> {
  const configs = await prisma.aiConfig.findMany({ where: { isActive: true } })
  const results: HealthResult[] = []

  for (const model of configs) {
    const start = Date.now()
    let outcome: { ok: boolean; message: string }

    switch (model.type) {
      case 'builtin':
        outcome = { ok: true, message: 'Dahili — her zaman çalışır' }
        break
      case 'image':
        outcome = await pingImage()
        break
      case 'cloud':
        outcome = await pingCloud(model)
        break
      case 'local':
        outcome = await pingLocal(model)
        break
      case 'premium':
        outcome = await pingPremium(model)
        break
      default:
        outcome = { ok: false, message: 'Bilinmeyen model tipi' }
    }

    results.push({
      id: model.id,
      modelName: model.modelName,
      type: model.type,
      ok: outcome.ok,
      message: outcome.message,
      latencyMs: Date.now() - start,
    })
  }

  return results
}
