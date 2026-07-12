<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/stores/appStore'

const appStore = useAppStore()
const admins = ref([])
const groups = ref([])
const userCandidates = ref([])
const loading = ref(true)
const showAddForm = ref(false)
const addForm = ref({ user_id: '', group_id: '' })
const addLoading = ref(false)

async function loadData() {
  loading.value = true
  const [adminsRes, groupsRes] = await Promise.all([
    supabase.from('profiles').select('id, nama, nim, email, group_id, groups!left(nama_kelompok)').eq('role', 'admin').order('nama'),
    supabase.from('groups').select('id, nama_kelompok').order('nama_kelompok')
  ])
  admins.value = (adminsRes.data || []).map(a => ({ ...a, nama_kelompok: a.groups?.nama_kelompok || null }))
  groups.value = groupsRes.data || []
  loading.value = false
}

async function loadCandidates() {
  const { data } = await supabase
    .from('profiles')
    .select('id, nama, nim')
    .eq('role', 'user')
    .eq('status_akun', 'aktif')
    .order('nama')
  userCandidates.value = data || []
}

function openAddForm() {
  loadCandidates()
  addForm.value = { user_id: '', group_id: '' }
  showAddForm.value = true
}

async function handleAdd() {
  if (!addForm.value.user_id) return
  addLoading.value = true
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ role: 'admin', group_id: addForm.value.group_id || null })
      .eq('id', addForm.value.user_id)
    if (error) throw error
    appStore.showToast('Murabbi baru ditambahkan')
    showAddForm.value = false
    await loadData()
  } catch (e) {
    appStore.showToast(e.message, 'error')
  } finally {
    addLoading.value = false
  }
}

async function handleUpdateGroup(adminId, groupId) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ group_id: groupId || null })
      .eq('id', adminId)
    if (error) throw error
    appStore.showToast('Kelompok diperbarui')
    await loadData()
  } catch (e) {
    appStore.showToast(e.message, 'error')
  }
}

onMounted(loadData)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <div>
        <h1 class="text-xl font-bold text-emerald-900">Kelola Murabbi</h1>
        <p class="text-sm text-gray-500">Manajemen akun pembimbing liqa</p>
      </div>
      <button @click="openAddForm"
        class="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800">
        + Tambah
      </button>
    </div>

    <div v-if="loading" class="text-center py-8 text-gray-500">Memuat...</div>

    <div v-else-if="admins.length === 0" class="text-center py-12 text-gray-500">
      Belum ada Murabbi.
    </div>

    <div v-else class="space-y-3">
      <div v-for="a in admins" :key="a.id"
        class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <p class="font-medium text-gray-800">{{ a.nama }}</p>
          <p class="text-sm text-gray-500">{{ a.email || a.nim || '-' }}</p>
          <p class="text-xs text-gray-400">{{ a.nama_kelompok || 'Belum ditugaskan' }}</p>
        </div>
        <select @change="(e) => handleUpdateGroup(a.id, e.target.value || null)"
          class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="">— Pilih Kelompok —</option>
          <option v-for="g in groups" :key="g.id" :value="g.id" :selected="a.group_id === g.id">
            {{ g.nama_kelompok }}
          </option>
        </select>
      </div>
    </div>

    <!-- Add Modal -->
    <div v-if="showAddForm" class="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4"
      @click.self="showAddForm = false">
      <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h3 class="text-lg font-bold text-gray-800 mb-4">Tambah Murabbi Baru</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Pilih Anggota</label>
            <select v-model="addForm.user_id" class="w-full px-4 py-3 border border-gray-300 rounded-xl">
              <option value="">— Pilih —</option>
              <option v-for="u in userCandidates" :key="u.id" :value="u.id">{{ u.nama }} ({{ u.nim || '-' }})</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Kelompok (opsional)</label>
            <select v-model="addForm.group_id" class="w-full px-4 py-3 border border-gray-300 rounded-xl">
              <option value="">— Tidak ditugaskan —</option>
              <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.nama_kelompok }}</option>
            </select>
          </div>
          <div class="flex gap-3">
            <button @click="showAddForm = false"
              class="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50">
              Batal
            </button>
            <button @click="handleAdd" :disabled="addLoading || !addForm.user_id"
              class="flex-1 py-3 bg-emerald-700 text-white rounded-xl font-medium hover:bg-emerald-800 disabled:opacity-50">
              {{ addLoading ? 'Menyimpan...' : 'Tambah' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
