<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-brand-50 via-white to-white flex items-center justify-center p-6">
    <div class="text-center max-w-sm">
      <div class="w-16 h-16 mx-auto rounded-2xl bg-brand-600 text-white flex items-center justify-center shadow-brand-glow mb-6">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
      </div>
      <p class="font-serif text-6xl font-bold text-brand-700 leading-none mb-2">404</p>
      <h1 class="text-xl font-semibold text-gray-800 mb-2">Halaman tidak ditemukan</h1>
      <p class="text-sm text-gray-500 mb-6">
        Halaman yang kamu cari tidak ada atau telah dipindahkan.
      </p>
      <button
        @click="router.back()"
        class="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-all mr-2"
      >
        Kembali
      </button>
      <button
        @click="router.push('/')"
        class="px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 active:scale-95 transition-all shadow-brand-glow"
      >
        Ke Beranda
      </button>
    </div>
  </div>
</template>
