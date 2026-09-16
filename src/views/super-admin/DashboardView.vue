<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
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
const sessionCounts = ref({})
const showSesiDetail = ref(false)
const detailSesi = ref(null)
const detailAttendances = ref([])
const detailLoading = ref(false)
let realtimeSub = null

const trendMax = computed(() => Math.max(...weeklyTrend.value.map(d => d.total), 1))
const trendPts = computed(() => {
  const n = weeklyTrend.value.length
  if (n === 0) return []
  const W = 300, H = 130, padTop = 10, base = H
  return weeklyTrend.value.map((d, i) => {
    const x = n === 1 ? W / 2 : (W / (n - 1)) * i
    const y = base - (d.total / trendMax.value) * (base - padTop)
    return [x, y]
  })
})
const trendLine = computed(() => {
  if (trendPts.value.length === 0) return ''
  return 'M ' + trendPts.value.map(p => p.map(v => v.toFixed(1)).join(',')).join(' L ')
})
const trendArea = computed(() => {
  if (trendPts.value.length === 0) return ''
  const pts = trendPts.value
  const base = 130
  return `M ${pts[0][0].toFixed(1)} ${base} L ` +
    pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' L ') +
    ` L ${pts[pts.length - 1][0].toFixed(1)} ${base} Z`
})

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
  await loadActiveCounts()

  const groupData = groupsWithCount || []
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const { data: allSessions } = await supabase
    .from('sessions')
    .select('id, group_id')
    .gte('created_at', monthStart)
    .order('created_at', { ascending: false })

  const last5ByGroup = {}
  ;(allSessions || []).forEach(s => {
    if (!last5ByGroup[s.group_id]) last5ByGroup[s.group_id] = []
    if (last5ByGroup[s.group_id].length < 5) last5ByGroup[s.group_id].push(s.id)
  })
  const last5Ids = Object.values(last5ByGroup).flat()

  const [attsRes, memberRes] = await Promise.all([
    last5Ids.length
      ? supabase.from('attendances').select('status, session_id').in('session_id', last5Ids)
      : Promise.resolve({ data: [] }),
    supabase.from('profiles').select('group_id').eq('status_akun', 'aktif')
  ])

  const attCountBySession = {}
  const hadirBySession = {}
  ;(attsRes.data || []).forEach(a => {
    attCountBySession[a.session_id] = (attCountBySession[a.session_id] || 0) + 1
    if (a.status === 'hadir') hadirBySession[a.session_id] = (hadirBySession[a.session_id] || 0) + 1
  })

  const memberCountByGroup = {}
  ;(memberRes.data || []).forEach(m => {
    memberCountByGroup[m.group_id] = (memberCountByGroup[m.group_id] || 0) + 1
  })

  groupOverview.value = groupData.map(g => {
    const ids = last5ByGroup[g.id] || []
    const total = ids.reduce((s, id) => s + (attCountBySession[id] || 0), 0)
    const hadir = ids.reduce((s, id) => s + (hadirBySession[id] || 0), 0)
    return {
      id: g.id,
      nama: g.nama_kelompok,
      totalSesi: ids.length,
      hadir,
      totalAbsen: total,
      rate: total > 0 ? Math.round((hadir / total) * 100) : 0,
      anggota: memberCountByGroup[g.id] || 0
    }
  })

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

async function loadActiveCounts() {
  const ids = activeSessions.value.map(s => s.id)
  if (ids.length === 0) { sessionCounts.value = {}; return }
  const { data } = await supabase
    .from('attendances')
    .select('session_id, status')
    .in('session_id', ids)
  const map = {}
  ;(data || []).forEach(a => {
    const c = map[a.session_id] || (map[a.session_id] = { hadir: 0, izin: 0, alpa: 0, total: 0 })
    c.total++
    if (a.status === 'hadir') c.hadir++
    else if (a.status === 'izin') c.izin++
    else c.alpa++
  })
  sessionCounts.value = map
}

