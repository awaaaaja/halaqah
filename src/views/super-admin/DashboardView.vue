<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'

const stats = ref({
  totalGroups: 0,
  totalAdmins: 0,
  totalMembers: 0,
  activeSessions: 0
})
const activeSessions = ref([])
const groupOverview = ref([])
const adminActivity = ref([])
const weeklyTrend = ref([])
const loading = ref(true)

async function loadDashboard() {
  loading.value = true

  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()

  const [
    { count: totalGroups },
    { count: totalAdmins },
    { count: totalMembers },
    { data: activeSes },
    { data: groupsWithCount },
    { data: adminData },
  ] = await Promise.all([
    supabase.from('groups').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'user').eq('status_akun', 'aktif'),
    supabase.from('sessions').select('id, group_id, judul_materi, dibuka_at, created_by, groups(nama_kelompok), profiles!sessions_created_by_fkey(nama)').eq('is_open', true),
    supabase.from('groups').select('id, nama_kelompok'),
    supabase.from('profiles').select('id, nama, group_id, groups(nama_kelompok)').eq('role', 'admin').order('nama'),
  ])

  stats.value = {
    totalGroups: totalGroups || 0,
    totalAdmins: totalAdmins || 0,
    totalMembers: totalMembers || 0,
    activeSessions: activeSes?.length || 0
  }

  activeSessions.value = (activeSes || []).map(s => ({
    id: s.id,
    nama_kelompok: s.groups?.nama_kelompok || '-',
    judul_materi: s.judul_materi || 'Liqa',
    dibuka_at: s.dibuka_at,
    murabbi: s.profiles?.nama || '-'
  }))

  // Group overview with attendance rates
  const groupData = groupsWithCount || []
  const groupStats = await Promise.all(groupData.map(async (g) => {
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('group_id', g.id)
      .order('created_at', { ascending: false })
      .limit(5)

    const sessionIds = (sessions || []).map(s => s.id)
    let hadir = 0, total = 0
    if (sessionIds.length > 0) {
      const { data: atts } = await supabase
        .from('attendances')
        .select('status')
        .in('session_id', sessionIds)
      total = (atts || []).length
      hadir = (atts || []).filter(a => a.status === 'hadir').length
    }

    return {
      id: g.id,
      nama: g.nama_kelompok,
      totalSesi: sessionIds.length,
      hadir,
      totalAbsen: total,
      rate: total > 0 ? Math.round((hadir / total) * 100) : 0
    }
  }))
  groupOverview.value = groupStats

  // Admin weekly activity
  const { data: weekSessions } = await supabase
    .from('sessions')
    .select('created_by, groups!inner(murabbi_id)')
    .gte('created_at', weekAgo)

  const activeAdminIds = new Set((weekSessions || []).map(s => s.created_by))
  adminActivity.value = (adminData || []).map(a => ({
    id: a.id,
    nama: a.nama,
    kelompok: a.groups?.nama_kelompok || 'Belum ditugaskan',
    aktifMingguIni: activeAdminIds.has(a.id)
  }))

  // Weekly trend — query sessions + join attendances, count per date in JS
  const { data: weekSessionsList } = await supabase
    .from('sessions')
    .select('id, tanggal')
    .gte('tanggal', weekAgo.split('T')[0])

  const weekSessionIds = (weekSessionsList || []).map(s => s.id)
  const attCountByDate = {}

  if (weekSessionIds.length > 0) {
    const { data: weekAtts } = await supabase
      .from('attendances')
      .select('session_id')
      .in('session_id', weekSessionIds)

    const countBySession = {}
    ;(weekAtts || []).forEach(a => {
      countBySession[a.session_id] = (countBySession[a.session_id] || 0) + 1
    })
    ;(weekSessionsList || []).forEach(s => {
      const dateKey = s.tanggal
      const c = countBySession[s.id] || 0
      attCountByDate[dateKey] = (attCountByDate[dateKey] || 0) + c
    })
  }

  const trendMap = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const key = d.toISOString().split('T')[0]
    trendMap[key] = { tanggal: key, total: attCountByDate[key] || 0 }
  }
  weeklyTrend.value = Object.values(trendMap)

  loading.value = false
}

