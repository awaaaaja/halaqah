<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import QRCard from '@/components/qr/QRCard.vue'

const authStore = useAuthStore()
const profile = computed(() => authStore.profile)

const loading = ref(true)
const stats = ref({ total: 0, hadir: 0, izin: 0, alpa: 0 })
const anggotaCount = ref(0)
const lastAttendance = ref(null)
const activeSessionToday = ref(null)
const qrToken = ref(null)

const namaKelompok = computed(() => {
  return profile.value?.nama_kelompok || 'Belum ada kelompok'
})

const firstName = computed(() => {
  if (!profile.value?.nama) return 'Anggota'
  return profile.value.nama.split(' ')[0]
})

onMounted(async () => {
  if (!authStore.user?.id) { loading.value = false; return }

  await Promise.all([
    loadQrToken(),
    loadStats(),
    loadGroupInfo(),
    loadActiveSession()
  ])
  loading.value = false
})

async function loadQrToken() {
  const { data } = await supabase.rpc('get_my_qr_token')
  qrToken.value = data || null
}

async function loadStats() {
  const { data } = await supabase
    .from('attendances')
    .select('status, sessions!inner(tanggal)')
    .eq('user_id', authStore.user.id)

  if (data) {
    stats.value = {
      total: data.length,
      hadir: data.filter(a => a.status === 'hadir').length,
      izin: data.filter(a => a.status === 'izin').length,
      alpa: data.filter(a => a.status === 'alpa').length
    }
  }

  const { data: last } = await supabase
    .from('attendances')
    .select('status, waktu_absen, sessions!inner(judul_materi, tanggal)')
    .eq('user_id', authStore.user.id)
    .order('waktu_absen', { ascending: false })
    .limit(1)

  if (last && last.length > 0) {
    lastAttendance.value = last[0]
  }
}

async function loadGroupInfo() {
  if (!profile.value?.group_id) return
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', profile.value.group_id)
    .eq('status_akun', 'aktif')
  anggotaCount.value = count || 0
}

async function loadActiveSession() {
  if (!profile.value?.group_id) return
  const { data } = await supabase
    .from('sessions')
    .select('id, judul_materi, dibuka_at, groups(nama_kelompok)')
    .eq('group_id', profile.value.group_id)
    .eq('is_open', true)
    .maybeSingle()
  activeSessionToday.value = data
}

function statusBadge(status) {
  const map = {
    hadir: 'bg-emerald-100 text-emerald-700',
    izin: 'bg-amber-100 text-amber-700',
    alpa: 'bg-red-100 text-red-700'
  }
  return map[status] || 'bg-gray-100 text-gray-600'
}

const kehadiranRate = computed(() => {
  if (stats.value.total === 0) return 0
  return Math.round((stats.value.hadir / stats.value.total) * 100)
})
</script>

<template>
  <div class="pb-4">
    <!-- Welcome Header -->
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
        <p class="text-emerald-200 text-sm font-arabic mb-0.5">السلام عليكم</p>
        <h1 class="text-2xl font-bold font-serif">{{ firstName }}</h1>
        <p class="text-emerald-100 text-sm mt-1">{{ profile?.email || 'Anggota Liqa' }}</p>
        <div class="mt-3 flex items-center gap-2">
          <span class="inline-flex items-center gap-1 bg-white/15 rounded-full px-3 py-1 text-xs">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            {{ namaKelompok }}
          </span>
          <span v-if="anggotaCount > 0" class="inline-flex items-center gap-1 bg-white/15 rounded-full px-3 py-1 text-xs">
            {{ anggotaCount }} anggota
          </span>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-8 text-gray-500">
      <svg class="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      <span>Memuat data...</span>
    </div>

    <template v-else>
      <!-- Active Session Alert -->
      <div v-if="activeSessionToday"
        class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5 flex items-center gap-3">
        <span class="relative flex h-3 w-3 shrink-0">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
        </span>
        <div class="min-w-0">
          <p class="text-sm font-medium text-emerald-800">Sesi sedang berlangsung</p>
          <p class="text-xs text-emerald-600 truncate">{{ activeSessionToday.judul_materi || 'Liqa' }} • {{ activeSessionToday.groups?.nama_kelompok }}</p>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-4 gap-2 mb-5">
        <div class="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
          <p class="text-lg font-bold text-gray-800">{{ stats.total }}</p>
          <p class="text-[10px] text-gray-500 mt-0.5">Total</p>
        </div>
        <div class="bg-white rounded-xl p-3 border border-emerald-100 shadow-sm text-center">
          <p class="text-lg font-bold text-emerald-600">{{ stats.hadir }}</p>
          <p class="text-[10px] text-emerald-600 mt-0.5">Hadir</p>
        </div>
        <div class="bg-white rounded-xl p-3 border border-amber-100 shadow-sm text-center">
          <p class="text-lg font-bold text-amber-600">{{ stats.izin }}</p>
          <p class="text-[10px] text-amber-600 mt-0.5">Izin</p>
        </div>
        <div class="bg-white rounded-xl p-3 border border-red-100 shadow-sm text-center">
          <p class="text-lg font-bold text-red-600">{{ stats.alpa }}</p>
          <p class="text-[10px] text-red-600 mt-0.5">Alpa</p>
        </div>
      </div>

      <!-- Attendance Rate -->
      <div v-if="stats.total > 0" class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-gray-700">Tingkat Kehadiran</span>
          <span class="text-sm font-bold" :class="kehadiranRate >= 75 ? 'text-emerald-600' : kehadiranRate >= 50 ? 'text-amber-600' : 'text-red-600'">
            {{ kehadiranRate }}%
          </span>
        </div>
        <div class="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div class="h-full rounded-full transition-all duration-700"
            :class="kehadiranRate >= 75 ? 'bg-emerald-500' : kehadiranRate >= 50 ? 'bg-amber-500' : 'bg-red-500'"
            :style="{ width: kehadiranRate + '%' }">
          </div>
        </div>
      </div>

      <!-- Last Attendance -->
      <div v-if="lastAttendance" class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
        <div class="flex items-center gap-2 mb-2">
          <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <h3 class="text-sm font-medium text-gray-700">Terakhir Hadir</h3>
        </div>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-800">{{ lastAttendance.sessions?.judul_materi || 'Sesi Liqa' }}</p>
            <p class="text-xs text-gray-500">{{ new Date(lastAttendance.waktu_absen).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }) }}</p>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-medium capitalize" :class="statusBadge(lastAttendance.status)">
            {{ lastAttendance.status }}
          </span>
        </div>
      </div>

      <!-- QR Card -->
      <div v-if="!profile" class="text-center py-8 text-gray-500">
        Memuat data...
      </div>
      <QRCard
        v-else
        :qr-token="qrToken"
        :nama="profile.nama"
        :nim="profile.nim"
        :prodi="profile.prodi"
        :kelas="profile.kelas"
        :nama-kelompok="namaKelompok"
      />

      <!-- Tips -->
      <div class="mt-6 p-4 bg-amber-50/80 border border-amber-200 rounded-xl text-sm text-amber-800">
        <div class="flex items-start gap-2">
          <svg class="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
          </svg>
          <div>
            <p class="font-medium text-amber-800">Tips</p>
            <p class="text-amber-700 mt-0.5">Simpan kartu QR ini di galeri HP atau cetak. Tunjukkan ke Murabbi saat sesi liqa untuk absen.</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
