<script setup>
import { computed } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import QRCard from '@/components/qr/QRCard.vue'

const authStore = useAuthStore()
const profile = computed(() => authStore.profile)

const namaKelompok = computed(() => {
  return profile.value?.nama_kelompok || '-'
})
</script>

<template>
  <div class="flex flex-col items-center">
    <h1 class="text-xl font-bold text-emerald-900 mb-1">Kartu Saya</h1>
    <p class="text-sm text-gray-500 mb-6">Tunjukkan QR ini ke Murabbi saat absen</p>

    <div v-if="!profile" class="text-center py-8 text-gray-500">
      Memuat data...
    </div>

    <QRCard
      v-else
      :qr-token="profile.qr_token"
      :nama="profile.nama"
      :nim="profile.nim"
      :prodi="profile.prodi"
      :kelas="profile.kelas"
      :nama-kelompok="namaKelompok"
    />

    <div class="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg max-w-sm text-sm text-amber-800">
      <div class="flex items-center gap-2 mb-1"><svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg><span class="font-medium text-amber-800">Tips</span></div>
      <p>Simpan kartu ini di galeri HP atau cetak untuk memudahkan scan absen setiap sesi liqa.</p>
    </div>
  </div>
</template>
