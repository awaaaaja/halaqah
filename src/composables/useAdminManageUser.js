import { supabase } from '@/lib/supabase'

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession()
  return { Authorization: `Bearer ${session?.access_token || ''}` }
}

async function handleFnError(error) {
  if (error?.context?.json) {
    try {
      const errBody = await error.context.json()
      throw new Error(errBody.error || error.message)
    } catch (_) {}
  }
  throw error
}

export function useAdminManageUser() {
  async function createUser(data) {
    const authHeader = await getAuthHeader()
    const { data: result, error } = await supabase.functions.invoke('admin-create-user', {
      headers: { ...authHeader, 'Content-Type': 'application/json' },
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
      })
    })
    if (error) await handleFnError(error)
    if (result?.error) throw new Error(result.error)
    return result
  }

  async function updateUser(userId, data) {
    const authHeader = await getAuthHeader()
    const { data: result, error } = await supabase.functions.invoke('admin-create-user', {
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ _action: 'update', user_id: userId, ...data })
    })
    if (error) await handleFnError(error)
    if (result?.error) throw new Error(result.error)
    return result
  }

  return { createUser, updateUser }
}
