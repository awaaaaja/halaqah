<script setup>
import { useAuthStore } from '@/stores/authStore'

const authStore = useAuthStore()
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-6">
    <div class="w-full max-w-sm text-center animate-fade-in">
      <div class="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-5">
        <svg class="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 class="text-xl font-bold text-gray-800 mb-2">Akun Sedang Ditinjau</h1>
      <p class="text-sm text-gray-500 mb-6 leading-relaxed">
        Pendaftaran berhasil! Akun Anda masih menunggu persetujuan dari Super Admin.
        Silakan coba login kembali setelah akun Anda diaktifkan.
      </p>
      <router-link to="/login"
        class="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-all active:scale-95 shadow-md">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Kembali ke Login
      </router-link>
    </div>
  </div>
</template>
