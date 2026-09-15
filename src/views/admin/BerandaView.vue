<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { useSession } from '@/composables/useSession'

const router = useRouter()
const authStore = useAuthStore()
const appStore = useAppStore()
const { sesiAktif, loading: sesiLoading, getSesiAktif, bukaSesi, akhiriSesi, getSesiSummary } = useSession()

const groupInfo = ref(null)
const anggotaCount = ref(0)
const sesiDitutup = ref(null)
const sesiSummary = ref(null)
const showBukaForm = ref(false)
const judulMateri = ref('')
const bukaLoading = ref(false)
const akhiriLoading = ref(false)
const riwayatSesi = ref([])
const realtimeCount = ref(0)
const bulanIniSesiCount = ref(0)
const bulanIniHadir = ref(0)
const bulanIniTotal = ref(0)
const anggotaTerbaru = ref([])

async function loadRealtimeCount() {
  if (!sesiAktif.value) { realtimeCount.value = 0; return }
  const { count } = await supabase
    .from('attendances')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sesiAktif.value.id)
  realtimeCount.value = count || 0
}

const recentAttendances = ref([])

async function loadRecentAttendances() {
  if (!sesiAktif.value) { recentAttendances.value = []; return }
  const { data } = await supabase
    .from('attendances')
    .select('user_id, status, waktu_absen, profiles(nama)')
    .eq('session_id', sesiAktif.value.id)
    .order('waktu_absen', { ascending: false })
    .limit(5)
  recentAttendances.value = data || []
}

