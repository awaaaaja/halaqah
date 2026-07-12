<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { useSession } from '@/composables/useSession'

const router = useRouter()
const authStore = useAuthStore()
const appStore = useAppStore()
const { sesiAktif, loading: sesiLoading, getSesiAktif, bukaSesi, akhiriSesi, getSesiSummary } = useSession()

const groupInfo = ref(null)
const anggotaCount = ref(0)
const sesiDitutup = ref(null)
const sesiSummary = ref(null)
const showBukaForm = ref(false)
const judulMateri = ref('')
const bukaLoading = ref(false)
const akhiriLoading = ref(false)
const riwayatSesi = ref([])
const realtimeCount = ref(0)

async function loadRealtimeCount() {
  if (!sesiAktif.value) { realtimeCount.value = 0; return }
  const { count } = await supabase
    .from('attendances')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sesiAktif.value.id)
  realtimeCount.value = count || 0
}

const adminGroupId = computed(() => authStore.profile?.group_id)
const today = new Date().toISOString().split('T')[0]

async function loadData() {
  if (!adminGroupId.value) return

  const [{ data: group }, { count: memberCount }] = await Promise.all([
    supabase.from('groups').select('nama_kelompok, deskripsi').eq('id', adminGroupId.value).single(),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('group_id', adminGroupId.value).eq('status_akun', 'aktif')
  ])
  groupInfo.value = group
  anggotaCount.value = memberCount || 0

  await getSesiAktif(adminGroupId.value)
  if (sesiAktif.value) await loadRealtimeCount()

  const { data: riwayat } = await supabase
    .from('sessions')
    .select('id, tanggal, judul_materi, created_at')
    .eq('group_id', adminGroupId.value)
    .eq('is_open', false)
    .order('created_at', { ascending: false })
    .limit(5)
  riwayatSesi.value = riwayat || []
}

async function handleBukaSesi() {
  if (!adminGroupId.value) return
  bukaLoading.value = true
  try {
    await bukaSesi(adminGroupId.value, judulMateri.value, authStore.profile?.id)
    appStore.showToast('Sesi liqa dibuka!')
    showBukaForm.value = false
    judulMateri.value = ''
    sesiDitutup.value = null
    sesiSummary.value = null
  } catch (e) {
    if (e.message?.includes('one_open_session_per_group') || e.message?.includes('duplicate')) {
      appStore.showToast('Sudah ada sesi aktif untuk kelompok ini', 'warning')
    } else {
      appStore.showToast(e.message, 'error')
    }
  } finally {
    bukaLoading.value = false
  }
}

async function handleAkhiriSesi() {
  if (!sesiAktif.value) return
  akhiriLoading.value = true
  try {
    const session = sesiAktif.value
    sesiSummary.value = await getSesiSummary(session.id)
    sesiDitutup.value = session
    await akhiriSesi(session.id)
    appStore.showToast('Sesi liqa diakhiri')
    await loadData()
  } catch (e) {
    appStore.showToast(e.message, 'error')
  } finally {
    akhiriLoading.value = false
  }
}

let realtimeSub = null

onMounted(() => {
  loadData()

  realtimeSub = supabase
    .channel('attendances-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendances' }, () => {
      loadRealtimeCount()
      loadData()
    })
    .subscribe()
})

import { onUnmounted } from 'vue'
onUnmounted(() => {
  if (realtimeSub) supabase.removeChannel(realtimeSub)
})
</script>

