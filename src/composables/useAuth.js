import { useAuthStore } from '@/stores/authStore'

export function useAuth() {
  const authStore = useAuthStore()
  return {
    user: authStore.user,
    profile: authStore.profile,
    loading: authStore.loading,
    login: authStore.login,
    register: authStore.register,
    logout: authStore.logout,
    fetchSession: authStore.fetchSession
  }
}
