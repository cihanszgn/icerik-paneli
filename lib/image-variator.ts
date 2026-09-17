ts
// lib/image-variator.ts
// Sharp ile görsel varyasyon (crop, filtre, re-encode) + R2/S3 yükleme
import sharp from 'sharp'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export type PostFormat = 'reels' | 'shorts' | 'post' | 'tweet' | 'story'

// R2/S3 Client (mevcut @aws-sdk/client-s3 zaten package.json'da var)
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'auto',
  endpoint: process.env.R2_ENDPOINT || process.env.AWS_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
})

const BUCKET = process.env.R2_BUCKET || process.env.AWS_BUCKET || 'icerik-paneli'
const PUBLIC_URL_BASE = process.env.R2_PUBLIC_URL || `https://${BUCKET}.r2.dev`

function getDimensions(format: PostFormat): { width: number; height: number } {
  switch (format) {
    case 'reels': case 'shorts': case 'story': return { width: 1080, height: 1920 }
    case 'post': return { width: 1080, height: 1080 }
    case 'tweet': return { width: 1200, height: 675 }
    default: return { width: 1080, height: 1080 }
  }
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  if (url.startsWith('data:')) {
    // data:image/png;base64,... formatından buffer çıkar
    const base64 = url.split(',')[1]
    return Buffer.from(base64, 'base64')
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

async function uploadToR2(buffer: Buffer, key: string, contentType: string): Promise<string> {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable'
  }))
  return `${PUBLIC_URL_BASE}/${key}`
}

/**
 * URL'den görseli indir, formata göre crop et, hafif varyasyon uygula, R2'ye yükle, public URL döndür
 */
export async function varyAndUploadImage(sourceUrl: string, format: PostFormat, clipId: string): Promise<string> {
  const { width, height } = getDimensions(format)
  const buffer = await fetchImageBuffer(sourceUrl)

  // Sharp ile işle: entropy-based smart crop + hafif filtre + webp
  const varied = await sharp(buffer)
    .resize(width, height, {
      fit: 'cover',
      position: 'entropy',  // en ilgi çekici kısım (yüz, hareket vb.)
      withoutEnlargement: false
    })
    .modulate({
      brightness: 1.02 + Math.random() * 0.06,  // ±3%
      saturation: 1.0 + Math.random() * 0.04,   // +0-4%
      hue: (Math.random() - 0.5) * 2            // ±1 derece
    })
    .sharpen({ sigma: 0.5 })                    // hafif netleştirme
    .webp({ quality: 85, effort: 4 })           // WebP, iyi sıkıştırma
    .toBuffer()

  const key = `posts/${clipId}/${format}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`
  return uploadToR2(varied, key, 'image/webp')
}

/**
 * Sadece varyasyon yap, upload etmeden buffer döndür (test için)
 */
export async function varyImageBuffer(sourceUrl: string, format: PostFormat): Promise<Buffer> {
  const { width, height } = getDimensions(format)
  const buffer = await fetchImageBuffer(sourceUrl)
  return sharp(buffer)
    .resize(width, height, { fit: 'cover', position: 'entropy' })
    .modulate({ brightness: 1.03, saturation: 1.02 })
    .webp({ quality: 85 })
    .toBuffer()
}
