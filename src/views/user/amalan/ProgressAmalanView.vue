<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useAmalan } from '@/composables/useAmalan'
import { Bar, Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement)

const authStore = useAuthStore()
const { getBulanan, hitungKonsistensi, hitungSkorHarian, loading } = useAmalan()

const activeTab = ref('minggu')
const now = new Date()
const tahun = ref(now.getFullYear())
const bulan = ref(now.getMonth() + 1)
const monthLogs = ref([])

const monthLogsSorted = computed(() => {
  return [...monthLogs.value].sort((a, b) => a.tanggal.localeCompare(b.tanggal))
})

// ── Weekly Data ──
const weekDates = computed(() => {
  const dates = []
  const today = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    dates.push({ date: `${y}-${m}-${day}`, label: d.toLocaleDateString('id-ID', { weekday: 'short' }) })
  }
  return dates
})

const weeklyData = computed(() => {
  return weekDates.value.map(w => {
    const log = monthLogs.value.find(l => l.tanggal === w.date)
    if (!log) return { label: w.label, pct: 0, date: w.date }
    const wajibFields = ['shalat_subuh', 'shalat_dzuhur', 'shalat_ashar', 'shalat_maghrib', 'shalat_isya']
    let tepat = 0
    wajibFields.forEach(f => { if (log[f] === 'tepat_waktu') tepat++ })
    return { label: w.label, pct: Math.round((tepat / 5) * 100), date: w.date }
  })
})

const weeklyBarData = computed(() => ({
  labels: weeklyData.value.map(d => d.label),
  datasets: [{
    label: 'Tepat Waktu',
    data: weeklyData.value.map(d => d.pct),
    backgroundColor: weeklyData.value.map(d => d.pct >= 80 ? '#10b981' : d.pct >= 40 ? '#f59e0b' : '#ef4444'),
    borderRadius: 6,
    maxBarThickness: 32
  }]
}))

const weeklyBarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: ctx => `${ctx.parsed.y}% tepat waktu`
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      max: 100,
      grid: { color: 'rgba(0,0,0,0.04)' },
      ticks: { callback: v => v + '%' }
    },
    x: {
      grid: { display: false }
    }
  }
}

// ── Monthly Data ──
const monthlyShalatData = computed(() => {
  const logs = monthLogsSorted.value
  if (logs.length === 0) return { labels: [], datasets: [] }
  const fields = ['shalat_subuh', 'shalat_dzuhur', 'shalat_ashar', 'shalat_maghrib', 'shalat_isya']
  const labelsMap = {
    shalat_subuh: 'Subuh', shalat_dzuhur: 'Dzuhur', shalat_ashar: 'Ashar',
    shalat_maghrib: 'Maghrib', shalat_isya: 'Isya'
  }
  const labels = fields.map(f => labelsMap[f])
  const tepatData = fields.map(f => {
    return logs.filter(l => l[f] === 'tepat_waktu').length
  })
  const lainnyaData = fields.map(f => {
    return logs.filter(l => l[f] !== 'tepat_waktu').length
  })
  return {
    labels,
    datasets: [
      {
        label: 'Tepat Waktu',
        data: tepatData,
        backgroundColor: '#10b981',
        borderRadius: 6,
        maxBarThickness: 24
      },
      {
        label: 'Lainnya',
        data: lainnyaData,
        backgroundColor: '#d1d5db',
        borderRadius: 6,
        maxBarThickness: 24
      }
    ]
  }
})

const monthlyShalatOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { boxWidth: 12, padding: 16, font: { size: 11 } } },
    tooltip: {
      callbacks: {
        label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y} hari`
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(0,0,0,0.04)' },
      ticks: { stepSize: 1 }
    },
    x: {
      grid: { display: false }
    }
  }
}

const doughnutData = computed(() => {
  const logs = monthLogsSorted.value
  if (logs.length === 0) return { labels: [], datasets: [] }
  const totalTepat = logs.filter(l => {
    return ['shalat_subuh', 'shalat_dzuhur', 'shalat_ashar', 'shalat_maghrib', 'shalat_isya']
      .every(f => l[f] === 'tepat_waktu')
  }).length
  const totalLain = logs.length - totalTepat
  return {
    labels: ['Semua Tepat Waktu', 'Ada Kekurangan'],
    datasets: [{
      data: [totalTepat, totalLain],
      backgroundColor: ['#10b981', '#d1d5db'],
      borderWidth: 0,
      cutout: '70%'
    }]
  }
})

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { boxWidth: 12, padding: 16, font: { size: 11 } } }
  }
}

// ── Stats ──
const bulanNama = computed(() => {
  return new Date(tahun.value, bulan.value - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
})

const rataRataSkor = computed(() => {
  const logs = monthLogsSorted.value
  if (logs.length === 0) return 0
  const totalScore = logs.reduce((sum, l) => sum + hitungSkorHarian(l).score, 0)
  return Math.round((totalScore / logs.length) * 10) / 10
})

const totalHariTercatat = computed(() => monthLogsSorted.value.length)

const konsistensiDhuha = computed(() => {
  return hitungKonsistensi(monthLogsSorted.value, 'dhuha')
})

const konsistensiWajib = computed(() => {
  return hitungKonsistensi(monthLogsSorted.value, 'shalat_wajib')
})

async function loadMonth() {
  if (!authStore.user?.id) return
  const data = await getBulanan(authStore.user.id, tahun.value, bulan.value)
  monthLogs.value = data || []
}

function prevMonth() {
  if (bulan.value === 1) { bulan.value = 12; tahun.value-- }
  else { bulan.value-- }
  loadMonth()
}

function nextMonth() {
  if (bulan.value === 12) { bulan.value = 1; tahun.value++ }
  else { bulan.value++ }
  loadMonth()
}

onMounted(async () => {
  await loadMonth()
})
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-emerald-900 mb-1">Progress Amalan</h1>
    <p class="text-sm text-gray-500 mb-4">Analisis konsistensi ibadah harian Anda</p>

    <!-- Tab Toggle -->
    <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-1 mb-4 flex">
      <button @click="activeTab = 'minggu'"
        class="flex-1 py-2 text-sm font-medium rounded-lg transition-colors"
        :class="activeTab === 'minggu' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'">
        Minggu Ini
      </button>
      <button @click="activeTab = 'bulan'"
        class="flex-1 py-2 text-sm font-medium rounded-lg transition-colors"
        :class="activeTab === 'bulan' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'">
        Bulan Ini
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-8 text-gray-500">
      <svg class="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      <span>Memuat data...</span>
    </div>

    <template v-else>
      <!-- ── Minggu Ini Tab ── -->
      <div v-if="activeTab === 'minggu'">
        <!-- Weekly Bar Chart -->
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
          <h2 class="text-sm font-semibold text-gray-700 mb-4">Konsistensi 7 Hari Terakhir</h2>
          <div class="h-52">
            <Bar v-if="weeklyData.some(d => d.pct > 0)" :data="weeklyBarData" :options="weeklyBarOptions" />
            <div v-else class="h-full flex items-center justify-center text-gray-400 text-sm">
              Belum ada data minggu ini
            </div>
          </div>
        </div>

        <!-- Mini Legend -->
        <div class="flex flex-wrap gap-4 px-1 mb-4">
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-sm bg-emerald-500"></span>
            <span class="text-xs text-gray-500">&ge;80%</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-sm bg-amber-400"></span>
            <span class="text-xs text-gray-500">40-79%</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-sm bg-red-400"></span>
            <span class="text-xs text-gray-500">&lt;40%</span>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="!weeklyData.some(d => d.pct > 0)" class="text-center py-8">
          <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
          <h3 class="text-sm font-medium text-gray-700 mb-1">Belum Ada Data</h3>
          <p class="text-xs text-gray-500">Mulai catat amalan harian Anda untuk melihat progress.</p>
        </div>
      </div>

      <!-- ── Bulan Ini Tab ── -->
      <div v-if="activeTab === 'bulan'">
        <!-- Month Navigation -->
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-3 mb-4 flex items-center justify-between">
          <button @click="prevMonth" class="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            :disabled="loading" aria-label="Bulan sebelumnya">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <p class="text-sm font-semibold text-emerald-800">{{ bulanNama }}</p>
          <button @click="nextMonth" class="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            :disabled="loading" aria-label="Bulan selanjutnya">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

        <!-- Stats Cards -->
        <div class="grid grid-cols-2 gap-3 mb-4">
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <p class="text-2xl font-bold text-emerald-600">{{ rataRataSkor }}</p>
            <p class="text-xs text-gray-500 mt-1">Rata-rata Skor</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <p class="text-2xl font-bold text-emerald-600">{{ totalHariTercatat }}</p>
            <p class="text-xs text-gray-500 mt-1">Hari Tercatat</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <p class="text-2xl font-bold text-amber-600">{{ konsistensiWajib }}%</p>
            <p class="text-xs text-gray-500 mt-1">Shalat Wajib</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <p class="text-2xl font-bold text-amber-600">{{ konsistensiDhuha }}%</p>
            <p class="text-xs text-gray-500 mt-1">Dhuha</p>
          </div>
        </div>

        <!-- Monthly Bar Chart (per shalat) -->
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
          <h2 class="text-sm font-semibold text-gray-700 mb-4">Detail Shalat Wajib</h2>
          <div class="h-60">
            <Bar v-if="monthLogs.length > 0" :data="monthlyShalatData" :options="monthlyShalatOptions" />
            <div v-else class="h-full flex items-center justify-center text-gray-400 text-sm">
              Belum ada data bulan ini
            </div>
          </div>
        </div>

        <!-- Doughnut Chart -->
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
          <h2 class="text-sm font-semibold text-gray-700 mb-4">Hari dengan Shalat Lengkap</h2>
          <div class="h-52 flex items-center justify-center">
            <Doughnut v-if="monthLogs.length > 0" :data="doughnutData" :options="doughnutOptions" />
            <div v-else class="text-gray-400 text-sm text-center">
              <p>Belum ada data bulan ini</p>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="monthLogs.length === 0" class="text-center py-8">
          <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
          <h3 class="text-sm font-medium text-gray-700 mb-1">Belum Ada Data Bulan Ini</h3>
          <p class="text-xs text-gray-500">Mulai catat amalan harian Anda untuk melihat progress bulanan.</p>
        </div>
      </div>
    </template>
  </div>
</template>
