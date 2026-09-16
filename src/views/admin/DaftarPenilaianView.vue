<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { usePenilaian } from '@/composables/usePenilaian'
import { getGrade } from '@/lib/grading'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

const router = useRouter()
const authStore = useAuthStore()
const appStore = useAppStore()
const { loading, asaSettings, penilaianList, getAsaSettings, getAsaActive, getPenilaianBatch } = usePenilaian()

const selectedPeriode = ref('')
const exporting = ref(false)
const allUsers = ref([])
const sortKey = ref('total_nilai')
const sortDir = ref('desc')

const mergedList = computed(() => {
  const penilaianMap = {}
  penilaianList.value.forEach(p => { penilaianMap[p.user_id] = p })

  return allUsers.value.map(u => {
    const p = penilaianMap[u.id]
    return {
      user_id: u.id,
      nama: u.nama,
      nim: u.nim,
      has_penilaian: !!p,
      kehadiran: p?.kehadiran || 0,
      sikap_kedisiplinan: p?.sikap_kedisiplinan || 0,
      keaktifan: p?.keaktifan || 0,
      roadmap: p?.roadmap || 0,
      posttest: p?.posttest || 0,
      amalan_yaumi: p?.amalan_yaumi || 0,
      total_nilai: p?.total_nilai || 0,
      catatan_mentor: p?.catatan_mentor || ''
    }
  }).sort((a, b) => {
    if (!a.has_penilaian && b.has_penilaian) return 1
    if (a.has_penilaian && !b.has_penilaian) return -1
    const aVal = a[sortKey.value] ?? 0
    const bVal = b[sortKey.value] ?? 0
    return sortDir.value === 'desc' ? bVal - aVal : aVal - bVal
  })
})

onMounted(async () => {
  loading.value = true
  await getAsaSettings()
  const active = await getAsaActive()
  if (active) selectedPeriode.value = active.periode
  await loadData()
  loading.value = false
})

async function loadData() {
  if (!selectedPeriode.value) return
  const groupId = authStore.profile?.group_id
  const [penResult, userResult] = await Promise.all([
    getPenilaianBatch(selectedPeriode.value, groupId),
    supabase
      .from('profiles')
      .select('id, nama, nim')
      .eq('group_id', groupId)
      .eq('role', 'user')
      .eq('status_akun', 'aktif')
      .order('nama')
  ])
  allUsers.value = userResult.data || []
}

async function handlePeriodeChange() {
  await loadData()
}

function toggleSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortKey.value = key
    sortDir.value = 'desc'
  }
}

function gradeColor(grade) {
  if (grade === 'A') return 'text-emerald-600 bg-emerald-50'
  if (grade === 'B') return 'text-blue-600 bg-blue-50'
  if (grade === 'C') return 'text-amber-600 bg-amber-50'
  return 'text-red-600 bg-red-50'
}