onMounted(loadDashboard)
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-emerald-900 mb-1">Dashboard</h1>
    <p class="text-sm text-gray-500 mb-6">Progress liqa lintas kelompok</p>

    <!-- Skeleton loading -->
    <div v-if="loading" class="space-y-4 animate-pulse">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div v-for="i in 4" :key="i" class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div class="h-8 bg-gray-200 rounded w-12 mb-2"></div>
          <div class="h-3 bg-gray-200 rounded w-20"></div>
        </div>
      </div>
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div class="h-4 bg-gray-200 rounded w-40 mb-3"></div>
        <div v-for="i in 3" :key="i" class="h-10 bg-gray-100 rounded mb-2"></div>
      </div>
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div class="h-4 bg-gray-200 rounded w-40 mb-3"></div>
        <div v-for="i in 2" :key="i" class="h-6 bg-gray-100 rounded mb-3"></div>
      </div>
    </div>

    <template v-else>
      <!-- Stat Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p class="text-2xl font-bold text-gray-800">{{ stats.totalGroups }}</p>
          <p class="text-xs text-gray-500">Kelompok</p>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p class="text-2xl font-bold text-blue-600">{{ stats.totalAdmins }}</p>
          <p class="text-xs text-gray-500">Murabbi</p>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p class="text-2xl font-bold text-emerald-600">{{ stats.totalMembers }}</p>
          <p class="text-xs text-gray-500">Anggota Aktif</p>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"
          :class="stats.activeSessions > 0 ? 'bg-emerald-50 border-emerald-200' : ''">
          <p class="text-2xl font-bold" :class="stats.activeSessions > 0 ? 'text-emerald-600' : 'text-gray-400'">
            {{ stats.activeSessions }}
          </p>
          <p class="text-xs text-gray-500">Sesi Hari Ini</p>
        </div>
      </div>

      <!-- Active Sessions -->
      <div v-if="activeSessions.length > 0" class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
        <h3 class="font-bold text-emerald-800 mb-3 flex items-center gap-2"><svg class="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg> Sesi Sedang Berlangsung</h3>
        <div class="space-y-2">
          <div v-for="s in activeSessions" :key="s.id"
            class="flex justify-between items-center bg-white rounded-lg p-3">
            <div>
              <p class="font-medium text-gray-800">{{ s.nama_kelompok }}</p>
              <p class="text-sm text-gray-500">{{ s.judul_materi }}</p>
              <p class="text-xs text-gray-400 mt-0.5">oleh {{ s.murabbi }}</p>
            </div>
            <span class="text-xs text-gray-400">{{ new Date(s.dibuka_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }}</span>
          </div>
        </div>
      </div>

      <!-- Group Overview -->
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
        <h3 class="font-bold text-gray-800 mb-3 flex items-center gap-2"><svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> Kehadiran per Kelompok</h3>
        <div v-if="groupOverview.length === 0" class="text-gray-400 text-sm text-center py-4">
          Belum ada data kelompok.
        </div>
        <div v-else class="space-y-4">
          <div v-for="g in groupOverview" :key="g.id">
            <div class="flex justify-between text-sm mb-1">
              <span class="font-medium text-gray-700">{{ g.nama }}</span>
              <span class="text-gray-500">{{ g.rate }}% ({{ g.hadir }}/{{ g.totalAbsen }})</span>
            </div>
            <div class="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all"
                :class="g.rate >= 75 ? 'bg-emerald-500' : g.rate >= 50 ? 'bg-amber-500' : 'bg-red-500'"
                :style="{ width: g.rate + '%' }">
              </div>
            </div>
            <p class="text-xs text-gray-400 mt-0.5">{{ g.totalSesi }} sesi terakhir</p>
          </div>
        </div>
      </div>

      <!-- Two columns: Admin Activity + Weekly Trend -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Admin Activity -->
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 class="font-bold text-gray-800 mb-3 flex items-center gap-2"><svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> Aktivitas Murabbi Minggu Ini</h3>
          <div v-if="adminActivity.length === 0" class="text-gray-400 text-sm text-center py-4">
            Belum ada Murabbi.
          </div>
          <div v-else class="space-y-2">
            <div v-for="a in adminActivity" :key="a.id"
              class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full" :class="a.aktifMingguIni ? 'bg-emerald-500' : 'bg-gray-300'"></span>
                <div>
                  <p class="text-sm font-medium text-gray-700">{{ a.nama }}</p>
                  <p class="text-xs text-gray-400">{{ a.kelompok }}</p>
                </div>
              </div>
              <span v-if="a.aktifMingguIni" class="text-xs text-emerald-600 flex items-center gap-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                Buka sesi
              </span>
              <span v-else class="text-xs text-gray-400 flex items-center gap-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                Belum
              </span>
            </div>
          </div>
        </div>

        <!-- Weekly Trend -->
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 class="font-bold text-gray-800 mb-3 flex items-center gap-2"><svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg> Tren Kehadiran 7 Hari</h3>
          <div v-if="weeklyTrend.length === 0" class="text-gray-400 text-sm text-center py-4">
            Belum ada data.
          </div>
          <div v-else class="flex items-end gap-1 h-32">
            <div v-for="d in weeklyTrend" :key="d.tanggal" class="flex-1 flex flex-col items-center gap-1">
              <div class="w-full bg-emerald-100 rounded-t-md transition-all"
                :style="{ height: Math.max(4, (d.total / Math.max(...weeklyTrend.map(x => x.total), 1)) * 100) + '%' }">
              </div>
              <span class="text-[10px] text-gray-400 whitespace-nowrap">
                {{ new Date(d.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short' }) }}
              </span>
              <span class="text-[10px] font-medium text-gray-600">{{ d.total }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
