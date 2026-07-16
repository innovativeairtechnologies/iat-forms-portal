import { BarcodeDetector, setZXingModuleOverrides } from 'barcode-detector/ponyfill'

/* Camera barcode decoding for the Tool Crib in-app scanner (Path B).
 *
 * Ponyfill, not polyfill: the polyfill subpath registers itself on globalThis,
 * and this feature has no business mutating the global object for the rest of
 * the portal.
 *
 * On Android Chrome the ponyfill delegates to the browser's NATIVE
 * BarcodeDetector — fast, and the .wasm is never downloaded. On iOS it falls
 * back to ZXing-C++ WebAssembly, because NO browser on iOS implements the
 * Barcode Detection API (they're all WebKit underneath, so "use Chrome" is not
 * a workaround). Same call site either way.
 *
 * This module must only ever be imported lazily, from a client component, via
 * await import() — see ScannerClient. A static import would pull the decoder
 * into the shared bundle, which Path A (the phone's own Camera app → /t/<code>)
 * must never pay for.
 */

let configured = false

/** Point the wasm loader at our own origin. Idempotent. */
function configureOnce() {
  if (configured) return
  configured = true

  // zxing-wasm otherwise fetches its binary from a hardcoded jsDelivr URL at
  // runtime (see scripts/sync-zxing-wasm.mjs). A locked-down shop network or a
  // dead CDN would break scanning at the point of use — on the floor, mid-job.
  // public/wasm/zxing_reader.wasm is kept in sync by the prebuild script.
  setZXingModuleOverrides({
    locateFile: (path: string, prefix: string) =>
      path.endsWith('.wasm') ? '/wasm/zxing_reader.wasm' : prefix + path,
  })
}

/** A detector limited to QR — our labels are QR and nothing else. */
export function createDetector(): BarcodeDetector {
  configureOnce()
  return new BarcodeDetector({ formats: ['qr_code'] })
}

export type CameraHandle = { stream: MediaStream; stop: () => void }

/**
 * Open the rear camera.
 *
 * MUST be called from a user gesture — iOS rejects getUserMedia otherwise, and
 * the rejection looks identical to a permission denial, which sends you
 * debugging the wrong thing. Requires HTTPS (localhost counts; a LAN IP does
 * not — http://192.168.x.x is not a secure context).
 */
export async function openRearCamera(): Promise<CameraHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  })
  return {
    stream,
    // Every track must be stopped or the camera indicator stays lit after the
    // component unmounts, which reads to a user as the app spying on them.
    stop: () => stream.getTracks().forEach(t => t.stop()),
  }
}
