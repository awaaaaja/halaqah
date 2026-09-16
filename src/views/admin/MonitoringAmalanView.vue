<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { hitungSkorHarian, AMALAN_SKOR_MAX } from '@/lib/amalanScore'

const router = useRouter()
const authStore = useAuthStore()
const appStore = useAppStore()

const users = ref([])
const usersSummary = ref({})
const groups = ref([])
const allGroups = ref([])
const loading = ref(true)
const exporting = ref(false)

const role = computed(() => authStore.profile?.role)
const adminGroupId = computed(() => authStore.profile?.group_id)
const isAdminWithoutGroup = computed(() => role.value === 'admin' && !adminGroupId.value)

const now = new Date()
const currentYear = ref(now.getFullYear())
const currentMonth = ref(now.getMonth() + 1)

const searchQuery = ref('')
const filterGroup = ref('')
const filterScore = ref('')

const monthStart = computed(() => `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-01`)
const monthEnd = computed(() => new Date(currentYear.value, currentMonth.value, 0).toISOString().split('T')[0])

const monthLabel = computed(() =>
  new Date(currentYear.value, currentMonth.value - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
)

const filteredUsers = computed(() => {
  let list = users.value
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(u =>
      (u.nama || '').toLowerCase().includes(q) ||
      (u.nim || '').toLowerCase().includes(q)
    )
  }
  if (filterGroup.value) {
    list = list.filter(u => u.group_id === filterGroup.value)
  }
  if (filterScore.value === 'tinggi') {
    list = list.filter(u => (usersSummary.value[u.id]?.konsistensi || 0) >= 75)
  } else if (filterScore.value === 'sedang') {
    list = list.filter(u => {
      const k = usersSummary.value[u.id]?.konsistensi || 0
      return k >= 50 && k < 75
    })
  } else if (filterScore.value === 'rendah') {
    list = list.filter(u => (usersSummary.value[u.id]?.konsistensi || 0) < 50)
  }
  return list
})

async function loadGroups() {
  const { data } = await supabase.from('groups').select('id, nama_kelompok').order('nama_kelompok')
  allGroups.value = data || []
}

async function loadData() {
  loading.value = true
  try {
    let userQuery = supabase
      .from('profiles')
      .select('id, nama, nim, group_id, groups(nama_kelompok)')
      .eq('status_akun', 'aktif')

    if (role.value === 'super_admin') {
      userQuery = userQuery.eq('role', 'user')
    } else if (role.value === 'admin') {
      if (!adminGroupId.value) {
        users.value = []
        loading.value = false
        return
      }
      userQuery = userQuery.eq('group_id', adminGroupId.value)
    }

    const { data: userData, error: userError } = await userQuery.order('nama')
    if (userError) throw userError
    users.value = userData || []

    if (users.value.length === 0) {
      loading.value = false
      return
    }

    const userIds = users.value.map(u => u.id)
    const { data: logs, error: logsError } = await supabase
      .from('daily_worship_logs')
      .select('*')
      .in('user_id', userIds)
      .gte('tanggal', monthStart.value)
      .lte('tanggal', monthEnd.value)

    if (logsError) throw logsError

    const logMap = {}
    ;(logs || []).forEach(log => {
      if (!logMap[log.user_id]) logMap[log.user_id] = []
      logMap[log.user_id].push(log)
    })

    const summary = {}
    users.value.forEach(u => {
      const userLogs = logMap[u.id] || []
      const activeLogs = userLogs.filter(l => !l.berhalangan)
      const totalHari = userLogs.length
      const berhalanganCount = userLogs.filter(l => l.berhalangan).length

      let totalScore = 0
      let totalWajib = 0
      let totalTepatWaktu = 0
      let tahajjudCount = 0
      let quranCount = 0

      activeLogs.forEach(log => {
        totalScore += hitungSkorHarian(log)

        const wajibFields = ['shalat_subuh', 'shalat_dzuhur', 'shalat_ashar', 'shalat_maghrib', 'shalat_isya']
        wajibFields.forEach(f => {
          totalWajib++
          if (log[f] === 'tepat_waktu') totalTepatWaktu++
        })
        if (log.tahajjud === 'tepat_waktu' || log.tahajjud === 'terlambat') tahajjudCount++
        if (log.bacaan_quran && Object.keys(log.bacaan_quran).length > 0) quranCount++
      })

      const rataRata = activeLogs.length > 0 ? totalScore / activeLogs.length : 0
      const konsistensi = totalWajib > 0 ? Math.round((totalTepatWaktu / totalWajib) * 100) : 0
      const tahajjudPct = activeLogs.length > 0 ? Math.round((tahajjudCount / activeLogs.length) * 100) : 0
      const quranPct = activeLogs.length > 0 ? Math.round((quranCount / activeLogs.length) * 100) : 0

      summary[u.id] = {
        totalHari,
        berhalanganCount,
        rataRata: Math.round(rataRata * 10) / 10,
        konsistensi,
        tahajjudPct,
        quranPct,
        maxSkor: AMALAN_SKOR_MAX
      }
    })

    usersSummary.value = summary
  } catch (e) {
    console.error('Gagal memuat data monitoring:', e)
    appStore.setError('Gagal memuat data')
  } finally {
    loading.value = false
  }
}

