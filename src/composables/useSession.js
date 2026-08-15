import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

export function useSession() {
  const sesiAktif = ref(null)
  const loading = ref(false)

  async function getSesiAktif(groupId) {
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('group_id', groupId)
        .eq('is_open', true)
        .maybeSingle()
      if (error) {
        console.error('[useSession] getSesiAktif:', error.message)
        sesiAktif.value = null
        return null
      }
      sesiAktif.value = data
      return data
    } finally {
      loading.value = false
    }
  }

  async function bukaSesi(groupId, judulMateri = '', createdBy) {
    if (!createdBy) throw new Error('createdBy (profile ID) wajib diisi untuk membuka sesi')
    const payload = { group_id: groupId, judul_materi: judulMateri, created_by: createdBy }
    const { data, error } = await supabase
      .from('sessions')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    sesiAktif.value = data
    return data
  }

  async function akhiriSesi(sessionId) {
    const { data, error } = await supabase
      .from('sessions')
      .update({ is_open: false, ditutup_at: new Date().toISOString() })
      .eq('id', sessionId)
      .select()
      .single()
    if (error) throw error
    sesiAktif.value = null
    return data
  }

  async function getSesiSummary(sessionId) {
    const { data, error } = await supabase
      .from('attendances')
      .select('status')
      .eq('session_id', sessionId)
    if (error) {
      console.error('[useSession] getSesiSummary:', error.message)
      return { total: 0, hadir: 0, izin: 0, alpa: 0 }
    }
    if (!data) return { total: 0, hadir: 0, izin: 0, alpa: 0 }
    return {
      total: data.length,
      hadir: data.filter(a => a.status === 'hadir').length,
      izin: data.filter(a => a.status === 'izin').length,
      alpa: data.filter(a => a.status === 'alpa').length
    }
  }

  return { sesiAktif, loading, getSesiAktif, bukaSesi, akhiriSesi, getSesiSummary }
}
