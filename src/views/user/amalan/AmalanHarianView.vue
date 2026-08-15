<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { useAmalan } from '@/composables/useAmalan'

const route = useRoute()
const authStore = useAuthStore()
const appStore = useAppStore()
const { getLog, upsertLog, hitungSkorHarian, loading } = useAmalan()

const today = new Date()

function parseTanggalQuery(q) {
  if (!q) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(q)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return isNaN(d.getTime()) ? null : d
}

const qDate = parseTanggalQuery(route.query.tanggal)
const currentDate = ref(qDate || new Date(today.getFullYear(), today.getMonth(), today.getDate()))
const logData = ref(null)
const saving = ref(false)
const hasChanges = ref(false)
const shalatOptions = ['tepat_waktu', 'terlambat', 'qadha', 'belum']
const rawatibList = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya']

const tanggalStr = computed(() => {
  const d = currentDate.value
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const displayDate = computed(() => {
  return currentDate.value.toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
})

const isToday = computed(() => {
  const t = new Date()
  return tanggalStr.value === `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
})

const form = ref({
  shalat_subuh: 'belum',
  shalat_dzuhur: 'belum',
  shalat_ashar: 'belum',
  shalat_maghrib: 'belum',
  shalat_isya: 'belum',
  shalat_dhuha: false,
  jumlah_rakaat: null,
  rawatib_qobliyah: {},
  rawatib_badiyah: {},
  catatan_harian: ''
})

const score = computed(() => hitungSkorHarian(logData.value))

function resetForm() {
  form.value = {
    shalat_subuh: 'belum',
    shalat_dzuhur: 'belum',
    shalat_ashar: 'belum',
    shalat_maghrib: 'belum',
    shalat_isya: 'belum',
    shalat_dhuha: false,
    jumlah_rakaat: null,
    rawatib_qobliyah: {},
    rawatib_badiyah: {},
    catatan_harian: ''
  }
}

function populateForm(log) {
  if (!log) {
    resetForm()
    return
  }
  form.value = {
    shalat_subuh: log.shalat_subuh || 'belum',
    shalat_dzuhur: log.shalat_dzuhur || 'belum',
    shalat_ashar: log.shalat_ashar || 'belum',
    shalat_maghrib: log.shalat_maghrib || 'belum',
    shalat_isya: log.shalat_isya || 'belum',
    shalat_dhuha: log.shalat_dhuha || false,
    jumlah_rakaat: log.jumlah_rakaat || null,
    rawatib_qobliyah: log.rawatib_qobliyah || {},
    rawatib_badiyah: log.rawatib_badiyah || {},
    catatan_harian: log.catatan_harian || ''
  }
}

function nextDay() {
  const d = new Date(currentDate.value)
  d.setDate(d.getDate() + 1)
  currentDate.value = d
}

function prevDay() {
  const d = new Date(currentDate.value)
  d.setDate(d.getDate() - 1)
  currentDate.value = d
}

function goToday() {
  currentDate.value = new Date(today.getFullYear(), today.getMonth(), today.getDate())
}

let debounceTimer = null
let saveSeq = 0
function debouncedSave() {
  hasChanges.value = true
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(doSave, 800)
}

async function doSave() {
  if (!authStore.user?.id) return
  if (!hasChanges.value) return
  saving.value = true
  const seq = ++saveSeq
  const tgl = tanggalStr.value
  try {
    const payload = {
      shalat_subuh: form.value.shalat_subuh,
      shalat_dzuhur: form.value.shalat_dzuhur,
      shalat_ashar: form.value.shalat_ashar,
      shalat_maghrib: form.value.shalat_maghrib,
      shalat_isya: form.value.shalat_isya,
      shalat_dhuha: form.value.shalat_dhuha,
      jumlah_rakaat: form.value.shalat_dhuha ? form.value.jumlah_rakaat : null,
      rawatib_qobliyah: form.value.rawatib_qobliyah,
      rawatib_badiyah: form.value.rawatib_badiyah,
      catatan_harian: form.value.catatan_harian
    }
    const result = await upsertLog(authStore.user.id, tgl, payload)
    if (seq !== saveSeq) return
    logData.value = result
    hasChanges.value = false
    appStore.showToast('Amalan tersimpan')
  } catch (e) {
    if (seq !== saveSeq) return
    appStore.showToast(e.message || 'Gagal menyimpan', 'error')
  } finally {
    if (seq === saveSeq) saving.value = false
  }
}

async function loadData() {
  if (!authStore.user?.id) return
  const log = await getLog(authStore.user.id, tanggalStr.value)
  logData.value = log
  populateForm(log)
  hasChanges.value = false
}

function toggleRawatib(type, waktu) {
  const key = type === 'qobliyah' ? 'rawatib_qobliyah' : 'rawatib_badiyah'
  const current = { ...form.value[key] }
  if (current[waktu]) {
    delete current[waktu]
  } else {
    current[waktu] = true
  }
  form.value[key] = current
  debouncedSave()
}

const isFutureDate = computed(() => {
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return currentDate.value > now
})

const isEditable = computed(() => !isFutureDate.value)

watch(currentDate, () => {
  saveSeq++
  if (debounceTimer) clearTimeout(debounceTimer)
  loadData()
})

watch(() => route.query.tanggal, (q) => {
  const d = parseTanggalQuery(q)
  if (d && d.getTime() !== currentDate.value.getTime()) {
    currentDate.value = d
  }
})

onMounted(async () => {
  await authStore.fetchSession?.()
  await loadData()
})

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<template>
  <div>
    <!-- Header with Date Navigation -->
    <div class="flex items-center justify-between mb-1">
      <h1 class="text-xl font-bold text-emerald-900">Amalan Harian</h1>
      <button v-if="!isToday" @click="goToday"
        class="text-xs text-emerald-600 hover:text-emerald-700 font-medium underline underline-offset-2">
        Hari Ini
      </button>
    </div>
    <p class="text-sm text-gray-500 mb-4">Catat ibadah wajib dan sunnah harian Anda</p>

    <!-- Date Navigator -->
    <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-3 mb-4 flex items-center justify-between">
      <button @click="prevDay" class="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
        :disabled="loading" aria-label="Hari sebelumnya">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>
      <div class="text-center">
        <p class="text-sm font-semibold text-emerald-800">{{ displayDate }}</p>
        <p v-if="isToday" class="text-[10px] text-emerald-500 font-medium">Hari Ini</p>
        <p v-else-if="isFutureDate" class="text-[10px] text-amber-500 font-medium">Akan Datang</p>
      </div>
      <button @click="nextDay" class="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
        :disabled="loading" aria-label="Hari selanjutnya">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
        </svg>
      </button>
    </div>

    <!-- Score Card -->
    <div v-if="!loading" class="bg-gradient-to-r from-emerald-700 to-emerald-600 rounded-xl p-4 mb-4 text-white shadow-sm">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-emerald-100 text-xs font-medium uppercase tracking-wider">Skor Amalan</p>
          <p class="text-3xl font-bold mt-1">{{ score.score }}<span class="text-lg text-emerald-200">/{{ score.max }}</span></p>
        </div>
        <div class="text-right">
          <p class="text-4xl font-bold">{{ score.pct }}%</p>
          <p class="text-emerald-200 text-xs mt-1">{{ score.pct >= 80 ? 'Luar Biasa' : score.pct >= 60 ? 'Baik' : score.pct >= 40 ? 'Cukup' : score.pct > 0 ? 'Kurang' : 'Belum ada' }}</p>
        </div>
      </div>
      <div class="mt-3 w-full h-2 bg-emerald-800/40 rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all duration-500 bg-emerald-300"
          :style="{ width: score.pct + '%' }">
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-8 text-gray-500">
      <svg class="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      <span>Memuat data...</span>
    </div>

    <!-- Form -->
    <div v-else class="space-y-4 pb-6">
      <!-- 5 Waktu Shalat -->
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h2 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
          </svg>
          Shalat Wajib
        </h2>
        <div class="space-y-2.5">
          <div v-for="waktu in ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya']" :key="waktu"
            class="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
            <label class="text-sm font-medium text-gray-700 capitalize">{{ waktu }}</label>
            <select v-model="form['shalat_' + waktu]" @change="debouncedSave"
              :disabled="!isEditable"
              class="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed capitalize">
              <option v-for="opt in shalatOptions" :key="opt" :value="opt">{{ opt.replace(/_/g, ' ') }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Shalat Dhuha -->
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h2 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
          </svg>
          Shalat Dhuha
        </h2>
        <div class="flex items-center justify-between mb-3">
          <span class="text-sm text-gray-600">Sudah dhuha hari ini?</span>
          <button @click="form.shalat_dhuha = !form.shalat_dhuha; if(!form.shalat_dhuha) form.jumlah_rakaat = null; debouncedSave()"
            :disabled="!isEditable"
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50"
            :class="form.shalat_dhuha ? 'bg-emerald-500' : 'bg-gray-300'">
            <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm"
              :class="form.shalat_dhuha ? 'translate-x-6' : 'translate-x-1'">
            </span>
          </button>
        </div>
        <div v-if="form.shalat_dhuha" class="flex items-center gap-3">
          <span class="text-sm text-gray-600">Jumlah Rakaat</span>
          <div class="flex items-center gap-2">
            <button @click="if(form.jumlah_rakaat > 2) { form.jumlah_rakaat--; debouncedSave() }"
              :disabled="!isEditable || (form.jumlah_rakaat || 2) <= 2"
              class="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/></svg>
            </button>
            <span class="text-lg font-semibold text-gray-800 min-w-[2ch] text-center">{{ form.jumlah_rakaat || 2 }}</span>
            <button @click="if((form.jumlah_rakaat || 2) < 12) { form.jumlah_rakaat = (form.jumlah_rakaat || 2) + 1; debouncedSave() }"
              :disabled="!isEditable || (form.jumlah_rakaat || 2) >= 12"
              class="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Rawatib -->
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h2 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          Shalat Rawatib
        </h2>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Qobliyah (Sebelum)</p>
            <div class="space-y-2">
              <label v-for="waktu in rawatibList" :key="'q-' + waktu"
                class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" :checked="form.rawatib_qobliyah[waktu] || false"
                  @change="toggleRawatib('qobliyah', waktu)"
                  :disabled="!isEditable"
                  class="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50">
                <span class="text-sm text-gray-700 capitalize">{{ waktu }}</span>
              </label>
            </div>
          </div>
          <div>
            <p class="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Badiyah (Sesudah)</p>
            <div class="space-y-2">
              <label v-for="waktu in rawatibList" :key="'b-' + waktu"
                class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" :checked="form.rawatib_badiyah[waktu] || false"
                  @change="toggleRawatib('badiyah', waktu)"
                  :disabled="!isEditable"
                  class="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50">
                <span class="text-sm text-gray-700 capitalize">{{ waktu }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Catatan Harian -->
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h2 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
          Catatan Harian
        </h2>
        <textarea v-model="form.catatan_harian" @input="debouncedSave"
          :disabled="!isEditable"
          rows="3" placeholder="Tulis catatan ibadah hari ini..."
          class="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none disabled:opacity-50 disabled:bg-gray-50 placeholder:text-gray-400">
        </textarea>
      </div>

      <!-- Future Date Notice -->
      <div v-if="isFutureDate" class="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
        <div class="flex items-start gap-2">
          <svg class="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span>Tanggal ini masih akan datang. Anda bisa mencatat amalan untuk hari ini atau hari sebelumnya.</span>
        </div>
      </div>

      <!-- Save indicator -->
      <div v-if="saving" class="text-center text-sm text-gray-400 py-2">
        <svg class="w-4 h-4 animate-spin inline mr-1 text-emerald-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        Menyimpan...
      </div>
    </div>
  </div>
</template>