function formatJam(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

const adminGroupId = computed(() => authStore.profile?.group_id)
const today = new Date().toISOString().split('T')[0]
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

async function loadData() {
  if (!adminGroupId.value) return

  const [{ data: group }, { count: memberCount }] = await Promise.all([
    supabase.from('groups').select('nama_kelompok, deskripsi').eq('id', adminGroupId.value).single(),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('group_id', adminGroupId.value).eq('status_akun', 'aktif')
  ])
  groupInfo.value = group
  anggotaCount.value = memberCount || 0

  await getSesiAktif(adminGroupId.value)
  if (sesiAktif.value) {
    await loadRealtimeCount()
    await loadRecentAttendances()
  }

  const { data: riwayat } = await supabase
    .from('sessions')
    .select('id, tanggal, judul_materi, created_at')
    .eq('group_id', adminGroupId.value)
    .eq('is_open', false)
    .order('created_at', { ascending: false })
    .limit(5)
  riwayatSesi.value = riwayat || []

  if (riwayatSesi.value.length > 0) {
    const ids = riwayatSesi.value.map(s => s.id)
    const { data: allCounts } = await supabase
      .from('attendances')
      .select('session_id, status')
      .in('session_id', ids)
    const countMap = {}
    ;(allCounts || []).forEach(a => {
      if (!countMap[a.session_id]) countMap[a.session_id] = []
      countMap[a.session_id].push(a)
    })
    riwayatSesi.value = riwayatSesi.value.map(s => ({
      ...s,
      summary: {
        hadir: (countMap[s.id] || []).filter(a => a.status === 'hadir').length,
        izin: (countMap[s.id] || []).filter(a => a.status === 'izin').length,
        alpa: (countMap[s.id] || []).filter(a => a.status === 'alpa').length
      }
    }))
  }

  const { count: sesiCount } = await supabase
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', adminGroupId.value)
    .gte('created_at', monthStart)
  bulanIniSesiCount.value = sesiCount || 0

  const { data: monthAtts } = await supabase
    .from('attendances')
    .select('status, sessions!inner(group_id)')
    .eq('sessions.group_id', adminGroupId.value)
    .gte('waktu_absen', monthStart)
  if (monthAtts) {
    bulanIniTotal.value = monthAtts.length
    bulanIniHadir.value = monthAtts.filter(a => a.status === 'hadir').length
  }

  const { data: latest } = await supabase
    .from('profiles')
    .select('nama')
    .eq('group_id', adminGroupId.value)
    .eq('status_akun', 'aktif')
    .order('created_at', { ascending: false })
    .limit(3)
  anggotaTerbaru.value = latest || []
}

const kehadiranRate = computed(() => {
  if (bulanIniTotal.value === 0) return 0
  return Math.round((bulanIniHadir.value / bulanIniTotal.value) * 100)
})

const elapsedSessionTime = ref('')
let timerInterval = null

function startSessionTimer() {
  stopSessionTimer()
  if (!sesiAktif.value?.dibuka_at) return
  timerInterval = setInterval(() => {
    const start = new Date(sesiAktif.value.dibuka_at).getTime()
    const now = Date.now()
    const diff = Math.floor((now - start) / 1000)
    const h = Math.floor(diff / 3600)
    const m = Math.floor((diff % 3600) / 60)
    const s = diff % 60
    elapsedSessionTime.value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }, 1000)
}

function stopSessionTimer() {
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = null
}

async function handleBukaSesi() {
  if (!adminGroupId.value) return
  bukaLoading.value = true
  try {
    await bukaSesi(adminGroupId.value, judulMateri.value, authStore.profile?.id || authStore.user?.id)
    appStore.showToast('Sesi liqa dibuka')
    showBukaForm.value = false
    judulMateri.value = ''
    sesiDitutup.value = null
    sesiSummary.value = null
    await loadData()
  } catch (e) {
    if (e.message?.includes('one_open_session_per_group') || e.message?.includes('duplicate')) {
      appStore.showToast('Sudah ada sesi aktif untuk kelompok ini', 'warning')
    } else {
      appStore.showToast(e.message, 'error')
    }
  } finally {
    bukaLoading.value = false
  }
}

async function handleAkhiriSesi() {
  if (!sesiAktif.value) return
  akhiriLoading.value = true
  try {
    const session = sesiAktif.value
    sesiSummary.value = await getSesiSummary(session.id)
    sesiDitutup.value = session
    await akhiriSesi(session.id)
    stopSessionTimer()
    appStore.showToast('Sesi liqa diakhiri')
    await loadData()
  } catch (e) {
    appStore.showToast(e.message, 'error')
  } finally {
    akhiriLoading.value = false
  }
}

let realtimeSub = null

watch(adminGroupId, (id) => {
  if (id) loadData()
}, { immediate: true })

watch(sesiAktif, (s) => {
  if (s?.dibuka_at) startSessionTimer()
  else stopSessionTimer()
}, { immediate: true })

onMounted(() => {
  realtimeSub = supabase
    .channel('attendances-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendances' }, () => {
      loadRealtimeCount()
      loadRecentAttendances()
    })
    .subscribe()
})

onUnmounted(() => {
  if (realtimeSub) supabase.removeChannel(realtimeSub)
  stopSessionTimer()
})
</script>

