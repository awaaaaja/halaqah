import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

export function usePenilaian() {
  const loading = ref(false)
  const asaSettings = ref([])
  const penilaian = ref(null)
  const penilaianList = ref([])

  async function getAsaSettings() {
    const { data, error } = await supabase
      .from('asa_settings')
      .select('*')
      .order('tahun', { ascending: false })
    if (error) {
      console.error('[usePenilaian] getAsaSettings:', error.message)
      return []
    }
    asaSettings.value = data || []
    return data || []
  }

  async function getAsaActive() {
    const { data, error } = await supabase
      .from('asa_settings')
      .select('*')
      .eq('is_active', true)
      .maybeSingle()
    if (error) {
      console.error('[usePenilaian] getAsaActive:', error.message)
      return null
    }
    return data
  }

  async function createAsaSettings(payload) {
    const { data, error } = await supabase
      .from('asa_settings')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data
  }

  async function updateAsaSettings(id, payload) {
    const { data, error } = await supabase
      .from('asa_settings')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  async function setActiveAsaSettings(id) {
    await supabase
      .from('asa_settings')
      .update({ is_active: false })
      .neq('id', id)
    const { data, error } = await supabase
      .from('asa_settings')
      .update({ is_active: true })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  async function deleteAsaSettings(id) {
    const { error } = await supabase
      .from('asa_settings')
      .delete()
      .eq('id', id)
    if (error) throw error
  }

  async function getPenilaian(userId, periode) {
    const { data, error } = await supabase
      .from('penilaian_asa')
      .select('*')
      .eq('user_id', userId)
      .eq('periode', periode)
      .maybeSingle()
    if (error) {
      console.error('[usePenilaian] getPenilaian:', error.message)
      return null
    }
    penilaian.value = data
    return data
  }

  async function getPenilaianBatch(periode, groupId) {
    loading.value = true
    try {
      const { data, error } = await supabase
        .rpc('get_penilaian_with_profile', {
          p_periode: periode,
          p_group_id: groupId || null
        })
      if (error) {
        console.error('[usePenilaian] getPenilaianBatch:', error.message)
        penilaianList.value = []
        return []
      }
      penilaianList.value = data || []
      return data || []
    } finally {
      loading.value = false
    }
  }

  async function upsertPenilaian(payload) {
    const { data, error } = await supabase
      .from('penilaian_asa')
      .upsert({
        user_id: payload.user_id,
        periode: payload.periode,
        sikap_kedisiplinan: payload.sikap_kedisiplinan || 0,
        keaktifan: payload.keaktifan || 0,
        roadmap: payload.roadmap || 0,
        posttest: payload.posttest || 0,
        catatan_mentor: payload.catatan_mentor || '',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,periode' })
      .select()
      .single()
    if (error) throw error
    return data
  }

  async function calculateAuto(userId, periode) {
    const { error } = await supabase
      .rpc('calculate_penilaian', {
        p_user_id: userId,
        p_periode: periode
      })
    if (error) throw error
    const updated = await getPenilaian(userId, periode)
    return updated
  }

  return {
    loading, asaSettings, penilaian, penilaianList,
    getAsaSettings, getAsaActive, createAsaSettings, updateAsaSettings,
    setActiveAsaSettings, deleteAsaSettings,
    getPenilaian, getPenilaianBatch, upsertPenilaian, calculateAuto
  }
}
