import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

export function useCatatan() {
  const daftarCatatan = ref([])
  const detailCatatan = ref(null)
  const loading = ref(false)

  async function fetchAll(userId, filters = {}) {
    loading.value = true
    let query = supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('tanggal', { ascending: false })
    if (filters.search) {
      query = query.or(`materi.ilike.%${filters.search}%,lokasi.ilike.%${filters.search}%,isi_catatan.ilike.%${filters.search}%`)
    }
    if (filters.tanggal) query = query.eq('tanggal', filters.tanggal)
    if (filters.lokasi) query = query.eq('lokasi', filters.lokasi)
    if (filters.tag) query = query.contains('tags', [filters.tag])
    const { data } = await query
    daftarCatatan.value = data || []
    loading.value = false
    return data
  }

  async function fetchOne(id) {
    loading.value = true
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('id', id)
      .single()
    detailCatatan.value = data || null
    loading.value = false
    return data
  }

  async function create(payload) {
    const { data, error } = await supabase
      .from('notes')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data
  }

  async function update(id, payload) {
    const { data, error } = await supabase
      .from('notes')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  async function remove(id) {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id)
    if (error) throw error
  }

  return { daftarCatatan, detailCatatan, loading, fetchAll, fetchOne, create, update, remove }
}
