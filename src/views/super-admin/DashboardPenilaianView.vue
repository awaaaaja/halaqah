<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/stores/appStore'
import { usePenilaian } from '@/composables/usePenilaian'
import { getGrade } from '@/lib/grading'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

const router = useRouter()
const appStore = useAppStore()
const { loading, asaSettings, penilaianList, getAsaSettings, getAsaActive, getPenilaianBatch } = usePenilaian()

const selectedPeriode = ref('')
const filterGroup = ref('')
const exporting = ref(false)
const allUsers = ref([])

const gradeDistribution = computed(() => {
  const dist = { A: 0, B: 0, C: 0, D: 0, belum: 0 }
  mergedList.value.forEach(item => {
    if (!item.has_penilaian) { dist.belum++; return }
    const g = getGrade(item.total_nilai)
    dist[g.grade]++
  })
  return dist
})

const averageScore = computed(() => {
  const graded = mergedList.value.filter(i => i.has_penilaian)
  if (graded.length === 0) return 0
  const sum = graded.reduce((acc, p) => acc + (p.total_nilai || 0), 0)
  return Math.round((sum / graded.length) * 10) / 10
})

const uniqueGroups = computed(() => {
  const groups = [...new Set(mergedList.value.map(p => p.nama_kelompok).filter(Boolean))]
  return groups.sort()
})

const mergedList = computed(() => {
  const penilaianMap = {}
  penilaianList.value.forEach(p => { penilaianMap[p.user_id] = p })

  return allUsers.value.map(u => {
    const p = penilaianMap[u.id]
    return {
      user_id: u.id,
      nama: u.nama,
      nim: u.nim,
      nama_kelompok: u.groups?.nama_kelompok || '-',
      has_penilaian: !!p,
      kehadiran: p?.kehadiran || 0,
      sikap_kedisiplinan: p?.sikap_kedisiplinan || 0,
      keaktifan: p?.keaktifan || 0,
      roadmap: p?.roadmap || 0,
      posttest: p?.posttest || 0,
      amalan_yaumi: p?.amalan_yaumi || 0,
      total_nilai: p?.total_nilai || 0,
      catatan_mentor: p?.catatan_mentor || '',
      updated_at: p?.updated_at || null
    }
  }).sort((a, b) => {
    if (!a.has_penilaian && b.has_penilaian) return 1
    if (a.has_penilaian && !b.has_penilaian) return -1
    return (b.total_nilai || 0) - (a.total_nilai || 0)
  })
})