const totalActive = computed(() => users.value.length)
const averageKonsistensi = computed(() => {
  const vals = users.value.map(u => usersSummary.value[u.id]?.konsistensi || 0)
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
})
const averageHari = computed(() => {
  const vals = users.value.map(u => usersSummary.value[u.id]?.totalHari || 0)
  return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0
})

function prevMonth() {
  if (currentMonth.value === 1) {
    currentMonth.value = 12
    currentYear.value--
  } else {
    currentMonth.value--
  }
  loadData()
}

function nextMonth() {
  if (currentMonth.value === 12) {
    currentMonth.value = 1
    currentYear.value++
  } else {
    currentMonth.value++
  }
  loadData()
}

async function exportPDF() {
  exporting.value = true
  try {
    const doc = new jsPDF('l', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.getWidth()

    doc.setFontSize(16)
    doc.setTextColor(22, 163, 74)
    doc.text('Laporan Monitoring Amalan', pageWidth / 2, 20, { align: 'center' })

    doc.setFontSize(10)
    doc.setTextColor(107, 114, 128)
    doc.text(`Periode: ${monthLabel.value}`, pageWidth / 2, 28, { align: 'center' })
    doc.text(`Total Anggota: ${filteredUsers.value.length}`, pageWidth / 2, 34, { align: 'center' })

    if (filterGroup.value) {
      const grp = allGroups.value.find(g => g.id === filterGroup.value)
      if (grp) doc.text(`Kelompok: ${grp.nama_kelompok}`, pageWidth / 2, 40, { align: 'center' })
    }

    const rows = filteredUsers.value.map((u, i) => {
      const s = usersSummary.value[u.id]
      return [
        i + 1,
        u.nama || '-',
        u.nim || '-',
        u.groups?.nama_kelompok || '-',
        s?.totalHari || 0,
        s?.rataRata || 0,
        s ? `${s.konsistensi}%` : '0%'
      ]
    })

    const scoreY = filterGroup.value ? 46 : 40
    doc.autoTable({
      startY: scoreY,
      head: [['No', 'Nama', 'NIM', 'Kelompok', 'Hari Tercatat', 'Rata-rata', 'Konsistensi']],
      body: rows,
      headStyles: {
        fillColor: [22, 163, 74],
        fontSize: 9
      },
      bodyStyles: {
        fontSize: 8
      },
      alternateRowStyles: {
        fillColor: [240, 253, 244]
      }
    })

    doc.save(`monitoring-amalan-${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}.pdf`)
  } catch (e) {
    console.error('Gagal export PDF:', e)
    appStore.setError('Gagal mengexport PDF')
  } finally {
    exporting.value = false
  }
}

function getInitial(name) {
  return (name || '?')[0].toUpperCase()
}

function getInitialColor(name) {
  const colors = [
    'bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-purple-500',
    'bg-rose-500', 'bg-cyan-500', 'bg-teal-500', 'bg-indigo-500'
  ]
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function konsistensiColor(pct) {
  if (pct >= 75) return 'text-emerald-600'
  if (pct >= 50) return 'text-amber-600'
  return 'text-red-600'
}

function konsistensiBarColor(pct) {
  if (pct >= 75) return 'bg-emerald-500'
  if (pct >= 50) return 'bg-amber-400'
  return 'bg-red-400'
}

let realtimeSub = null

onMounted(() => {
  loadData()
  if (role.value === 'super_admin') loadGroups()
  realtimeSub = supabase
    .channel('monitoring-amalan')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_worship_logs' }, () => {
      loadData()
    })
    .subscribe()
})

onUnmounted(() => {
  if (realtimeSub) supabase.removeChannel(realtimeSub)
})
</script>

