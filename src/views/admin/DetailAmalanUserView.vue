<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { hitungSkorHarian } from '@/lib/amalanScore'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const appStore = useAppStore()

const userId = computed(() => route.params.userId)
const role = computed(() => authStore.profile?.role)
const adminGroupId = computed(() => authStore.profile?.group_id)

const profile = ref(null)
const logs = ref([])
const loading = ref(true)
const profileLoading = ref(true)
const errorMsg = ref('')

const selectedYear = ref(new Date().getFullYear())
const selectedMonth = ref(new Date().getMonth() + 1)

const monthEnd = computed(() => {
  return new Date(selectedYear.value, selectedMonth.value, 0).toISOString().split('T')[0]
})

const monthStart = computed(() => {
  return `${selectedYear.value}-${String(selectedMonth.value).padStart(2, '0')}-01`
})

const dayHeaders = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

const logsByDate = computed(() => {
  const map = {}
  logs.value.forEach(log => {
    map[log.tanggal] = log
  })
  return map
})

const calendarDays = computed(() => {
  const year = selectedYear.value
  const month = selectedMonth.value
  const firstDay = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const startDayOfWeek = firstDay.getDay()
  const startOffset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1

  const days = []
  for (let i = 0; i < startOffset; i++) {
    days.push(null)
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const log = logsByDate.value[dateStr]
    let cellClass = 'bg-gray-50 text-gray-300'

    if (log) {
      if (log.berhalangan) {
        cellClass = 'bg-gray-300 text-white shadow-sm'
      } else {
        const score = hitungSkorHarian(log)
        if (score >= 17) cellClass = 'bg-emerald-500 text-white shadow-sm'
        else if (score >= 10) cellClass = 'bg-amber-400 text-white shadow-sm'
        else if (score > 0) cellClass = 'bg-red-400 text-white shadow-sm'
      }
    }

    days.push({ day: d, date: dateStr, cellClass, log })
  }

  return days
})

const monthLogs = computed(() => {
  return [...(logs.value || [])].sort((a, b) => b.tanggal.localeCompare(a.tanggal))
})

const monthLabel = computed(() => {
  return new Date(selectedYear.value, selectedMonth.value - 1).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric'
  })
})

function prevMonth() {
  if (selectedMonth.value === 1) {
    selectedMonth.value = 12
    selectedYear.value--
  } else {
    selectedMonth.value--
  }
  loadLogs()
}

function nextMonth() {
  if (selectedMonth.value === 12) {
    selectedMonth.value = 1
    selectedYear.value++
  } else {
    selectedMonth.value++
  }
  loadLogs()
}

function statusBadge(status) {
  const map = {
    tepat_waktu: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    terlambat: 'bg-amber-100 text-amber-700 border-amber-200',
    qadha: 'bg-blue-100 text-blue-700 border-blue-200',
    belum: 'bg-gray-100 text-gray-400 border-gray-200'
  }
  return map[status] || 'bg-gray-100 text-gray-400 border-gray-200'
}

