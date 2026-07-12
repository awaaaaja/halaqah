<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { useSession } from '@/composables/useSession'
import { useQrScanner } from '@/composables/useQrScanner'
import { useAttendance } from '@/composables/useAttendance'

const SCANNER_ID = 'qr-reader-scanner'

const authStore = useAuthStore()
const appStore = useAppStore()
const { sesiAktif, loading: sesiLoading, getSesiAktif, bukaSesi, akhiriSesi } = useSession()
const { scannedToken, isScanning, error: scanError, isFrontCamera, startScanner, toggleCamera, stopScanner } = useQrScanner()
const { catatAbsen } = useAttendance()

const scannedProfile = ref(null)
const scanLoading = ref(false)
const confirmLoading = ref(false)
const pageStep = ref('idle')
const cameraStarted = ref(false)
const toastMsg = ref('')
const toastType = ref('success')
const toastVisible = ref(false)
const showBukaForm = ref(false)
const judulMateri = ref('')
const bukaLoading = ref(false)
const akhiriLoading = ref(false)

const adminGroupId = computed(() => authStore.profile?.group_id)

function showToast(message, type = 'success') {
  toastMsg.value = message
  toastType.value = type
  toastVisible.value = true
  setTimeout(() => { toastVisible.value = false }, 3500)
}

async function checkSession() {
  if (!adminGroupId.value) return
  await getSesiAktif(adminGroupId.value)
  if (sesiAktif.value) {
    pageStep.value = 'ready'
  }
}

async function handleStartCamera() {
  scanError.value = ''
  pageStep.value = 'scanning'
  cameraStarted.value = false
  await nextTick()
  await startScanner(SCANNER_ID, onScanResult)
  cameraStarted.value = true
}

async function onScanResult(token) {
  if (scanLoading.value) return
  scanLoading.value = true
  try {
    const { data, error } = await supabase.rpc('get_profile_by_token', { token })
    if (error) throw error
    if (!data || data.length === 0) {
      showToast('QR Code tidak dikenal', 'error')
      await stopScanner()
      pageStep.value = 'ready'
      return
    }
    await stopScanner()
    scannedProfile.value = data[0]
    pageStep.value = 'result'
  } catch (e) {
    showToast(e.message, 'error')
    await stopScanner()
    pageStep.value = 'ready'
  } finally {
    scanLoading.value = false
  }
}

async function handleToggleCamera() {
  await toggleCamera(SCANNER_ID, onScanResult)
}

async function handleConfirm(status = 'hadir') {
  if (!sesiAktif.value || !scannedProfile.value) return
  confirmLoading.value = true
  try {
    await catatAbsen(sesiAktif.value.id, scannedProfile.value.id, authStore.user.id, status)
    const label = { hadir: 'Hadir', izin: 'Izin', alpa: 'Alpa' }
    showToast(`${scannedProfile.value.nama} — ${label[status]}`, 'success')
    scannedProfile.value = null
    pageStep.value = 'ready'
  } catch (e) {
    if (e.message?.includes('duplicate') || e.message?.includes('unique') || e.message?.includes('violates')) {
      showToast('Sudah diabsen sebelumnya', 'warning')
    } else {
      showToast(e.message, 'error')
    }
    scannedProfile.value = null
    pageStep.value = 'ready'
  } finally {
    confirmLoading.value = false
  }
}

async function handleScanAnother() {
  scannedProfile.value = null
  pageStep.value = 'ready'
}

async function handleBukaSesi() {
  if (!adminGroupId.value) return
  bukaLoading.value = true
  try {
    await bukaSesi(adminGroupId.value, judulMateri.value, authStore.profile?.id)
    showToast('Sesi liqa dibuka!')
    showBukaForm.value = false
    judulMateri.value = ''
    pageStep.value = 'ready'
  } catch (e) {
    if (e.message?.includes('one_open_session_per_group') || e.message?.includes('duplicate')) {
      showToast('Sudah ada sesi aktif untuk kelompok ini', 'warning')
    } else {
      showToast(e.message, 'error')
    }
  } finally {
    bukaLoading.value = false
  }
}