<template>
  <div>
    <div class="mb-5">
      <h1 class="text-xl font-bold text-gray-900">Monitoring Amalan</h1>
      <p class="text-sm text-gray-500 mt-1">
        {{ role === 'super_admin' ? 'Seluruh anggota (monitoring)' : 'Anggota kelompok binaan' }}
      </p>
    </div>

    <div v-if="isAdminWithoutGroup" class="text-center py-12">
      <div class="flex justify-center mb-4">
        <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
          <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>
      <h3 class="text-lg font-medium text-gray-700">Anda Belum Ditugaskan ke Kelompok</h3>
      <p class="text-sm text-gray-500 mt-1">Hubungi Super Admin untuk ditetapkan sebagai Murabbi.</p>
    </div>

    <div v-else-if="loading" class="text-center py-12 text-gray-500">
      <svg class="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span>Memuat data amalan...</span>
    </div>

    <template v-else>
      <div class="grid grid-cols-3 gap-3 mb-5">
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 text-center">
          <p class="text-2xl font-bold text-emerald-600">{{ totalActive }}</p>
          <p class="text-[10px] text-gray-500 mt-0.5">Anggota</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 text-center">
          <p class="text-2xl font-bold text-blue-600">{{ averageKonsistensi }}%</p>
          <p class="text-[10px] text-gray-500 mt-0.5">Rata Konsistensi</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 text-center">
          <p class="text-2xl font-bold text-amber-600">{{ averageHari }}</p>
          <p class="text-[10px] text-gray-500 mt-0.5">Rata Hari</p>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
        <div class="flex items-center justify-between mb-3">
          <button
            @click="prevMonth"
            class="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 class="text-sm font-bold text-gray-800">{{ monthLabel }}</h2>
          <button
            @click="nextMonth"
            class="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div class="relative mb-3">
          <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari nama atau NIM..."
            class="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        <div class="flex gap-2">
          <select
            v-if="role === 'super_admin'"
            v-model="filterGroup"
            class="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="">Semua Kelompok</option>
            <option v-for="g in allGroups" :key="g.id" :value="g.id">{{ g.nama_kelompok }}</option>
          </select>
          <select
            v-model="filterScore"
            class="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="">Semua Skor</option>
            <option value="tinggi">Konsistensi Tinggi (≥75%)</option>
            <option value="sedang">Konsistensi Sedang (50-74%)</option>
            <option value="rendah">Konsistensi Rendah (<50%)</option>
          </select>
          <button
            v-if="role === 'super_admin'"
            @click="exportPDF"
            :disabled="exporting"
            class="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-medium hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          >
            <svg v-if="exporting" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export
          </button>
        </div>
      </div>

      <div v-if="filteredUsers.length === 0" class="text-center py-12">
        <div class="flex justify-center mb-4">
          <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>
        <h3 class="text-lg font-medium text-gray-700">Tidak Ada Data</h3>
        <p class="text-sm text-gray-500 mt-1">Tidak ada anggota yang sesuai filter.</p>
      </div>

      <div v-else class="space-y-3">
        <p class="text-sm text-gray-500">{{ filteredUsers.length }} anggota</p>

        <div
          v-for="u in filteredUsers"
          :key="u.id"
          @click="router.push(`/monitoring-amalan/${u.id}`)"
          class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 cursor-pointer hover:shadow-md hover:border-emerald-200 transition-all active:scale-[0.99]"
        >
          <div class="flex items-center gap-3 mb-3">
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
              :class="getInitialColor(u.nama)"
            >
              {{ getInitial(u.nama) }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-medium text-gray-900 truncate">{{ u.nama }}</p>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="text-xs text-gray-400">{{ u.nim || '-' }}</span>
                <span
                  v-if="u.groups?.nama_kelompok"
                  class="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200"
                >
                  {{ u.groups.nama_kelompok }}
                </span>
              </div>
            </div>
            <svg class="w-5 h-5 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>

          <div v-if="usersSummary[u.id]" class="grid grid-cols-2 gap-3 text-center mb-3">
            <div class="bg-gray-50 rounded-xl py-2 px-1">
              <p class="text-lg font-bold text-gray-800">{{ usersSummary[u.id].totalHari }}</p>
              <p class="text-[10px] text-gray-500">Hari Tercatat</p>
            </div>
            <div class="bg-gray-50 rounded-xl py-2 px-1">
              <p class="text-lg font-bold text-gray-800">{{ usersSummary[u.id].rataRata }}</p>
              <p class="text-[10px] text-gray-500">Rata-rata /{{ usersSummary[u.id].maxSkor }}</p>
            </div>
            <div class="bg-gray-50 rounded-xl py-2 px-1">
              <p class="text-lg font-bold" :class="konsistensiColor(usersSummary[u.id].konsistensi)">
                {{ usersSummary[u.id].konsistensi }}%
              </p>
              <p class="text-[10px] text-gray-500">Shalat Wajib</p>
            </div>
            <div class="bg-gray-50 rounded-xl py-2 px-1">
              <p class="text-lg font-bold text-indigo-600">{{ usersSummary[u.id].tahajjudPct }}%</p>
              <p class="text-[10px] text-gray-500">Tahajjud</p>
            </div>
          </div>
          <div v-if="usersSummary[u.id]" class="flex items-center gap-2 mb-2">
            <span class="text-xs text-gray-500">Qur'an:</span>
            <span class="text-xs font-medium text-emerald-600">{{ usersSummary[u.id].quranPct }}%</span>
            <span v-if="usersSummary[u.id].berhalanganCount > 0" class="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-medium border border-amber-200">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              {{ usersSummary[u.id].berhalanganCount }} hari berhalangan
            </span>
          </div>

          <div v-if="usersSummary[u.id]" class="space-y-1">
            <div class="flex items-center justify-between text-xs text-gray-500">
              <span>Konsistensi shalat wajib</span>
              <span :class="konsistensiColor(usersSummary[u.id].konsistensi)">
                {{ usersSummary[u.id].konsistensi }}%
              </span>
            </div>
            <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="konsistensiBarColor(usersSummary[u.id].konsistensi)"
                :style="{ width: usersSummary[u.id].konsistensi + '%' }"
              ></div>
            </div>
          </div>

          <div v-else class="text-center text-sm text-gray-400 py-1">
            Belum ada catatan amalan bulan ini.
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
