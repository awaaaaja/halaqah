import { supabase } from '@/lib/supabase'

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    Authorization: `Bearer ${session?.access_token || ''}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  }
}

export function useAdminManageUser() {
  async function createUser(data) {
    const headers = await getAuthHeader()
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        _action: 'create',
        email: data.email,
        password: data.password,
        nama: data.nama,
        nim: data.nim || null,
        prodi: data.prodi || null,
        kelas: data.kelas || null,
        angkatan: data.angkatan || null,
        no_hp: data.no_hp || null,
        role: data.role,
        group_id: data.group_id || null,
      }),
    })
    const result = await res.json()
    if (!res.ok || result.error) throw new Error(result.error || `HTTP ${res.status}`)
    return result
  }

  async function updateUser(userId, data) {
    const headers = await getAuthHeader()
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ _action: 'update', user_id: userId, ...data }),
    })
    const result = await res.json()
    if (!res.ok || result.error) throw new Error(result.error || `HTTP ${res.status}`)
    return result
  }

  return { createUser, updateUser }
}
