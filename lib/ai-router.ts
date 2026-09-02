import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { localAiRespond } from '@/lib/local-ai'

export type AiTaskLevel = 'simple' | 'medium' | 'complex'

function cacheKey(level: AiTaskLevel, prompt: string) {
  return createHash('sha256').update(`${level}\n${prompt}`).digest('hex')
}

// Önbellek katmanı: daha önce işlenmiş (ve token harcanmış) istekler
// tekrar geldiğinde SIFIR token ile aynı sonucu döndürür. Yerel ve tüm
// bağlı modeller bu ortak önbellekten veri çeker.
export async function callAi(prompt: string, level: AiTaskLevel = 'simple'): Promise<string> {
  const key = cacheKey(level, prompt)

  // 1) Önce önbelleğe bak — varsa hiç token harcamadan döndür
  try {
    const cached = await prisma.aiCache.findUnique({ where: { key } })
    if (cached && cached.response) {
      prisma.aiCache
        .update({ where: { key }, data: { hits: { increment: 1 } } })
        .catch(() => {})
      return cached.response
    }
  } catch {}

  // 2) Önbellekte yoksa modeli çağır
  const response = await callAiCore(prompt, level)

  // 3) Boş olmayan sonucu önbelleğe yaz (bir dahaki sefere sıfır token)
  if (response && response.trim()) {
    let source = 'unknown'
    try {
      const m = await getActiveModel(level)
      source = m?.type ?? 'unknown'
    } catch {}
    prisma.aiCache
      .upsert({
        where: { key },
        create: { key, level, prompt, response, source },
        update: {},
      })
      .catch(() => {})
  }

  return response
}

// Bir modelin kullanılabilir anahtarı var mı? (inline config anahtarı veya env)
function modelHasKey(m: any): boolean {
  const inline = (m?.config as any)?.apiKey
  if (inline && inline !== 'placeholder') return true
  const name: string = m?.modelName ?? ''
  let envVal: string | undefined
  if (/llama|mixtral/i.test(name)) envVal = process.env.GROQ_API_KEY
  else if (/gemini/i.test(name)) envVal = process.env.GEMINI_API_KEY
  else envVal = process.env.HF_API_KEY
  return !!envVal && envVal !== 'placeholder'
}

// Sohbet/metin üretebilen model mi? (sentiment/sınıflandırma modellerini ele)
function modelIsChat(m: any): boolean {
  return !/sentiment|distilbert|classification/i.test(m?.modelName ?? '')
}

