<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useAttendance } from '@/composables/useAttendance'

const authStore = useAuthStore()
const { riwayat, loading, getRiwayatUser } = useAttendance()

const stats = computed(() => {
  const total = riwayat.value.length
  const hadir = riwayat.value.filter(r => r.status === 'hadir').length
  const izin = riwayat.value.filter(r => r.status === 'izin').length
  const alpa = riwayat.value.filter(r => r.status === 'alpa').length
  const persentase = total > 0 ? Math.round((hadir / total) * 100) : 0
  return { total, hadir, izin, alpa, persentase }
})

function statusBadge(status) {
  const map = {
    hadir: 'bg-emerald-100 text-emerald-700',
    izin: 'bg-amber-100 text-amber-700',
    alpa: 'bg-red-100 text-red-700'
  }
  return map[status] || 'bg-gray-100 text-gray-600'
}

onMounted(() => {
  if (authStore.user) {
    getRiwayatUser(authStore.user.id)
  }
})
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-emerald-900 mb-1">Catatan Kehadiran</h1>
    <p class="text-sm text-gray-500 mb-4">Riwayat kehadiran Anda di setiap sesi liqa — tersimpan permanen</p>

    <!-- Stats Cards -->
    <div v-if="!loading && riwayat.length > 0" class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div class="bg-white rounded-xl p-4 border border-gray-100 text-center shadow-sm">
        <p class="text-2xl font-bold text-gray-800">{{ stats.total }}</p>
        <p class="text-xs text-gray-500 mt-1">Total Sesi</p>
      </div>
      <div class="bg-white rounded-xl p-4 border border-emerald-100 text-center shadow-sm">
        <p class="text-2xl font-bold text-emerald-600">{{ stats.hadir }}</p>
        <p class="text-xs text-emerald-600 mt-1">Hadir</p>
      </div>
      <div class="bg-white rounded-xl p-4 border border-amber-100 text-center shadow-sm">
        <p class="text-2xl font-bold text-amber-600">{{ stats.izin }}</p>
        <p class="text-xs text-amber-600 mt-1">Izin</p>
      </div>
      <div class="bg-white rounded-xl p-4 border border-red-100 text-center shadow-sm">
        <p class="text-2xl font-bold text-red-600">{{ stats.alpa }}</p>
        <p class="text-xs text-red-600 mt-1">Alpa</p>
      </div>
    </div>

    <!-- Progress bar -->
    <div v-if="!loading && riwayat.length > 0" class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm mb-6">
      <div class="flex justify-between items-center mb-2">
        <span class="text-sm font-medium text-gray-700">Tingkat Kehadiran</span>
        <span class="text-sm font-bold" :class="stats.persentase >= 75 ? 'text-emerald-600' : stats.persentase >= 50 ? 'text-amber-600' : 'text-red-600'">
          {{ stats.persentase }}%
        </span>
      </div>
      <div class="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all duration-500"
          :class="stats.persentase >= 75 ? 'bg-emerald-500' : stats.persentase >= 50 ? 'bg-amber-500' : 'bg-red-500'"
          :style="{ width: stats.persentase + '%' }">
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-gray-500">
      <p>Memuat riwayat...</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="riwayat.length === 0" class="text-center py-12">
      <div class="flex justify-center mb-4"><div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center"><svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg></div></div>
      <h3 class="text-lg font-medium text-gray-700 mb-2">Belum Ada Catatan Kehadiran</h3>
      <p class="text-sm text-gray-500">
        Anda belum pernah tercatat mengikuti sesi liqa. Hadiri sesi dan minta Murabbi melakukan scan QR Anda.
      </p>
    </div>

    <!-- Attendance list -->
    <div v-else class="space-y-3">
      <div v-for="item in riwayat" :key="item.id"
        class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
        <div class="flex-1 min-w-0">
          <p class="font-medium text-gray-800 truncate">{{ item.session_judul || 'Sesi Liqa' }}</p>
          <p class="text-sm text-gray-500">
            {{ item.session_tanggal ? new Date(item.session_tanggal + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-' }}
          </p>
          <p v-if="item.kelompok" class="text-xs text-gray-400 mt-0.5">Kelompok: {{ item.kelompok }}</p>
        </div>
        <span class="px-3 py-1 rounded-full text-xs font-medium capitalize whitespace-nowrap ml-3"
          :class="statusBadge(item.status)">
          {{ item.status }}
        </span>
      </div>
    </div>
  </div>
</template>
