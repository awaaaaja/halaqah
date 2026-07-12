<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import AppLayout from '@/components/layout/AppLayout.vue'
import AuthLayout from '@/components/layout/AuthLayout.vue'

const route = useRoute()
const authStore = useAuthStore()
const appStore = useAppStore()

const layout = computed(() => {
  if (route.meta?.layout === 'auth') return AuthLayout
  return AppLayout
})

onMounted(() => {
  authStore.fetchSession()
})
</script>

<template>
  <component :is="layout">
    <router-view />
  </component>

  <!-- Toast -->
  <Teleport to="body">
    <div v-if="appStore.toast"
      class="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all duration-300"
      :class="appStore.toast.type === 'error' ? 'bg-red-600' : appStore.toast.type === 'warning' ? 'bg-amber-600' : 'bg-emerald-700'">
      {{ appStore.toast.message }}
    </div>
  </Teleport>
</template>
