<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { supabase } from '@/lib/supabase'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const appStore = useAppStore()

const role = computed(() => authStore.profile?.role)
const profile = computed(() => authStore.profile)
const pendingCount = ref(0)
const showLogoutConfirm = ref(false)

async function loadPendingCount() {
  if (role.value !== 'super_admin') return
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('status_akun', 'pending')
  pendingCount.value = count || 0
}

onMounted(loadPendingCount)
watch(role, loadPendingCount)

const icons = {
  dashboard: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  qr: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z',
  history: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  scan: 'M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  plus: 'M12 4v16m8-8H4',
  group: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  settings: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  document: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  logout: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
  home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  quran: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  amalan: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  catatan: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  monitoring: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6'
}

const menuMap = {
  user: [
    { label: 'QR Saya', icon: icons.qr, route: '/qr-saya' },
    { label: 'Al-Quran', icon: icons.quran, route: '/quran' },
    { label: 'Amalan', icon: icons.amalan, route: '/amalan' },
    { label: 'Catatan', icon: icons.catatan, route: '/catatan' },
    { label: 'Profil', icon: icons.user, route: '/profil' }
  ],
  admin: [
    { label: 'Beranda', icon: icons.home, route: '/beranda' },
    { label: 'Scan', icon: icons.scan, route: '/scan-absen' },
    { label: 'Anggota', icon: icons.group, route: '/anggota-saya' },
    { label: 'Monitoring', icon: icons.monitoring, route: '/monitoring-amalan' },
    { label: 'Riwayat', icon: icons.history, route: '/riwayat-sesi' }
  ],
  super_admin: [
    { label: 'Dashboard', icon: icons.dashboard, route: '/dashboard' },
    { label: 'Murabbi', icon: icons.user, route: '/dashboard/murabbi' },
    { label: 'Kelompok', icon: icons.group, route: '/dashboard/kelompok' },
    { label: 'Akun', icon: icons.user, route: '/dashboard/akun' },
    { label: 'Monitoring', icon: icons.monitoring, route: '/monitoring-amalan' },
    { label: 'Approval', icon: icons.document, route: '/dashboard/approval' },
    { label: 'Laporan', icon: icons.document, route: '/dashboard/laporan' },
    { label: 'Pengaturan', icon: icons.settings, route: '/dashboard/pengaturan' }
  ]
}

const menu = computed(() => menuMap[role.value] || [])

function isActive(itemRoute) {
  if (itemRoute === '/dashboard') {
    return route.path === '/dashboard' || (route.path.startsWith('/dashboard/') && !route.path.includes('murabbi') && !route.path.includes('kelompok') && !route.path.includes('akun') && !route.path.includes('approval') && !route.path.includes('laporan') && !route.path.includes('pengaturan'))
  }
  if (itemRoute === '/dashboard/akun') return route.path === '/dashboard/akun'
  if (itemRoute === '/dashboard/approval') return route.path === '/dashboard/approval'
  if (itemRoute === '/dashboard/murabbi' && route.path === '/dashboard/murabbi') return true
  if (itemRoute === '/dashboard/kelompok' && route.path === '/dashboard/kelompok') return true
  return route.path === itemRoute
}

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}
</script>

<template>
  <!-- ===== MOBILE BOTTOM NAV ===== -->
  <nav v-if="role"
    class="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-200 z-50 safe-area-bottom">
    <div class="flex items-center justify-around">
      <router-link
        v-for="item in menu"
        :key="item.route"
        :to="item.route"
        class="relative flex flex-col items-center py-2 px-3 min-w-0 transition-all duration-150"
        :class="isActive(item.route)
          ? 'text-brand-700'
          : 'text-gray-400 hover:text-gray-600'"
      >
        <div class="relative">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"
            :class="{ 'stroke-[2.5]': isActive(item.route), 'stroke-[1.5]': !isActive(item.route) }">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" :d="item.icon" />
          </svg>
          <span v-if="item.route === '/dashboard/approval' && pendingCount > 0"
            class="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center leading-tight shadow">
            {{ pendingCount > 99 ? '99+' : pendingCount }}
          </span>
        </div>
        <span class="text-[10px] mt-0.5 font-medium truncate max-w-full">{{ item.label }}</span>
        <div v-if="isActive(item.route)"
          class="absolute -top-[1px] left-1/2 -translate-x-1/2 w-8 h-0.5 bg-brand-600 rounded-full">
        </div>
      </router-link>

      <!-- Logout button on mobile -->
      <button @click="showLogoutConfirm = true"
        class="flex flex-col items-center py-2 px-3 text-gray-400 hover:text-red-500 transition-all duration-150">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" :d="icons.logout" />
        </svg>
        <span class="text-[10px] mt-0.5 font-medium">Keluar</span>
      </button>
    </div>
  </nav>

  <!-- ===== DESKTOP SIDEBAR ===== -->
  <nav v-if="role"
    class="hidden md:flex md:flex-col md:w-64 md:h-screen md:bg-white md:border-r md:border-gray-200 md:sticky md:top-0 md:shrink-0">
    <!-- Brand -->
    <div class="px-6 pt-6 pb-4 border-b border-gray-100">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center shadow-sm">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="font-bold text-brand-900 text-sm">Absensi Liqa</p>
          <p class="text-[11px] text-gray-500 capitalize">{{ role === 'super_admin' ? 'Super Admin' : role === 'admin' ? 'Murabbi' : 'Anggota' }}</p>
        </div>
      </div>
    </div>

    <!-- Menu -->
    <div class="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
      <router-link
        v-for="item in menu"
        :key="item.route"
        :to="item.route"
        class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
        :class="isActive(item.route)
          ? 'bg-brand-50 text-brand-700'
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'"
      >
        <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" :d="item.icon" />
        </svg>
        <span>{{ item.label }}</span>
        <span v-if="item.route === '/dashboard/approval' && pendingCount > 0"
          class="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
          {{ pendingCount > 99 ? '99+' : pendingCount }}
        </span>
      </router-link>
    </div>

    <!-- Profile + Logout (Desktop) -->
    <div class="p-4 border-t border-gray-100">
      <div class="flex items-center gap-3 px-2 py-1">
        <div class="w-9 h-9 rounded-full bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center text-brand-700 font-bold text-sm shrink-0">
          {{ (profile?.nama || '?')[0] }}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-800 truncate">{{ profile?.nama }}</p>
          <p class="text-xs text-gray-400 truncate">{{ authStore.user?.email || '' }}</p>
        </div>
        <button @click="showLogoutConfirm = true"
          class="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
          title="Keluar">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" :d="icons.logout" />
          </svg>
        </button>
      </div>
    </div>
  </nav>

  <!-- ===== LOGOUT CONFIRMATION MODAL ===== -->
  <Teleport to="body">
    <div v-if="showLogoutConfirm"
      class="fixed inset-0 bg-black/40 z-[999] flex items-end md:items-center justify-center p-4 animate-fade-in"
      @click.self="showLogoutConfirm = false">
      <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-slide-up">
        <div class="text-center mb-5">
          <div class="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
            <svg class="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
          <h3 class="text-lg font-bold text-gray-800">Keluar</h3>
          <p class="text-sm text-gray-500 mt-1">Apakah Anda yakin ingin keluar?</p>
        </div>
        <div class="flex gap-3">
          <button @click="showLogoutConfirm = false"
            class="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-all active:scale-[0.98]">
            Batal
          </button>
          <button @click="handleLogout"
            class="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-all active:scale-[0.98] shadow-sm">
            Keluar
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
</style>
