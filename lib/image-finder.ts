ts
// lib/image-finder.ts
// Telifsiz görsel arama (Unsplash, Pexels, Pixabay) + AI görsel üretimi (Gemini)

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY
const PEXELS_API_KEY = process.env.PEXELS_API_KEY
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

export type PostFormat = 'reels' | 'shorts' | 'post' | 'tweet' | 'story'

function getOrientation(format: PostFormat): 'portrait' | 'landscape' | 'square' {
  if (format === 'reels' || format === 'shorts' || format === 'story') return 'portrait'
  if (format === 'tweet') return 'landscape'
  return 'square'
}

function getDimensions(format: PostFormat): { width: number; height: number } {
  switch (format) {
    case 'reels': case 'shorts': case 'story': return { width: 1080, height: 1920 }
    case 'post': return { width: 1080, height: 1080 }
    case 'tweet': return { width: 1200, height: 675 }
    default: return { width: 1080, height: 1080 }
  }
}

export async function searchRoyaltyFreeImage(query: string, format: PostFormat): Promise<string | null> {
  const orientation = getOrientation(format)

  // 1. Unsplash (en yüksek kalite)
  if (UNSPLASH_ACCESS_KEY && UNSPLASH_ACCESS_KEY !== 'placeholder') {
    try {
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=${orientation}`
      const res = await fetch(url, { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } })
      if (res.ok) {
        const data = await res.json()
        if (data.results?.length) return data.results[0].urls.small
      }
    } catch (e) { console.error('Unsplash error:', e) }
  }

  // 2. Pexels
  if (PEXELS_API_KEY && PEXELS_API_KEY !== 'placeholder') {
    try {
      const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=${orientation}`
      const res = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } })
      if (res.ok) {
        const data = await res.json()
        if (data.photos?.length) return data.photos[0].src.medium
      }
    } catch (e) { console.error('Pexels error:', e) }
  }

  // 3. Pixabay
  if (PIXABAY_API_KEY && PIXABAY_API_KEY !== 'placeholder') {
    try {
      const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&per_page=5&orientation=${orientation === 'portrait' ? 'vertical' : orientation === 'landscape' ? 'horizontal' : 'all'}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        if (data.hits?.length) return data.hits[0].webformatURL
      }
    } catch (e) { console.error('Pixabay error:', e) }
  }

  return null
}

function buildImagePrompt(clip: any, format: PostFormat): string {
  const { width, height } = getDimensions(format)
  const aspect = format === 'reels' || format === 'shorts' || format === 'story' ? '9:16 dikey' : format === 'tweet' ? '16:9 yatay' : '1:1 kare'
  return `Professional social media image for ${format}: "${clip.title}". ${clip.description ?? ''}. Style: modern, clean, ${aspect} (${width}x${height}), high quality, no text, no watermark, no logos, royalty-free stock photo style. Topic: ${clip.category ?? 'general'}. Colorful, engaging, viral-ready.`
}

export async function generateImageWithAI(clip: any, format: PostFormat): Promise<string | null> {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'placeholder') return null

  const prompt = buildImagePrompt(clip, format)

  try {
    // Gemini 2.0 Flash Experimental - Image Generation
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
      })
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Gemini image gen failed:', res.status, err)
      return null
    }

    const data = await res.json()
    const imagePart = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data)
    if (imagePart?.inlineData?.data) {
      // Base64'i geçici data URL olarak döndür (sonra varyator yüklüyor)
      return `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`
    }
  } catch (e) {
    console.error('Gemini image generation error:', e)
  }

  return null
}
