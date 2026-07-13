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

    const { count: memberCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', g.id)
      .eq('status_akun', 'aktif')

    return {
      id: g.id,
      nama: g.nama_kelompok,
      totalSesi: sessionIds.length,
      hadir,
      totalAbsen: total,
      rate: total > 0 ? Math.round((hadir / total) * 100) : 0,
      anggota: memberCount || 0
    }
  }))
  groupOverview.value = groupStats

  const { data: weekSessions } = await supabase
    .from('sessions')
    .select('created_by, groups!inner(murabbi_id)')
    .gte('created_at', weekAgo)

  const activeAdminIds = new Set((weekSessions || []).map(s => s.created_by))
  const sessionCountByAdmin = {}
  ;(weekSessions || []).forEach(s => {
    sessionCountByAdmin[s.created_by] = (sessionCountByAdmin[s.created_by] || 0) + 1
  })

  adminActivity.value = (adminData || []).map(a => ({
    id: a.id,
    nama: a.nama,
    kelompok: a.groups?.nama_kelompok || 'Belum ditugaskan',
    aktifMingguIni: activeAdminIds.has(a.id),
    sesiCount: sessionCountByAdmin[a.id] || 0
  }))

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
  <div class="pb-4">
    <!-- Header -->
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-600 p-5 mb-5 text-white shadow-lg">
      <div class="absolute inset-0 opacity-10">
        <svg class="w-full h-full" viewBox="0 0 200 100" fill="none">
          <path d="M20 50 Q 50 20 80 50 T 140 50 T 200 50" stroke="white" stroke-width="0.5" fill="none" opacity="0.3"/>
          <circle cx="30" cy="20" r="2" fill="white" opacity="0.2"/>
          <circle cx="150" cy="15" r="1.5" fill="white" opacity="0.15"/>
          <circle cx="100" cy="85" r="1" fill="white" opacity="0.2"/>
        </svg>
      </div>
      <div class="relative">
        <div class="flex items-center gap-2 mb-1">
          <svg class="w-5 h-5 text-emerald-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/>
          </svg>
          <span class="text-emerald-200 text-sm">Super Admin</span>
        </div>
        <h1 class="text-2xl font-bold font-serif">Dashboard</h1>
        <p class="text-emerald-100 text-sm mt-1">Progress liqa lintas kelompok</p>
      </div>
    </div>

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
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 h-40"></div>
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 h-40"></div>
      </div>
    </div>

    <template v-else>
      <!-- Stat Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>
            </div>
            <div>
              <p class="text-2xl font-bold text-gray-800">{{ stats.totalGroups }}</p>
              <p class="text-xs text-gray-500">Kelompok</p>
            </div>
          </div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </div>
            <div>
              <p class="text-2xl font-bold text-blue-600">{{ stats.totalAdmins }}</p>
              <p class="text-xs text-gray-500">Murabbi</p>
            </div>
          </div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <div>
              <p class="text-2xl font-bold text-emerald-600">{{ stats.totalMembers }}</p>
              <p class="text-xs text-gray-500">Anggota Aktif</p>
            </div>
          </div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"
          :class="stats.activeSessions > 0 ? 'bg-emerald-50 border-emerald-200' : ''">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg" :class="stats.activeSessions > 0 ? 'bg-emerald-200' : 'bg-gray-100'">
              <svg class="w-5 h-5 mx-auto mt-2.5" :class="stats.activeSessions > 0 ? 'text-emerald-600' : 'text-gray-400'" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/>
              </svg>
            </div>
            <div>
              <p class="text-2xl font-bold" :class="stats.activeSessions > 0 ? 'text-emerald-600' : 'text-gray-400'">
                {{ stats.activeSessions }}
              </p>
              <p class="text-xs text-gray-500">Sesi Hari Ini</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Active Sessions -->
      <div v-if="activeSessions.length > 0" class="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 mb-6 shadow-sm">
        <h3 class="font-bold text-emerald-800 mb-3 flex items-center gap-2">
          <span class="relative flex h-3 w-3">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          Sesi Sedang Berlangsung
        </h3>
        <div class="space-y-2">
          <div v-for="s in activeSessions" :key="s.id"
            class="flex items-center justify-between bg-white/80 backdrop-blur rounded-xl p-3">
            <div class="min-w-0">
              <p class="font-medium text-gray-800 truncate">{{ s.nama_kelompok }}</p>
              <p class="text-sm text-gray-500 truncate">{{ s.judul_materi }}</p>
              <p class="text-xs text-gray-400 mt-0.5">oleh {{ s.murabbi }}</p>
            </div>
            <span class="text-xs text-gray-400 ml-3 shrink-0 font-mono">
              {{ new Date(s.dibuka_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Group Overview -->
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
        <h3 class="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
          Kehadiran per Kelompok
        </h3>
        <div v-if="groupOverview.length === 0" class="text-gray-400 text-sm text-center py-6">
          Belum ada data kelompok.
        </div>
        <div v-else class="space-y-5">
          <div v-for="g in groupOverview" :key="g.id">
            <div class="flex items-center justify-between mb-1.5">
              <div class="min-w-0">
                <span class="font-medium text-gray-800 text-sm">{{ g.nama }}</span>
                <span class="text-xs text-gray-400 ml-2">{{ g.anggota }} anggota</span>
              </div>
              <span class="text-sm font-bold whitespace-nowrap ml-2"
                :class="g.rate >= 75 ? 'text-emerald-600' : g.rate >= 50 ? 'text-amber-600' : 'text-red-600'">
                {{ g.rate }}%
              </span>
            </div>
            <div class="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500"
                :class="g.rate >= 75 ? 'bg-emerald-500' : g.rate >= 50 ? 'bg-amber-500' : 'bg-red-500'"
                :style="{ width: g.rate + '%' }">
              </div>
            </div>
            <div class="flex items-center justify-between mt-1">
              <p class="text-[11px] text-gray-400">{{ g.totalSesi }} sesi terakhir</p>
              <p class="text-[11px] text-gray-400">{{ g.hadir }}/{{ g.totalAbsen }} hadir</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Two columns -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <!-- Admin Activity -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 class="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
            Aktivitas Murabbi
          </h3>
          <div v-if="adminActivity.length === 0" class="text-gray-400 text-sm text-center py-6">
            Belum ada Murabbi.
          </div>
          <div v-else class="space-y-2">
            <div v-for="a in adminActivity" :key="a.id"
              class="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  :class="a.aktifMingguIni ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'">
                  {{ a.nama.charAt(0) }}
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-medium text-gray-700 truncate">{{ a.nama }}</p>
                  <p class="text-xs text-gray-400 truncate">{{ a.kelompok }}</p>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0 ml-2">
                <span class="text-xs font-medium"
                  :class="a.aktifMingguIni ? 'text-emerald-600' : 'text-gray-400'">
                  {{ a.sesiCount }} sesi
                </span>
                <span class="w-2 h-2 rounded-full" :class="a.aktifMingguIni ? 'bg-emerald-500' : 'bg-gray-300'"></span>
              </div>
            </div>
          </div>
        </div>

        <!-- Weekly Trend -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 class="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
            </svg>
            Tren Kehadiran 7 Hari
          </h3>
          <div v-if="weeklyTrend.length === 0" class="text-gray-400 text-sm text-center py-6">
            Belum ada data.
          </div>
          <div v-else>
            <div class="flex items-end gap-1.5 h-36 mb-2">
              <div v-for="d in weeklyTrend" :key="d.tanggal" class="flex-1 flex flex-col items-center justify-end gap-1">
                <span class="text-[10px] font-medium text-gray-500">{{ d.total }}</span>
                <div class="w-full rounded-t-md transition-all duration-500"
                  :class="d.total > 0 ? 'bg-gradient-to-t from-emerald-500 to-emerald-400' : 'bg-gray-100'"
                  :style="{ height: Math.max(4, (d.total / Math.max(...weeklyTrend.map(x => x.total), 1)) * 100) + '%' }">
                </div>
                <span class="text-[10px] text-gray-400 whitespace-nowrap">
                  {{ new Date(d.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short' }) }}
                </span>
              </div>
            </div>
            <div class="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-50">
              <span>Total: {{ weeklyTrend.reduce((s, d) => s + d.total, 0) }} absensi</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
