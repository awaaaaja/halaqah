import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const loading = ref(false)
  const toast = ref(null)
  const error = ref('')

  function showToast(message, type = 'success') {
    toast.value = { message, type }
    setTimeout(() => { toast.value = null }, 3000)
  }

  function setError(msg) {
    error.value = msg
  }

  function clearError() {
    error.value = ''
  }

  return { loading, toast, error, showToast, setError, clearError }
})