function statusLabel(status) {
  const map = {
    tepat_waktu: 'Tepat Waktu',
    terlambat: 'Terlambat',
    qadha: 'Qadha',
    belum: 'Belum'
  }
  return map[status] || status
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

function getRawatibKeys(obj) {
  if (!obj || typeof obj !== 'object') return []
  return Object.keys(obj).filter(k => obj[k])
}

const rawatibLabels = {
  subuh: 'Subuh',
  dzuhur: 'Dzuhur',
  ashar: 'Ashar',
  maghrib: 'Maghrib',
  isya: 'Isya'
}

const exporting = ref(false)

async function exportPDF() {
  exporting.value = true
  try {
    const doc = new jsPDF('p', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.getWidth()

    doc.setFontSize(16)
    doc.setTextColor(22, 163, 74)
    doc.text('Laporan Amalan Individu', pageWidth / 2, 20, { align: 'center' })

    doc.setFontSize(11)
    doc.setTextColor(55, 65, 81)
    doc.text(profile.value?.nama || '-', pageWidth / 2, 28, { align: 'center' })

    doc.setFontSize(10)
    doc.setTextColor(107, 114, 128)
    doc.text(`NIM: ${profile.value?.nim || '-'}`, pageWidth / 2, 34, { align: 'center' })
    if (profile.value?.groups?.nama_kelompok) {
      doc.text(`Kelompok: ${profile.value.groups.nama_kelompok}`, pageWidth / 2, 40, { align: 'center' })
    }
    doc.text(`Periode: ${monthLabel.value}`, pageWidth / 2, 46, { align: 'center' })

    const rows = logs.value.map(log => {
      const score = hitungSkorHarian(log)
      const wajibFields = ['shalat_subuh', 'shalat_dzuhur', 'shalat_ashar', 'shalat_maghrib', 'shalat_isya']
      const shalat = wajibFields.map(f => {
        const m = { tepat_waktu: 'TW', terlambat: 'TL', qadha: 'Q', belum: '-' }
        return m[log[f]] || '-'
      }).join('/')
      const tahajjud = log.tahajjud === 'tepat_waktu' ? 'TW' : log.tahajjud === 'terlambat' ? 'TL' : '-'
      const quran = log.bacaan_quran && Object.keys(log.bacaan_quran).length > 0
        ? `${log.bacaan_quran.surah}:${log.bacaan_quran.awal}-${log.bacaan_quran.akhir}`
        : '-'
      const berhalangan = log.berhalangan ? 'Ya' : '-'
      return [
        new Date(log.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        shalat,
        log.shalat_dhuha ? 'Ya' : 'Tidak',
        log.jumlah_rakaat || '-',
        tahajjud,
        quran,
        berhalangan,
        score
      ]
    })

    const startY = profile.value?.groups?.nama_kelompok ? 52 : 46
    doc.autoTable({
      startY,
      head: [['Tanggal', 'Shalat (S/D/A/M/I)', 'Dhuha', 'Rakaat', 'Tahajjud', 'Qur\'an', 'Berhal.', 'Skor']],
      body: rows,
      headStyles: {
        fillColor: [22, 163, 74],
        fontSize: 8
      },
      bodyStyles: {
        fontSize: 7
      },
      alternateRowStyles: {
        fillColor: [240, 253, 244]
      }
    })

    doc.save(`amalan-${profile.value?.nama?.replace(/\s+/g, '_') || 'user'}-${selectedYear.value}-${String(selectedMonth.value).padStart(2, '0')}.pdf`)
  } catch (e) {
    console.error('Gagal export PDF:', e)
    appStore.setError('Gagal mengexport PDF')
  } finally {
    exporting.value = false
  }
}

async function loadProfile() {
  profileLoading.value = true
  errorMsg.value = ''

  const { data, error } = await supabase
    .from('profiles')
    .select('id, nama, nim, group_id, groups(nama_kelompok)')
    .eq('id', userId.value)
    .maybeSingle()

  if (error) {
    errorMsg.value = 'Gagal memuat profil anggota'
    profileLoading.value = false
    return
  }

  if (!data) {
    errorMsg.value = 'Anggota tidak ditemukan'
    profileLoading.value = false
    return
  }

  if (role.value === 'admin' && data.group_id !== adminGroupId.value) {
    errorMsg.value = 'Anda tidak memiliki akses ke anggota ini'
    profileLoading.value = false
    return
  }

  profile.value = data
  profileLoading.value = false
}

async function loadLogs() {
  if (errorMsg.value) return
  const { data, error } = await supabase
    .from('daily_worship_logs')
    .select('*')
    .eq('user_id', userId.value)
    .gte('tanggal', monthStart.value)
    .lte('tanggal', monthEnd.value)
    .order('tanggal', { ascending: true })

  if (error) {
    appStore.setError('Gagal memuat catatan amalan')
    return
  }

  logs.value = data || []
}

function getInitial(name) {
  return (name || '?')[0].toUpperCase()
}

const shalatFields = ['shalat_subuh', 'shalat_dzuhur', 'shalat_ashar', 'shalat_maghrib', 'shalat_isya']

let realtimeSub = null

onMounted(async () => {
  await loadProfile()
  if (!errorMsg.value) {
    await loadLogs()
  }
  loading.value = false

  realtimeSub = supabase
    .channel('detail-amalan-' + userId.value)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_worship_logs', filter: `user_id=eq.${userId.value}` }, () => {
      if (!errorMsg.value) loadLogs()
    })
    .subscribe()
})

onUnmounted(() => {
  if (realtimeSub) supabase.removeChannel(realtimeSub)
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <button
        @click="router.push('/monitoring-amalan')"
        class="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-emerald-700 transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Kembali
      </button>
      <button
        v-if="role === 'super_admin'"
        @click="exportPDF"
        :disabled="exporting"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-all disabled:opacity-50"
      >
        <svg v-if="exporting" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Export PDF
      </button>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-500">
      <svg class="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span>Memuat data...</span>
    </div>

    <div v-else-if="errorMsg" class="text-center py-12">
      <div class="flex justify-center mb-4">
        <div class="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
          <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>
      <h3 class="text-lg font-medium text-gray-700">{{ errorMsg }}</h3>
    </div>

    <template v-else-if="profile">
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
        <div class="flex items-center gap-3">
          <div
            class="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-sm"
          >
            {{ getInitial(profile.nama) }}
          </div>
          <div>
            <h1 class="text-lg font-bold text-gray-900">{{ profile.nama }}</h1>
            <p class="text-sm text-gray-500">{{ profile.nim || '-' }}</p>
            <span
              v-if="profile.groups?.nama_kelompok"
              class="inline-block mt-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200"
            >
              {{ profile.groups.nama_kelompok }}
            </span>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
        <div class="flex items-center justify-between mb-4">
          <button
            @click="prevMonth"
            class="p-2 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 class="text-base font-bold text-gray-800">{{ monthLabel }}</h2>
          <button
            @click="nextMonth"
            class="p-2 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div class="grid grid-cols-7 gap-1 mb-2">
          <div
            v-for="day in dayHeaders"
            :key="day"
            class="text-center text-[11px] font-medium text-gray-400 py-1"
          >
            {{ day }}
          </div>
        </div>

        <div class="grid grid-cols-7 gap-1">
          <div
            v-for="(cell, idx) in calendarDays"
            :key="idx"
            class="aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-all"
            :class="cell ? cell.cellClass : ''"
          >
            {{ cell?.day || '' }}
          </div>
        </div>

        <div class="flex items-center justify-center gap-3 mt-4 text-[11px] text-gray-500 flex-wrap">
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-sm bg-emerald-500"></span>
            <span>Tinggi</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-sm bg-amber-400"></span>
            <span>Sedang</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-sm bg-red-400"></span>
            <span>Rendah</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-sm bg-gray-300"></span>
            <span>Berhalangan</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-sm bg-gray-50 border border-gray-200"></span>
            <span>Kosong</span>
          </div>
        </div>
      </div>

      <div v-if="monthLogs.length === 0" class="text-center py-8 text-gray-400 bg-white rounded-xl border border-gray-100 shadow-sm">
        <svg class="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p class="text-sm">Belum ada catatan amalan bulan ini.</p>
      </div>

      <div v-else class="space-y-3">
        <h3 class="text-sm font-semibold text-gray-700">Catatan Harian</h3>

        <div
          v-for="log in monthLogs"
          :key="log.tanggal"
          class="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
        >
          <p class="text-sm font-medium text-gray-800 mb-3">
            {{ formatDate(log.tanggal) }}
            <span v-if="log.berhalangan" class="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-medium border border-amber-200">
              Berhalangan
              <span v-if="log.alasan_berhalangan" class="text-amber-500">— {{ log.alasan_berhalangan }}</span>
            </span>
          </p>

          <div v-if="log.berhalangan" class="text-xs text-gray-400 italic mb-3">
            Tidak ada catatan amalan (berhalangan)
          </div>

          <div v-else>
            <div class="grid grid-cols-5 gap-1.5 mb-3">
              <div
                v-for="(field, idx) in shalatFields"
                :key="idx"
                class="text-center"
              >
                <p class="text-[10px] text-gray-400 mb-1 capitalize">{{ field.replace('shalat_', '') }}</p>
                <span
                  class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border"
                  :class="statusBadge(log[field])"
                >
                  {{ statusLabel(log[field]) }}
                </span>
              </div>
            </div>

            <div class="flex flex-wrap gap-3 text-xs text-gray-600 border-t border-gray-50 pt-3">
              <div class="flex items-center gap-1">
                <span class="text-gray-400">Dhuha:</span>
                <span :class="log.shalat_dhuha ? 'text-emerald-600 font-medium' : 'text-gray-400'">
                  {{ log.shalat_dhuha ? 'Ya' : 'Tidak' }}
                </span>
              </div>
              <div v-if="log.jumlah_rakaat" class="flex items-center gap-1">
                <span class="text-gray-400">Rakaat:</span>
                <span class="font-medium text-gray-700">{{ log.jumlah_rakaat }}</span>
              </div>
              <div class="flex items-center gap-1">
                <span class="text-gray-400">Tahajjud:</span>
                <span :class="log.tahajjud === 'tepat_waktu' ? 'text-indigo-600 font-medium' : log.tahajjud === 'terlambat' ? 'text-amber-600 font-medium' : 'text-gray-400'">
                  {{ log.tahajjud ? statusLabel(log.tahajjud) : 'Tidak' }}
                </span>
              </div>
              <div v-if="log.bacaan_quran && Object.keys(log.bacaan_quran).length > 0" class="flex items-center gap-1">
                <span class="text-gray-400">Qur'an:</span>
                <span class="text-emerald-600 font-medium">{{ log.bacaan_quran.surah || '-' }}: {{ log.bacaan_quran.awal || '-' }}-{{ log.bacaan_quran.akhir || '-' }}</span>
              </div>
            </div>

            <div v-if="getRawatibKeys(log.rawatib_qobliyah).length > 0" class="text-xs text-gray-600 mt-1.5">
              <span class="text-gray-400">Rawatib Qobliyah:</span>
              <span class="text-gray-700 ml-1">
                {{ getRawatibKeys(log.rawatib_qobliyah).map(k => rawatibLabels[k] || k).join(', ') }}
              </span>
            </div>

            <div v-if="getRawatibKeys(log.rawatib_badiyah).length > 0" class="text-xs text-gray-600 mt-0.5">
              <span class="text-gray-400">Rawatib Badiyah:</span>
              <span class="text-gray-700 ml-1">
                {{ getRawatibKeys(log.rawatib_badiyah).map(k => rawatibLabels[k] || k).join(', ') }}
              </span>
            </div>
          </div>

          <div v-if="log.catatan_harian" class="mt-2 bg-gray-50 rounded-lg p-2.5 text-xs text-gray-600 italic leading-relaxed">
            {{ log.catatan_harian }}
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
