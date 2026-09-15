<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'

const authStore = useAuthStore()
const appStore = useAppStore()

const profile = ref({ nama: '', email: '', nim: '', prodi: '', kelas: '', angkatan: '', no_hp: '' })
const saving = ref(false)
const showPasswordForm = ref(false)
const passwordForm = ref({ new: '', confirm: '' })
const passwordLoading = ref(false)

onMounted(() => {
  if (authStore.profile) {
    const p = authStore.profile
    profile.value = {
      nama: p.nama || '',
      email: p.email || '',
      nim: p.nim || '',
      prodi: p.prodi || '',
      kelas: p.kelas || '',
      angkatan: p.angkatan || '',
      no_hp: p.no_hp || ''
    }
  }
})

async function handleSave() {
  saving.value = true
  try {
    await authStore.updateProfile({
      nama: profile.value.nama,
      no_hp: profile.value.no_hp
    })
    appStore.showToast('Profil diperbarui')
  } catch (e) {
    appStore.showToast(e.message, 'error')
  } finally {
    saving.value = false
  }
}

async function handleChangePassword() {
  if (passwordForm.value.new.length < 6) {
    appStore.showToast('Password minimal 6 karakter', 'warning')
    return
  }
  if (passwordForm.value.new !== passwordForm.value.confirm) {
    appStore.showToast('Konfirmasi password tidak cocok', 'warning')
    return
  }
  passwordLoading.value = true
  try {
    await authStore.updatePassword(passwordForm.value.new)
    appStore.showToast('Password berhasil diubah')
    showPasswordForm.value = false
    passwordForm.value = { new: '', confirm: '' }
  } catch (e) {
    appStore.showToast(e.message, 'error')
  } finally {
    passwordLoading.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-xl font-bold text-emerald-900 mb-1">Profil Saya</h1>
    <p class="text-sm text-gray-500 mb-6">Informasi dan pengaturan akun</p>

    <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6 max-w-md">
      <div class="space-y-4">
        <!-- Nama -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
          <input v-model="profile.nama" maxlength="100"
            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>

        <!-- NIM (read-only) -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">NIM</label>
          <input :value="profile.nim" disabled
            class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed" />
        </div>

        <!-- Prodi (read-only) -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Program Studi</label>
          <input :value="profile.prodi" disabled
            class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
            <input :value="profile.kelas" disabled
              class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Angkatan</label>
            <input :value="profile.angkatan" disabled
              class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed" />
          </div>
        </div>

        <!-- Email (read-only) -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input :value="profile.email" disabled
            class="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed" />
          <p class="text-xs text-gray-400 mt-1">Email tidak dapat diubah</p>
        </div>

        <!-- No. HP -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">No. HP</label>
          <input v-model="profile.no_hp" type="tel" maxlength="20"
            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>

        <button @click="handleSave" :disabled="saving"
          class="w-full py-3 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-sm">
          {{ saving ? 'Menyimpan...' : 'Simpan Perubahan' }}
        </button>

        <button @click="showPasswordForm = !showPasswordForm"
          class="w-full py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">
          {{ showPasswordForm ? 'Batal' : 'Ganti Password' }}
        </button>

        <div v-if="showPasswordForm" class="space-y-3 pt-2 border-t border-gray-100">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
            <input v-model="passwordForm.new" type="password" required placeholder="Minimal 6 karakter"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password</label>
            <input v-model="passwordForm.confirm" type="password" required
              placeholder="Ulangi password baru"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm" />
          </div>
          <button @click="handleChangePassword" :disabled="passwordLoading || !passwordForm.new || !passwordForm.confirm"
            class="w-full py-3 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-sm">
            {{ passwordLoading ? 'Menyimpan...' : 'Ubah Password' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
