<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'

const router = useRouter()
const authStore = useAuthStore()
const appStore = useAppStore()

const users = ref([])
const usersSummary = ref({})
const loading = ref(true)

const role = computed(() => authStore.profile?.role)
const adminGroupId = computed(() => authStore.profile?.group_id)
const isAdminWithoutGroup = computed(() => role.value === 'admin' && !adminGroupId.value)

const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1
const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
const monthEnd = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0]

function hitungSkor(log) {
  if (!log) return 0
  let score = 0
  const wajibFields = ['shalat_subuh', 'shalat_dzuhur', 'shalat_ashar', 'shalat_maghrib', 'shalat_isya']
  wajibFields.forEach(f => {
    if (log[f] === 'tepat_waktu') score += 4
    else if (log[f] === 'terlambat') score += 2
    else if (log[f] === 'qadha') score += 1
  })
  if (log.shalat_dhuha) score += 3
  return score
}

async function loadData() {
  loading.value = true
  try {
    let userQuery = supabase
      .from('profiles')
      .select('id, nama, nim, group_id, groups(nama_kelompok)')
      .eq('status_akun', 'aktif')

    if (role.value === 'admin') {
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
      .gte('tanggal', monthStart)
      .lte('tanggal', monthEnd)

    if (logsError) throw logsError

    const logMap = {}
    ;(logs || []).forEach(log => {
      if (!logMap[log.user_id]) logMap[log.user_id] = []
      logMap[log.user_id].push(log)
    })

    const summary = {}
    users.value.forEach(u => {
      const userLogs = logMap[u.id] || []
      const totalHari = userLogs.length

      let totalScore = 0
      let totalWajib = 0
      let totalTepatWaktu = 0

      userLogs.forEach(log => {
        totalScore += hitungSkor(log)

        const wajibFields = ['shalat_subuh', 'shalat_dzuhur', 'shalat_ashar', 'shalat_maghrib', 'shalat_isya']
        wajibFields.forEach(f => {
          totalWajib++
          if (log[f] === 'tepat_waktu') totalTepatWaktu++
        })
      })

      const rataRata = totalHari > 0 ? totalScore / totalHari : 0
      const konsistensi = totalWajib > 0 ? Math.round((totalTepatWaktu / totalWajib) * 100) : 0

      summary[u.id] = {
        totalHari,
        rataRata: Math.round(rataRata * 10) / 10,
        konsistensi,
        maxSkor: 23
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
        {{ role === 'super_admin' ? 'Seluruh anggota' : 'Anggota kelompok binaan' }} —
        {{ new Date(currentYear, currentMonth - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) }}
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

    <div v-else-if="users.length === 0" class="text-center py-12">
      <div class="flex justify-center mb-4">
        <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
          <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
      </div>
      <h3 class="text-lg font-medium text-gray-700">Belum Ada Anggota</h3>
      <p class="text-sm text-gray-500 mt-1">Tidak ada anggota aktif untuk ditampilkan.</p>
    </div>

    <div v-else class="space-y-3">
      <p class="text-sm text-gray-500">{{ users.length }} anggota</p>

      <div
        v-for="u in users"
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

        <div v-if="usersSummary[u.id]" class="grid grid-cols-3 gap-3 text-center mb-3">
          <div class="bg-gray-50 rounded-xl py-2 px-1">
            <p class="text-lg font-bold text-gray-800">{{ usersSummary[u.id].totalHari }}</p>
            <p class="text-[10px] text-gray-500">Hari Tercatat</p>
          </div>
          <div class="bg-gray-50 rounded-xl py-2 px-1">
            <p class="text-lg font-bold text-gray-800">{{ usersSummary[u.id].rataRata }}</p>
            <p class="text-[10px] text-gray-500">Rata-rata /{{ usersSummary[u.id].maxSkor }}</p>
          </div>
          <div class="bg-gray-50 rounded-xl py-2 px-1">
            <p
              class="text-lg font-bold"
              :class="konsistensiColor(usersSummary[u.id].konsistensi)"
            >
              {{ usersSummary[u.id].konsistensi }}%
            </p>
            <p class="text-[10px] text-gray-500">Konsistensi</p>
          </div>
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
  </div>
</template>
