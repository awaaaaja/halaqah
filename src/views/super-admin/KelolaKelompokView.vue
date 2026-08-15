<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/stores/appStore'

const appStore = useAppStore()
const groups = ref([])
const admins = ref([])
const loading = ref(true)
const showForm = ref(false)
const editId = ref(null)
const oldMurabbiId = ref(null)
const form = ref({ nama_kelompok: '', deskripsi: '', murabbi_id: '' })
const formLoading = ref(false)
const deleting = ref(new Set())

async function loadData() {
  loading.value = true
  const [gRes, aRes] = await Promise.all([
    supabase.from('groups').select('id, nama_kelompok, deskripsi, murabbi_id, created_at').order('nama_kelompok'),
    supabase.from('profiles').select('id, nama').eq('role', 'admin').order('nama')
  ])
  groups.value = gRes.data || []
  admins.value = aRes.data || []

  // Get member counts (batched — satu query untuk semua kelompok)
  const { data: memberRows } = await supabase.from('profiles').select('group_id').eq('status_akun', 'aktif')
  const countMap = {}
  ;(memberRows || []).forEach(m => {
    countMap[m.group_id] = (countMap[m.group_id] || 0) + 1
  })
  groups.value = groups.value.map(g => ({ ...g, anggota_count: countMap[g.id] || 0 }))

  loading.value = false
}

function openCreate() {
  editId.value = null
  oldMurabbiId.value = null
  form.value = { nama_kelompok: '', deskripsi: '', murabbi_id: '' }
  showForm.value = true
}

function openEdit(g) {
  editId.value = g.id
  oldMurabbiId.value = g.murabbi_id || null
  form.value = { nama_kelompok: g.nama_kelompok, deskripsi: g.deskripsi || '', murabbi_id: g.murabbi_id || '' }
  showForm.value = true
}

async function syncMurabbiGroup(groupId) {
  const newMurabbi = form.value.murabbi_id || null
  if (oldMurabbiId.value && oldMurabbiId.value !== newMurabbi) {
    await supabase.from('profiles').update({ group_id: null }).eq('id', oldMurabbiId.value).eq('group_id', groupId)
  }
  if (newMurabbi) {
    await supabase.from('profiles').update({ group_id: groupId }).eq('id', newMurabbi)
  }
}

async function handleSave() {
  if (!form.value.nama_kelompok) return
  formLoading.value = true
  try {
    const payload = {
      nama_kelompok: form.value.nama_kelompok,
      deskripsi: form.value.deskripsi || null,
      murabbi_id: form.value.murabbi_id || null
    }

    if (editId.value) {
      const { error } = await supabase.from('groups').update(payload).eq('id', editId.value)
      if (error) throw error
      await syncMurabbiGroup(editId.value)
      appStore.showToast('Kelompok diperbarui')
    } else {
      const { data, error } = await supabase.from('groups').insert(payload).select('id').single()
      if (error) throw error
      await syncMurabbiGroup(data.id)
      appStore.showToast('Kelompok baru dibuat')
    }
    showForm.value = false
    await loadData()
  } catch (e) {
    appStore.showToast(e.message, 'error')
  } finally {
    formLoading.value = false
  }
}

async function handleDelete(groupId) {
  if (!confirm('Hapus kelompok ini? Anggota di dalamnya akan kehilangan kelompok.')) return
  deleting.value = new Set([...deleting.value, groupId])
  try {
    const { error } = await supabase.from('groups').delete().eq('id', groupId)
    if (error) throw error
    appStore.showToast('Kelompok dihapus')
    await loadData()
  } catch (e) {
    appStore.showToast(e.message, 'error')
  } finally {
    const next = new Set(deleting.value)
    next.delete(groupId)
    deleting.value = next
  }
}

onMounted(loadData)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <div>
        <h1 class="text-xl font-bold text-emerald-900">Kelola Kelompok</h1>
        <p class="text-sm text-gray-500">Manajemen kelompok liqa</p>
      </div>
      <button @click="openCreate"
        class="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800">
        + Baru
      </button>
    </div>

    <div v-if="loading" class="text-center py-8 text-gray-500">Memuat...</div>

    <div v-else-if="groups.length === 0" class="text-center py-12 text-gray-500">
      Belum ada kelompok.
    </div>

    <div v-else class="space-y-3">
      <div v-for="g in groups" :key="g.id"
        class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <p class="font-medium text-gray-800">{{ g.nama_kelompok }}</p>
            <p class="text-sm text-gray-500">{{ g.deskripsi || 'Tidak ada deskripsi' }}</p>
            <div class="flex gap-3 mt-1 text-xs text-gray-400">
              <svg class="w-4 h-4 text-gray-400 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" /></svg>
              <span>{{ g.anggota_count }} anggota</span>
              <span>{{ admins.find(a => a.id === g.murabbi_id)?.nama || 'Belum ada Murabbi' }}</span>
            </div>
          </div>
          <div class="flex gap-2">
            <button @click="openEdit(g)" class="text-sm text-emerald-700 font-medium hover:text-emerald-800">Edit</button>
            <button @click="handleDelete(g.id)" :disabled="deleting.has(g.id)"
              class="text-sm text-red-600 font-medium hover:text-red-700 disabled:opacity-50">
              {{ deleting.has(g.id) ? '...' : 'Hapus' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Form Modal -->
    <div v-if="showForm" class="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4"
      @click.self="showForm = false">
      <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h3 class="text-lg font-bold text-gray-800 mb-4">{{ editId ? 'Edit Kelompok' : 'Kelompok Baru' }}</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nama Kelompok</label>
            <input v-model="form.nama_kelompok" required maxlength="100"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
            <textarea v-model="form.deskripsi" rows="2" maxlength="300"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Murabbi</label>
            <select v-model="form.murabbi_id" class="w-full px-4 py-3 border border-gray-300 rounded-xl">
              <option value="">— Pilih —</option>
              <option v-for="a in admins" :key="a.id" :value="a.id">{{ a.nama }}</option>
            </select>
          </div>
          <div class="flex gap-3">
            <button @click="showForm = false"
              class="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50">
              Batal
            </button>
            <button @click="handleSave" :disabled="formLoading || !form.nama_kelompok"
              class="flex-1 py-3 bg-emerald-700 text-white rounded-xl font-medium hover:bg-emerald-800 disabled:opacity-50">
              {{ formLoading ? 'Menyimpan...' : 'Simpan' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
