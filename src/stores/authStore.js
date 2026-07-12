import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const profile = ref(null)
  const loading = ref(true)

  async function fetchSession() {
    loading.value = true
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      user.value = session.user
      await fetchProfile()
    } else {
      user.value = null
      profile.value = null
    }
    loading.value = false
  }

  async function fetchProfile() {
    if (!user.value) return
    const { data } = await supabase
      .from('profiles')
      .select('*, groups(nama_kelompok)')
      .eq('id', user.value.id)
      .maybeSingle()
    if (data) {
      profile.value = { ...data, nama_kelompok: data.groups?.nama_kelompok || null }
    } else {
      profile.value = null
    }
  }

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    if (data.session) {
      user.value = data.session.user
      await fetchProfile()
    } else {
      await fetchSession()
    }
  }

  async function register(data) {
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { nama: data.nama }
      }
    })
    if (error) throw error
    if (signUpData.session) {
      user.value = signUpData.session.user
    } else if (signUpData.user) {
      user.value = signUpData.user
    }
  }

  async function updateProfile(profileData) {
    if (!user.value) return
    for (let i = 0; i < 3; i++) {
      const { error } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('id', user.value.id)
      if (!error) {
        await fetchProfile()
        return
      }
      if (i < 2) await new Promise(r => setTimeout(r, 600))
      else throw error
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    user.value = null
    profile.value = null
  }

  return {
    user,
    profile,
    loading,
    fetchSession,
    fetchProfile,
    login,
    register,
    updateProfile,
    logout
  }
})
