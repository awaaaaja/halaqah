<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

const form = ref({
  nama: '',
  email: '',
  password: '',
  confirmPassword: '',
  nim: '',
  prodi: '',
  kelas: '',
  angkatan: '',
  no_hp: ''
})
const error = ref('')
const loading = ref(false)

async function handleRegister() {
  error.value = ''
  if (form.value.password !== form.value.confirmPassword) {
    error.value = 'Password tidak cocok'
    return
  }
  loading.value = true
  try {
    await authStore.register({
      email: form.value.email,
      password: form.value.password,
      nama: form.value.nama
    })

    if (authStore.user) {
      await authStore.updateProfile({
        nim: form.value.nim,
        prodi: form.value.prodi,
        kelas: form.value.kelas,
        angkatan: form.value.angkatan,
        no_hp: form.value.no_hp
      })
    }

    router.push('/pending')
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
    <div class="mb-6 text-center animate-fade-in">
      <h1 class="text-2xl font-bold text-brand-900 font-serif">Daftar Akun</h1>
      <p class="text-sm text-gray-500 mt-1">Isi data diri untuk mendaftar</p>
    </div>

    <!-- Form -->
    <div class="w-full max-w-sm bg-white rounded-2xl shadow-xl shadow-gray-200/50 p-6 animate-slide-up">
      <form @submit.prevent="handleRegister" class="space-y-3.5">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
          <input v-model="form.nama" type="text" required placeholder="Nama lengkap"
            class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all bg-gray-50/50 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">NIM</label>
          <input v-model="form.nim" type="text" required placeholder="Nomor Induk Mahasiswa"
            class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all bg-gray-50/50 text-sm" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Prodi</label>
            <input v-model="form.prodi" type="text" required placeholder="Prodi"
              class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all bg-gray-50/50 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
            <input v-model="form.kelas" type="text" required placeholder="Kelas"
              class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all bg-gray-50/50 text-sm" />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Angkatan</label>
          <input v-model="form.angkatan" type="text" required placeholder="Contoh: 2021"
            class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all bg-gray-50/50 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input v-model="form.email" type="email" required placeholder="contoh@email.com"
            class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all bg-gray-50/50 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">No. HP</label>
          <input v-model="form.no_hp" type="tel" placeholder="08xxx"
            class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all bg-gray-50/50 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input v-model="form.password" type="password" required placeholder="Minimal 6 karakter"
            class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all bg-gray-50/50 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password</label>
          <input v-model="form.confirmPassword" type="password" required placeholder="Ulangi password"
            class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all bg-gray-50/50 text-sm" />
        </div>

        <p v-if="error" class="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-3">{{ error }}</p>

        <button type="submit" :disabled="loading"
          class="w-full py-3 px-4 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-all active:scale-[0.98] disabled:opacity-50 shadow-md shadow-brand-600/20 flex items-center justify-center gap-2">
          <svg v-if="loading" class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>{{ loading ? 'Memuat...' : 'Daftar' }}</span>
        </button>
      </form>

      <div class="mt-6 pt-4 border-t border-gray-100 text-center">
        <p class="text-sm text-gray-500">
          Sudah punya akun?
          <router-link to="/login" class="text-brand-600 font-semibold hover:text-brand-700 transition-colors">Masuk</router-link>
        </p>
      </div>
    </div>
  </div>
</template>
