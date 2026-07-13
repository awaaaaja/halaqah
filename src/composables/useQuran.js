import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

const API_BASE = 'https://equran.id/api/v2'

export function useQuran() {
  const daftarSurat = ref([])
  const detailSurat = ref(null)
  const tafsirSurat = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function fetchDaftarSurat() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`${API_BASE}/surat`)
      const json = await res.json()
      daftarSurat.value = json.data || []
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchDetailSurat(nomor) {
    loading.value = true
    error.value = null
    detailSurat.value = null
    try {
      const res = await fetch(`${API_BASE}/surat/${nomor}`)
      const json = await res.json()
      detailSurat.value = json.data || null
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchTafsirSurat(nomor) {
    loading.value = true
    error.value = null
    tafsirSurat.value = null
    try {
      const res = await fetch(`${API_BASE}/tafsir/${nomor}`)
      const json = await res.json()
      tafsirSurat.value = json.data || null
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function getBookmark(userId, suratNomor) {
    const { data } = await supabase
      .from('quran_bookmarks')
      .select('*')
      .eq('user_id', userId)
      .eq('surat_nomor', suratNomor)
      .maybeSingle()
    return data
  }

  async function getAllBookmarks(userId) {
    const { data } = await supabase
      .from('quran_bookmarks')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
    return data || []
  }

  async function saveBookmark(userId, suratNomor, ayatNomor = 1) {
    const { data, error: err } = await supabase
      .from('quran_bookmarks')
      .upsert(
        { user_id: userId, surat_nomor: suratNomor, ayat_nomor: ayatNomor },
        { onConflict: 'user_id, surat_nomor' }
      )
      .select()
      .single()
    if (err) throw err
    return data
  }

  return {
    daftarSurat, detailSurat, tafsirSurat, loading, error,
    fetchDaftarSurat, fetchDetailSurat, fetchTafsirSurat,
    getBookmark, getAllBookmarks, saveBookmark
  }
}
