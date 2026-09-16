<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { usePenilaian } from '@/composables/usePenilaian'
import { getGrade, PENILAIAN_COMPONENTS } from '@/lib/grading'

const authStore = useAuthStore()
const appStore = useAppStore()
const { asaSettings, getAsaSettings, getPenilaian } = usePenilaian()

const selectedPeriode = ref('')
const penilaianData = ref(null)
const loading = ref(true)

const gradeResult = computed(() => {
  if (!penilaianData.value) return { grade: '-', label: '-' }
  return getGrade(penilaianData.value.total_nilai || 0)
})

function gradeColor(grade) {
  if (grade === 'A') return 'text-emerald-600 bg-emerald-50 border-emerald-200'
  if (grade === 'B') return 'text-blue-600 bg-blue-50 border-blue-200'
  if (grade === 'C') return 'text-amber-600 bg-amber-50 border-amber-200'
  return 'text-red-600 bg-red-50 border-red-200'
}

function progressColor(score) {
  if (score >= 90) return 'bg-emerald-500'
  if (score >= 80) return 'bg-blue-500'
  if (score >= 70) return 'bg-amber-500'
  return 'bg-red-500'
}

onMounted(async () => {
  loading.value = true
  await getAsaSettings()
  if (asaSettings.value.length > 0) {
    selectedPeriode.value = asaSettings.value[0].periode
    await loadPenilaian()
  }
  loading.value = false
})

async function loadPenilaian() {
  if (!selectedPeriode.value || !authStore.profile?.id) return
  penilaianData.value = await getPenilaian(authStore.profile.id, selectedPeriode.value)
}

async function handlePeriodeChange() {
  await loadPenilaian()
}
</script>

<template>
  <div>
    <div class="mb-5">
      <h1 class="text-xl font-bold text-gray-900">Riwayat Penilaian ASA</h1>
      <p class="text-sm text-gray-500 mt-1">Lihat nilai penilaian Anda</p>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-500">
      <svg class="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span>Memuat data...</span>
    </div>

    <template v-else>
      <div v-if="asaSettings.length > 1" class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">Periode</label>
        <select
          v-model="selectedPeriode"
          @change="handlePeriodeChange"
          class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
        >
          <option v-for="s in asaSettings" :key="s.id" :value="s.periode">
            {{ s.periode }}
          </option>
        </select>
      </div>

      <div v-if="!penilaianData" class="text-center py-12 bg-white rounded-xl border border-gray-100 shadow-sm">
        <div class="flex justify-center mb-4">
          <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
        </div>
        <h3 class="text-lg font-medium text-gray-700">Belum Ada Penilaian</h3>
        <p class="text-sm text-gray-500 mt-1">Penilaian Anda untuk periode ini belum tersedia.</p>
      </div>

      <template v-else>
        <div class="bg-white rounded-xl border-2 shadow-sm p-6 mb-5 text-center"
          :class="gradeColor(gradeResult.grade)">
          <p class="text-sm font-medium opacity-75 mb-1">Total Nilai</p>
          <p class="text-5xl font-bold mb-2">{{ penilaianData.total_nilai }}</p>
          <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/60">
            <span class="text-2xl font-bold">{{ gradeResult.grade }}</span>
            <span class="text-sm font-medium">{{ gradeResult.label }}</span>
          </div>
        </div>

        <div class="space-y-3">
          <div
            v-for="comp in PENILAIAN_COMPONENTS"
            :key="comp.key"
            class="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
          >
            <div class="flex items-center justify-between mb-2">
              <div>
                <p class="font-medium text-gray-800">{{ comp.label }}</p>
                <p class="text-xs text-gray-400">Bobot {{ comp.bobot }}%{{ comp.auto ? ' · Otomatis' : '' }}</p>
              </div>
              <p class="text-xl font-bold text-gray-800">
                {{ penilaianData[comp.key] || 0 }}
              </p>
            </div>
            <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="progressColor(penilaianData[comp.key] || 0)"
                :style="{ width: (penilaianData[comp.key] || 0) + '%' }"
              ></div>
            </div>
          </div>
        </div>

        <div v-if="penilaianData.catatan_mentor" class="mt-4 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p class="text-sm font-medium text-gray-700 mb-1">Catatan Mentor</p>
          <p class="text-sm text-gray-600 italic">{{ penilaianData.catatan_mentor }}</p>
        </div>
      </template>
    </template>
  </div>
</template>
