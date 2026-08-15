<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/stores/appStore'

const appStore = useAppStore()
const pendingUsers = ref([])
const loading = ref(true)
const processingId = ref(null)

async function fetchPendingUsers() {
  loading.value = true
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nama, nim, email, prodi, kelas, angkatan, created_at')
    .eq('status_akun', 'pending')
    .order('created_at', { ascending: true })
  if (error) {
    appStore.setError(error.message)
  } else {
    pendingUsers.value = data || []
  }
  loading.value = false
}

async function handleApprove(userId) {
  if (processingId.value) return
  processingId.value = userId
  try {
    const { error } = await supabase.rpc('approve_user', {
      target_user_id: userId,
      new_status: 'aktif'
    })
    if (error) throw error
    appStore.showToast('Anggota berhasil diaktifkan')
    pendingUsers.value = pendingUsers.value.filter(u => u.id !== userId)
  } catch (e) {
    appStore.showToast(e.message, 'error')
  } finally {
    processingId.value = null
  }
}

async function handleReject(userId) {
  if (processingId.value) return
  processingId.value = userId
  try {
    const { error } = await supabase.rpc('approve_user', {
      target_user_id: userId,
      new_status: 'nonaktif'
    })
    if (error) throw error
    appStore.showToast('Anggota ditolak', 'warning')
    pendingUsers.value = pendingUsers.value.filter(u => u.id !== userId)
  } catch (e) {
    appStore.showToast(e.message, 'error')
  } finally {
    processingId.value = null
  }
}

onMounted(fetchPendingUsers)
</script>

<template>
  <div>
    <h1 class="text-xl font-bold mb-4">Approval Anggota</h1>
    <p class="text-sm text-gray-500 mb-4">Setujui atau tolak pendaftaran anggota baru</p>

    <div v-if="loading" class="text-center py-8 text-gray-500">Memuat...</div>

    <div v-else-if="pendingUsers.length === 0" class="text-center py-8 text-gray-500">
      Tidak ada anggota yang menunggu persetujuan.
    </div>

    <div v-else class="space-y-3">
      <div v-for="user in pendingUsers" :key="user.id"
        class="border border-gray-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div class="flex-1">
          <p class="font-medium">{{ user.nama }}</p>
          <p class="text-sm text-gray-500">NIM: {{ user.nim }} | {{ user.prodi }} | {{ user.kelas }} | {{ user.angkatan }}</p>
          <p class="text-sm text-gray-400">{{ user.email }} · {{ new Date(user.created_at).toLocaleDateString('id-ID') }}</p>
        </div>
        <div class="flex gap-2">
          <button @click="handleApprove(user.id)" :disabled="processingId === user.id"
            class="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 disabled:opacity-50">
            Setujui
          </button>
          <button @click="handleReject(user.id)" :disabled="processingId === user.id"
            class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
            Tolak
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
