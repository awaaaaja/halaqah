<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuran } from '@/composables/useQuran'
import { useAuthStore } from '@/stores/authStore'

const route = useRoute()
const router = useRouter()
const { detailSurat, loading, error, fetchDetailSurat, getBookmark, saveBookmark } = useQuran()
const authStore = useAuthStore()

const nomor = computed(() => Number(route.params.nomor))

const selectedQari = ref('')
const availableQari = ref([])
const isPlaying = ref(false)
const currentAudio = ref(null)
const playingAyat = ref(null)
const bookmark = ref(null)
const bookmarkLoading = ref(false)
const ayatRefs = ref({})

const qariLabels = {
  qari01: 'Abdurrahman As-Sudais',
  qari02: 'Mishary Rashid Al-Afasy',
  qari03: 'Saad Al-Ghamidi',
  qari04: 'Abdul Basit Abdus Samad',
  qari05: 'Al-Husary',
}

function qariLabel(key) {
  return qariLabels[key] || key
}

function getQariKeys() {
  if (!detailSurat.value?.ayat?.length) return []
  const first = detailSurat.value.ayat[0]
  return first?.audio ? Object.keys(first.audio) : []
}

function playAyat(ayat) {
  if (!ayat.audio?.[selectedQari.value]) return
  stopAudio()
  playingAyat.value = ayat.nomorAyat
  const audio = new Audio(ayat.audio[selectedQari.value])
  currentAudio.value = audio
  audio.play()
  isPlaying.value = true
  audio.addEventListener('ended', () => {
    isPlaying.value = false
    playingAyat.value = null
    currentAudio.value = null
  })
}

function playFullSura() {
  if (!detailSurat.value?.audio?.[selectedQari.value]) return
  stopAudio()
  playingAyat.value = 'full'
  const audio = new Audio(detailSurat.value.audio[selectedQari.value])
  currentAudio.value = audio
  audio.play()
  isPlaying.value = true
  audio.addEventListener('ended', () => {
    isPlaying.value = false
    playingAyat.value = null
    currentAudio.value = null
  })
}

function stopAudio() {
  if (currentAudio.value) {
    currentAudio.value.pause()
    currentAudio.value = null
  }
  isPlaying.value = false
  playingAyat.value = null
}

function togglePlayPause() {
  if (!currentAudio.value) {
    playFullSura()
    return
  }
  if (isPlaying.value) {
    currentAudio.value.pause()
    isPlaying.value = false
  } else {
    currentAudio.value.play()
    isPlaying.value = true
  }
}

async function loadBookmark() {
  if (!authStore.user?.id) return
  bookmark.value = await getBookmark(authStore.user.id, nomor.value)
}

async function handleSaveBookmark() {
  if (!authStore.user?.id) return
  bookmarkLoading.value = true
  try {
    const scrollAyat = findCurrentAyat()
    const bm = await saveBookmark(authStore.user.id, nomor.value, scrollAyat)
    bookmark.value = bm
  } catch {
    // silent
  } finally {
    bookmarkLoading.value = false
  }
}

function findCurrentAyat() {
  if (!detailSurat.value?.ayat?.length) return 1
  const mid = Math.floor(window.innerHeight / 2)
  let closest = 1
  let closestDist = Infinity
  for (const a of detailSurat.value.ayat) {
    const el = ayatRefs.value[a.nomorAyat]
    if (el) {
      const rect = el.getBoundingClientRect()
      const dist = Math.abs(rect.top - mid)
      if (dist < closestDist) {
        closestDist = dist
        closest = a.nomorAyat
      }
    }
  }
  return closest
}

