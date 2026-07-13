<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuranStore } from '@/stores/quranStore'
import { useQuran } from '@/composables/useQuran'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const quranStore = useQuranStore()
const { getAllBookmarks } = useQuran()
const authStore = useAuthStore()

const loading = ref(true)
const search = ref('')
const bookmarkedSuras = ref(new Set())

const filteredSuras = computed(() => {
  if (!search.value.trim()) return quranStore.daftarSurat
  const q = search.value.trim().toLowerCase()
  return quranStore.daftarSurat.filter(s => {
    const matchNama = s.namaLatin?.toLowerCase().includes(q)
    const matchNomor = String(s.nomor).includes(q)
    return matchNama || matchNomor
  })
})

function isBookmarked(nomor) {
  return bookmarkedSuras.value.has(Number(nomor))
}

function goToSurat(nomor) {
  router.push(`/quran/${nomor}`)
}

onMounted(async () => {
  try {
    await quranStore.fetchDaftarSurat()
    if (authStore.user?.id) {
      const bm = await getAllBookmarks(authStore.user.id)
      if (bm?.length) {
        bookmarkedSuras.value = new Set(bm.map(b => b.surat_nomor))
      }
    }
  } catch {
    // silently fail
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="pb-4 animate-fade-in">
    <!-- Header -->
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-600 p-5 mb-5 text-white shadow-lg">
      <div class="absolute inset-0 opacity-10">
        <svg class="w-full h-full" viewBox="0 0 200 100" fill="none">
          <path d="M20 50 Q 50 20 80 50 T 140 50 T 200 50" stroke="white" stroke-width="0.5" fill="none" opacity="0.3"/>
          <circle cx="30" cy="20" r="2" fill="white" opacity="0.2"/>
          <circle cx="150" cy="15" r="1.5" fill="white" opacity="0.15"/>
          <circle cx="100" cy="85" r="1" fill="white" opacity="0.2"/>
        </svg>
      </div>
      <div class="relative">
        <p class="text-emerald-200 text-sm font-arabic mb-0.5">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم</p>
        <h1 class="text-2xl font-bold font-serif">Al-Qur'an</h1>
        <p class="text-emerald-100 text-sm mt-1">{{ quranStore.daftarSurat.length || '—' }} Surat</p>
      </div>
    </div>

    <!-- Search -->
    <div class="relative mb-5">
      <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
      </svg>
      <input v-model="search" placeholder="Cari surat (nama atau nomor)..." type="search"
        class="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent shadow-sm" />
    </div>

    <!-- Skeleton Loading -->
    <template v-if="loading">
      <div class="space-y-3">
        <div v-for="i in 10" :key="i" class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-pulse">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-full bg-gray-200 shrink-0"></div>
            <div class="flex-1 min-w-0">
              <div class="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div class="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
            <div class="h-3 bg-gray-200 rounded w-16"></div>
          </div>
        </div>
      </div>
    </template>

    <!-- Surat List -->
    <template v-else>
      <div v-if="filteredSuras.length === 0" class="text-center py-12 text-gray-500">
        <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
        </svg>
        <p class="font-medium">Surat tidak ditemukan</p>
        <p class="text-sm mt-1">Coba kata kunci lain</p>
      </div>

      <div class="space-y-2">
        <div v-for="s in filteredSuras" :key="s.nomor"
          @click="goToSurat(s.nomor)"
          class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 active:scale-[0.99] transition-transform cursor-pointer hover:border-brand-200">
          <!-- Number Badge -->
          <div class="relative w-10 h-10 shrink-0 flex items-center justify-center">
            <svg class="absolute inset-0 w-full h-full" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="19" fill="currentColor" class="text-brand-100"/>
              <circle cx="20" cy="20" r="19" stroke="currentColor" class="text-brand-200" stroke-width="0.5"/>
            </svg>
            <span class="relative text-xs font-bold text-brand-700">{{ String(s.nomor).padStart(3, '0') }}</span>
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="font-arabic text-xl leading-none text-gray-900">{{ s.nama }}</h3>
              <svg v-if="isBookmarked(s.nomor)" class="w-4 h-4 text-gold-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 2h14a1 1 0 011 1v19.143a.5.5 0 01-.766.424L12 18.03l-7.234 4.536A.5.5 0 014 22.143V3a1 1 0 011-1z"/>
              </svg>
            </div>
            <p class="text-sm font-medium text-gray-700 mt-0.5">{{ s.namaLatin }}</p>
            <p class="text-xs text-gray-500 mt-0.5">{{ s.arti }} · {{ s.jumlahAyat }} ayat · {{ s.tempatTurun }}</p>
          </div>

          <!-- Chevron -->
          <svg class="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </div>
      </div>
    </template>
  </div>
</template>
