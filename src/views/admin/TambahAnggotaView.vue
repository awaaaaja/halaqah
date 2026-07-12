<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'

const authStore = useAuthStore()
const appStore = useAppStore()

const candidates = ref([])
const searchQuery = ref('')
const loading = ref(true)
const assignLoading = ref(new Set())

const adminGroupId = computed(() => authStore.profile?.group_id)

const filteredCandidates = computed(() => {
  if (!searchQuery.value) return candidates.value
  const q = searchQuery.value.toLowerCase()
  return candidates.value.filter(
    c => c.nama.toLowerCase().includes(q) || (c.nim && c.nim.toLowerCase().includes(q))
  )
})

async function fetchCandidates() {
  loading.value = true
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nama, nim, prodi, kelas, angkatan')
    .is('group_id', null)
    .eq('status_akun', 'aktif')
    .order('nama', { ascending: true })

  if (error) {
    appStore.setError(error.message)
  } else {
    candidates.value = data || []
  }
  loading.value = false
}

async function handleAssign(userId) {
  if (!adminGroupId.value) return

  assignLoading.value = new Set([...assignLoading.value, userId])
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ group_id: adminGroupId.value })
      .eq('id', userId)
      .is('group_id', null)

    if (error) throw error
    appStore.showToast('Anggota ditambahkan ke kelompok')
    candidates.value = candidates.value.filter(c => c.id !== userId)
  } catch (e) {
    appStore.showToast(e.message, 'error')
  } finally {
    const next = new Set(assignLoading.value)
    next.delete(userId)
    assignLoading.value = next
  }
}

onMounted(fetchCandidates)
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-emerald-900 mb-1">Tambah Anggota</h1>
    <p class="text-sm text-gray-500 mb-4">Daftar anggota yang belum memiliki kelompok</p>

    <!-- No group assigned -->
    <div v-if="!adminGroupId" class="text-center py-12">
      <div class="flex justify-center mb-4"><div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center"><svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div></div>
      <h3 class="text-lg font-medium text-gray-700">Anda Belum Ditugaskan ke Kelompok</h3>
      <p class="text-sm text-gray-500 mt-1">Hubungi Super Admin untuk ditetapkan sebagai Murabbi suatu kelompok.</p>
    </div>

    <template v-else>
      <!-- Search -->
      <div class="mb-4">
        <input v-model="searchQuery" placeholder="Cari nama atau NIM..."
          class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-center py-8 text-gray-500">Memuat...</div>

      <!-- Empty -->
      <div v-else-if="candidates.length === 0" class="text-center py-12">
        <div class="flex justify-center mb-4"><div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center"><svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg></div></div>
        <h3 class="text-lg font-medium text-gray-700 mb-2">Semua Anggota Sudah Memiliki Kelompok</h3>
        <p class="text-sm text-gray-500">Tidak ada anggota aktif yang belum ditugaskan.</p>
      </div>

      <!-- Search no result -->
      <div v-else-if="filteredCandidates.length === 0" class="text-center py-8 text-gray-500">
        Tidak ditemukan anggota dengan kata kunci "{{ searchQuery }}"
      </div>

      <!-- List -->
      <div v-else class="space-y-3">
        <p class="text-sm text-gray-500">{{ filteredCandidates.length }} anggota tersedia</p>
        <div v-for="c in filteredCandidates" :key="c.id"
          class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center justify-between gap-3">
          <div class="flex-1 min-w-0">
            <p class="font-medium text-gray-800 truncate">{{ c.nama }}</p>
            <p class="text-sm text-gray-500">{{ c.nim || '-' }} · {{ c.prodi || '-' }} {{ c.kelas ? '· ' + c.kelas : '' }}</p>
          </div>
          <button @click="handleAssign(c.id)" :disabled="assignLoading.has(c.id)"
            class="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 disabled:opacity-50 whitespace-nowrap transition-colors">
            {{ assignLoading.has(c.id) ? '...' : '+ Tambah' }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
