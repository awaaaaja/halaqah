<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/stores/appStore'
import { useAdminManageUser } from '@/composables/useAdminManageUser'

const appStore = useAppStore()
const { createUser, updateUser } = useAdminManageUser()

const allUsers = ref([])
const groups = ref([])
const loading = ref(true)
const search = ref('')
const filterRole = ref('')
const filterStatus = ref('')

const showCreateModal = ref(false)
const showEditModal = ref(false)
const editTarget = ref(null)
const saving = ref(false)
const deleting = ref(new Set())
const confirmToggleUser = ref(null)

const createForm = ref({
  email: '', password: '', nama: '', nim: '', prodi: '', kelas: '',
  angkatan: '', no_hp: '', role: 'user', group_id: ''
})
const editForm = ref({
  nama: '', nim: '', prodi: '', kelas: '', angkatan: '',
  no_hp: '', role: 'user', group_id: '', status_akun: 'aktif'
})

async function loadData() {
  loading.value = true
  const [uRes, gRes] = await Promise.all([
    supabase.from('profiles').select('id, nama, nim, email, prodi, kelas, angkatan, role, status_akun, group_id, created_at, groups!left(nama_kelompok)').order('created_at', { ascending: false }),
    supabase.from('groups').select('id, nama_kelompok').order('nama_kelompok')
  ])
  allUsers.value = (uRes.data || []).map(u => ({ ...u, nama_kelompok: u.groups?.nama_kelompok || null }))
  groups.value = gRes.data || []
  loading.value = false
}

