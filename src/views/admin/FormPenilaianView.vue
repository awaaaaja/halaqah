<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { usePenilaian } from '@/composables/usePenilaian'
import { getGrade } from '@/lib/grading'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const appStore = useAppStore()
const { getAsaActive, getPenilaian, upsertPenilaian, calculateAuto } = usePenilaian()

const adminGroupId = computed(() => authStore.profile?.group_id)
const users = ref([])
const selectedUserId = ref(route.params.userId || '')
const asaActive = ref(null)
const loading = ref(true)
const saving = ref(false)
const calculating = ref(false)

const form = ref({
  sikap_kedisiplinan: 0,
  keaktifan: 0,
  roadmap: 0,
  posttest: 0,
  catatan_mentor: ''
})

const kehadiran = ref(0)
const amalanYaumi = ref(0)
const totalNilai = ref(0)
const gradeResult = ref({ grade: 'D', label: 'Perlu Perbaikan' })
const isEditing = ref(false)

const selectedUser = computed(() => users.value.find(u => u.id === selectedUserId.value))

onMounted(async () => {
  loading.value = true
  try {
    asaActive.value = await getAsaActive()
    if (!asaActive.value) {
      appStore.showToast('Tidak ada periode ASA aktif', 'error')
      loading.value = false
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, nama, nim, groups(nama_kelompok)')
      .eq('group_id', adminGroupId.value)
      .eq('role', 'user')
      .eq('status_akun', 'aktif')
      .order('nama')
    users.value = data || []

    if (selectedUserId.value) {
      await loadExisting()
    }
  } finally {
    loading.value = false
  }
})

async function loadExisting() {
  if (!selectedUserId.value || !asaActive.value) return
  const data = await getPenilaian(selectedUserId.value, asaActive.value.periode)
  if (data) {
    isEditing.value = true
    form.value = {
      sikap_kedisiplinan: data.sikap_kedisiplinan || 0,
      keaktifan: data.keaktifan || 0,
      roadmap: data.roadmap || 0,
      posttest: data.posttest || 0,
      catatan_mentor: data.catatan_mentor || ''
    }
    kehadiran.value = data.kehadiran || 0
    amalanYaumi.value = data.amalan_yaumi || 0
    totalNilai.value = data.total_nilai || 0
    gradeResult.value = getGrade(data.total_nilai || 0)
  } else {
    isEditing.value = false
    form.value = { sikap_kedisiplinan: 0, keaktifan: 0, roadmap: 0, posttest: 0, catatan_mentor: '' }
    kehadiran.value = 0
    amalanYaumi.value = 0
    totalNilai.value = 0
    gradeResult.value = { grade: 'D', label: 'Perlu Perbaikan' }
  }
}

async function handleSelectUser() {
  await loadExisting()
}

async function handleCalculate() {
  if (!selectedUserId.value || !asaActive.value) {
    appStore.showToast('Pilih anggota terlebih dahulu', 'error')
    return
  }
  calculating.value = true
  try {
    await calculateAuto(selectedUserId.value, asaActive.value.periode)
    const data = await getPenilaian(selectedUserId.value, asaActive.value.periode)
    if (data) {
      kehadiran.value = data.kehadiran || 0
      amalanYaumi.value = data.amalan_yaumi || 0
      totalNilai.value = data.total_nilai || 0
      gradeResult.value = getGrade(data.total_nilai || 0)
    }
    appStore.showToast('Kehadiran (per sesi) & Amalan Yaumi dihitung')
  } catch (e) {
    appStore.showToast(e.message, 'error')
  } finally {
    calculating.value = false
  }
}

async function handleSave() {
  if (!selectedUserId.value || !asaActive.value) {
    appStore.showToast('Pilih anggota terlebih dahulu', 'error')
    return
  }
  saving.value = true
  try {
    await upsertPenilaian({
      user_id: selectedUserId.value,
      periode: asaActive.value.periode,
      ...form.value
    })
    await handleCalculate()
    appStore.showToast(isEditing.value ? 'Penilaian diperbarui' : 'Penilaian disimpan')
  } catch (e) {
    appStore.showToast(e.message, 'error')
  } finally {
    saving.value = false
  }
}

function gradeColor(grade) {
  if (grade === 'A') return 'text-emerald-600 bg-emerald-50 border-emerald-200'
  if (grade === 'B') return 'text-blue-600 bg-blue-50 border-blue-200'
  if (grade === 'C') return 'text-amber-600 bg-amber-50 border-amber-200'
  return 'text-red-600 bg-red-50 border-red-200'
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-xl font-bold text-gray-900">{{ isEditing ? 'Edit Penilaian' : 'Form Penilaian ASA' }}</h1>
        <p class="text-sm text-gray-500 mt-1">
          {{ asaActive ? asaActive.periode : 'Memuat...' }}
        </p>
      </div>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-500">
      <svg class="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span>Memuat data...</span>
    </div>

    <div v-else-if="!asaActive" class="text-center py-12 bg-white rounded-xl border border-gray-100 shadow-sm">
      <div class="flex justify-center mb-4">
        <div class="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
          <svg class="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>
      <h3 class="text-lg font-medium text-gray-700">Tidak Ada Periode ASA Aktif</h3>
      <p class="text-sm text-gray-500 mt-1">Hubungi Super Admin untuk mengatur periode ASA.</p>
    </div>

    <template v-else>
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">Pilih Anggota</label>
        <select
          v-model="selectedUserId"
          @change="handleSelectUser"
          class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
        >
          <option value="">-- Pilih Anggota --</option>
          <option v-for="u in users" :key="u.id" :value="u.id">
            {{ u.nama }} ({{ u.nim || '-' }})
          </option>
        </select>
      </div>

      <div v-if="selectedUser" class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
            {{ (selectedUser.nama || '?')[0] }}
          </div>
          <div>
            <p class="font-medium text-gray-900">{{ selectedUser.nama }}</p>
            <p class="text-xs text-gray-500">{{ selectedUser.nim || '-' }} · {{ selectedUser.groups?.nama_kelompok || '-' }}</p>
          </div>
        </div>
      </div>

      <div v-if="selectedUserId" class="space-y-4">
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 class="text-sm font-bold text-gray-700 mb-3">Input Mentor</h3>
          <div class="space-y-4">
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-sm font-medium text-gray-600">Sikap & Kedisiplinan</label>
                <span class="text-sm font-bold text-emerald-600">{{ form.sikap_kedisiplinan }}</span>
              </div>
              <input type="range" v-model.number="form.sikap_kedisiplinan" min="0" max="100"
                class="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-emerald-600" />
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-sm font-medium text-gray-600">Keaktifan</label>
                <span class="text-sm font-bold text-emerald-600">{{ form.keaktifan }}</span>
              </div>
              <input type="range" v-model.number="form.keaktifan" min="0" max="100"
                class="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-emerald-600" />
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-sm font-medium text-gray-600">Refleksi & Roadmap</label>
                <span class="text-sm font-bold text-emerald-600">{{ form.roadmap }}</span>
              </div>
              <input type="range" v-model.number="form.roadmap" min="0" max="100"
                class="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-emerald-600" />
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-sm font-medium text-gray-600">Posttest</label>
                <span class="text-sm font-bold text-emerald-600">{{ form.posttest }}</span>
              </div>
              <input type="range" v-model.number="form.posttest" min="0" max="100"
                class="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-emerald-600" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-600 mb-1">Catatan Mentor</label>
              <textarea v-model="form.catatan_mentor" rows="3"
                class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                placeholder="Catatan untuk anggota..."></textarea>
            </div>
          </div>
        </div>

        <div class="flex gap-3">
          <button
            @click="handleCalculate"
            :disabled="calculating"
            class="flex-1 py-3 border-2 border-emerald-200 text-emerald-700 rounded-xl font-medium hover:bg-emerald-50 transition-all disabled:opacity-50 text-sm"
          >
            {{ calculating ? 'Menghitung...' : 'Hitung Otomatis' }}
          </button>
          <button
            @click="handleSave"
            :disabled="saving"
            class="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-all disabled:opacity-50 text-sm"
          >
            {{ saving ? 'Menyimpan...' : 'Simpan' }}
          </button>
        </div>

        <div v-if="totalNilai > 0 || kehadiran > 0 || amalanYaumi > 0"
          class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 class="text-sm font-bold text-gray-700 mb-3">Preview Nilai</h3>
          <div class="grid grid-cols-2 gap-3 mb-3">
            <div class="bg-gray-50 rounded-xl p-3 text-center">
              <p class="text-lg font-bold text-gray-800">{{ kehadiran }}%</p>
              <p class="text-[10px] text-gray-500">Kehadiran Sesi (10%)</p>
            </div>
            <div class="bg-gray-50 rounded-xl p-3 text-center">
              <p class="text-lg font-bold text-gray-800">{{ amalanYaumi }}%</p>
              <p class="text-[10px] text-gray-500">Amalan Yaumi (20%)</p>
            </div>
          </div>
          <div class="flex items-center justify-between p-3 rounded-xl border-2"
            :class="gradeColor(gradeResult.grade)">
            <div>
              <p class="text-xs font-medium opacity-75">Total Nilai</p>
              <p class="text-2xl font-bold">{{ totalNilai }}</p>
            </div>
            <div class="text-center">
              <p class="text-xs font-medium opacity-75">Grade</p>
              <p class="text-3xl font-bold">{{ gradeResult.grade }}</p>
            </div>
            <div class="text-right">
              <p class="text-xs font-medium opacity-75">Keterangan</p>
              <p class="text-sm font-bold">{{ gradeResult.label }}</p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
