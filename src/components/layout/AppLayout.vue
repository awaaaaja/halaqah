<script setup>
import { useAuthStore } from '@/stores/authStore'
import BottomNav from './BottomNav.vue'

const authStore = useAuthStore()
</script>

<template>
  <div class="md:flex md:min-h-screen bg-gray-50">
    <a href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-brand-700 focus:text-white focus:rounded-lg focus:text-sm">
      Lewati ke konten utama
    </a>
    <BottomNav />
    <main id="main-content" class="flex-1 pb-24 md:pb-0 md:ml-0 min-h-screen">
      <div class="max-w-4xl mx-auto p-4 md:p-8">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>
  </div>
</template>

<style>
.page-enter-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.page-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
