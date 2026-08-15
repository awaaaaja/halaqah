export const AMALAN_SKOR_MAX = 25

export function hitungSkorHarian(log) {
  if (!log) return 0
  let score = 0
  const wajibFields = ['shalat_subuh', 'shalat_dzuhur', 'shalat_ashar', 'shalat_maghrib', 'shalat_isya']
  wajibFields.forEach(f => {
    if (log[f] === 'tepat_waktu') score += 4
    else if (log[f] === 'terlambat') score += 2
    else if (log[f] === 'qadha') score += 1
  })
  if (log.shalat_dhuha) score += 3
  if (log.jumlah_rakaat) score += Math.min(log.jumlah_rakaat, 2)
  return score
}

export function skorHarianPct(score) {
  return Math.round((score / AMALAN_SKOR_MAX) * 100)
}
