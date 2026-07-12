import { ref } from 'vue'
import { Html5Qrcode } from 'html5-qrcode'

export function useQrScanner() {
  const scanner = ref(null)
  const scannedToken = ref('')
  const isScanning = ref(false)
  const error = ref('')
  const isFrontCamera = ref(false)

  async function startScanner(elementId, onScan) {
    try {
      error.value = ''
      isScanning.value = true

      const facing = isFrontCamera.value ? 'user' : 'environment'

      if (!scanner.value) {
        const el = document.getElementById(elementId)
        if (!el) throw new Error('Elemen scanner tidak ditemukan')
        scanner.value = new Html5Qrcode(elementId)
      }

      await scanner.value.start(
        { facingMode: facing },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1
        },
        (decodedText) => {
          scannedToken.value = decodedText
          if (onScan) onScan(decodedText)
        },
        () => {}
      )

      console.log('[QR Scanner] Started with facingMode:', facing)
    } catch (e) {
      console.error('[QR Scanner] Start error:', e)
      isScanning.value = false

      const msg = e.toString()
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        error.value = 'Izinkan akses kamera di pengaturan browser, lalu coba lagi'
      } else if (msg.includes('NotFoundError')) {
        error.value = 'Kamera tidak ditemukan'
      } else if (msg.includes('NotReadableError')) {
        error.value = 'Kamera sedang digunakan aplikasi lain'
      } else if (msg.includes('elemen')) {
        error.value = msg
      } else {
        error.value = 'Gagal mengakses kamera'
      }
    }
  }

  async function toggleCamera(elementId, onScan) {
    if (!scanner.value || !isScanning.value) return
    try {
      await scanner.value.stop()
      isFrontCamera.value = !isFrontCamera.value
      await startScanner(elementId, onScan)
    } catch (e) {
      isFrontCamera.value = !isFrontCamera.value
      isScanning.value = false
      error.value = 'Gagal mengganti kamera'
    }
  }

  async function stopScanner() {
    try {
      if (scanner.value) {
        await scanner.value.stop()
        scanner.value = null
      }
    } catch (e) {
      console.warn('[QR Scanner] Stop error:', e)
    }
    isScanning.value = false
    error.value = ''
  }

  return {
    scannedToken,
    isScanning,
    error,
    isFrontCamera,
    startScanner,
    toggleCamera,
    stopScanner
  }
}