<template>
  <div>
    <!-- Group Info -->
    <div v-if="groupInfo" class="mb-6">
      <h1 class="text-2xl font-bold text-emerald-900">{{ groupInfo.nama_kelompok }}</h1>
      <p class="text-sm text-gray-500 mt-1">{{ groupInfo.deskripsi || 'Kelompok liqa' }}</p>
      <div class="flex gap-4 mt-2 text-sm text-gray-600">
        <svg class="w-4 h-4 text-gray-400 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" /></svg>
        <span>{{ anggotaCount }} anggota</span>
      </div>
    </div>

    <!-- No group -->
    <div v-else-if="!adminGroupId" class="text-center py-12">
      <div class="flex justify-center mb-4"><div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center"><svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div></div>
      <h3 class="text-lg font-medium text-gray-700">Anda Belum Ditugaskan ke Kelompok</h3>
      <p class="text-sm text-gray-500 mt-1">Hubungi Super Admin untuk ditetapkan sebagai Murabbi.</p>
    </div>

    <!-- Loading -->
    <div v-else-if="sesiLoading" class="text-center py-8 text-gray-500">Memuat...</div>

    <!-- ======== ACTIVE SESSION ======== -->
    <div v-else-if="sesiAktif" class="space-y-6">
      <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
        <svg class="w-10 h-10 text-emerald-500 mx-auto mb-3" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>
        <h2 class="text-lg font-bold text-emerald-800">Sesi Sedang Berlangsung</h2>
        <p class="text-sm text-emerald-600 mt-1">
          {{ sesiAktif.judul_materi || 'Liqa' }} ·
          {{ new Date(sesiAktif.dibuka_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }}
        </p>
        <div class="mt-3 inline-flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm">
          <svg class="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
          <span class="text-lg font-bold text-emerald-700">{{ realtimeCount }}</span>
          <span class="text-sm text-gray-500">terabsen</span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <button @click="router.push('/scan-absen')"
          class="py-4 px-6 bg-emerald-700 text-white rounded-xl font-medium text-lg hover:bg-emerald-800 transition-colors shadow-md flex flex-col items-center gap-1">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <span>Scan Absen</span>
        </button>
        <button @click="handleAkhiriSesi" :disabled="akhiriLoading"
          class="py-4 px-6 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors shadow-md disabled:opacity-50 flex flex-col items-center gap-1">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
          <span>{{ akhiriLoading ? 'Menutup...' : 'Akhiri Sesi' }}</span>
        </button>
      </div>
    </div>

    <!-- ======== NO ACTIVE SESSION ======== -->
    <div v-else class="space-y-6">
      <!-- Today's sessions that are closed -->
      <div v-if="sesiDitutup && sesiSummary" class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h3 class="font-bold text-gray-800 mb-3 flex items-center gap-2"><svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> Ringkasan Sesi Sebelumnya</h3>
        <p class="text-sm text-gray-500 mb-3">{{ sesiDitutup.judul_materi || 'Liqa' }} — {{ new Date(sesiDitutup.created_at).toLocaleDateString('id-ID') }}</p>
        <div class="grid grid-cols-3 gap-3 text-center">
          <div class="bg-emerald-50 rounded-lg p-3">
            <p class="text-2xl font-bold text-emerald-600">{{ sesiSummary.hadir }}</p>
            <p class="text-xs text-emerald-600">Hadir</p>
          </div>
          <div class="bg-amber-50 rounded-lg p-3">
            <p class="text-2xl font-bold text-amber-600">{{ sesiSummary.izin }}</p>
            <p class="text-xs text-amber-600">Izin</p>
          </div>
          <div class="bg-red-50 rounded-lg p-3">
            <p class="text-2xl font-bold text-red-600">{{ sesiSummary.alpa }}</p>
            <p class="text-xs text-red-600">Alpa</p>
          </div>
        </div>
      </div>

      <!-- Buka Sesi Button -->
      <div class="text-center">
        <button @click="showBukaForm = true"
          class="w-full py-6 px-8 bg-emerald-700 text-white rounded-xl font-bold text-xl hover:bg-emerald-800 transition-colors shadow-lg flex items-center justify-center gap-3">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          <span>Buka Sesi Liqa</span>
        </button>
      </div>

      <!-- Buka Sesi Form Modal -->
      <div v-if="showBukaForm" class="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4"
        @click.self="showBukaForm = false">
        <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
          <h3 class="text-lg font-bold text-gray-800 mb-4">Buka Sesi Baru</h3>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Judul Materi (opsional)</label>
            <input v-model="judulMateri" placeholder="Misal: Kajian Tafsir" maxlength="200"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div class="flex gap-3">
            <button @click="showBukaForm = false"
              class="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50">
              Batal
            </button>
            <button @click="handleBukaSesi" :disabled="bukaLoading"
              class="flex-1 py-3 bg-emerald-700 text-white rounded-xl font-medium hover:bg-emerald-800 disabled:opacity-50">
              {{ bukaLoading ? 'Membuka...' : 'Buka Sesi' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Recent sessions -->
      <div v-if="riwayatSesi.length > 0" class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 class="font-bold text-gray-800 mb-3">Riwayat Sesi Terakhir</h3>
        <div class="space-y-2">
          <div v-for="s in riwayatSesi" :key="s.id"
            class="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
            <div>
              <p class="text-sm font-medium">{{ s.judul_materi || 'Liqa' }}</p>
              <p class="text-xs text-gray-500">{{ new Date(s.tanggal + 'T00:00:00').toLocaleDateString('id-ID') }}</p>
            </div>
            <span class="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">Selesai</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
