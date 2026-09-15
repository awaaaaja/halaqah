<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

const nim = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    await authStore.login(nim.value, password.value)
    const role = authStore.profile?.role
    const status = authStore.profile?.status_akun
    if (status === 'pending') return router.push('/pending')
    const redirectMap = { user: '/qr-saya', admin: '/beranda', super_admin: '/dashboard' }
    router.push(redirectMap[role] || '/')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-6">
    <!-- Brand -->
    <div class="mb-8 text-center animate-fade-in">
      <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-600/20">
        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 class="text-2xl font-bold text-brand-900 font-serif">Absensi Liqa</h1>
      <p class="text-sm text-gray-500 mt-1">Aplikasi Absensi Berbasis QR Code</p>
    </div>

    <!-- Form -->
    <div class="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 animate-slide-up">
      <h2 class="text-lg font-bold text-gray-800 mb-5">Masuk</h2>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">NIM</label>
          <input v-model="nim" type="text" required placeholder="Masukkan NIM"
            class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all bg-gray-50/50 text-sm" />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
          <input v-model="password" type="password" required placeholder="Masukkan password"
            class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all bg-gray-50/50 text-sm" />
        </div>

        <p v-if="error" class="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-3">{{ error }}</p>

        <button type="submit" :disabled="loading"
          class="w-full py-3 px-4 bg-brand-700 text-white rounded-xl font-semibold hover:bg-brand-800 transition-all active:scale-[0.98] disabled:opacity-50 shadow-md shadow-brand-700/20 flex items-center justify-center gap-2">
          <svg v-if="loading" class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>{{ loading ? 'Memuat...' : 'Masuk' }}</span>
        </button>
      </form>

      <div class="mt-6 pt-4 border-t border-gray-100 text-center">
        <p class="text-sm text-gray-500">
          Belum punya akun?
          <router-link to="/register" class="text-brand-700 font-semibold hover:text-brand-800 transition-colors">Daftar</router-link>
        </p>
      </div>
    </div>
  </div>
</template>
