<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useCatatan } from '@/composables/useCatatan'

const router = useRouter()
const authStore = useAuthStore()
const { daftarCatatan, loading, fetchAll } = useCatatan()

const search = ref('')
const searchActive = ref('')
const selectedTag = ref(null)
const selectedLokasi = ref(null)
const allLokasi = ref([])
const allTags = ref([])
let debounceTimer = null

watch(search, (val) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    searchActive.value = val
    loadData()
  }, 400)
})

function filterByTag(tag) {
  selectedTag.value = selectedTag.value === tag ? null : tag
  loadData()
}

function filterByLokasi(lokasi) {
  selectedLokasi.value = selectedLokasi.value === lokasi ? null : lokasi
  loadData()
}

function clearFilters() {
  search.value = ''
  searchActive.value = ''
  selectedTag.value = null
  selectedLokasi.value = null
  loadData()
}

function isiPreview(text) {
  if (!text) return ''
  return text.length > 100 ? text.substring(0, 100) + '...' : text
}

function formatTanggal(tgl) {
  if (!tgl) return ''
  return new Date(tgl + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

async function loadData() {
  const filters = {}
  if (searchActive.value) filters.search = searchActive.value
  if (selectedTag.value) filters.tag = selectedTag.value
  if (selectedLokasi.value) filters.lokasi = selectedLokasi.value

  await fetchAll(authStore.user.id, filters)

  const uniqueLokasi = [...new Set(daftarCatatan.value.map(n => n.lokasi).filter(Boolean))]
  allLokasi.value = uniqueLokasi.sort()

  const uniqueTags = [...new Set(daftarCatatan.value.flatMap(n => n.tags || []))]
  allTags.value = uniqueTags.sort()
}

const hasActiveFilters = () => searchActive.value || selectedTag.value || selectedLokasi.value

onMounted(loadData)
</script>

<template>
  <div class="pb-20">
    <!-- Header -->
    <h1 class="text-xl font-bold text-emerald-900 mb-1">Catatan Liqa</h1>
    <p class="text-sm text-gray-500 mb-4">Catatan pribadi materi liqa dan tausiyah</p>

    <!-- Search Bar -->
    <div class="relative mb-3">
      <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
      </svg>
      <input v-model="search" placeholder="Cari materi, lokasi, atau isi catatan..."
        class="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm" />
    </div>

    <!-- Filter Chips -->
    <div v-if="allTags.length > 0 || allLokasi.length > 0" class="flex flex-wrap gap-2 mb-4">
      <button v-for="tag in allTags" :key="'t-'+tag" @click="filterByTag(tag)"
        class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
        :class="selectedTag === tag ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'">
        #{{ tag }}
      </button>
      <button v-for="lokasi in allLokasi" :key="'l-'+lokasi" @click="filterByLokasi(lokasi)"
        class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
        :class="selectedLokasi === lokasi ? 'bg-blue-700 text-white' : 'bg-blue-50 text-blue-700 border border-blue-200'">
        {{ lokasi }}
      </button>
      <button v-if="hasActiveFilters()" @click="clearFilters"
        class="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition-colors">
        Hapus filter
      </button>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 4" :key="i" class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-pulse">
        <div class="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
        <div class="h-5 bg-gray-200 rounded w-2/3 mb-2"></div>
        <div class="h-3 bg-gray-100 rounded w-1/4 mb-3"></div>
        <div class="h-3 bg-gray-100 rounded w-full mb-1"></div>
        <div class="h-3 bg-gray-100 rounded w-4/5 mb-3"></div>
        <div class="flex gap-2">
          <div class="h-5 bg-gray-100 rounded-full w-16"></div>
          <div class="h-5 bg-gray-100 rounded-full w-12"></div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="daftarCatatan.length === 0" class="text-center py-16">
      <div class="flex justify-center mb-4">
        <div class="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center">
          <svg class="w-10 h-10 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/>
          </svg>
        </div>
      </div>
      <h3 class="text-lg font-medium text-gray-700 mb-2">Belum Ada Catatan</h3>
      <p class="text-sm text-gray-500 max-w-xs mx-auto">Anda belum membuat catatan liqa. Mulai catat materi tausiyah dan pelajaran berharga!</p>
    </div>

    <!-- Note List -->
    <div v-else class="space-y-3">
      <div v-for="note in daftarCatatan" :key="note.id"
        @click="router.push('/catatan/' + note.id)"
        class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 cursor-pointer hover:shadow-md hover:border-emerald-100 transition-all active:scale-[0.99]">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs text-gray-500">{{ formatTanggal(note.tanggal) }}</span>
          <span v-if="note.lokasi" class="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{{ note.lokasi }}</span>
        </div>
        <h3 class="font-semibold text-gray-800 mb-0.5 leading-snug">{{ note.materi }}</h3>
        <p v-if="note.pemateri" class="text-xs text-gray-500 mb-2">oleh {{ note.pemateri }}</p>
        <p class="text-sm text-gray-600 leading-relaxed mb-3">{{ isiPreview(note.isi_catatan) }}</p>
        <div v-if="note.tags && note.tags.length > 0" class="flex flex-wrap gap-1.5">
          <span v-for="tag in note.tags" :key="tag"
            class="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-medium">
            #{{ tag }}
          </span>
        </div>
      </div>
    </div>

    <!-- FAB -->
    <button @click="router.push('/catatan/tambah')"
      class="fixed bottom-20 right-5 z-40 w-14 h-14 bg-emerald-700 text-white rounded-full shadow-lg shadow-emerald-700/30 hover:bg-emerald-800 active:scale-90 transition-all flex items-center justify-center">
      <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
      </svg>
    </button>
  </div>
</template>
