<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'

const authStore = useAuthStore()
const appStore = useAppStore()

const anggota = ref([])
const expandedId = ref(null)
const attendanceMap = ref({})
const loading = ref(true)

const adminGroupId = computed(() => authStore.profile?.group_id)

async function fetchAnggota() {
  if (!adminGroupId.value) return
  loading.value = true
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nama, nim, prodi, kelas, angkatan')
    .eq('group_id', adminGroupId.value)
    .eq('status_akun', 'aktif')
    .order('nama', { ascending: true })

  if (error) {
    appStore.setError(error.message)
  } else {
    anggota.value = data || []
  }
  loading.value = false
}

async function toggleExpand(userId) {
  if (expandedId.value === userId) {
    expandedId.value = null
    return
  }
  expandedId.value = userId

  if (!attendanceMap.value[userId]) {
    const { data } = await supabase
      .from('attendances')
      .select('status, waktu_absen, sessions!inner(tanggal, judul_materi)')
      .eq('user_id', userId)
      .order('waktu_absen', { ascending: false })

    attendanceMap.value = {
      ...attendanceMap.value,
      [userId]: data || []
    }
  }
}

function statusBadge(status) {
  const map = {
    hadir: 'bg-emerald-100 text-emerald-700',
    izin: 'bg-amber-100 text-amber-700',
    alpa: 'bg-red-100 text-red-700'
  }
  return map[status] || 'bg-gray-100 text-gray-600'
}

onMounted(fetchAnggota)
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-emerald-900 mb-1">Anggota Saya</h1>
    <p class="text-sm text-gray-500 mb-4">Daftar anggota kelompok binaan Anda</p>

    <div v-if="!adminGroupId" class="text-center py-12">
      <div class="flex justify-center mb-4"><div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center"><svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div></div>
      <h3 class="text-lg font-medium text-gray-700">Anda Belum Ditugaskan ke Kelompok</h3>
    </div>

    <div v-else-if="loading" class="text-center py-8 text-gray-500">Memuat...</div>

    <div v-else-if="anggota.length === 0" class="text-center py-12">
      <div class="flex justify-center mb-4"><div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center"><svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" /></svg></div></div>
      <h3 class="text-lg font-medium text-gray-700 mb-2">Belum Ada Anggota</h3>
      <p class="text-sm text-gray-500">Tambahkan anggota dari halaman Tambah Anggota.</p>
    </div>

    <div v-else class="space-y-3">
      <p class="text-sm text-gray-500">{{ anggota.length }} anggota</p>
      <div v-for="a in anggota" :key="a.id"
        class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <button @click="toggleExpand(a.id)"
          class="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors">
          <div class="flex-1 min-w-0">
            <p class="font-medium text-gray-800">{{ a.nama }}</p>
            <p class="text-sm text-gray-500">{{ a.nim || '-' }} · {{ a.prodi || '-' }}{{ a.kelas ? ' · ' + a.kelas : '' }}</p>
          </div>
          <span class="text-gray-400 ml-2 transition-transform" :class="expandedId === a.id ? 'rotate-180' : ''">▼</span>
        </button>

        <div v-if="expandedId === a.id" class="border-t border-gray-50">
          <div v-if="!attendanceMap[a.id]" class="p-4 text-center text-gray-400 text-sm">Memuat riwayat...</div>
          <div v-else-if="attendanceMap[a.id].length === 0" class="p-4 text-center text-gray-400 text-sm">
            Belum ada catatan kehadiran.
          </div>
          <div v-else class="divide-y divide-gray-50">
            <div v-for="att in attendanceMap[a.id]" :key="att.waktu_absen"
              class="p-3 flex items-center justify-between text-sm">
              <div>
                <p class="text-gray-700">{{ att.sessions?.judul_materi || 'Sesi Liqa' }}</p>
                <p class="text-gray-400 text-xs">
                  {{ att.sessions?.tanggal ? new Date(att.sessions.tanggal + 'T00:00:00').toLocaleDateString('id-ID') : '-' }}
                </p>
              </div>
              <span class="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                :class="statusBadge(att.status)">
                {{ att.status }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