function formatJam(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

async function openSesiDetail(s) {
  detailSesi.value = s
  showSesiDetail.value = true
  detailLoading.value = true
  const { data } = await supabase
    .from('attendances')
    .select('user_id, status, waktu_absen, profiles!attendances_user_id_fkey(nama, nim)')
    .eq('session_id', s.id)
    .order('waktu_absen', { ascending: false })
  detailAttendances.value = data || []
  detailLoading.value = false
}

onMounted(() => {
  loadDashboard()
  realtimeSub = supabase
    .channel('dashboard-att-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendances' }, () => {
      loadActiveCounts()
      if (showSesiDetail.value && detailSesi.value) openSesiDetail(detailSesi.value)
    })
    .subscribe()
})

onUnmounted(() => {
  if (realtimeSub) supabase.removeChannel(realtimeSub)
})
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
            <div class="flex items-center gap-2 shrink-0 ml-3">
              <div class="text-center">
                <p class="text-lg font-bold text-emerald-700 leading-tight">{{ sessionCounts[s.id]?.total || 0 }}</p>
                <p class="text-[9px] text-gray-400 uppercase tracking-wide">Terabsen</p>
              </div>
              <button @click="openSesiDetail(s)"
                class="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-all active:scale-95">
                Detail
              </button>
            </div>
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
            <svg viewBox="0 0 300 140" class="w-full" preserveAspectRatio="none" role="img" aria-label="Grafik tren kehadiran 7 hari">
              <defs>
                <linearGradient id="gradTren" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#059669" stop-opacity="0.35"/>
                  <stop offset="100%" stop-color="#059669" stop-opacity="0"/>
                </linearGradient>
              </defs>
              <line x1="0" y1="130" x2="300" y2="130" stroke="#e5e7eb" stroke-width="1"/>
              <path :d="trendArea" fill="url(#gradTren)"/>
              <path :d="trendLine" fill="none" stroke="#059669" stroke-width="2.5"
                stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
              <circle v-for="(p, i) in trendPts" :key="i" :cx="p[0]" :cy="p[1]" r="3.5" fill="#059669"
                :stroke="weeklyTrend[i].total > 0 ? '#ffffff' : 'none'" stroke-width="1.5">
                <title>{{ weeklyTrend[i].total }} absensi</title>
              </circle>
            </svg>
            <div class="grid grid-cols-7 mt-1">
              <div v-for="d in weeklyTrend" :key="d.tanggal" class="text-center text-[10px] text-gray-400">
                {{ new Date(d.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short' }) }}
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

  <!-- ===== MODAL DETAIL SESI ===== -->
  <Teleport to="body">
    <div v-if="showSesiDetail"
      class="fixed inset-0 bg-black/40 z-[999] flex items-end md:items-center justify-center p-4 animate-fade-in"
      @click.self="showSesiDetail = false">
      <div class="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-slide-up overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100 flex items-start justify-between">
          <div class="min-w-0">
            <h3 class="font-bold text-gray-800">{{ detailSesi?.nama_kelompok }}</h3>
            <p class="text-sm text-gray-500 truncate">{{ detailSesi?.judul_materi }}</p>
            <p class="text-xs text-gray-400 mt-0.5">oleh {{ detailSesi?.murabbi }} · dibuka {{ formatJam(detailSesi?.dibuka_at) }}</p>
          </div>
          <button @click="showSesiDetail = false"
            class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="max-h-[60vh] overflow-y-auto">
          <div v-if="detailLoading" class="px-5 py-8 text-center text-sm text-gray-400">Memuat...</div>
          <div v-else-if="detailAttendances.length === 0" class="px-5 py-8 text-center text-sm text-gray-400">
            Belum ada anggota terabsen.
          </div>
          <div v-else class="divide-y divide-gray-50">
            <div v-for="a in detailAttendances" :key="a.user_id" class="px-5 py-3 flex items-center justify-between">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700 shrink-0">
                  {{ (a.profiles?.nama || '?').charAt(0) }}
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-medium text-gray-800 truncate">{{ a.profiles?.nama || '-' }}</p>
                  <p class="text-[11px] text-gray-400 truncate">{{ a.profiles?.nim || '-' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0 ml-2">
                <span class="text-[11px] text-gray-400 font-mono">{{ formatJam(a.waktu_absen) }}</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                  :class="a.status === 'hadir' ? 'bg-emerald-100 text-emerald-700' : a.status === 'izin' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'">
                  {{ a.status }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <p class="text-xs text-gray-400">Total: {{ detailAttendances.length }} terabsen</p>
          <button @click="showSesiDetail = false"
            class="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-all">
            Tutup
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
