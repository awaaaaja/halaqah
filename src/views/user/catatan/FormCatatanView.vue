<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { useCatatan } from '@/composables/useCatatan'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const appStore = useAppStore()
const { detailCatatan, loading, fetchOne, create, update } = useCatatan()

const isEdit = computed(() => route.name === 'EditCatatan')

const form = ref({
  tanggal: new Date().toISOString().split('T')[0],
  lokasi: '',
  pemateri: '',
  materi: '',
  isi_catatan: '',
  tags: ''
})

const submitting = ref(false)
const errors = ref({})

function validate() {
  const errs = {}
  if (!form.value.materi.trim()) errs.materi = 'Materi wajib diisi'
  if (!form.value.isi_catatan.trim()) errs.isi_catatan = 'Isi catatan wajib diisi'
  errors.value = errs
  return Object.keys(errs).length === 0
}

function buildPayload() {
  const tagsArr = form.value.tags
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
  return {
    user_id: authStore.user.id,
    tanggal: form.value.tanggal,
    lokasi: form.value.lokasi || null,
    pemateri: form.value.pemateri || null,
    materi: form.value.materi.trim(),
    isi_catatan: form.value.isi_catatan.trim(),
    tags: tagsArr.length > 0 ? tagsArr : []
  }
}

async function handleSubmit() {
  if (!validate()) return
  submitting.value = true
  try {
    if (isEdit.value) {
      await update(route.params.id, buildPayload())
      appStore.showToast('Catatan diperbarui')
      router.replace('/catatan/' + route.params.id)
    } else {
      const data = await create(buildPayload())
      appStore.showToast('Catatan berhasil dibuat')
      router.replace('/catatan/' + data.id)
    }
  } catch (e) {
    appStore.showToast(e.message, 'error')
  } finally {
    submitting.value = false
  }
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.replace('/catatan')
  }
}

onMounted(async () => {
  if (isEdit.value) {
    try {
      await fetchOne(route.params.id)
      if (detailCatatan.value) {
        form.value = {
          tanggal: detailCatatan.value.tanggal || '',
          lokasi: detailCatatan.value.lokasi || '',
          pemateri: detailCatatan.value.pemateri || '',
          materi: detailCatatan.value.materi || '',
          isi_catatan: detailCatatan.value.isi_catatan || '',
          tags: (detailCatatan.value.tags || []).join(', ')
        }
      } else {
        appStore.showToast('Catatan tidak ditemukan', 'error')
        router.replace('/catatan')
      }
    } catch (e) {
      appStore.showToast('Gagal memuat catatan', 'error')
      router.replace('/catatan')
    }
  }
})
</script>

<template>
  <div class="pb-6">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-5">
      <button @click="goBack" class="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors">
        <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>
      <h1 class="text-lg font-bold text-emerald-900">{{ isEdit ? 'Edit Catatan' : 'Catatan Baru' }}</h1>
    </div>

    <!-- Loading (edit mode) -->
    <div v-if="isEdit && loading" class="text-center py-16">
      <svg class="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      <p class="text-sm text-gray-500">Memuat data...</p>
    </div>

    <template v-else>
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div class="space-y-4">
          <!-- Tanggal -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Tanggal <span class="text-red-500">*</span></label>
            <input v-model="form.tanggal" type="date"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm" />
          </div>

          <!-- Lokasi -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Lokasi</label>
            <input v-model="form.lokasi" placeholder="Misal: Masjid Al-Ikhlas" maxlength="100"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm" />
          </div>

          <!-- Materi -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Materi <span class="text-red-500">*</span></label>
            <input v-model="form.materi" placeholder="Judul materi liqa" maxlength="200"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              :class="{ 'border-red-400': errors.materi }" />
            <p v-if="errors.materi" class="text-xs text-red-500 mt-1">{{ errors.materi }}</p>
          </div>

          <!-- Pemateri -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Pemateri <span class="text-gray-400">(opsional)</span></label>
            <input v-model="form.pemateri" placeholder="Nama pemateri" maxlength="100"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm" />
          </div>

          <!-- Isi Catatan -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Isi Catatan <span class="text-red-500">*</span></label>
            <textarea v-model="form.isi_catatan" rows="8" placeholder="Tulis catatan materi liqa di sini..."
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm resize-y min-h-[160px]"
              :class="{ 'border-red-400': errors.isi_catatan }"></textarea>
            <p v-if="errors.isi_catatan" class="text-xs text-red-500 mt-1">{{ errors.isi_catatan }}</p>
          </div>

          <!-- Tags -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Tags <span class="text-gray-400">(pisahkan dengan koma)</span></label>
            <input v-model="form.tags" placeholder="Misal: tafsir, fiqih, adab" maxlength="500"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm" />
            <p v-if="form.tags" class="text-xs text-gray-400 mt-1.5">
              Tag: <span v-for="t in form.tags.split(',').map(s => s.trim()).filter(Boolean)" :key="t" class="inline-block bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[11px] font-medium mr-1 mb-1">#{{ t }}</span>
            </p>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex gap-3 mt-6">
          <button @click="goBack"
            class="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-all">
            Batal
          </button>
          <button @click="handleSubmit" :disabled="submitting"
            class="flex-1 py-3 bg-emerald-700 text-white rounded-xl font-medium hover:bg-emerald-800 disabled:opacity-50 transition-all shadow-sm">
            <svg v-if="submitting" class="w-4 h-4 animate-spin inline mr-1.5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            {{ submitting ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan Catatan' }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
