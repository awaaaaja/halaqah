<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'

const authStore = useAuthStore()
const appStore = useAppStore()

const sesiList = ref([])
const summaryMap = ref({})
const loading = ref(true)

const adminGroupId = computed(() => authStore.profile?.group_id)

async function fetchRiwayatSesi() {
  if (!adminGroupId.value) return
  loading.value = true

  const { data, error } = await supabase
    .from('sessions')
    .select('id, tanggal, judul_materi, dibuka_at, ditutup_at, is_open')
    .eq('group_id', adminGroupId.value)
    .eq('is_open', false)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    appStore.setError(error.message)
    loading.value = false
    return
  }

  sesiList.value = data || []

  const sessionIds = (data || []).map(s => s.id)
  const { data: atts } = sessionIds.length
    ? await supabase.from('attendances').select('status, session_id').in('session_id', sessionIds)
    : { data: [] }

  const summaries = {}
  ;(atts || []).forEach(a => {
    const s = summaries[a.session_id] || (summaries[a.session_id] = { hadir: 0, izin: 0, alpa: 0, total: 0 })
    s.total++
    if (a.status === 'hadir') s.hadir++
    else if (a.status === 'izin') s.izin++
    else s.alpa++
  })
  summaryMap.value = summaries
  loading.value = false
}

onMounted(fetchRiwayatSesi)
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-emerald-900 mb-1">Riwayat Sesi</h1>
    <p class="text-sm text-gray-500 mb-4">Daftar sesi liqa yang telah ditutup</p>

    <div v-if="!adminGroupId" class="text-center py-12">
      <div class="flex justify-center mb-4"><div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center"><svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div></div>
      <h3 class="text-lg font-medium text-gray-700">Anda Belum Ditugaskan ke Kelompok</h3>
    </div>

    <div v-else-if="loading" class="text-center py-8 text-gray-500">Memuat...</div>

    <div v-else-if="sesiList.length === 0" class="text-center py-12">
      <div class="flex justify-center mb-4"><div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center"><svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg></div></div>
      <h3 class="text-lg font-medium text-gray-700 mb-2">Belum Ada Sesi</h3>
      <p class="text-sm text-gray-500">Buka sesi liqa dari halaman Beranda untuk memulai.</p>
    </div>

    <div v-else class="space-y-3">
      <p class="text-sm text-gray-500">{{ sesiList.length }} sesi</p>
      <div v-for="s in sesiList" :key="s.id"
        class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <div class="flex items-start justify-between mb-3">
          <div>
            <p class="font-medium text-gray-800">{{ s.judul_materi || 'Sesi Liqa' }}</p>
            <p class="text-sm text-gray-500">
              {{ s.tanggal ? new Date(s.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-' }}
            </p>
          </div>
          <span class="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">Selesai</span>
        </div>

        <div v-if="summaryMap[s.id]" class="grid grid-cols-3 gap-2 text-center text-sm">
          <div class="bg-emerald-50 rounded-lg py-2">
            <p class="font-bold text-emerald-600">{{ summaryMap[s.id].hadir }}</p>
            <p class="text-xs text-emerald-600">Hadir</p>
          </div>
          <div class="bg-amber-50 rounded-lg py-2">
            <p class="font-bold text-amber-600">{{ summaryMap[s.id].izin }}</p>
            <p class="text-xs text-amber-600">Izin</p>
          </div>
          <div class="bg-red-50 rounded-lg py-2">
            <p class="font-bold text-red-600">{{ summaryMap[s.id].alpa }}</p>
            <p class="text-xs text-red-600">Alpa</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