async function handleAkhiriSesi() {
  if (!sesiAktif.value) return
  akhiriLoading.value = true
  try {
    await akhiriSesi(sesiAktif.value.id)
    showToast('Sesi liqa diakhiri')
    pageStep.value = 'idle'
  } catch (e) {
    showToast(e.message, 'error')
  } finally {
    akhiriLoading.value = false
  }
}

onMounted(() => {
  checkSession()
})

onUnmounted(() => {
  stopScanner()
})
</script>

<template>
  <div class="flex flex-col min-h-[70vh]">
    <!-- Toast -->
    <Teleport to="body">
      <div v-if="toastVisible"
        class="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-2xl shadow-xl text-sm font-medium text-white transition-all duration-300 animate-slide-down pointer-events-none"
        :class="toastType === 'error' ? 'bg-red-500' : toastType === 'warning' ? 'bg-amber-500' : 'bg-brand-600'">
        {{ toastMsg }}
      </div>
    </Teleport>

    <!-- Buka Sesi Form Modal -->
    <Teleport to="body">
      <div v-if="showBukaForm" class="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4 animate-fade-in"
        @click.self="showBukaForm = false">
        <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl animate-slide-up">
          <h3 class="text-lg font-bold text-gray-800 mb-4">Buka Sesi Baru</h3>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Judul Materi (opsional)</label>
            <input v-model="judulMateri" placeholder="Misal: Kajian Tafsir" maxlength="200"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div class="flex gap-3">
            <button @click="showBukaForm = false"
              class="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-all">
              Batal
            </button>
            <button @click="handleBukaSesi" :disabled="bukaLoading"
              class="flex-1 py-3 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 disabled:opacity-50 transition-all">
              {{ bukaLoading ? 'Membuka...' : 'Buka Sesi' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Header -->
    <div class="mb-5">
      <h1 class="text-xl font-bold text-brand-900">Scan Absen</h1>
      <p class="text-sm text-gray-500 mt-0.5">Arahkan QR Code anggota ke kamera</p>
    </div>

    <!-- No group -->
    <div v-if="!adminGroupId && !sesiLoading" class="flex-1 flex flex-col items-center justify-center text-center px-6 animate-fade-in">
      <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 class="text-lg font-bold text-gray-800 mb-1">Belum Ditugaskan</h3>
      <p class="text-sm text-gray-500 max-w-xs">Hubungi Super Admin untuk ditetapkan sebagai Murabbi suatu kelompok.</p>
    </div>

    <!-- No session -->
    <div v-else-if="!sesiAktif && !sesiLoading && pageStep === 'idle'" class="flex-1 flex flex-col items-center justify-center text-center px-6 animate-fade-in">
      <div class="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-4">
        <svg class="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 class="text-lg font-bold text-gray-800 mb-1">Tidak Ada Sesi Aktif</h3>
      <p class="text-sm text-gray-500 max-w-xs mb-6">Buka sesi liqa untuk mulai melakukan absensi.</p>
      <button @click="showBukaForm = true"
        class="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-all active:scale-95 shadow-md">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Buka Sesi
      </button>
    </div>

    <!-- Loading session -->
    <div v-else-if="sesiLoading" class="flex-1 flex items-center justify-center">
      <div class="flex flex-col items-center gap-3 text-brand-700">
        <svg class="w-7 h-7 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span class="text-sm text-gray-500">Memuat sesi...</span>
      </div>
    </div>

    <!-- ===== READY TO SCAN ===== -->
    <div v-else-if="pageStep === 'ready'" class="flex-1 flex flex-col items-center justify-center animate-fade-in">
      <div class="w-full max-w-sm text-center">
        <div class="w-20 h-20 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-5">
          <svg class="w-10 h-10 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h3 class="text-lg font-bold text-gray-800 mb-2">Siap Scan</h3>
        <p class="text-sm text-gray-500 mb-6">Tekan tombol di bawah untuk membuka kamera dan mulai scan QR Code anggota.</p>
        <button @click="handleStartCamera"
          class="w-full py-4 bg-brand-600 text-white rounded-2xl font-semibold text-lg hover:bg-brand-700 transition-all active:scale-[0.98] shadow-lg shadow-brand-600/20 flex items-center justify-center gap-3">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          </svg>
          Mulai Scan
        </button>
        <button @click="handleAkhiriSesi" :disabled="akhiriLoading"
          class="w-full mt-3 py-3 border border-red-200 text-red-600 rounded-xl font-medium hover:bg-red-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
          {{ akhiriLoading ? 'Menutup...' : 'Akhiri Sesi' }}
        </button>
      </div>
    </div>

    <!-- ===== SCANNING ===== -->
    <div v-else-if="pageStep === 'scanning'" class="flex-1 flex flex-col items-center animate-fade-in">
      <!-- Scanner wrapper -->
      <div class="relative w-full max-w-xs mx-auto mb-4">
        <!-- Scanner element (always mounted) -->
        <div class="rounded-2xl overflow-hidden bg-gray-900 shadow-xl aspect-square">
          <div :id="SCANNER_ID" class="w-full h-full"></div>

          <!-- Scanning overlay -->
          <div v-if="isScanning" class="absolute inset-0 pointer-events-none">
            <div class="absolute inset-6 border-2 border-brand-400/50 rounded-xl"></div>
            <div class="absolute left-6 right-6 h-0.5 bg-brand-400 top-1/2 -translate-y-1/2 shadow-lg shadow-brand-400/60 animate-pulse-slow"></div>
            <!-- Corner markers -->
            <div class="absolute top-6 left-6 w-5 h-5 border-t-2 border-l-2 border-brand-400 rounded-tl"></div>
            <div class="absolute top-6 right-6 w-5 h-5 border-t-2 border-r-2 border-brand-400 rounded-tr"></div>
            <div class="absolute bottom-6 left-6 w-5 h-5 border-b-2 border-l-2 border-brand-400 rounded-bl"></div>
            <div class="absolute bottom-6 right-6 w-5 h-5 border-b-2 border-r-2 border-brand-400 rounded-br"></div>
          </div>

          <!-- Start button overlay (when not scanning) -->
          <div v-if="!isScanning && !scanError"
            class="absolute inset-0 bg-gray-900/80 flex flex-col items-center justify-center text-white p-6 rounded-2xl">
            <svg class="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            </svg>
            <p class="text-sm text-center text-gray-300 mb-4">Klik tombol di bawah untuk memulai kamera</p>
            <button @click="handleStartCamera"
              class="px-6 py-2.5 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-all active:scale-95 shadow-md">
              Mulai Kamera
            </button>
          </div>

          <!-- Error overlay -->
          <div v-if="scanError && !isScanning"
            class="absolute inset-0 bg-gray-900/80 flex flex-col items-center justify-center text-white p-6 rounded-2xl">
            <svg class="w-10 h-10 text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-sm text-center text-red-300 mb-1">{{ scanError }}</p>
            <p class="text-xs text-gray-400 mb-4">Pastikan browser telah diizinkan mengakses kamera</p>
            <button @click="handleStartCamera"
              class="px-6 py-2.5 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-all active:scale-95 shadow-md">
              Coba Lagi
            </button>
          </div>
        </div>
      </div>

      <!-- Camera controls -->
      <div v-if="isScanning" class="flex items-center gap-3 mb-3">
        <button @click="handleToggleCamera"
          class="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all active:scale-95 shadow-sm">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {{ isFrontCamera ? 'Kamera Belakang' : 'Kamera Depan' }}
        </button>
      </div>

      <!-- Scan status -->
      <div v-if="isScanning" class="flex items-center justify-center gap-2 text-sm text-gray-500 mb-2">
        <span class="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
        Kamera aktif — arahkan QR Code ke tengah
      </div>

      <!-- Cancel -->
      <button @click="handleScanAnother"
        class="text-sm text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2 mt-2">
        Batal
      </button>
    </div>

    <!-- ===== LOADING SCAN RESULT ===== -->
    <div v-else-if="scanLoading" class="flex-1 flex items-center justify-center animate-fade-in">
      <div class="flex flex-col items-center gap-3">
        <svg class="w-8 h-8 animate-spin text-brand-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span class="text-sm text-gray-500">Memeriksa data anggota...</span>
      </div>
    </div>

    <!-- ===== RESULT ===== -->
    <div v-else-if="pageStep === 'result' && scannedProfile" class="flex-1 flex flex-col items-center animate-slide-up">
      <div class="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
        <!-- Profile header -->
        <div class="bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-center relative">
          <div class="absolute inset-0 opacity-[0.08]">
            <svg class="w-full h-full" viewBox="0 0 120 120" fill="none">
              <circle cx="30" cy="30" r="40" stroke="white" stroke-width="0.5" />
              <circle cx="90" cy="90" r="50" stroke="white" stroke-width="0.5" />
              <circle cx="60" cy="60" r="70" stroke="white" stroke-width="0.3" />
            </svg>
          </div>
          <div class="relative">
            <div class="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center mx-auto mb-3 ring-2 ring-white/20">
              <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 class="text-xl font-bold text-white font-serif">{{ scannedProfile.nama }}</h2>
            <p class="text-brand-200 text-sm mt-0.5">{{ scannedProfile.nama_kelompok || 'Anggota' }}</p>
          </div>
        </div>

        <!-- Detail -->
        <div class="p-5 space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <div class="bg-gray-50 rounded-xl p-3">
              <p class="text-[11px] text-gray-500 mb-0.5">NIM</p>
              <p class="font-semibold text-gray-800 text-sm">{{ scannedProfile.nim || '-' }}</p>
            </div>
            <div class="bg-gray-50 rounded-xl p-3">
              <p class="text-[11px] text-gray-500 mb-0.5">Prodi</p>
              <p class="font-semibold text-gray-800 text-sm">{{ scannedProfile.prodi || '-' }}</p>
            </div>
            <div class="bg-gray-50 rounded-xl p-3">
              <p class="text-[11px] text-gray-500 mb-0.5">Kelas</p>
              <p class="font-semibold text-gray-800 text-sm">{{ scannedProfile.kelas || '-' }}</p>
            </div>
            <div class="bg-gray-50 rounded-xl p-3">
              <p class="text-[11px] text-gray-500 mb-0.5">Angkatan</p>
              <p class="font-semibold text-gray-800 text-sm">{{ scannedProfile.angkatan || '-' }}</p>
            </div>
          </div>

          <!-- Status buttons -->
          <div class="flex gap-2.5 pt-1">
            <button @click="handleConfirm('hadir')" :disabled="confirmLoading"
              class="flex-1 py-3.5 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-all active:scale-[0.98] disabled:opacity-50 shadow-sm flex items-center justify-center gap-1.5">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
              {{ confirmLoading ? '...' : 'Hadir' }}
            </button>
            <button @click="handleConfirm('izin')" :disabled="confirmLoading"
              class="py-3.5 px-4 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-all active:scale-[0.98] disabled:opacity-50 text-sm flex items-center gap-1">
              Izin
            </button>
            <button @click="handleConfirm('alpa')" :disabled="confirmLoading"
              class="py-3.5 px-4 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-all active:scale-[0.98] disabled:opacity-50 text-sm flex items-center gap-1">
              Alpa
            </button>
          </div>

          <button @click="handleScanAnother" :disabled="confirmLoading"
            class="w-full py-2.5 text-sm text-brand-600 font-medium hover:text-brand-700 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Scan Anggota Lain
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
#qr-reader-scanner {
  min-height: 280px;
  position: relative;
}
#qr-reader-scanner :deep(video) {
  object-fit: cover !important;
  width: 100% !important;
  height: 100% !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  border-radius: 1rem !important;
}
#qr-reader-scanner :deep(img),
#qr-reader-scanner :deep(p),
#qr-reader-scanner :deep(button),
#qr-reader-scanner :deep(span) {
  display: none !important;
}
</style>