const filteredUsers = computed(() => {
  let list = allUsers.value
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(u => (u.nama || '').toLowerCase().includes(q) || (u.nim || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
  }
  if (filterRole.value) list = list.filter(u => u.role === filterRole.value)
  if (filterStatus.value) list = list.filter(u => u.status_akun === filterStatus.value)
  return list
})

function openCreate() {
  createForm.value = { email: '', password: '', nama: '', nim: '', prodi: '', kelas: '', angkatan: '', no_hp: '', role: 'user', group_id: '' }
  showCreateModal.value = true
}

async function handleCreate() {
  saving.value = true
  try {
    await createUser(createForm.value)
    appStore.showToast('Akun berhasil dibuat')
    showCreateModal.value = false
    await loadData()
  } catch (e) {
    appStore.showToast(e.message, 'error')
  } finally {
    saving.value = false
  }
}

function openEdit(user) {
  editTarget.value = user
  editForm.value = {
    nama: user.nama || '', nim: user.nim || '', prodi: user.prodi || '',
    kelas: user.kelas || '', angkatan: user.angkatan || '',
    no_hp: user.no_hp || '', role: user.role, group_id: user.group_id || '',
    status_akun: user.status_akun
  }
  showEditModal.value = true
}

async function handleEdit() {
  if (!editTarget.value) return
  saving.value = true
  try {
    const payload = { ...editForm.value }
    // Only send group_id if admin actually changed it — preserve existing
    if (payload.group_id === (editTarget.value.group_id || '')) {
      delete payload.group_id
    } else if (payload.group_id === '') {
      payload.group_id = null
    }
    await updateUser(editTarget.value.id, payload)
    appStore.showToast('Akun diperbarui')
    showEditModal.value = false
    editTarget.value = null
    await loadData()
  } catch (e) {
    appStore.showToast(e.message, 'error')
  } finally {
    saving.value = false
  }
}

async function handleToggleStatus() {
  const user = confirmToggleUser.value
  if (!user) return
  confirmToggleUser.value = null
  const newStatus = user.status_akun === 'aktif' ? 'nonaktif' : 'aktif'
  const label = newStatus === 'aktif' ? 'diaktifkan' : 'dinonaktifkan'
  try {
    await updateUser(user.id, { status_akun: newStatus })
    appStore.showToast(`Akun ${label}`)
    await loadData()
  } catch (e) {
    appStore.showToast(e.message, 'error')
  }
}

const roleBadgeClass = (role) => {
  const map = {
    super_admin: 'bg-purple-100 text-purple-800',
    admin: 'bg-blue-100 text-blue-800',
    user: 'bg-emerald-100 text-emerald-800',
  }
  return map[role] || 'bg-gray-100 text-gray-800'
}

const statusBadgeClass = (status) => {
  const map = {
    aktif: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    nonaktif: 'bg-red-100 text-red-800',
  }
  return map[status] || 'bg-gray-100 text-gray-800'
}

onMounted(loadData)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <div>
        <h1 class="text-xl font-bold text-emerald-900">Kelola Akun</h1>
        <p class="text-sm text-gray-500">Buat & kelola semua akun pengguna</p>
      </div>
      <button @click="openCreate"
        class="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800">
        + Akun Baru
      </button>
    </div>

    <!-- Filters -->
    <div class="flex flex-col sm:flex-row gap-3 mb-4">
      <input v-model="search" placeholder="Cari nama, NIM, atau email..."
        class="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      <select v-model="filterRole" class="px-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-white">
        <option value="">Semua Role</option>
        <option value="super_admin">Super Admin</option>
        <option value="admin">Admin</option>
        <option value="user">User</option>
      </select>
      <select v-model="filterStatus" class="px-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-white">
        <option value="">Semua Status</option>
        <option value="aktif">Aktif</option>
        <option value="pending">Pending</option>
        <option value="nonaktif">Nonaktif</option>
      </select>
    </div>

    <div v-if="loading" class="text-center py-8 text-gray-500">Memuat...</div>

    <div v-else-if="filteredUsers.length === 0" class="text-center py-12 text-gray-500">
      Tidak ada akun ditemukan.
    </div>

    <div v-else class="space-y-3">
      <div v-for="u in filteredUsers" :key="u.id"
        class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0">
            <p class="font-medium text-gray-800 truncate">{{ u.nama }}</p>
            <p class="text-sm text-gray-500 truncate">{{ u.email || '-' }}</p>
            <p class="text-xs text-gray-400 truncate" v-if="u.nim || u.prodi">{{ [u.nim, u.prodi, u.kelas, u.angkatan].filter(Boolean).join(' · ') }}</p>
            <p class="text-xs text-gray-400 mt-1">{{ u.nama_kelompok || 'Tanpa kelompok' }}</p>
          </div>
          <div class="flex flex-col items-end gap-1.5 shrink-0">
            <span :class="['px-2 py-0.5 rounded text-xs font-medium', roleBadgeClass(u.role)]">
              {{ u.role === 'super_admin' ? 'Super Admin' : u.role === 'admin' ? 'Admin' : 'User' }}
            </span>
            <span :class="['px-2 py-0.5 rounded text-xs font-medium', statusBadgeClass(u.status_akun)]">
              {{ u.status_akun }}
            </span>
          </div>
        </div>
        <div class="flex gap-2 mt-3 pt-3 border-t border-gray-100">
          <button @click="openEdit(u)"
            class="text-xs text-emerald-700 font-medium hover:text-emerald-800 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors">
            Edit
          </button>
          <button @click="confirmToggleUser = u"
            class="text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            :class="u.status_akun === 'aktif' ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'">
            {{ u.status_akun === 'aktif' ? 'Nonaktifkan' : 'Aktifkan' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Create Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4"
      @click.self="showCreateModal = false">
      <div class="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-bold text-gray-800 mb-4">Buat Akun Baru</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input v-model="createForm.email" type="email" required
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Password *</label>
            <input v-model="createForm.password" type="password" required minlength="6"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <p class="text-xs text-gray-400 mt-1">Minimal 6 karakter</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap *</label>
            <input v-model="createForm.nama" required maxlength="100"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">NIM</label>
              <input v-model="createForm.nim" maxlength="20"
                class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">No. HP</label>
              <input v-model="createForm.no_hp" type="tel" maxlength="20"
                class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Prodi</label>
              <input v-model="createForm.prodi" maxlength="50"
                class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
              <input v-model="createForm.kelas" maxlength="20"
                class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Angkatan</label>
              <input v-model="createForm.angkatan" maxlength="10"
                class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Role *</label>
            <select v-model="createForm.role" class="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white">
              <option value="user">User (Anggota)</option>
              <option value="admin">Admin (Murabbi)</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <div v-if="createForm.role !== 'super_admin'">
            <label class="block text-sm font-medium text-gray-700 mb-1">Kelompok</label>
            <select v-model="createForm.group_id" class="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white">
              <option value="">— Tidak ditugaskan —</option>
              <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.nama_kelompok }}</option>
            </select>
          </div>
          <div class="flex gap-3 pt-2">
            <button @click="showCreateModal = false"
              class="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50">
              Batal
            </button>
            <button @click="handleCreate" :disabled="saving || !createForm.email || !createForm.password || !createForm.nama"
              class="flex-1 py-3 bg-emerald-700 text-white rounded-xl font-medium hover:bg-emerald-800 disabled:opacity-50">
              {{ saving ? 'Menyimpan...' : 'Buat Akun' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="showEditModal" class="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4"
      @click.self="showEditModal = false">
      <div class="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-bold text-gray-800 mb-1">Edit Akun</h3>
        <p class="text-sm text-gray-500 mb-4">{{ editTarget?.nama }} ({{ editTarget?.email }})</p>
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
            <input v-model="editForm.nama" maxlength="100"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">NIM</label>
              <input v-model="editForm.nim" maxlength="20"
                class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">No. HP</label>
              <input v-model="editForm.no_hp" type="tel" maxlength="20"
                class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Prodi</label>
              <input v-model="editForm.prodi" maxlength="50"
                class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
              <input v-model="editForm.kelas" maxlength="20"
                class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Angkatan</label>
              <input v-model="editForm.angkatan" maxlength="10"
                class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select v-model="editForm.role" class="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white">
              <option value="user">User (Anggota)</option>
              <option value="admin">Admin (Murabbi)</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select v-model="editForm.status_akun" class="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white">
              <option value="aktif">Aktif</option>
              <option value="pending">Pending</option>
              <option value="nonaktif">Nonaktif</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Kelompok</label>
            <select v-model="editForm.group_id" class="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white">
              <option value="">— Tidak ditugaskan —</option>
              <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.nama_kelompok }}</option>
            </select>
          </div>
          <div class="flex gap-3 pt-2">
            <button @click="showEditModal = false"
              class="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50">
              Batal
            </button>
            <button @click="handleEdit" :disabled="saving"
              class="flex-1 py-3 bg-emerald-700 text-white rounded-xl font-medium hover:bg-emerald-800 disabled:opacity-50">
              {{ saving ? 'Menyimpan...' : 'Simpan' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Toggle Status Confirmation Modal -->
    <Teleport to="body">
      <div v-if="confirmToggleUser"
        class="fixed inset-0 bg-black/40 z-[999] flex items-end md:items-center justify-center p-4 animate-fade-in"
        @click.self="confirmToggleUser = null">
        <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-slide-up">
          <div class="text-center mb-5">
            <div class="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
              :class="confirmToggleUser.status_akun === 'aktif' ? 'bg-red-50' : 'bg-green-50'">
              <svg class="w-7 h-7" :class="confirmToggleUser.status_akun === 'aktif' ? 'text-red-500' : 'text-green-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h3 class="text-lg font-bold text-gray-800">
              {{ confirmToggleUser.status_akun === 'aktif' ? 'Nonaktifkan' : 'Aktifkan' }} Akun?
            </h3>
            <p class="text-sm text-gray-500 mt-1">
              {{ confirmToggleUser.nama }} ({{ confirmToggleUser.email }})
            </p>
          </div>
          <div class="flex gap-3">
            <button @click="confirmToggleUser = null"
              class="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-all active:scale-[0.98]">
              Batal
            </button>
            <button @click="handleToggleStatus"
              class="flex-1 py-3 rounded-xl font-medium transition-all active:scale-[0.98] shadow-sm text-white"
              :class="confirmToggleUser.status_akun === 'aktif' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'">
              {{ confirmToggleUser.status_akun === 'aktif' ? 'Nonaktifkan' : 'Aktifkan' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