function scrollToAyat(nomorAyat) {
  const el = ayatRefs.value[nomorAyat]
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

function goToTafsir() {
  router.push(`/quran/${nomor.value}/tafsir`)
}

watch(selectedQari, () => {
  stopAudio()
})

watch(nomor, (newVal) => {
  if (newVal) {
    fetchDetailSurat(newVal)
    loadBookmark()
    stopAudio()
    availableQari.value = []
  }
}, { immediate: true })

watch(detailSurat, (val) => {
  if (val?.ayat?.length) {
    availableQari.value = getQariKeys()
    if (availableQari.value.length > 0 && !selectedQari.value) {
      selectedQari.value = availableQari.value[0]
    }
    nextTick(() => {
      if (bookmark.value?.ayat_nomor) {
        scrollToAyat(bookmark.value.ayat_nomor)
      }
    })
  }
})
</script>

<template>
  <div class="pb-6 animate-fade-in">
    <!-- Loading Skeleton -->
    <template v-if="loading">
      <div class="animate-pulse space-y-4">
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div class="h-8 bg-gray-200 rounded w-1/2 mb-3 mx-auto"></div>
          <div class="h-5 bg-gray-200 rounded w-2/3 mb-2 mx-auto"></div>
          <div class="h-4 bg-gray-200 rounded w-1/3 mx-auto"></div>
        </div>
        <div class="space-y-3">
          <div v-for="i in 8" :key="i" class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 rounded-full bg-gray-200 shrink-0"></div>
              <div class="flex-1">
                <div class="h-16 bg-gray-200 rounded w-full mb-3"></div>
                <div class="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-12 text-red-500">
      <svg class="w-12 h-12 mx-auto mb-3 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
      </svg>
      <p class="font-medium">Gagal memuat surat</p>
      <p class="text-sm mt-1">{{ error }}</p>
      <button @click="fetchDetailSurat(route.params.nomor)" class="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
        Coba Lagi
      </button>
    </div>

    <template v-else-if="detailSurat">
      <!-- Header Card -->
      <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-600 p-5 mb-5 text-white shadow-lg text-center">
        <div class="absolute inset-0 opacity-10">
          <svg class="w-full h-full" viewBox="0 0 200 100" fill="none">
            <path d="M20 50 Q 50 20 80 50 T 140 50 T 200 50" stroke="white" stroke-width="0.5" fill="none" opacity="0.3"/>
            <circle cx="30" cy="20" r="2" fill="white" opacity="0.2"/>
            <circle cx="150" cy="15" r="1.5" fill="white" opacity="0.15"/>
            <circle cx="100" cy="85" r="1" fill="white" opacity="0.2"/>
          </svg>
        </div>
        <div class="relative">
          <p class="text-emerald-200 text-sm mb-2">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم</p>
          <h2 class="font-arabic text-3xl leading-relaxed mb-1">{{ detailSurat.nama }}</h2>
          <h1 class="text-xl font-bold font-serif">{{ detailSurat.namaLatin }}</h1>
          <p class="text-emerald-100 text-sm mt-2">{{ detailSurat.arti }}</p>
          <div class="flex items-center justify-center gap-3 mt-3 text-xs text-emerald-200">
            <span>Surat ke-{{ detailSurat.nomor }}</span>
            <span>·</span>
            <span>{{ detailSurat.jumlahAyat }} Ayat</span>
            <span>·</span>
            <span>{{ detailSurat.tempatTurun }}</span>
          </div>
        </div>
      </div>

      <!-- Audio Player -->
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
        <div class="flex items-center gap-3 mb-3">
          <button @click="togglePlayPause"
            class="w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center shrink-0 hover:bg-brand-700 transition-colors shadow-sm">
            <svg v-if="isPlaying" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
            <svg v-else class="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-700">
              {{ isPlaying ? 'Memutar...' : 'Putar Audio' }}
            </p>
            <p v-if="playingAyat === 'full'" class="text-xs text-gray-500">Seluruh surat</p>
            <p v-else-if="playingAyat" class="text-xs text-gray-500">Ayat {{ playingAyat }}</p>
          </div>
          <select v-model="selectedQari"
            class="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-500 max-w-[140px]">
            <option v-for="q in availableQari" :key="q" :value="q">{{ qariLabel(q) }}</option>
          </select>
        </div>
      </div>

      <!-- Bookmark Button -->
      <button @click="handleSaveBookmark" :disabled="bookmarkLoading"
        class="w-full mb-5 py-2.5 rounded-xl border-2 border-dashed font-medium text-sm transition-colors flex items-center justify-center gap-2"
        :class="bookmark
          ? 'border-gold-400 bg-gold-50 text-gold-700'
          : 'border-gray-200 text-gray-500 hover:border-brand-300 hover:text-brand-600'">
        <svg class="w-4 h-4" :fill="bookmark ? 'currentColor' : 'none'" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M5 2h14a1 1 0 011 1v19.143a.5.5 0 01-.766.424L12 18.03l-7.234 4.536A.5.5 0 014 22.143V3a1 1 0 011-1z" stroke-width="1.5"/>
        </svg>
        {{ bookmarkLoading ? 'Menyimpan...' : bookmark ? `Bookmark Ayat ${bookmark.ayat_nomor}` : 'Simpan Bookmark' }}
      </button>

      <!-- Ayat List -->
      <div class="space-y-4">
        <div v-for="a in detailSurat.ayat" :key="a.nomorAyat"
          :ref="el => { ayatRefs[a.nomorAyat] = el }"
          :id="'ayat-' + a.nomorAyat"
          class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-slide-up"
          :class="{ 'ring-2 ring-gold-400 bg-gold-50/30': bookmark?.ayat_nomor === a.nomorAyat }">

          <div class="flex items-center justify-between mb-3">
            <span class="relative w-8 h-8 flex items-center justify-center">
              <svg class="absolute inset-0 w-full h-full" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="15" fill="currentColor" class="text-brand-100"/>
                <circle cx="16" cy="16" r="15" stroke="currentColor" class="text-brand-200" stroke-width="0.5"/>
              </svg>
              <span class="relative text-[11px] font-bold text-brand-700 font-arabic">{{ a.nomorAyat }}</span>
            </span>
            <button @click="playAyat(a)" v-if="a.audio?.[selectedQari]"
              class="text-gray-400 hover:text-brand-600 transition-colors p-1"
              :class="{ 'text-brand-600': playingAyat === a.nomorAyat }">
              <svg v-if="playingAyat === a.nomorAyat && isPlaying" class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
              </svg>
              <svg v-else class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
          </div>

          <p class="font-arabic text-right text-2xl md:text-3xl leading-[2.2] text-gray-900 mb-3" dir="rtl">
            {{ a.teksArab }}
          </p>

          <p class="text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
            {{ a.teksIndonesia }}
          </p>
        </div>
      </div>
    </template>
  </div>
</template>