const filteredList = computed(() => {
  if (!filterGroup.value) return mergedList.value
  return mergedList.value.filter(p => p.nama_kelompok === filterGroup.value)
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
  const [penResult, userResult] = await Promise.all([
    getPenilaianBatch(selectedPeriode.value),
    supabase
      .from('profiles')
      .select('id, nama, nim, group_id, groups(nama_kelompok)')
      .eq('role', 'user')
      .eq('status_akun', 'aktif')
      .order('nama')
  ])
  allUsers.value = userResult.data || []
}

async function handlePeriodeChange() {
  filterGroup.value = ''
  await loadData()
}

function gradeColor(grade) {
  if (grade === 'A') return 'text-emerald-600 bg-emerald-50'
  if (grade === 'B') return 'text-blue-600 bg-blue-50'
  if (grade === 'C') return 'text-amber-600 bg-amber-50'
  return 'text-red-600 bg-red-50'
}

function gradeBgColor(grade) {
  if (grade === 'A') return 'bg-emerald-500'
  if (grade === 'B') return 'bg-blue-500'
  if (grade === 'C') return 'bg-amber-500'
  return 'bg-red-500'
}

function exportPDF() {
  exporting.value = true
  try {
    const doc = new jsPDF('l', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.getWidth()

    doc.setFontSize(16)
    doc.setTextColor(22, 163, 74)
    doc.text('Ranking Penilaian ASA', pageWidth / 2, 20, { align: 'center' })

    doc.setFontSize(10)
    doc.setTextColor(107, 114, 128)
    doc.text(`Periode: ${selectedPeriode.value} · Rata-rata: ${averageScore} · Total: ${filteredList.value.length} anggota`, pageWidth / 2, 28, { align: 'center' })

    const rows = filteredList.value.map((p, i) => {
      if (!p.has_penilaian) return [i + 1, p.nama || '-', p.nim || '-', p.nama_kelompok, '-', '-', 'Belum dinilai']
      const g = getGrade(p.total_nilai)
      return [i + 1, p.nama || '-', p.nim || '-', p.nama_kelompok, `${p.total_nilai}`, g.grade, g.label]
    })

    doc.autoTable({
      startY: 34,
      head: [['No', 'Nama', 'NIM', 'Kelompok', 'Total', 'Grade', 'Keterangan']],
      body: rows,
      headStyles: { fillColor: [22, 163, 74], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [240, 253, 244] }
    })

    doc.save(`ranking-penilaian-${selectedPeriode.value}.pdf`)
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
        <h1 class="text-xl font-bold text-gray-900">Dashboard Penilaian ASA</h1>
        <p class="text-sm text-gray-500 mt-1">Ranking & distribusi nilai</p>
      </div>
      <button
        v-if="filteredList.length > 0"
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

    <div v-if="loading" class="text-center py-12 text-gray-500">
      <svg class="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span>Memuat data...</span>
    </div>

    <template v-else>
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
        <div class="flex gap-3">
          <select
            v-model="selectedPeriode"
            @change="handlePeriodeChange"
            class="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
          >
            <option value="">-- Pilih Periode --</option>
            <option v-for="s in asaSettings" :key="s.id" :value="s.periode">
              {{ s.periode }} {{ s.is_active ? '(Aktif)' : '' }}
            </option>
          </select>
          <select
            v-model="filterGroup"
            class="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
          >
            <option value="">Semua Kelompok</option>
            <option v-for="g in uniqueGroups" :key="g" :value="g">{{ g }}</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-4 gap-3 mb-5">
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
          <p class="text-2xl font-bold text-emerald-600">{{ mergedList.length }}</p>
          <p class="text-[10px] text-gray-500 mt-0.5">Total Anggota</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
          <p class="text-2xl font-bold text-blue-600">{{ averageScore }}</p>
          <p class="text-[10px] text-gray-500 mt-0.5">Rata-rata</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
          <p class="text-2xl font-bold text-indigo-600">{{ mergedList.filter(i => i.has_penilaian).length }}/{{ mergedList.length }}</p>
          <p class="text-[10px] text-gray-500 mt-0.5">Dinilai</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
          <p class="text-2xl font-bold text-emerald-600">{{ gradeDistribution.A }}</p>
          <p class="text-[10px] text-gray-500 mt-0.5">Grade A</p>
        </div>
      </div>

      <div class="grid grid-cols-4 gap-3 mb-5">
        <div v-for="g in ['A', 'B', 'C', 'D']" :key="g"
          class="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
          <div class="w-3 h-3 rounded-full mx-auto mb-1.5" :class="gradeBgColor(g)"></div>
          <p class="text-lg font-bold text-gray-800">{{ gradeDistribution[g] }}</p>
          <p class="text-[10px] text-gray-500">Grade {{ g }}</p>
        </div>
      </div>

      <div v-if="filteredList.length === 0" class="text-center py-12 bg-white rounded-xl border border-gray-100 shadow-sm">
        <p class="text-sm text-gray-500">Belum ada data anggota.</p>
      </div>

      <div v-else class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-emerald-600 text-white text-left">
                <th class="px-3 py-2.5 text-[10px] font-bold w-10">No</th>
                <th class="px-3 py-2.5 text-[10px] font-bold">Nama</th>
                <th class="px-3 py-2.5 text-[10px] font-bold">NIM</th>
                <th class="px-3 py-2.5 text-[10px] font-bold">Kelompok</th>
                <th class="px-3 py-2.5 text-[10px] font-bold">Total</th>
                <th class="px-3 py-2.5 text-[10px] font-bold">Grade</th>
                <th class="px-3 py-2.5 text-[10px] font-bold">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(p, i) in filteredList"
                :key="p.user_id"
                class="border-t border-gray-100 hover:bg-emerald-50 transition-colors"
                :class="i % 2 === 0 ? 'bg-white' : 'bg-gray-50'"
              >
                <td class="px-3 py-2.5 text-gray-500">{{ i + 1 }}</td>
                <td class="px-3 py-2.5 font-medium text-gray-800">{{ p.nama }}</td>
                <td class="px-3 py-2.5 text-gray-500">{{ p.nim || '-' }}</td>
                <td class="px-3 py-2.5 text-gray-500">{{ p.nama_kelompok }}</td>
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
                <td class="px-3 py-2.5 text-gray-600 text-xs">
                  <span v-if="p.has_penilaian">{{ getGrade(p.total_nilai).label }}</span>
                  <span v-else class="text-gray-400 italic">Belum dinilai</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
