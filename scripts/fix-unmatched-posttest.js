#!/usr/bin/env node

/**
 * Fix unmatched posttest users:
 * 1. Typo matches → resolve from DB + seed posttest
 * 2. Not-in-DB → create profile + penilaian (posttest=100)
 */

import pg from 'pg'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PERIODE = 'ASA-2026'
const DEFAULT_PASSWORD = '123456'

// Load env
function loadEnv() {
  const env = {}
  const content = readFileSync(join(ROOT, '.env.local'), 'utf-8')
  for (const line of content.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return env
}
const env = loadEnv()
const SUPABASE_URL = env.VITE_SUPABASE_URL
const SERVICE_KEY = env.VITE_SUPABASE_SERVICE_ROLE_KEY

// Typo matches: Excel name → DB search query + optional exact name
const TYPO_MAP = {
  'Ihda asaroh':               { q: "%'a'saroh%", pick: "IHDA 'A'SAROH" },
  'Latifah nur muk minah':     { q: '%mukminah%', pick: null },
  'NEFEL NAZLA USWATUN W':     { q: '%nefel%nazla%uswatun%', pick: null },
  'Resti Aprlia Zinda':        { q: '%resti%aprilia%zinda%', pick: null },
  'Kelsi putri Ramadhani':     { q: '%kelsi%putri%ramadani%', pick: null },
  'VANESSA PERTAMA SARI':      { q: '%vanessa%permata%sari%', pick: null },
  'Pipin':                     { q: '%pipin%yunita%', pick: null },
  'Sahar Amelia':              { q: '%sahara%amelia%', pick: null },
  'Sakila Fitri Nengsi':       { q: '%sakila%pitri%nengsi%', pick: null },
  'Fersan aldio fero':         { q: '%fersan%aldio%', pick: 'Fersan Aldio Ferro' },
  'jelsi idris safiri':        { q: '%jelsi%idris%safitri%', pick: null },
  'salwa':                     { q: '%salwa%safitri%', pick: null },
  'Muhammad Aditya putra':     { q: '%aditya%saputra%', pick: null },
  'Annisa Tufaillah.A':        { q: '%annisa%tufaila%', pick: null },
  'MHD.IHSANUL ZUKRI HSB':     { q: '%ihsanul%zikri%', pick: null },
  'Fadila Muthomainnah':       { q: '%fadila%muthomainnah%', pick: null },
  'M teguh prasetyawan':       { q: '%teguh%prasetyawan%', pick: null },
  'Nur Aini':                  { q: "%nur'aini%", pick: null },
  'intantanjung':              { q: '%intan%tanjung%', pick: null },
}

function matchGroupId(kelompokName, groups) {
  if (!kelompokName) return null
  const k = String(kelompokName).toLowerCase().trim()
  const num = k.match(/\d+/)
  if (!num) return null
  const isIkhwan = k.includes('ikhwan')
  const prefix = isIkhwan ? 'Kelompok ' + num[0] + ' Ikhwan' : 'Kelompok ' + num[0] + ' Akhwat'
  const match = groups.find(g => g.nama_kelompok === prefix)
  return match ? match.id : null
}

async function main() {
  console.log('=== FIX UNMATCHED POSTTEST ===\n')

  const client = new pg.Client({
    connectionString: `postgresql://postgres.wyspiveirsbvvbhajglc:${encodeURIComponent('ZildaSayan99!')}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`
  })
  await client.connect()

  const { rows: groups } = await client.query('SELECT id, nama_kelompok FROM groups')
  const report = JSON.parse(readFileSync(join(ROOT, 'seed-posttest-report.json'), 'utf-8'))

  // Resolve all fuzzy matches
  const resolvedMap = {} // excelName → userId
  console.log('--- Resolving fuzzy matches ---')
  for (const [excelName, info] of Object.entries(TYPO_MAP)) {
    const { rows } = await client.query('SELECT id, nama FROM profiles WHERE lower(nama) LIKE $1', [info.q])
    const match = info.pick ? rows.find(r => r.nama === info.pick) : rows[0]
    if (match) {
      resolvedMap[excelName] = match.id
      console.log(`  ${excelName} → ${match.nama}`)
    } else {
      console.log(`  ${excelName} → NOT FOUND`)
    }
  }

  // PART 1: Typo matches
  console.log('\n--- PART 1: TYPO MATCHES ---')
  let typoSeeded = 0
  for (const u of report.unmatched) {
    const userId = resolvedMap[u.nama]
    if (!userId) continue
    const score = u.score || 100
    const { error } = await client.query(
      `INSERT INTO penilaian_asa (user_id, periode, posttest, sikap_kedisiplinan, keaktifan, roadmap)
       VALUES ($1, $2, $3, 0, 0, 0) ON CONFLICT (user_id, periode) DO UPDATE SET posttest = $3`,
      [userId, PERIODE, Number(score)]
    )
    if (error) console.error(`  FAILED: ${u.nama} - ${error.message}`)
    else { console.log(`  OK: ${u.nama} | posttest=${score}`); typoSeeded++ }
  }
  console.log(`  Typo seeded: ${typoSeeded}`)

  // PART 2: Not in DB → create auth accounts + profiles + penilaian
  console.log('\n--- PART 2: NEW ACCOUNTS ---')
  let created = 0
  for (const u of report.unmatched) {
    if (resolvedMap[u.nama]) continue
    const fullName = u.nama.trim()
    const nim = String(u.nim).trim()
    const email = fullName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/\.+/g, '.') + '@peserta.halaqah.com'
    const groupId = matchGroupId(u.kelompok, groups)

    try {
      // Create auth user via admin API
      const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'apikey': SERVICE_KEY
        },
        body: JSON.stringify({
          email,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: { nama: fullName, nim, role: 'user' }
        })
      })
      const data = await res.json()
      if (data.id) {
        // Auth user created, now update profile with group_id and nim
        await client.query(
          'UPDATE profiles SET nim = $1, group_id = $2, status_akun = $3 WHERE id = $4',
          [nim, groupId, 'aktif', data.id]
        )
        // Insert penilaian
        await client.query(
          `INSERT INTO penilaian_asa (user_id, periode, posttest, sikap_kedisiplinan, keaktifan, roadmap)
           VALUES ($1, $2, 100, 0, 0, 0) ON CONFLICT (user_id, periode) DO UPDATE SET posttest = 100`,
          [data.id, PERIODE]
        )
        console.log(`  OK: ${fullName} | NIM: ${nim} | Group: ${groupId || 'NONE'} | posttest=100`)
        created++
      } else {
        console.error(`  FAILED: ${fullName} - ${data.msg || data.error || JSON.stringify(data)}`)
      }
    } catch (e) { console.error(`  FAILED: ${fullName} - ${e.message}`) }
  }
  console.log(`  New accounts: ${created}`)

  const final = await client.query(
    'SELECT count(*) as total, count(CASE WHEN posttest > 0 THEN 1 END) as hp FROM penilaian_asa WHERE periode = $1',
    [PERIODE]
  )
  console.log(`\nFinal: ${final.rows[0].total} records, ${final.rows[0].hp} with posttest > 0`)
  await client.end()
}

main().catch(e => { console.error(e); process.exit(1) })
