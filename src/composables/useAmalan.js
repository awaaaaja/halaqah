import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { hitungSkorHarian as hitungSkor, skorHarianPct, AMALAN_SKOR_MAX } from '@/lib/amalanScore'

export function useAmalan() {
  const logHarian = ref(null)
  const riwayatBulan = ref([])
  const loading = ref(false)

  async function getLog(userId, tanggal) {
    loading.value = true
    const { data } = await supabase
      .from('daily_worship_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('tanggal', tanggal)
      .maybeSingle()
    logHarian.value = data || null
    loading.value = false
    return data
  }

  async function upsertLog(userId, tanggal, payload) {
    const record = {
      user_id: userId,
      tanggal,
      shalat_subuh: payload.shalat_subuh || 'belum',
      shalat_dzuhur: payload.shalat_dzuhur || 'belum',
      shalat_ashar: payload.shalat_ashar || 'belum',
      shalat_maghrib: payload.shalat_maghrib || 'belum',
      shalat_isya: payload.shalat_isya || 'belum',
      shalat_dhuha: payload.shalat_dhuha || false,
      jumlah_rakaat: payload.jumlah_rakaat || null,
      rawatib_qobliyah: payload.rawatib_qobliyah || {},
      rawatib_badiyah: payload.rawatib_badiyah || {},
      catatan_harian: payload.catatan_harian || ''
    }
    const { data, error } = await supabase
      .from('daily_worship_logs')
      .upsert(record, { onConflict: 'user_id, tanggal' })
      .select()
      .single()
    if (error) throw error
    logHarian.value = data
    return data
  }

  async function getBulanan(userId, tahun, bulan) {
    const start = `${tahun}-${String(bulan).padStart(2, '0')}-01`
    const endDate = new Date(tahun, bulan, 0)
    const end = endDate.toISOString().split('T')[0]
    loading.value = true
    const { data } = await supabase
      .from('daily_worship_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('tanggal', start)
      .lte('tanggal', end)
      .order('tanggal', { ascending: true })
    riwayatBulan.value = data || []
    loading.value = false
    return data
  }

  function hitungKonsistensi(logs, type = 'shalat_wajib') {
    const total = logs.length
    if (total === 0) return 0
    if (type === 'shalat_wajib') {
      const wajibFields = ['shalat_subuh', 'shalat_dzuhur', 'shalat_ashar', 'shalat_maghrib', 'shalat_isya']
      let totalTepat = 0, totalAll = 0
      logs.forEach(log => {
        wajibFields.forEach(f => {
          totalAll++
          if (log[f] === 'tepat_waktu') totalTepat++
        })
      })
      return totalAll > 0 ? Math.round((totalTepat / totalAll) * 100) : 0
    }
    if (type === 'dhuha') {
      const done = logs.filter(l => l.shalat_dhuha).length
      return Math.round((done / total) * 100)
    }
    return 0
  }

  function hitungSkorHarian(log) {
    const score = hitungSkor(log)
    return { total: score, max: AMALAN_SKOR_MAX, score, pct: skorHarianPct(score) }
  }

  return {
    logHarian, riwayatBulan, loading,
    getLog, upsertLog, getBulanan,
    hitungKonsistensi, hitungSkorHarian
  }
}
