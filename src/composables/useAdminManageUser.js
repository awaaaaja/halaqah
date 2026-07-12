import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession()
  return { Authorization: `Bearer ${session?.access_token || ''}` }
}

export function useAdminManageUser() {
  async function createUser(data) {
    const authHeader = await getAuthHeader()
    const { data: result, error } = await supabase.functions.invoke('admin-create-user', {
      headers: authHeader,
      body: {
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
      }
    })
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const errBody = await error.context.json()
        throw new Error(errBody.error || error.message)
      }
      throw error
    }
    if (result?.error) throw new Error(result.error)
    return result
  }

  async function updateUser(userId, data) {
    const authHeader = await getAuthHeader()
    const { data: result, error } = await supabase.functions.invoke('admin-create-user', {
      headers: authHeader,
      body: { _action: 'update', user_id: userId, ...data }
    })
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const errBody = await error.context.json()
        throw new Error(errBody.error || error.message)
      }
      throw error
    }
    if (result?.error) throw new Error(result.error)
    return result
  }

  return { createUser, updateUser }
}
