<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useAmalan } from '@/composables/useAmalan'

const router = useRouter()
const authStore = useAuthStore()
const { getBulanan, hitungSkorHarian, loading } = useAmalan()

const now = new Date()
const tahun = ref(now.getFullYear())
const bulan = ref(now.getMonth() + 1)
const monthLogs = ref([])

const bulanNama = computed(() => {
  return new Date(tahun.value, bulan.value - 1).toLocaleDateString('id-ID', {
    month: 'long', year: 'numeric'
  })
})

const daysInMonth = computed(() => {
  return new Date(tahun.value, bulan.value, 0).getDate()
})

const firstDayIndex = computed(() => {
  return new Date(tahun.value, bulan.value - 1, 1).getDay()
})

const calendarDays = computed(() => {
  const days = []
  const totalDays = daysInMonth.value
  const startOffset = firstDayIndex.value

  for (let i = 0; i < startOffset; i++) {
    days.push(null)
  }
  for (let d = 1; d <= totalDays; d++) {
    days.push(d)
  }
  return days
})

const todayStr = computed(() => {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
})

function getDayScore(day) {
  const dateStr = `${tahun.value}-${String(bulan.value).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const log = monthLogs.value.find(l => l.tanggal === dateStr)
  if (!log) return null
  return hitungSkorHarian(log)
}

function dayClass(day) {
  const score = getDayScore(day)
  if (!score || score.score === 0) return ''
  if (score.score >= 20) return 'bg-emerald-500 text-white'
  if (score.score >= 10) return 'bg-amber-400 text-white'
  return 'bg-red-400 text-white'
}

function dayIndicator(day) {
  const score = getDayScore(day)
  if (!score || score.score === 0) return 'bg-gray-200'
  if (score.score >= 20) return 'bg-emerald-500'
  if (score.score >= 10) return 'bg-amber-400'
  return 'bg-red-400'
}

function isFutureDay(day) {
  const dateStr = `${tahun.value}-${String(bulan.value).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return dateStr > todayStr.value
}

function goToDay(day) {
  const dateStr = `${tahun.value}-${String(bulan.value).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  router.push({ name: 'AmalanHarian', query: { tanggal: dateStr } })
}

function prevMonth() {
  if (bulan.value === 1) {
    bulan.value = 12
    tahun.value--
  } else {
    bulan.value--
  }
}

function nextMonth() {
  if (bulan.value === 12) {
    bulan.value = 1
    tahun.value++
  } else {
    bulan.value++
  }
}

const isCurrentMonth = computed(() => {
  const t = new Date()
  return tahun.value === t.getFullYear() && bulan.value === t.getMonth() + 1
})

async function loadMonth() {
  if (!authStore.user?.id) return
  const data = await getBulanan(authStore.user.id, tahun.value, bulan.value)
  monthLogs.value = data || []
}

onMounted(async () => {
  await authStore.fetchSession?.()
  await loadMonth()
})
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-emerald-900 mb-1">Kalender Amalan</h1>
    <p class="text-sm text-gray-500 mb-4">Pantau konsistensi ibadah harian Anda</p>

    <!-- Month Navigation -->
    <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-3 mb-4 flex items-center justify-between">
      <button @click="prevMonth; loadMonth()" class="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
        :disabled="loading" aria-label="Bulan sebelumnya">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>
      <div class="text-center">
        <p class="text-sm font-semibold text-emerald-800">{{ bulanNama }}</p>
        <button v-if="!isCurrentMonth" @click="tahun = now.getFullYear(); bulan = now.getMonth() + 1; loadMonth()"
          class="text-[10px] text-emerald-600 hover:text-emerald-700 font-medium underline underline-offset-2">
          Bulan Ini
        </button>
      </div>
      <button @click="nextMonth; loadMonth()" class="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
        :disabled="loading" aria-label="Bulan selanjutnya">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
        </svg>
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

    <!-- Calendar Grid -->
    <div v-else class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <!-- Day Headers -->
      <div class="grid grid-cols-7 mb-2">
        <div v-for="day in ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']" :key="day"
          class="text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider py-1">
          {{ day }}
        </div>
      </div>

      <!-- Calendar Body -->
      <div class="grid grid-cols-7 gap-1">
        <div v-for="(day, idx) in calendarDays" :key="idx" class="aspect-square">
          <div v-if="day"
            @click="goToDay(day)"
            class="relative w-full h-full flex items-center justify-center rounded-xl text-sm font-medium cursor-pointer transition-all hover:shadow-md active:scale-95"
            :class="[
              isFutureDay(day) ? 'text-gray-300 cursor-default hover:shadow-none active:scale-100' : 'text-gray-700 hover:bg-gray-50',
              dayClass(day) || 'bg-gray-50'
            ]">
            <span>{{ day }}</span>
            <!-- Dot indicator for non-empty days -->
            <span v-if="!isFutureDay(day) && getDayScore(day) !== null && getDayScore(day).score > 0"
              class="absolute -bottom-0.5 w-1.5 h-1.5 rounded-full"
              :class="dayIndicator(day)">
            </span>
          </div>
          <div v-else class="w-full h-full"></div>
        </div>
      </div>

      <!-- Legend -->
      <div class="mt-5 pt-4 border-t border-gray-100">
        <p class="text-xs font-medium text-gray-500 mb-2">Legenda:</p>
        <div class="flex flex-wrap gap-4">
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-full bg-emerald-500"></span>
            <span class="text-xs text-gray-600">Lengkap (&ge;20)</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-full bg-amber-400"></span>
            <span class="text-xs text-gray-600">Sedang (10-19)</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-full bg-red-400"></span>
            <span class="text-xs text-gray-600">Kurang (&lt;10)</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-full bg-gray-200"></span>
            <span class="text-xs text-gray-600">Belum ada data</span>
          </div>
        </div>
      </div>

      <div class="mt-3 p-3 bg-emerald-50 rounded-xl text-xs text-emerald-700">
        <div class="flex items-start gap-2">
          <svg class="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span>Klik tanggal untuk melihat atau mengisi amalan harian.</span>
        </div>
      </div>
    </div>
  </div>
</template>
