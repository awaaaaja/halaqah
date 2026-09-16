export const GRADE_MAP = [
  { min: 90, grade: 'A', label: 'Sangat Memuaskan' },
  { min: 80, grade: 'B', label: 'Memuaskan' },
  { min: 70, grade: 'C', label: 'Cukup' },
  { min: 0,  grade: 'D', label: 'Perlu Perbaikan' }
]

export function getGrade(score) {
  const s = Math.round(score * 100) / 100
  for (const g of GRADE_MAP) {
    if (s >= g.min) return { score: s, grade: g.grade, label: g.label }
  }
  return { score: s, grade: 'D', label: 'Perlu Perbaikan' }
}

export const PENILAIAN_COMPONENTS = [
  { key: 'kehadiran', label: 'Kehadiran', bobot: 10, auto: true },
  { key: 'posttest', label: 'Posttest', bobot: 10, auto: false },
  { key: 'sikap_kedisiplinan', label: 'Sikap & Kedisiplinan', bobot: 20, auto: false },
  { key: 'amalan_yaumi', label: 'Amal Yaumi', bobot: 20, auto: true },
  { key: 'roadmap', label: 'Refleksi & Roadmap', bobot: 20, auto: false },
  { key: 'keaktifan', label: 'Keaktifan', bobot: 20, auto: false }
]
