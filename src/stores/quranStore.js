import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useQuranStore = defineStore('quran', () => {
  const daftarSurat = ref([])

  async function fetchDaftarSurat() {
    if (daftarSurat.value.length > 0) return daftarSurat.value
    const res = await fetch('https://equran.id/api/v2/surat')
    const json = await res.json()
    daftarSurat.value = json.data || []
    return daftarSurat.value
  }

  function getSurat(nomor) {
    return daftarSurat.value.find(s => Number(s.nomor) === Number(nomor)) || null
  }

  return { daftarSurat, fetchDaftarSurat, getSurat }
})