<template>
  <div class="pb-4">
    <!-- ====== GROUP HEADER ====== -->
    <div v-if="groupInfo" class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-600 p-5 mb-5 text-white shadow-lg">
      <div class="absolute inset-0 opacity-10">
        <svg class="w-full h-full" viewBox="0 0 200 100" fill="none">
          <path d="M20 50 Q 50 20 80 50 T 140 50 T 200 50" stroke="white" stroke-width="0.5" fill="none" opacity="0.3"/>
          <path d="M0 80 Q 30 40 60 80 T 120 80 T 180 80" stroke="white" stroke-width="0.3" fill="none" opacity="0.2"/>
          <circle cx="30" cy="20" r="2" fill="white" opacity="0.2"/>
          <circle cx="150" cy="15" r="1.5" fill="white" opacity="0.15"/>
          <circle cx="100" cy="85" r="1" fill="white" opacity="0.2"/>
          <circle cx="180" cy="40" r="1.5" fill="white" opacity="0.15"/>
        </svg>
      </div>
      <div class="relative">
        <div class="flex items-center gap-2 mb-1">
          <svg class="w-5 h-5 text-emerald-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/>
          </svg>
          <span class="text-emerald-200 text-sm">Kelompok Binaan</span>
        </div>
        <h1 class="text-2xl font-bold font-serif">{{ groupInfo.nama_kelompok }}</h1>
        <p class="text-emerald-100 text-sm mt-1">{{ groupInfo.deskripsi || 'Kelompok liqa' }}</p>
      </div>
    </div>

    <div v-else-if="!adminGroupId" class="text-center py-12">
      <div class="flex justify-center mb-4">
        <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
          <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
      </div>
      <h3 class="text-lg font-medium text-gray-700">Anda Belum Ditugaskan ke Kelompok</h3>
      <p class="text-sm text-gray-500 mt-1">Hubungi Super Admin untuk ditetapkan sebagai Murabbi.</p>
    </div>

    <!-- Loading -->
    <div v-else-if="sesiLoading" class="text-center py-8 text-gray-500">
      <svg class="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      <span>Memuat...</span>
    </div>

    <template v-if="groupInfo && !sesiLoading">
      <!-- ====== STATS ROW ====== -->
      <div v-if="groupInfo" class="grid grid-cols-3 gap-3 mb-5">
        <div class="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
          <p class="text-xl font-bold text-emerald-700">{{ anggotaCount }}</p>
          <p class="text-[10px] text-gray-500 mt-0.5">Anggota</p>
        </div>
        <div class="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
          <p class="text-xl font-bold text-blue-700">{{ bulanIniSesiCount }}</p>
          <p class="text-[10px] text-gray-500 mt-0.5">Sesi Bulan Ini</p>
        </div>
        <div class="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
          <p class="text-xl font-bold" :class="kehadiranRate >= 75 ? 'text-emerald-700' : kehadiranRate >= 50 ? 'text-amber-600' : 'text-red-600'">
            {{ bulanIniTotal > 0 ? kehadiranRate + '%' : '-' }}
          </p>
          <p class="text-[10px] text-gray-500 mt-0.5">Kehadiran</p>
        </div>
      </div>

      <!-- ====== ACTIVE SESSION ====== -->
      <div v-if="sesiAktif" class="mb-5">
        <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 p-5 text-center shadow-md">
          <div class="absolute top-3 right-3 flex items-center gap-1.5">
            <span class="relative flex h-3 w-3">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span class="text-[10px] font-medium text-emerald-600 uppercase tracking-wider">LIVE</span>
          </div>
          <svg class="w-8 h-8 text-emerald-500 mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"/>
          </svg>
          <h2 class="text-lg font-bold text-emerald-800">Sesi Sedang Berlangsung</h2>
          <p class="text-sm text-emerald-600 mt-1 font-medium">
            {{ sesiAktif.judul_materi || 'Tanpa judul' }}
          </p>
          <p class="text-xs text-emerald-500 mt-1 font-mono tracking-wider">{{ elapsedSessionTime }}</p>
          <div class="mt-4 inline-flex items-center gap-2 bg-white/80 backdrop-blur px-5 py-2.5 rounded-xl shadow-sm">
            <svg class="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            <span class="text-2xl font-bold text-emerald-700">{{ realtimeCount }}</span>
            <span class="text-sm text-gray-500">terabsen</span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 mt-4">
          <button @click="router.push('/scan-absen')"
            class="py-4 bg-emerald-700 text-white rounded-xl font-semibold text-lg hover:bg-emerald-800 active:scale-[0.98] transition-all shadow-lg shadow-emerald-700/20 flex flex-col items-center gap-1.5">
            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <span>Scan Absen</span>
          </button>
          <button @click="handleAkhiriSesi" :disabled="akhiriLoading"
            class="py-4 bg-white border-2 border-red-200 text-red-600 rounded-xl font-semibold hover:bg-red-50 active:scale-[0.98] transition-all shadow-md disabled:opacity-50 flex flex-col items-center gap-1.5">
            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
            </svg>
            <span>{{ akhiriLoading ? 'Menutup...' : 'Akhiri Sesi' }}</span>
          </button>
        </div>

        <!-- ====== BARU TERABSEN (realtime) ====== -->
        <div v-if="recentAttendances.length > 0" class="bg-white rounded-2xl border border-emerald-100 shadow-sm mt-4 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
            <p class="font-bold text-gray-800 text-sm flex items-center gap-2">
              <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Baru Terabsen
            </p>
            <span class="text-[11px] text-gray-400">5 terakhir</span>
          </div>
          <div class="divide-y divide-gray-50">
            <div v-for="a in recentAttendances" :key="a.user_id" class="px-4 py-2.5 flex items-center justify-between">
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-[11px] font-bold text-emerald-700 shrink-0">
                  {{ (a.profiles?.nama || '?').charAt(0) }}
                </div>
                <p class="text-sm font-medium text-gray-800 truncate">{{ a.profiles?.nama || '-' }}</p>
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
      </div>

      <!-- ====== NO ACTIVE SESSION ====== -->
      <div v-else class="space-y-5">
        <!-- Baru ditutup summary -->
        <div v-if="sesiDitutup && sesiSummary"
          class="bg-white rounded-2xl border border-emerald-100 shadow-sm p-5">
          <div class="flex items-center gap-2 mb-1">
            <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
            <h3 class="font-bold text-gray-800">Ringkasan Sesi</h3>
          </div>
          <p class="text-xs text-gray-500 mb-4">{{ sesiDitutup.judul_materi || 'Sesi Liqa' }} • {{ new Date(sesiDitutup.created_at).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }) }}</p>
          <div class="grid grid-cols-3 gap-3 text-center">
            <div class="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
              <p class="text-2xl font-bold text-emerald-600">{{ sesiSummary.hadir }}</p>
              <p class="text-xs text-emerald-600 font-medium">Hadir</p>
            </div>
            <div class="bg-amber-50 rounded-xl p-3 border border-amber-100">
              <p class="text-2xl font-bold text-amber-600">{{ sesiSummary.izin }}</p>
              <p class="text-xs text-amber-600 font-medium">Izin</p>
            </div>
            <div class="bg-red-50 rounded-xl p-3 border border-red-100">
              <p class="text-2xl font-bold text-red-600">{{ sesiSummary.alpa }}</p>
              <p class="text-xs text-red-600 font-medium">Alpa</p>
            </div>
          </div>
        </div>

        <!-- Buka Sesi CTA -->
        <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-600 p-6 text-center shadow-lg">
          <div class="absolute inset-0 opacity-[0.07]">
            <svg class="w-full h-full" viewBox="0 0 200 100">
              <path d="M20 50 Q 50 20 80 50 T 140 50 T 200 50" stroke="white" stroke-width="0.5" fill="none"/>
              <circle cx="40" cy="30" r="2" fill="white"/>
              <circle cx="160" cy="60" r="1.5" fill="white"/>
            </svg>
          </div>
          <div class="relative">
            <svg class="w-12 h-12 text-emerald-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            <h2 class="text-lg font-bold text-white mb-2">Mulai Sesi Liqa Baru</h2>
            <p class="text-sm text-emerald-200 mb-5">Buka sesi untuk mulai melakukan absensi anggota</p>
            <button @click="showBukaForm = true"
              class="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-emerald-800 rounded-xl font-bold hover:bg-emerald-50 active:scale-[0.98] transition-all shadow-lg">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
              </svg>
              Buka Sesi Liqa
            </button>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="grid grid-cols-3 gap-3">
          <button @click="router.push('/scan-absen')"
            class="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex flex-col items-center gap-1.5 hover:bg-gray-50 active:scale-[0.98] transition-all">
            <svg class="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
            </svg>
            <span class="text-[11px] font-medium text-gray-700">Scan</span>
          </button>
          <button @click="router.push('/anggota-saya')"
            class="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex flex-col items-center gap-1.5 hover:bg-gray-50 active:scale-[0.98] transition-all">
            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <span class="text-[11px] font-medium text-gray-700">Anggota</span>
          </button>
          <button @click="router.push('/riwayat-sesi')"
            class="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex flex-col items-center gap-1.5 hover:bg-gray-50 active:scale-[0.98] transition-all">
            <svg class="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span class="text-[11px] font-medium text-gray-700">Riwayat</span>
          </button>
        </div>

        <!-- Anggota Terbaru -->
        <div v-if="anggotaTerbaru.length > 0" class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 class="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
            </svg>
            Anggota Terbaru
          </h3>
          <div class="flex flex-wrap gap-2">
            <div v-for="a in anggotaTerbaru" :key="a.nama"
              class="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
              <div class="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                <span class="text-[10px] font-bold text-emerald-700">{{ a.nama.charAt(0) }}</span>
              </div>
              <span class="text-sm text-gray-700">{{ a.nama }}</span>
            </div>
          </div>
        </div>

        <!-- Riwayat Sesi -->
        <div v-if="riwayatSesi.length > 0" class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-bold text-gray-800">Riwayat Sesi</h3>
            <button @click="router.push('/riwayat-sesi')" class="text-xs text-emerald-700 font-medium hover:underline">Lihat semua</button>
          </div>
          <div class="space-y-3">
            <div v-for="s in riwayatSesi" :key="s.id"
              class="border-b border-gray-50 last:border-0 pb-3 last:pb-0">
              <div class="flex items-center justify-between mb-1.5">
                <p class="text-sm font-medium text-gray-800">{{ s.judul_materi || 'Sesi Liqa' }}</p>
                <span class="text-[11px] text-gray-400">{{ new Date(s.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }) }}</span>
              </div>
              <div v-if="s.summary" class="flex items-center gap-2">
                <div class="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden flex">
                  <div v-if="s.summary.hadir > 0" class="h-full bg-emerald-500 transition-all" :style="{ width: (s.summary.hadir / Math.max(s.summary.hadir + s.summary.izin + s.summary.alpa, 1)) * 100 + '%' }"></div>
                  <div v-if="s.summary.izin > 0" class="h-full bg-amber-400 transition-all" :style="{ width: (s.summary.izin / Math.max(s.summary.hadir + s.summary.izin + s.summary.alpa, 1)) * 100 + '%' }"></div>
                  <div v-if="s.summary.alpa > 0" class="h-full bg-red-400 transition-all" :style="{ width: (s.summary.alpa / Math.max(s.summary.hadir + s.summary.izin + s.summary.alpa, 1)) * 100 + '%' }"></div>
                </div>
                <span class="text-[11px] font-medium text-gray-500 whitespace-nowrap">{{ s.summary.hadir }}/{{ s.summary.hadir + s.summary.izin + s.summary.alpa }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Buka Sesi Form Modal -->
      <div v-if="showBukaForm" class="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4"
        @click.self="showBukaForm = false">
        <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl animate-slide-up">
          <h3 class="text-lg font-bold text-gray-800 mb-4">Buka Sesi Baru</h3>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Judul Materi <span class="text-gray-400">(opsional)</span></label>
            <input v-model="judulMateri" placeholder="Misal: Kajian Tafsir" maxlength="200"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div class="flex gap-3">
            <button @click="showBukaForm = false"
              class="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-all">
              Batal
            </button>
            <button @click="handleBukaSesi" :disabled="bukaLoading"
              class="flex-1 py-3 bg-emerald-700 text-white rounded-xl font-medium hover:bg-emerald-800 disabled:opacity-50 transition-all">
              {{ bukaLoading ? 'Membuka...' : 'Buka Sesi' }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
