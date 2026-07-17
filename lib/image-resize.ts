/* Client-side image downscale, shared by the Tool Crib photo upload and the
   nameplate OCR scan.

   Two consumers, two outputs from one canvas pass:
     - the OCR route wants a base64 data URL (it forwards the bytes to Claude)
     - the photo upload wants a Blob (uploadToSignedUrl takes a File/Blob)

   Downscaling on the client keeps the OCR request under the route's ~6MB
   backstop and keeps stored tool photos small enough to render as thumbnails
   without shipping 12MB phone originals. Same approach as the equipment
   nameplate scanner (fileToResizedDataUrl in EquipmentTicketForm), consolidated
   here so both features share one implementation.

   HEIC note: <canvas> can't decode HEIC, so those reject — the caller falls back
   to "enter it manually", same as the equipment scanner. */

export type ResizedImage = { blob: Blob; dataUrl: string; width: number; height: number }

export async function resizeImage(
  file: File,
  { maxDim = 1600, quality = 0.82 }: { maxDim?: number; quality?: number } = {}
): Promise<ResizedImage> {
  const srcUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('read failed'))
    r.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('decode failed'))
    i.src = srcUrl
  })

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')
  ctx.drawImage(img, 0, 0, w, h)

  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', quality)
  })

  return { blob, dataUrl, width: w, height: h }
}
