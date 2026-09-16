<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAppStore } from '@/stores/appStore'
import { usePenilaian } from '@/composables/usePenilaian'

const appStore = useAppStore()
const {
  asaSettings, loading,
  getAsaSettings, createAsaSettings, updateAsaSettings,
  setActiveAsaSettings, deleteAsaSettings
} = usePenilaian()

const showForm = ref(false)
const editing = ref(null)
const saving = ref(false)
const form = ref({ nama_acara: 'Adzkia Spiritual Academy', tahun: new Date().getFullYear() })
const tanggalList = ref([])

const sortedSettings = computed(() =>
  [...asaSettings.value].sort((a, b) => b.tahun - a.tahun)
)

watch(() => form.value.tahun, (val) => {
  if (val && tanggalList.value.length === 0) {
    tanggalList.value = [`${val}-07-10`]
  }
})

onMounted(loadData)

async function loadData() {
  loading.value = true
  await getAsaSettings()
  loading.value = false
}

function openCreate() {
  editing.value = null
  const tahun = new Date().getFullYear()
  form.value = { nama_acara: 'Adzkia Spiritual Academy', tahun }
  tanggalList.value = [`${tahun}-07-10`]
  showForm.value = true
}

function openEdit(item) {
  editing.value = item
  form.value = {
    nama_acara: item.nama_acara,
    tahun: item.tahun
  }
  tanggalList.value = [...(item.tanggal || [])]
  showForm.value = true
}

function addDate() {
  const tahun = form.value.tahun || new Date().getFullYear()
  tanggalList.value.push(`${tahun}-07-10`)
}

function removeDate(idx) {
  tanggalList.value.splice(idx, 1)
}

async function handleSave() {
  if (tanggalList.value.length === 0) {
    appStore.showToast('Minimal 1 tanggal harus diisi', 'error')
    return
  }
  saving.value = true
  try {
    const periode = `ASA-${form.value.tahun}`
    const payload = {
      periode,
      nama_acara: form.value.nama_acara,
      tahun: form.value.tahun,
      tanggal: tanggalList.value
    }
    if (editing.value) {
      await updateAsaSettings(editing.value.id, payload)
      appStore.showToast('Pengaturan ASA diperbarui')
    } else {
      await createAsaSettings(payload)
      appStore.showToast('Periode ASA baru dibuat')
    }
    showForm.value = false
    await loadData()
  } catch (e) {
    appStore.showToast(e.message, 'error')
  } finally {
    saving.value = false
  }
}

async function handleSetActive(id) {
  try {
    await setActiveAsaSettings(id)
    appStore.showToast('Periode aktif diperbarui')
    await loadData()
  } catch (e) {
    appStore.showToast(e.message, 'error')
  }
}

async function handleDelete(item) {
  if (!confirm(`Hapus periode ${item.periode}?`)) return
  try {
    await deleteAsaSettings(item.id)
    appStore.showToast('Periode dihapus')
    await loadData()
  } catch (e) {
    appStore.showToast(e.message, 'error')
  }
}

function formatDateArray(arr) {
  if (!arr || arr.length === 0) return '-'
  return arr.map(d => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })).join(' & ')
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-xl font-bold text-gray-900">Pengaturan ASA</h1>
        <p class="text-sm text-gray-500 mt-1">Konfigurasi tanggal pelaksanaan Adzkia Spiritual Academy</p>
      </div>
      <button
        @click="openCreate"
        class="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-all flex items-center gap-1.5"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Tambah
      </button>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-500">
      <svg class="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span>Memuat data...</span>
    </div>

    <div v-else-if="sortedSettings.length === 0" class="text-center py-12 bg-white rounded-xl border border-gray-100 shadow-sm">
      <div class="flex justify-center mb-4">
        <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
          <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
      <h3 class="text-lg font-medium text-gray-700">Belum Ada Periode ASA</h3>
      <p class="text-sm text-gray-500 mt-1">Klik "Tambah" untuk membuat periode baru.</p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="item in sortedSettings"
        :key="item.id"
        class="bg-white rounded-xl border shadow-sm p-4"
        :class="item.is_active ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-gray-100'"
      >
        <div class="flex items-start justify-between mb-2">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-bold text-gray-900">{{ item.periode }}</h3>
              <span
                v-if="item.is_active"
                class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold border border-emerald-200"
              >
                AKTIF
              </span>
            </div>
            <p class="text-sm text-gray-500">{{ item.nama_acara }}</p>
          </div>
          <div class="flex items-center gap-1.5">
            <button
              v-if="!item.is_active"
              @click="handleSetActive(item.id)"
              class="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-all"
            >
              Aktifkan
            </button>
            <button
              @click="openEdit(item)"
              class="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              @click="handleDelete(item)"
              class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
        <div class="flex items-center gap-2 text-sm text-gray-600">
          <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{{ formatDateArray(item.tanggal) }}</span>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showForm"
        class="fixed inset-0 bg-black/40 z-[999] flex items-end md:items-center justify-center p-4 animate-fade-in"
        @click.self="showForm = false">
        <div class="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-slide-up max-h-[85vh] overflow-y-auto">
          <h3 class="text-lg font-bold text-gray-800 mb-4">
            {{ editing ? 'Edit Periode ASA' : 'Tambah Periode ASA' }}
          </h3>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Nama Acara</label>
              <input v-model="form.nama_acara"
                class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Tahun</label>
              <select v-model.number="form.tahun"
                class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option v-for="y in [2024,2025,2026,2027,2028,2029,2030]" :key="y" :value="y">{{ y }}</option>
              </select>
            </div>
            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="text-sm font-medium text-gray-700">Tanggal Pelaksanaan</label>
                <button @click="addDate"
                  class="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Tambah Tanggal
                </button>
              </div>
              <div class="space-y-2">
                <div v-for="(tgl, idx) in tanggalList" :key="idx" class="flex items-center gap-2">
                  <input
                    type="date"
                    :value="tgl"
                    @input="tanggalList[idx] = $event.target.value"
                    class="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  />
                  <button
                    v-if="tanggalList.length > 1"
                    @click="removeDate(idx)"
                    class="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shrink-0"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              <p class="text-xs text-gray-400 mt-2">Pilih tanggal pelaksanaan ASA. Bisa lebih dari 1 hari.</p>
            </div>
          </div>
          <div class="flex gap-3 mt-6">
            <button @click="showForm = false"
              class="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-all">
              Batal
            </button>
            <button @click="handleSave" :disabled="saving"
              class="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-all disabled:opacity-50">
              {{ saving ? 'Menyimpan...' : 'Simpan' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
