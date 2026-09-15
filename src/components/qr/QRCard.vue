<script setup>
import { ref, onMounted, watch } from 'vue'
import QRCode from 'qrcode'
import QRFrame from './QRFrame.vue'

const props = defineProps({
  qrToken: { type: String, required: true },
  nama: { type: String, default: '' },
  nim: { type: String, default: '' },
  prodi: { type: String, default: '' },
  kelas: { type: String, default: '' },
  namaKelompok: { type: String, default: '' }
})

const qrCanvasRef = ref(null)
const qrDataUrl = ref('')
const cardRef = ref(null)
const downloading = ref(false)

async function generateQR() {
  if (!props.qrToken) return
  try {
    qrDataUrl.value = await QRCode.toDataURL(props.qrToken, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' }
    })
    if (qrCanvasRef.value) {
      await QRCode.toCanvas(qrCanvasRef.value, props.qrToken, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' }
      })
    }
  } catch (e) {
    console.error('QR generation failed:', e)
  }
}

async function downloadCard() {
  downloading.value = true
  try {
    await document.fonts.ready
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const width = 600
    const height = 750
    canvas.width = width
    canvas.height = height

    const bgColor = '#FDF6E3'
    const primaryColor = '#0F5132'
    const goldColor = '#D4AF37'
    const textColor = '#1F2937'

    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, width, height)

    drawBorders(ctx, width, height, primaryColor, goldColor)

    const qrSize = 280
    const qrX = (width - qrSize) / 2
    const qrY = 100

    const qrImg = new Image()
    qrImg.src = qrDataUrl.value
    await new Promise((resolve) => {
      qrImg.onload = () => {
        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)

        const whiteBorder = 8
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(qrX - whiteBorder, qrY - whiteBorder, qrSize + whiteBorder * 2, qrSize + whiteBorder * 2)
        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)

        // Title
        ctx.fillStyle = primaryColor
        ctx.font = 'bold 22px "Playfair Display", serif'
        ctx.textAlign = 'center'
        ctx.fillText('KARTU ANGGOTA', width / 2, 55)

        // Decorative line under title
        ctx.strokeStyle = goldColor
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(width / 2 - 60, 68)
        ctx.lineTo(width / 2 + 60, 68)
        ctx.stroke()

        // Name
        ctx.fillStyle = textColor
        ctx.font = 'bold 28px "Playfair Display", serif'
        ctx.fillText(props.nama || '-', width / 2, qrY + qrSize + 55)

        // Info
        ctx.fillStyle = '#4B5563'
        ctx.font = '16px system-ui, sans-serif'

        const infoLines = [
          `NIM: ${props.nim || '-'}`,
          `${props.prodi || '-'} · ${props.kelas || '-'}`,
          `Kelompok: ${props.namaKelompok || '-'}`
        ]

        let infoY = qrY + qrSize + 90
        infoLines.forEach((line) => {
          ctx.fillText(line, width / 2, infoY)
          infoY += 26
        })

        // Footer
        ctx.fillStyle = goldColor
        ctx.font = '11px system-ui, sans-serif'
        ctx.fillText('اَللّٰهُمَّ اهْدِنَا وَتَقَبَّلْ مِنَّا', width / 2, height - 30)

        // Footer line
        ctx.strokeStyle = primaryColor
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(100, height - 40)
        ctx.lineTo(width - 100, height - 40)
        ctx.stroke()

        resolve()
      }
    })

    const link = document.createElement('a')
    link.download = `qr-${props.nim || 'anggota'}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  } catch (e) {
    console.error('Download failed:', e)
  } finally {
    downloading.value = false
  }
}

function drawBorders(ctx, w, h, primaryColor, goldColor) {
  ctx.strokeStyle = goldColor
  ctx.lineWidth = 2
  ctx.strokeRect(15, 15, w - 30, h - 30)
  ctx.strokeRect(20, 20, w - 40, h - 40)

  ctx.strokeStyle = primaryColor
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.strokeRect(25, 25, w - 50, h - 50)
  ctx.setLineDash([])

  // Corner diamonds
  const corners = [
    [40, 40], [w - 40, 40],
    [40, h - 40], [w - 40, h - 40]
  ]
  ctx.fillStyle = primaryColor
  corners.forEach(([cx, cy]) => {
    ctx.beginPath()
    ctx.moveTo(cx, cy - 8)
    ctx.lineTo(cx + 8, cy)
    ctx.lineTo(cx, cy + 8)
    ctx.lineTo(cx - 8, cy)
    ctx.closePath()
    ctx.fill()
  })

  // Gold accent diamonds
  corners.forEach(([cx, cy]) => {
    ctx.fillStyle = goldColor
    ctx.beginPath()
    ctx.moveTo(cx, cy - 4)
    ctx.lineTo(cx + 4, cy)
    ctx.lineTo(cx, cy + 4)
    ctx.lineTo(cx - 4, cy)
    ctx.closePath()
    ctx.fill()
  })
}

onMounted(generateQR)
watch(() => props.qrToken, generateQR)
</script>

<template>
  <div class="flex flex-col items-center gap-6">
    <div ref="cardRef" class="qr-card w-full max-w-sm rounded-xl overflow-hidden shadow-lg">
      <QRFrame>
        <div class="p-6 pt-8">
          <!-- Header -->
          <div class="text-center mb-4">
            <p class="text-xs text-amber-600 font-medium tracking-widest">بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ</p>
            <h2 class="text-lg font-bold text-emerald-900 font-serif mt-1">KARTU ANGGOTA</h2>
            <div class="w-24 h-0.5 bg-amber-500 mx-auto mt-2"></div>
          </div>

          <!-- QR Code -->
          <div class="flex justify-center mb-4">
            <div class="bg-white p-3 rounded-lg shadow-inner">
              <canvas ref="qrCanvasRef" class="w-52 h-52 md:w-60 md:h-60"></canvas>
            </div>
          </div>

          <!-- Identity -->
          <div class="text-center space-y-1">
            <h3 class="text-2xl font-bold text-gray-800 font-serif">{{ nama || '-' }}</h3>
            <p class="text-sm text-gray-500">NIM: {{ nim || '-' }}</p>
            <p class="text-sm text-gray-500">{{ prodi || '-' }} · {{ kelas || '-' }}</p>
            <p v-if="namaKelompok" class="text-sm font-medium text-emerald-700 mt-2">
              Kelompok: {{ namaKelompok }}
            </p>
          </div>

          <!-- Footer -->
          <div class="mt-6 pt-4 border-t border-emerald-200 text-center">
            <p class="text-xs text-amber-700 font-arabic">اَللّٰهُمَّ اهْدِنَا وَتَقَبَّلْ مِنَّا</p>
          </div>
        </div>
      </QRFrame>
    </div>

    <button @click="downloadCard" :disabled="downloading || !qrDataUrl"
      class="px-6 py-3 bg-emerald-800 text-white rounded-xl font-medium hover:bg-emerald-900 transition-colors disabled:opacity-50 shadow-md">
      <span v-if="downloading">Menyiapkan...</span>
      <span v-else class="flex items-center gap-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> Download Kartu QR</span>
    </button>
  </div>
</template>

<style scoped>
.qr-card {
  background: #FDF6E3;
}

.font-serif {
  font-family: 'Playfair Display', Georgia, serif;
}

.font-arabic {
  font-family: 'Noto Naskh Arabic', serif;
}
</style>
