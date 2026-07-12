<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'

const authStore = useAuthStore()
const appStore = useAppStore()
const profile = ref({ nama: '', email: '', no_hp: '' })
const saving = ref(false)

onMounted(() => {
  if (authStore.profile) {
    profile.value = {
      nama: authStore.profile.nama || '',
      email: authStore.profile.email || '',
      no_hp: authStore.profile.no_hp || ''
    }
  }
})

async function handleSave() {
  saving.value = true
  try {
    await authStore.updateProfile({ nama: profile.value.nama, no_hp: profile.value.no_hp })
    appStore.showToast('Profil diperbarui')
  } catch (e) {
    appStore.showToast(e.message, 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-emerald-900 mb-1">Pengaturan</h1>
    <p class="text-sm text-gray-500 mb-6">Profil dan pengaturan akun</p>

    <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6 max-w-md">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
          <input v-model="profile.nama" maxlength="100"
            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input :value="profile.email" disabled
            class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed" />
          <p class="text-xs text-gray-400 mt-1">Email tidak dapat diubah</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">No. HP</label>
          <input v-model="profile.no_hp" type="tel" maxlength="20"
            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <button @click="handleSave" :disabled="saving"
          class="w-full py-3 bg-emerald-700 text-white rounded-xl font-medium hover:bg-emerald-800 disabled:opacity-50 transition-colors">
          {{ saving ? 'Menyimpan...' : 'Simpan Perubahan' }}
        </button>
      </div>
    </div>
  </div>
</template>
