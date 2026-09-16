<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from '@/lib/supabase'

const stats = ref({ totalGroups: 0, totalAdmins: 0, totalMembers: 0, activeSessions: 0 })
const activeSessions = ref([])
const groupOverview = ref([])
const weeklyTrend = ref([])
const loading = ref(true)
const sessionCounts = ref({})
const showSesiDetail = ref(false)
const detailSesi = ref(null)
const detailAttendances = ref([])
const detailLoading = ref(false)
const filterDate = ref(new Date().toISOString().split('T')[0])
const showAllGroups = ref(false)
let realtimeSub = null

const trendMax = computed(() => Math.max(...weeklyTrend.value.map(d => d.total), 1))
const trendPts = computed(() => {
  const n = weeklyTrend.value.length
  if (n === 0) return []
  const W = 300, H = 100, padTop = 10
  return weeklyTrend.value.map((d, i) => {
    const x = n === 1 ? W / 2 : (W / (n - 1)) * i
    const y = H - padTop - (d.total / trendMax.value) * (H - padTop - 10)
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
  const base = 110
  return `M ${pts[0][0].toFixed(1)} ${base} L ` + pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' L ') + ` L ${pts[pts.length - 1][0].toFixed(1)} ${base} Z`
})

const todaySessions = computed(() => {
  const today = new Date().toISOString().split('T')[0]
  return groupOverview.value.filter(g => g.lastSessionDate === today)
})

const notAttendedToday = computed(() => {
  const today = new Date().toISOString().split('T')[0]
  return groupOverview.value.filter(g => g.lastSessionDate !== today && g.anggota > 0)
})

const displayedGroups = computed(() => {
  return showAllGroups.value ? groupOverview.value : groupOverview.value.slice(0, 20)
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
  ] = await Promise.all([
    supabase.from('groups').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'user').eq('status_akun', 'aktif'),
    supabase.from('sessions')
      .select('id, group_id, judul_materi, dibuka_at, tanggal, created_by, groups(nama_kelompok), profiles!sessions_created_by_fkey(nama)')
      .eq('is_open', true),
    supabase.from('groups').select('id, nama_kelompok'),
  ])

  stats.value = {
    totalGroups: totalGroups || 0,
    totalAdmins: totalAdmins || 0,
    totalMembers: totalMembers || 0,
    activeSessions: activeSes?.length || 0
  }

  activeSessions.value = (activeSes || []).map(s => ({
    id: s.id, nama_kelompok: s.groups?.nama_kelompok || '-',
    judul_materi: s.judul_materi || 'Liqa',
    dibuka_at: s.dibuka_at, murabbi: s.profiles?.nama || '-'
  }))

  await loadActiveCounts()

  const groupData = groupsWithCount || []
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const { data: allSessions } = await supabase
    .from('sessions').select('id, group_id, tanggal').gte('created_at', monthStart).order('created_at', { ascending: false })

  const last5ByGroup = {}
  const lastDateByGroup = {}
  ;(allSessions || []).forEach(s => {
    if (!last5ByGroup[s.group_id]) last5ByGroup[s.group_id] = []
    if (last5ByGroup[s.group_id].length < 5) last5ByGroup[s.group_id].push(s.id)
    if (!lastDateByGroup[s.group_id] || s.tanggal > lastDateByGroup[s.group_id]) {
      lastDateByGroup[s.group_id] = s.tanggal
    }
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

  groupOverview.value = groupData
    .filter(g => (memberCountByGroup[g.id] || 0) > 0)
    .map(g => {
      const ids = last5ByGroup[g.id] || []
      const total = ids.reduce((s, id) => s + (attCountBySession[id] || 0), 0)
      const hadir = ids.reduce((s, id) => s + (hadirBySession[id] || 0), 0)
      return {
        id: g.id, nama: g.nama_kelompok,
        totalSesi: ids.length, hadir, totalAbsen: total,
        rate: total > 0 ? Math.round((hadir / total) * 100) : 0,
        anggota: memberCountByGroup[g.id] || 0,
        lastSessionDate: lastDateByGroup[g.id] || null
      }
    })
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))

  // Weekly trend
  const { data: weekSessionsList } = await supabase
    .from('sessions').select('id, tanggal').gte('tanggal', weekAgo.split('T')[0])

  const weekSessionIds = (weekSessionsList || []).map(s => s.id)
  const attCountByDate = {}

  if (weekSessionIds.length > 0) {
    const { data: weekAtts } = await supabase
      .from('attendances').select('session_id').in('session_id', weekSessionIds)
    const countBySession = {}
    ;(weekAtts || []).forEach(a => { countBySession[a.session_id] = (countBySession[a.session_id] || 0) + 1 })
    ;(weekSessionsList || []).forEach(s => {
      attCountByDate[s.tanggal] = (attCountByDate[s.tanggal] || 0) + (countBySession[s.id] || 0)
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
  const { data } = await supabase.from('attendances').select('session_id, status').in('session_id', ids)
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
  realtimeSub = supabase.channel('dashboard-att-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendances' }, () => {
      loadActiveCounts()
      if (showSesiDetail.value && detailSesi.value) openSesiDetail(detailSesi.value)
    })
    .subscribe()
})

onUnmounted(() => { if (realtimeSub) supabase.removeChannel(realtimeSub) })
</script>

<template>
  <div class="pb-4">
    <!-- Header -->
    <div class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-xl font-bold text-emerald-900">Dashboard</h1>
        <p class="text-sm text-gray-500">Progress liqa lintas kelompok</p>
      </div>
      <div class="flex items-center gap-2">
        <input type="date" v-model="filterDate"
          class="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>
    </div>

    <!-- Skeleton -->
    <div v-if="loading" class="space-y-4 animate-pulse">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div v-for="i in 4" :key="i" class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div class="h-8 bg-gray-200 rounded w-12 mb-2"></div>
          <div class="h-3 bg-gray-200 rounded w-20"></div>
        </div>
      </div>
    </div>

    <template v-else>
      <!-- Stat Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div class="bg-white rounded-xl p-3.5 border border-gray-100 shadow-sm">
          <p class="text-2xl font-bold text-gray-800">{{ stats.totalGroups }}</p>
          <p class="text-xs text-gray-500">Kelompok</p>
        </div>
        <div class="bg-white rounded-xl p-3.5 border border-gray-100 shadow-sm">
          <p class="text-2xl font-bold text-blue-600">{{ stats.totalAdmins }}</p>
          <p class="text-xs text-gray-500">Murabbi</p>
        </div>
        <div class="bg-white rounded-xl p-3.5 border border-gray-100 shadow-sm">
          <p class="text-2xl font-bold text-emerald-600">{{ stats.totalMembers }}</p>
          <p class="text-xs text-gray-500">Anggota Aktif</p>
        </div>
        <div class="bg-white rounded-xl p-3.5 border border-gray-100 shadow-sm"
          :class="stats.activeSessions > 0 ? 'ring-1 ring-emerald-200' : ''">
          <div class="flex items-center gap-2">
            <span v-if="stats.activeSessions > 0" class="relative flex h-2.5 w-2.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <p class="text-2xl font-bold" :class="stats.activeSessions > 0 ? 'text-emerald-600' : 'text-gray-400'">
              {{ stats.activeSessions }}
            </p>
          </div>
          <p class="text-xs text-gray-500">Sesi Aktif</p>
        </div>
      </div>

      <!-- Active Sessions — compact -->
      <div v-if="activeSessions.length > 0" class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5">
        <h3 class="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Sesi Aktif ({{ activeSessions.length }})
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <div v-for="s in activeSessions" :key="s.id"
            @click="openSesiDetail(s)"
            class="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 cursor-pointer hover:shadow-sm transition-all">
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-800 truncate">{{ s.nama_kelompok }}</p>
              <p class="text-[11px] text-gray-400 truncate">{{ s.murabbi }} · {{ s.judul_materi }}</p>
            </div>
            <div class="text-right shrink-0 ml-2">
              <p class="text-lg font-bold text-emerald-700 leading-tight">{{ sessionCounts[s.id]?.total || 0 }}</p>
              <p class="text-[9px] text-gray-400">terabsen</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Belum Absen Hari Ini -->
      <div v-if="notAttendedToday.length > 0" class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
        <h3 class="text-sm font-bold text-amber-800 mb-2">
          Belum Absen Hari Ini ({{ notAttendedToday.length }} kelompok)
        </h3>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="g in notAttendedToday" :key="g.id"
            class="px-2.5 py-1 bg-white/80 rounded-full text-xs text-amber-700 border border-amber-200">
            {{ g.nama }}
          </span>
        </div>
      </div>

      <!-- Weekly Trend -->
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
        <h3 class="text-sm font-bold text-gray-800 mb-3">Tren Kehadiran 7 Hari</h3>
        <div v-if="weeklyTrend.every(d => d.total === 0)" class="text-gray-400 text-sm text-center py-4">
          Belum ada data minggu ini.
        </div>
        <div v-else>
          <svg viewBox="0 0 300 120" class="w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="gradTren" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#059669" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="#059669" stop-opacity="0"/>
              </linearGradient>
            </defs>
            <line x1="0" y1="110" x2="300" y2="110" stroke="#e5e7eb" stroke-width="1"/>
            <path :d="trendArea" fill="url(#gradTren)"/>
            <path :d="trendLine" fill="none" stroke="#059669" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
            <circle v-for="(p, i) in trendPts" :key="i" :cx="p[0]" :cy="p[1]" r="3" fill="#059669"
              :stroke="weeklyTrend[i].total > 0 ? '#ffffff' : 'none'" stroke-width="1.5">
              <title>{{ weeklyTrend[i].total }} absensi</title>
            </circle>
          </svg>
          <div class="grid grid-cols-7 mt-1">
            <div v-for="d in weeklyTrend" :key="d.tanggal" class="text-center text-[10px] text-gray-400">
              {{ new Date(d.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short' }) }}
            </div>
          </div>
          <p class="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-50">
            Total: {{ weeklyTrend.reduce((s, d) => s + d.total, 0) }} absensi
          </p>
        </div>
      </div>

      <!-- Group Overview — compact table -->
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-bold text-gray-800">Kehadiran per Kelompok</h3>
          <span class="text-xs text-gray-400">{{ groupOverview.length }} kelompok</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-100 text-xs text-gray-500">
                <th class="text-left py-2 pr-2">Kelompok</th>
                <th class="text-center py-2 px-2">Anggota</th>
                <th class="text-center py-2 px-2">Sesi</th>
                <th class="text-center py-2 px-2">Hadir</th>
                <th class="text-right py-2 pl-2">Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="g in displayedGroups" :key="g.id"
                class="border-b border-gray-50 last:border-0">
                <td class="py-2 pr-2">
                  <div class="flex items-center gap-2">
                    <span class="w-1.5 h-1.5 rounded-full shrink-0"
                      :class="g.lastSessionDate === filterDate ? 'bg-emerald-500' : 'bg-gray-300'"></span>
                    <span class="text-gray-800 truncate">{{ g.nama }}</span>
                  </div>
                </td>
                <td class="text-center py-2 px-2 text-gray-500">{{ g.anggota }}</td>
                <td class="text-center py-2 px-2 text-gray-500">{{ g.totalSesi }}</td>
                <td class="text-center py-2 px-2">
                  <span class="font-medium"
                    :class="g.hadir > 0 ? 'text-emerald-600' : 'text-gray-400'">
                    {{ g.hadir }}/{{ g.totalAbsen }}
                  </span>
                </td>
                <td class="text-right py-2 pl-2">
                  <span class="text-xs font-bold"
                    :class="g.rate >= 75 ? 'text-emerald-600' : g.rate >= 50 ? 'text-amber-600' : g.totalAbsen === 0 ? 'text-gray-300' : 'text-red-600'">
                    {{ g.totalAbsen > 0 ? g.rate + '%' : '-' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <button v-if="groupOverview.length > 20 && !showAllGroups"
          @click="showAllGroups = true"
          class="w-full mt-3 py-2 text-xs text-emerald-600 font-medium hover:bg-emerald-50 rounded-lg transition-all">
          Tampilkan semua ({{ groupOverview.length }})
        </button>
      </div>
    </template>

    <!-- Modal Detail Sesi -->
    <Teleport to="body">
      <div v-if="showSesiDetail"
        class="fixed inset-0 bg-black/40 z-[999] flex items-end md:items-center justify-center p-4"
        @click.self="showSesiDetail = false">
        <div class="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
          <div class="px-5 py-4 border-b border-gray-100 flex items-start justify-between">
            <div class="min-w-0">
              <h3 class="font-bold text-gray-800">{{ detailSesi?.nama_kelompok }}</h3>
              <p class="text-sm text-gray-500">{{ detailSesi?.judul_materi }}</p>
              <p class="text-xs text-gray-400 mt-0.5">oleh {{ detailSesi?.murabbi }} · {{ formatJam(detailSesi?.dibuka_at) }}</p>
            </div>
            <button @click="showSesiDetail = false"
              class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
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
              <div v-for="a in detailAttendances" :key="a.user_id"
                class="px-5 py-2.5 flex items-center justify-between">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-[11px] font-bold text-emerald-700 shrink-0">
                    {{ (a.profiles?.nama || '?').charAt(0) }}
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm text-gray-800 truncate">{{ a.profiles?.nama || '-' }}</p>
                    <p class="text-[10px] text-gray-400">{{ a.profiles?.nim || '-' }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0 ml-2">
                  <span class="text-[10px] text-gray-400 font-mono">{{ formatJam(a.waktu_absen) }}</span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold"
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
              class="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200">
              Tutup
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
