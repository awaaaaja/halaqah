<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { useCatatan } from '@/composables/useCatatan'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const appStore = useAppStore()
const { detailCatatan, loading, fetchOne, remove } = useCatatan()

const showDeleteConfirm = ref(false)
const deleting = ref(false)

function formatTanggal(tgl) {
  if (!tgl) return ''
  return new Date(tgl + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function formatTimestamp(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  return d.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const tagColors = [
  'bg-emerald-100 text-emerald-700',
  'bg-blue-100 text-blue-700',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700',
  'bg-pink-100 text-pink-700',
  'bg-cyan-100 text-cyan-700'
]

function tagColor(index) {
  return tagColors[index % tagColors.length]
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.replace('/catatan')
  }
}

async function handleDelete() {
  deleting.value = true
  try {
    await remove(route.params.id)
    appStore.showToast('Catatan berhasil dihapus')
    router.replace('/catatan')
  } catch (e) {
    appStore.showToast(e.message, 'error')
  } finally {
    deleting.value = false
    showDeleteConfirm.value = false
  }
}

function exportPdf() {
  const note = detailCatatan.value
  if (!note) return

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 20
  let y = margin

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(12, 97, 58)
  doc.text('Catatan Liqa', pageW / 2, y, { align: 'center' })
  y += 10

  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.setFont('helvetica', 'normal')
  doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, pageW / 2, y, { align: 'center' })
  y += 12

  doc.setDrawColor(12, 97, 58)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageW - margin, y)
  y += 8

  const tableBody = [
    ['Tanggal', note.tanggal || '-'],
    ['Lokasi', note.lokasi || '-'],
    ['Materi', note.materi || '-'],
    ['Pemateri', note.pemateri || '-'],
    ['Tags', (note.tags && note.tags.length > 0) ? note.tags.join(', ') : '-'],
  ]

  autoTable(doc, {
    startY: y,
    head: [],
    body: tableBody,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 30, textColor: [12, 97, 58] }, 1: { cellWidth: 'auto' } },
    tableLineColor: [220, 220, 220],
    tableLineWidth: 0.1,
  })

  y = doc.lastAutoTable.finalY + 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(12, 97, 58)
  doc.text('Isi Catatan', margin, y)
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(60)

  const lines = doc.splitTextToSize(note.isi_catatan || '', pageW - margin * 2)
  const lineH = 5
  const pageH = doc.internal.pageSize.getHeight()

  for (const line of lines) {
    if (y + lineH > pageH - margin) {
      doc.addPage()
      y = margin
    }
    doc.text(line, margin, y)
    y += lineH
  }

  doc.save(`Catatan_Liqa_${note.tanggal || 'tanpa-tanggal'}.pdf`)
}

onMounted(async () => {
  try {
    await fetchOne(route.params.id)
  } catch (e) {
    appStore.showToast('Gagal memuat catatan', 'error')
    router.replace('/catatan')
  }
})
</script>

<template>
  <div class="pb-6">
    <!-- Header with Back -->
    <div class="flex items-center gap-3 mb-5">
      <button @click="goBack" class="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors">
        <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>
      <h1 class="text-lg font-bold text-emerald-900">Detail Catatan</h1>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-16">
      <svg class="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      <p class="text-sm text-gray-500">Memuat catatan...</p>
    </div>

    <template v-else-if="detailCatatan">
      <!-- Note Content Card -->
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <!-- Date & Location -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2 text-sm text-gray-500">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <span>{{ formatTanggal(detailCatatan.tanggal) }}</span>
          </div>
          <span v-if="detailCatatan.lokasi" class="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full font-medium">
            {{ detailCatatan.lokasi }}
          </span>
        </div>

        <!-- Materi -->
        <h2 class="text-xl font-bold text-gray-900 mb-1 font-serif">{{ detailCatatan.materi }}</h2>

        <!-- Pemateri -->
        <p v-if="detailCatatan.pemateri" class="text-sm text-gray-500 mb-4">oleh <span class="font-medium text-gray-700">{{ detailCatatan.pemateri }}</span></p>

        <!-- Tags -->
        <div v-if="detailCatatan.tags && detailCatatan.tags.length > 0" class="flex flex-wrap gap-2 mb-5">
          <span v-for="(tag, idx) in detailCatatan.tags" :key="tag"
            class="px-2.5 py-1 rounded-full text-xs font-medium"
            :class="tagColor(idx)">
            #{{ tag }}
          </span>
        </div>

        <!-- Divider -->
        <div class="border-t border-gray-100 mb-4"></div>

        <!-- Isi Catatan -->
        <div class="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{{ detailCatatan.isi_catatan }}</div>
      </div>

      <!-- Timestamps -->
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 text-xs text-gray-400 space-y-1">
        <div class="flex items-center justify-between">
          <span>Dibuat</span>
          <span>{{ formatTimestamp(detailCatatan.created_at) }}</span>
        </div>
        <div class="flex items-center justify-between">
          <span>Terakhir diubah</span>
          <span>{{ formatTimestamp(detailCatatan.updated_at) }}</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="grid grid-cols-3 gap-3">
        <button @click="router.push('/catatan/' + detailCatatan.id + '/edit')"
          class="flex flex-col items-center gap-1 py-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 font-medium hover:bg-emerald-100 active:scale-[0.98] transition-all">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
          <span class="text-xs">Edit</span>
        </button>
        <button @click="exportPdf"
          class="flex flex-col items-center gap-1 py-3.5 bg-purple-50 border border-purple-200 rounded-xl text-purple-700 font-medium hover:bg-purple-100 active:scale-[0.98] transition-all">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
          </svg>
          <span class="text-xs">PDF</span>
        </button>
        <button @click="showDeleteConfirm = true"
          class="flex flex-col items-center gap-1 py-3.5 bg-red-50 border border-red-200 rounded-xl text-red-600 font-medium hover:bg-red-100 active:scale-[0.98] transition-all">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
          <span class="text-xs">Hapus</span>
        </button>
      </div>
    </template>

    <!-- Not Found -->
    <div v-else class="text-center py-16">
      <p class="text-gray-500">Catatan tidak ditemukan</p>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteConfirm" class="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4"
      @click.self="showDeleteConfirm = false">
      <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl animate-slide-up">
        <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <h3 class="text-lg font-bold text-center text-gray-800 mb-2">Hapus Catatan?</h3>
        <p class="text-sm text-gray-500 text-center mb-6">Catatan yang dihapus tidak dapat dikembalikan.</p>
        <div class="flex gap-3">
          <button @click="showDeleteConfirm = false"
            class="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-all">
            Batal
          </button>
          <button @click="handleDelete" :disabled="deleting"
            class="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 transition-all">
            {{ deleting ? 'Menghapus...' : 'Hapus' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