// Uzaktan erişilebilir mi? (localhost bulut dağıtımından erişilemez)
function modelIsRemote(m: any): boolean {
  const ep: string = m?.endpoint ?? ''
  if (!/^https?:\/\//.test(ep)) return false
  return !/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(ep)
}

export async function getActiveModel(level: AiTaskLevel) {
  const configs = await prisma.aiConfig.findMany({ where: { isActive: true } })

  const builtin = configs.find((c) => c.type === 'builtin')
  const premium = configs.find((c) => c.type === 'premium')
  // Ücretsiz bulut modelleri (anahtarı olan, metin üretebilen).
  // Temiz JSON/metin döndüren Gemini tercih edilir; diğerleri yedek.
  const cloudCandidates = configs.filter(
    (c) => c.type === 'cloud' && modelIsChat(c) && modelHasKey(c)
  )
  const cloud =
    cloudCandidates.find((c) => /generativelanguage|gemini/i.test(`${c.endpoint} ${c.modelName}`)) ??
    cloudCandidates[0]
  // Yerel model yalnızca gerçekten erişilebilir (tünel/genel URL) ise kullan
  const local = configs.find((c) => c.type === 'local' && modelIsRemote(c))

  // Öncelik: token maliyetini minimize et ama ücretsiz bulut modellerini
  // gerçekten kullan. Zenginleştirme (medium/complex) için ücretsiz bulut
  // tercih edilir; premium (ücretli) daima son çare.
  switch (level) {
    case 'simple':
      return builtin ?? local ?? cloud ?? premium ?? configs?.[0]
    case 'medium':
      return cloud ?? local ?? builtin ?? premium ?? configs?.[0]
    case 'complex':
      return cloud ?? local ?? premium ?? builtin ?? configs?.[0]
    default:
      return builtin ?? cloud ?? premium ?? configs?.[0]
  }
}

async function callAiCore(prompt: string, level: AiTaskLevel = 'simple'): Promise<string> {
  const model = await getActiveModel(level)
  if (!model) {
    // Hiç aktif model yoksa bile yerel motorla ücretsiz yanıt üret
    return localAiRespond(prompt)
  }

  try {
    if (model.type === 'builtin') {
      // Yerel Motor — sıfır token, dış çağrı yok
      const result = localAiRespond(prompt)
      await prisma.aiConfig
        .update({ where: { id: model.id }, data: { usageCount: { increment: 1 } } })
        .catch(() => {})
      return result
    }

    if (model.type === 'premium') {
      // Abacus AI RouteLLM
      const apiKey = process.env.ABACUSAI_API_KEY
      if (!apiKey) throw new Error('ABACUSAI_API_KEY ayarlanmamış')
      const config = model.config as any
      const res = await fetch(model.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-5.4-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: config?.maxTokens ?? 500,
        }),
      })
      if (!res.ok) throw new Error(`Abacus AI hata: ${res.status}`)
      const data = await res.json()
      await prisma.aiConfig.update({ where: { id: model.id }, data: { usageCount: { increment: 1 } } })
      return data?.choices?.[0]?.message?.content ?? ''
    }

    if (model.type === 'local') {
      // Ollama / kendi yerel modelleriniz.
      // Endpoint önceliği: AI config'te girilen endpoint -> OLLAMA_ENDPOINT env -> localhost.
      // NOT: Bulut dağıtımı bilgisayarınızın localhost'una erişemez; bir tünel (Cloudflare/ngrok)
      // ile oluşan genel URL'yi AI config sayfasından girmeniz gerekir.
      const config = model.config as any
      let base =
        (model.endpoint && /^https?:\/\//.test(model.endpoint) ? model.endpoint : '') ||
        process.env.OLLAMA_ENDPOINT ||
        'http://localhost:11434'
      base = base.replace(/\/$/, '')
      const modelTag = config?.modelTag ?? 'llama3'

      // OpenAI-uyumlu uç (ör. tünel üzerinden /v1/chat/completions)
      if (/\/chat\/completions$/.test(base)) {
        const res = await fetch(base, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelTag,
            messages: [{ role: 'user', content: prompt }],
            stream: false,
            max_tokens: config?.maxTokens ?? 1024,
          }),
        })
        if (!res.ok) throw new Error(`Yerel model hata: ${res.status}`)
        const data = await res.json()
        await prisma.aiConfig.update({ where: { id: model.id }, data: { usageCount: { increment: 1 } } }).catch(() => {})
        return data?.choices?.[0]?.message?.content ?? ''
      }

      // Native Ollama API
      const genUrl = /\/api\/generate$/.test(base) ? base : `${base}/api/generate`
      const res = await fetch(genUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelTag, prompt, stream: false }),
      })
      if (!res.ok) throw new Error(`Ollama hata: ${res.status}`)
      const data = await res.json()
      await prisma.aiConfig.update({ where: { id: model.id }, data: { usageCount: { increment: 1 } } }).catch(() => {})
      return data?.response ?? ''
    }

    // Cloud (Groq - OpenAI uyumlu uç)
    if (model.endpoint?.includes('api.groq.com') || model.modelName?.includes('llama') || model.modelName?.includes('mixtral')) {
      // Önce AI config'te girilen anahtar, sonra env
      const apiKey = (model.config as any)?.apiKey || process.env.GROQ_API_KEY
      if (!apiKey || apiKey === 'placeholder') throw new Error('GROQ_API_KEY ayarlanmamış')
      const res = await fetch(model.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: model.modelName,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: (model.config as any)?.maxTokens ?? 2048,
        }),
      })
      if (!res.ok) throw new Error(`Groq hata: ${res.status}`)
      const data = await res.json()
      await prisma.aiConfig.update({ where: { id: model.id }, data: { usageCount: { increment: 1 } } })
      return data?.choices?.[0]?.message?.content ?? ''
    }

    // Gemini
    if (model.endpoint?.includes('generativelanguage') || model.modelName?.includes('gemini')) {
      const apiKey = (model.config as any)?.apiKey || process.env.GEMINI_API_KEY
      if (!apiKey || apiKey === 'placeholder') throw new Error('GEMINI_API_KEY ayarlanmamış')
      const res = await fetch(`${model.endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      })
      if (!res.ok) throw new Error(`Gemini hata: ${res.status}`)
      const data = await res.json()
      await prisma.aiConfig.update({ where: { id: model.id }, data: { usageCount: { increment: 1 } } })
      return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    }

    throw new Error(`Desteklenmeyen model: ${model.modelName}`)
  } catch (error: any) {
    console.error('AI çağrısı başarısız:', error?.message)
    // Her seviyede önce SIFIR TOKEN Yerel Motor'a düş (kredi harcamadan).
    // Yerel Motor her zaman bir yanıt üretir; böylece ücretsiz bulut modeli
    // (Groq/Gemini) geçici olarak başarısız olsa bile premium (ücretli) çağrılmaz.
    try {
      const local = localAiRespond(prompt)
      if (local && local.trim()) return local
    } catch {}
    // Son çare: Abacus AI RouteLLM (yalnızca Yerel Motor da yanıt veremezse)
    if (model.type !== 'premium') {
      try {
        const apiKey = process.env.ABACUSAI_API_KEY
        if (apiKey) {
          const res = await fetch('https://apps.abacus.ai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: 'gpt-5.4-mini',
              messages: [{ role: 'user', content: prompt }],
              max_tokens: 500,
            }),
          })
          if (res.ok) {
            const data = await res.json()
            return data?.choices?.[0]?.message?.content ?? ''
          }
        }
      } catch {}
    }
    throw error
  }
}
