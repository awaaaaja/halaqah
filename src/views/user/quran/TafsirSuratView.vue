<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuran } from '@/composables/useQuran'
import { useQuranStore } from '@/stores/quranStore'

const route = useRoute()
const router = useRouter()
const { tafsirSurat, loading, error, fetchTafsirSurat } = useQuran()
const quranStore = useQuranStore()

const nomor = computed(() => Number(route.params.nomor))

const suratInfo = computed(() => quranStore.getSurat(nomor.value))

onMounted(() => {
  quranStore.fetchDaftarSurat()
})

watch(nomor, (val) => {
  if (val) fetchTafsirSurat(val)
}, { immediate: true })
</script>

<template>
  <div class="pb-6 animate-fade-in">
    <!-- Tab Navigation -->
    <div class="flex bg-white rounded-xl border border-gray-100 shadow-sm p-1 mb-5">
      <button @click="router.push(`/quran/${nomor}`)"
        class="flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors text-gray-500 hover:text-gray-700">
        Baca
      </button>
      <button disabled
        class="flex-1 py-2.5 text-sm font-medium rounded-lg bg-brand-600 text-white shadow-sm">
        Tafsir
      </button>
    </div>

    <!-- Loading Skeleton -->
    <template v-if="loading">
      <div class="animate-pulse space-y-3">
        <div v-for="i in 6" :key="i" class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-8 h-8 rounded-full bg-gray-200"></div>
            <div class="h-4 bg-gray-200 rounded w-1/4"></div>
          </div>
          <div class="space-y-2">
            <div class="h-3 bg-gray-200 rounded w-full"></div>
            <div class="h-3 bg-gray-200 rounded w-5/6"></div>
            <div class="h-3 bg-gray-200 rounded w-4/6"></div>
            <div class="h-3 bg-gray-200 rounded w-3/6"></div>
          </div>
        </div>
      </div>
    </template>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-12 text-red-500">
      <svg class="w-12 h-12 mx-auto mb-3 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
      </svg>
      <p class="font-medium">Gagal memuat tafsir</p>
      <p class="text-sm mt-1">{{ error }}</p>
    </div>

    <template v-else>
      <!-- Surat Info Mini -->
      <div v-if="suratInfo" class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-600 p-5 mb-5 text-white shadow-lg text-center">
        <div class="absolute inset-0 opacity-10">
          <svg class="w-full h-full" viewBox="0 0 200 100" fill="none">
            <path d="M20 50 Q 50 20 80 50 T 140 50 T 200 50" stroke="white" stroke-width="0.5" fill="none" opacity="0.3"/>
          </svg>
        </div>
        <div class="relative">
          <h2 class="font-arabic text-2xl mb-1">{{ suratInfo.nama }}</h2>
          <h3 class="text-lg font-bold font-serif">{{ suratInfo.namaLatin }}</h3>
          <p class="text-emerald-200 text-sm mt-1">Tafsir Surat</p>
        </div>
      </div>

      <!-- Tafsir List -->
      <div v-if="tafsirSurat?.tafsir?.length" class="space-y-3">
        <div v-for="t in tafsirSurat.tafsir" :key="t.ayat"
          class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-slide-up">
          <div class="flex items-center gap-2 mb-3">
            <span class="relative w-8 h-8 flex items-center justify-center shrink-0">
              <svg class="absolute inset-0 w-full h-full" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="15" fill="currentColor" class="text-emerald-100"/>
                <circle cx="16" cy="16" r="15" stroke="currentColor" class="text-emerald-200" stroke-width="0.5"/>
              </svg>
              <span class="relative text-[11px] font-bold font-arabic text-emerald-700">Ayat {{ t.ayat }}</span>
            </span>
          </div>
          <p class="text-sm text-gray-700 leading-relaxed text-justify">{{ t.teks }}</p>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-12 text-gray-500">
        <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
        </svg>
        <p class="font-medium">Tafsir tidak tersedia</p>
      </div>
    </template>
  </div>
</template>
