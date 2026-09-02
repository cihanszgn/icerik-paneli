import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Hidden test account
  const hashedPw = await bcrypt.hash('DN7UXd#4ZR', 12)
  await prisma.user.upsert({
    where: { email: 'abacus-3757adb1@example.com' },
    update: {},
    create: { email: 'abacus-3757adb1@example.com', password: hashedPw, name: 'Admin' },
  })

  // Admin kullanıcı (kullanıcı adı: admin / şifre: admin123)
  const adminPw = await bcrypt.hash('admin123', 12)
  await prisma.user.upsert({
    where: { email: 'admin' },
    update: { password: adminPw },
    create: { email: 'admin', password: adminPw, name: 'Admin' },
  })

  // Default AI configurations
  const aiConfigs = [
    {
      modelName: 'yerel-motor',
      endpoint: 'builtin://local-engine',
      apiKeyEnv: null,
      type: 'builtin',
      isActive: true,
      config: {
        description: 'Yerel Motor — Sıfır Token (kategorilendirme, puanlama, hashtag, sosyal metin). Uygulama içinde çalışır, kredi harcamaz, her cihazdan çalışır.',
      },
    },
    {
      modelName: 'groq/compound',
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      apiKeyEnv: 'GROQ_API_KEY',
      type: 'cloud',
      isActive: true,
      config: { description: 'Groq Compound (Ücretsiz)', maxTokens: 1024, rateLimit: 30 },
    },
    {
      modelName: 'gemini-3.6-flash',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
      apiKeyEnv: 'GEMINI_API_KEY',
      type: 'cloud',
      isActive: true,
      config: { description: 'Google Gemini Flash (Ücretsiz)', maxTokens: 4096 },
    },
    {
      modelName: 'distilbert-sentiment',
      endpoint: 'https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english',
      apiKeyEnv: 'HF_API_KEY',
      type: 'cloud',
      isActive: true,
      config: { description: 'HuggingFace Sentiment (Ücretsiz)' },
    },
    {
      modelName: 'pollinations-image',
      endpoint: 'https://image.pollinations.ai',
      apiKeyEnv: null,
      type: 'image',
      isActive: true,
      config: {
        description: 'Görsel Ajanı — Ücretsiz / Sıfır Token görsel üretimi (Pollinations). Anahtar gerektirmez, içerikle alakalı kapak görselleri üretir.',
      },
    },
    {
      modelName: 'ollama-local',
      endpoint: 'http://localhost:11434',
      apiKeyEnv: null,
      type: 'local',
      isActive: false,
      config: {
        description: 'Ollama / Kendi yerel modeliniz. Bulut dağıtımının erişebilmesi için bilgisayarınızdaki Ollama’yı bir tünel (Cloudflare Tunnel / ngrok) ile açıp genel URL’yi buraya yazın. Sıfır token.',
        modelTag: 'llama3',
      },
    },
    {
      modelName: 'route-llm',
      endpoint: 'https://apps.abacus.ai/v1/chat/completions',
      apiKeyEnv: 'ABACUSAI_API_KEY',
      type: 'premium',
      isActive: true,
      config: { description: 'Abacus AI RouteLLM (Premium)', maxTokens: 500, monthlyLimit: 1000 },
    },
  ]

  for (const cfg of aiConfigs) {
    await prisma.aiConfig.upsert({
      where: { id: cfg.modelName },
      update: { ...cfg, id: cfg.modelName },
      create: { ...cfg, id: cfg.modelName },
    })
  }

  // Default settings
  const defaultSettings = [
    { key: 'scan_interval_kick', value: { minutes: 30 } },
    { key: 'scan_interval_youtube', value: { minutes: 60 } },
    { key: 'scan_interval_website', value: { minutes: 360 } },
    { key: 'default_categories', value: ['eğlence', 'bilim', 'teknoloji', 'oyun', 'spor', 'finans'] },
    { key: 'ai_routing', value: { simple: 'groq', medium: 'gemini', complex: 'abacus' } },
    { key: 'abacus_monthly_usage', value: { count: 0, limit: 1000, resetDate: new Date().toISOString() } },
  ]

  for (const s of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value as any },
      create: { key: s.key, value: s.value as any },
    })
  }

  console.log('Seed tamamlandı!')
}

main().catch(console.error).finally(() => prisma.$disconnect())