function exportPDF() {
  exporting.value = true
  try {
    const doc = new jsPDF('l', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.getWidth()

    doc.setFontSize(16)
    doc.setTextColor(22, 163, 74)
    doc.text('Laporan Penilaian ASA', pageWidth / 2, 20, { align: 'center' })

    doc.setFontSize(10)
    doc.setTextColor(107, 114, 128)
    doc.text(`Periode: ${selectedPeriode.value}`, pageWidth / 2, 28, { align: 'center' })

    const rows = mergedList.value.map((p, i) => {
      if (!p.has_penilaian) return [i + 1, p.nama || '-', p.nim || '-', '-', '-', '-', '-', '-', '-', '-', '-', 'Belum']
      const g = getGrade(p.total_nilai)
      return [
        i + 1, p.nama || '-', p.nim || '-',
        `${p.kehadiran}%`, `${p.sikap_kedisiplinan}`, `${p.keaktifan}`,
        `${p.roadmap}`, `${p.posttest}`, `${p.amalan_yaumi}%`,
        `${p.total_nilai}`, g.grade, g.label
      ]
    })

    doc.autoTable({
      startY: 34,
      head: [['No', 'Nama', 'NIM', 'Kehadiran', 'Sikap', 'Aktif', 'Roadmap', 'Posttest', 'Amalan', 'Total', 'Grade', 'Ket.']],
      body: rows,
      headStyles: { fillColor: [22, 163, 74], fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [240, 253, 244] }
    })

    doc.save(`penilaian-asa-${selectedPeriode.value}.pdf`)
  } catch (e) {
    console.error('Export error:', e)
    appStore.showToast('Gagal export PDF', 'error')
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-xl font-bold text-gray-900">Daftar Penilaian ASA</h1>
        <p class="text-sm text-gray-500 mt-1">Rekap penilaian anggota</p>
      </div>
      <button
        v-if="mergedList.length > 0"
        @click="exportPDF"
        :disabled="exporting"
        class="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-medium hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center gap-1.5"
      >
        <svg v-if="exporting" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Export PDF
      </button>
    </div>

    <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
      <label class="block text-sm font-medium text-gray-700 mb-2">Periode</label>
      <select
        v-model="selectedPeriode"
        @change="handlePeriodeChange"
        class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
      >
        <option value="">-- Pilih Periode --</option>
        <option v-for="s in asaSettings" :key="s.id" :value="s.periode">
          {{ s.periode }} {{ s.is_active ? '(Aktif)' : '' }}
        </option>
      </select>
    </div>

    <div class="flex items-center justify-between mb-3">
      <p class="text-sm text-gray-500">
        {{ mergedList.length }} anggota · {{ mergedList.filter(i => i.has_penilaian).length }} dinilai
      </p>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-500">
      <svg class="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span>Memuat data...</span>
    </div>

    <div v-else-if="mergedList.length === 0" class="text-center py-12 bg-white rounded-xl border border-gray-100 shadow-sm">
      <p class="text-sm text-gray-500">Tidak ada anggota di kelompok ini.</p>
    </div>

    <div v-else class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-emerald-600 text-white text-left">
              <th class="px-3 py-2.5 text-[10px] font-bold w-8">No</th>
              <th class="px-3 py-2.5 text-[10px] font-bold">Nama</th>
              <th class="px-3 py-2.5 text-[10px] font-bold">NIM</th>
              <th class="px-3 py-2.5 text-[10px] font-bold cursor-pointer" @click="toggleSort('kehadiran')">
                Kehadiran
                <span v-if="sortKey === 'kehadiran'" class="ml-0.5">{{ sortDir === 'desc' ? '↓' : '↑' }}</span>
              </th>
              <th class="px-3 py-2.5 text-[10px] font-bold cursor-pointer" @click="toggleSort('sikap_kedisiplinan')">
                Sikap
                <span v-if="sortKey === 'sikap_kedisiplinan'" class="ml-0.5">{{ sortDir === 'desc' ? '↓' : '↑' }}</span>
              </th>
              <th class="px-3 py-2.5 text-[10px] font-bold cursor-pointer" @click="toggleSort('amalan_yaumi')">
                Amalan
                <span v-if="sortKey === 'amalan_yaumi'" class="ml-0.5">{{ sortDir === 'desc' ? '↓' : '↑' }}</span>
              </th>
              <th class="px-3 py-2.5 text-[10px] font-bold cursor-pointer" @click="toggleSort('total_nilai')">
                Total
                <span v-if="sortKey === 'total_nilai'" class="ml-0.5">{{ sortDir === 'desc' ? '↓' : '↑' }}</span>
              </th>
              <th class="px-3 py-2.5 text-[10px] font-bold">Grade</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(p, i) in mergedList"
              :key="p.user_id"
              @click="router.push(`/penilaian/tambah/${p.user_id}`)"
              class="border-t border-gray-100 cursor-pointer hover:bg-emerald-50 transition-colors"
              :class="i % 2 === 0 ? 'bg-white' : 'bg-gray-50'"
            >
              <td class="px-3 py-2.5 text-gray-500">{{ i + 1 }}</td>
              <td class="px-3 py-2.5 font-medium text-gray-800">{{ p.nama }}</td>
              <td class="px-3 py-2.5 text-gray-500">{{ p.nim || '-' }}</td>
              <td class="px-3 py-2.5 text-gray-700">
                <span v-if="p.has_penilaian">{{ p.kehadiran }}%</span>
                <span v-else class="text-gray-300">-</span>
              </td>
              <td class="px-3 py-2.5 text-gray-700">
                <span v-if="p.has_penilaian">{{ p.sikap_kedisiplinan }}</span>
                <span v-else class="text-gray-300">-</span>
              </td>
              <td class="px-3 py-2.5 text-gray-700">
                <span v-if="p.has_penilaian">{{ p.amalan_yaumi }}%</span>
                <span v-else class="text-gray-300">-</span>
              </td>
              <td class="px-3 py-2.5 font-bold text-gray-800">
                <span v-if="p.has_penilaian">{{ p.total_nilai }}</span>
                <span v-else class="text-gray-300">-</span>
              </td>
              <td class="px-3 py-2.5">
                <span v-if="p.has_penilaian" class="px-2 py-0.5 rounded-full text-xs font-bold" :class="gradeColor(getGrade(p.total_nilai).grade)">
                  {{ getGrade(p.total_nilai).grade }}
                </span>
                <span v-else class="px-2 py-0.5 rounded-full text-xs font-medium text-gray-400 bg-gray-100">
                  Belum
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
