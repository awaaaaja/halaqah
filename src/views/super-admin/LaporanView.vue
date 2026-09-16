<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/stores/appStore'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const appStore = useAppStore()

const groups = ref([])
const allData = ref([])
const loading = ref(true)

const dateStart = ref(new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
const dateEnd = ref(new Date().toISOString().split('T')[0])
const filterGroup = ref('')
const filterStatus = ref('')

const summary = computed(() => {
  const d = filteredData.value
  const totalHadir = d.reduce((s, i) => s + i.hadir, 0)
  const totalIzin = d.reduce((s, i) => s + i.izin, 0)
  const totalAlpa = d.reduce((s, i) => s + i.alpa, 0)
  const grand = totalHadir + totalIzin + totalAlpa
  return { totalSesi: d.length, totalHadir, totalIzin, totalAlpa, grand, rate: grand ? Math.round(totalHadir / grand * 100) : 0 }
})

const filteredData = computed(() => {
  let d = allData.value
  if (filterGroup.value) d = d.filter(i => i.group_id === filterGroup.value)
  if (filterStatus.value) {
    d = d
      .filter(i => i.anggota.some(a => a.status === filterStatus.value))
      .map(i => {
        const anggota = i.anggota.filter(a => a.status === filterStatus.value)
        const hadir = anggota.filter(a => a.status === 'hadir').length
        const izin = anggota.filter(a => a.status === 'izin').length
        const alpa = anggota.filter(a => a.status === 'alpa').length
        return { ...i, anggota, hadir, izin, alpa, total: anggota.length }
      })
  }
  return d
})

async function loadData() {
  if (dateStart.value > dateEnd.value) {
    appStore.showToast('Tanggal mulai harus sebelum tanggal akhir', 'warning')
    return
  }
  loading.value = true
  const { data: g } = await supabase.from('groups').select('id, nama_kelompok').order('nama_kelompok')
  groups.value = g || []

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, tanggal, judul_materi, is_open, group_id, created_by, groups!inner(nama_kelompok), dibuka_at, ditutup_at, profiles!sessions_created_by_fkey(nama)')
    .gte('tanggal', dateStart.value)
    .lte('tanggal', dateEnd.value)
    .order('tanggal', { ascending: false })

  if (!sessions || sessions.length === 0) { allData.value = []; loading.value = false; return }

  const sessionIds = sessions.map(s => s.id)
  const { data: atts } = await supabase
    .from('attendances')
    .select('session_id, user_id, status, waktu_absen, profiles!attendances_user_id_fkey(nama, nim)')
    .in('session_id', sessionIds)

  const attMap = {}
  ;(atts || []).forEach(a => {
    if (!attMap[a.session_id]) attMap[a.session_id] = []
    attMap[a.session_id].push(a)
  })

  allData.value = sessions.map(s => {
    const list = attMap[s.id] || []
    const hadir = list.filter(a => a.status === 'hadir').length
    const izin = list.filter(a => a.status === 'izin').length
    const alpa = list.filter(a => a.status === 'alpa').length
    return {
      id: s.id,
      tanggal: s.tanggal,
      judul_materi: s.judul_materi || '-',
      group_id: s.group_id,
      nama_kelompok: s.groups?.nama_kelompok || '-',
      is_open: s.is_open,
      dibuka_at: s.dibuka_at,
      ditutup_at: s.ditutup_at,
      created_by: s.created_by,
      murabbi: s.profiles?.nama || '-',
      hadir, izin, alpa, total: list.length,
      anggota: list.map(a => ({
        nama: a.profiles?.nama || '-',
        nim: a.profiles?.nim || '-',
        status: a.status,
        waktu: a.waktu_absen
      }))
    }
  })

  loading.value = false
}

function exportExcel() {
  const rows = filteredData.value.flatMap(s => {
    if (s.anggota.length === 0) {
      return [{ Tanggal: s.tanggal, Kelompok: s.nama_kelompok, Materi: s.judul_materi, Murabbi: s.murabbi, Nama: '-', NIM: '-', Status: '-', Waktu: '-' }]
    }
    return s.anggota.map(a => ({
      Tanggal: s.tanggal,
      Kelompok: s.nama_kelompok,
      Materi: s.judul_materi,
      Murabbi: s.murabbi,
      Nama: a.nama,
      NIM: a.nim,
      Status: a.status,
      Waktu: new Date(a.waktu).toLocaleString('id-ID')
    }))
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Laporan Absensi')
  XLSX.writeFile(wb, `Laporan_Absensi_${dateStart.value}_${dateEnd.value}.xlsx`)
  appStore.showToast('Excel diunduh')
}

function exportPdf() {
  const doc = new jsPDF('l', 'mm', 'a4')
  doc.setFontSize(14)
  doc.text('Laporan Absensi Liqa', 14, 20)
  doc.setFontSize(10)
  doc.text(`Periode: ${dateStart.value} s/d ${dateEnd.value}`, 14, 28)

  const rows = filteredData.value.flatMap(s =>
    s.anggota.length === 0
      ? [[s.tanggal, s.nama_kelompok, s.judul_materi, s.murabbi, '-', '-', '-', '-']]
      : s.anggota.map(a => [s.tanggal, s.nama_kelompok, s.judul_materi, s.murabbi, a.nama, a.nim, a.status, new Date(a.waktu).toLocaleString('id-ID')])
  )

  autoTable(doc, {
    startY: 34,
    head: [['Tanggal', 'Kelompok', 'Materi', 'Murabbi', 'Nama', 'NIM', 'Status', 'Waktu']],
    body: rows,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [4, 120, 87], textColor: 255 }
  })

  doc.save(`Laporan_Absensi_${dateStart.value}_${dateEnd.value}.pdf`)
  appStore.showToast('PDF diunduh')
}

onMounted(loadData)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <div>
        <h1 class="text-xl font-bold text-emerald-900">Laporan</h1>
        <p class="text-sm text-gray-500">Rekap kehadiran liqa</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label class="text-xs font-medium text-gray-600">Dari Tanggal</label>
          <input type="date" v-model="dateStart"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600">Sampai Tanggal</label>
          <input type="date" v-model="dateEnd"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600">Kelompok</label>
          <select v-model="filterGroup" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">Semua</option>
            <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.nama_kelompok }}</option>
          </select>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600">Status</label>
          <select v-model="filterStatus" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">Semua</option>
            <option value="hadir">Hadir</option>
            <option value="izin">Izin</option>
            <option value="alpa">Alpa</option>
          </select>
        </div>
        <div class="flex items-end gap-2">
          <button @click="loadData"
            class="flex-1 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800">
            Cari
          </button>
        </div>
      </div>
    </div>

    <!-- Summary -->
    <div v-if="!loading" class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
      <div class="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
        <p class="text-lg font-bold text-emerald-700">{{ summary.totalSesi }}</p>
        <p class="text-xs text-gray-500">Total Sesi</p>
      </div>
      <div class="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
        <p class="text-lg font-bold text-emerald-700">{{ summary.grand }}</p>
        <p class="text-xs text-gray-500">Total Absen</p>
      </div>
      <div class="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
        <p class="text-lg font-bold text-green-600">{{ summary.totalHadir }}</p>
        <p class="text-xs text-gray-500">Hadir</p>
      </div>
      <div class="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
        <p class="text-lg font-bold text-yellow-600">{{ summary.totalIzin }}</p>
        <p class="text-xs text-gray-500">Izin</p>
      </div>
      <div class="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
        <p class="text-lg font-bold text-red-600">{{ summary.totalAlpa }}</p>
        <p class="text-xs text-gray-500">Alpa</p>
      </div>
    </div>

    <!-- Export -->
    <div v-if="filteredData.length > 0" class="flex gap-3 mb-4">
      <button @click="exportExcel"
        class="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 flex items-center gap-2">
        Export Excel
      </button>
      <button @click="exportPdf"
        class="px-4 py-2 border border-emerald-700 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-50 flex items-center gap-2">
        Export PDF
      </button>
    </div>

    <!-- Table -->
    <div v-if="loading" class="text-center py-8 text-gray-500">Memuat...</div>

    <div v-else-if="filteredData.length === 0" class="text-center py-12 text-gray-500">
      Tidak ada data untuk periode ini.
    </div>

    <div v-else class="space-y-3">
      <div v-for="s in filteredData" :key="s.id"
        class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div class="px-4 py-3 bg-gray-50 flex items-center justify-between">
          <div>
            <p class="font-medium text-gray-800">{{ s.tanggal }} — {{ s.nama_kelompok }}</p>
            <p class="text-sm text-gray-500">{{ s.judul_materi }}</p>
            <p class="text-xs text-gray-400">Dibuka oleh: {{ s.murabbi }}</p>
          </div>
          <div class="text-right text-sm">
            <span class="text-green-600 font-medium">{{ s.hadir }} H</span>
            <span class="text-yellow-600 font-medium mx-2">{{ s.izin }} I</span>
            <span class="text-red-600 font-medium">{{ s.alpa }} A</span>
          </div>
        </div>

        <!-- Detail anggota per sesi collapsed -->
        <details class="border-t border-gray-100">
          <summary class="px-4 py-2 text-xs text-emerald-700 font-medium cursor-pointer hover:bg-gray-50">
            Lihat anggota ({{ s.anggota.length }})
          </summary>
          <div v-if="s.anggota.length === 0" class="px-4 py-3 text-sm text-gray-500">
            Belum ada absen
          </div>
          <table v-else class="w-full text-sm">
            <thead>
              <tr class="border-t bg-gray-50 text-xs text-gray-500">
                <th class="text-left px-4 py-2">Nama</th>
                <th class="text-left px-4 py-2">NIM</th>
                <th class="text-center px-4 py-2">Status</th>
                <th class="text-right px-4 py-2">Waktu</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in s.anggota" :key="a.nama" class="border-t border-gray-50">
                <td class="px-4 py-2">{{ a.nama }}</td>
                <td class="px-4 py-2 text-gray-500">{{ a.nim }}</td>
                <td class="text-center px-4 py-2">
                  <span :class="{
                    'text-green-600 bg-green-50': a.status === 'hadir',
                    'text-yellow-600 bg-yellow-50': a.status === 'izin',
                    'text-red-600 bg-red-50': a.status === 'alpa'
                  }" class="px-2 py-0.5 rounded-full text-xs font-medium">
                    {{ a.status }}
                  </span>
                </td>
                <td class="text-right px-4 py-2 text-gray-400 text-xs">{{ new Date(a.waktu).toLocaleString('id-ID') }}</td>
              </tr>
            </tbody>
          </table>
        </details>
      </div>
    </div>
  </div>
</template>
