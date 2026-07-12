import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

export function useAttendance() {
  const riwayat = ref([])
  const loading = ref(false)

  async function getRiwayatUser(userId) {
    loading.value = true
    const { data } = await supabase
      .from('attendances')
      .select('*, sessions!inner(tanggal, judul_materi, group_id, groups(nama_kelompok))')
      .eq('user_id', userId)
      .order('waktu_absen', { ascending: false })
    if (data) {
      riwayat.value = data.map(r => ({
        ...r,
        session_tanggal: r.sessions?.tanggal,
        session_judul: r.sessions?.judul_materi,
        kelompok: r.sessions?.groups?.nama_kelompok
      }))
    } else {
      riwayat.value = []
    }
    loading.value = false
    return data
  }

  async function catatAbsen(sessionId, userId, scannedById, status = 'hadir') {
    const { data, error } = await supabase
      .from('attendances')
      .insert({ session_id: sessionId, user_id: userId, scanned_by: scannedById, status })
      .select()
      .single()
    if (error) throw error
    return data
  }

  return { riwayat, loading, getRiwayatUser, catatAbsen }
}
