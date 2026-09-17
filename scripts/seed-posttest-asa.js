#!/usr/bin/env node

/**
 * POST-TEST ASA SEED
 * 
 * Reads post-test scores from Excel and seeds into penilaian_asa.
 * Matching: by normalized NAMA (case-folded, whitespace-collapsed, emoji-stripped).
 * Excel is source of truth — overwrites existing posttest scores.
 * 
 * Usage:
 *   node scripts/seed-posttest-asa.js [--dry-run]
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DRY_RUN = process.argv.includes('--dry-run')
const PERIODE = 'ASA-2026'

function loadEnv() {
  const env = {}
  try {
    const content = readFileSync(join(ROOT, '.env.local'), 'utf-8')
    for (const line of content.split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
    }
  } catch {}
  return env
}

// Normalize: lowercase, strip emoji, collapse whitespace, strip non-alphanumeric except space
function normalize(str) {
  if (!str) return ''
  return str
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Dedupe: take first entry per normalized name
function dedupeExcel(rows) {
  const seen = new Map()
  const dupes = []
  const unique = []

  for (const row of rows) {
    const key = normalize(row['NAMA LENGKAP'])
    if (!key) continue
    if (seen.has(key)) {
      dupes.push({ nama: row['NAMA LENGKAP']?.trim(), nim: row['NIM'], score: row['Score'] })
      continue
    }
    seen.set(key, row)
    unique.push(row)
  }
  return { unique, dupes }
}

async function main() {
  console.log('=== POST-TEST ASA SEED ===')
  if (DRY_RUN) console.log('*** DRY RUN — no changes ***\n')

  // 1. Connect DB
  const client = new pg.Client({
    connectionString: `postgresql://postgres.wyspiveirsbvvbhajglc:${encodeURIComponent('ZildaSayan99!')}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`
  })
  await client.connect()

  // 2. Load Excel
  const wb = XLSX.readFile(join(ROOT, 'POSTEST ASA (Responses).xlsx'))
  const ws = wb.Sheets[wb.SheetNames[0]]
  const excelAll = XLSX.utils.sheet_to_json(ws)
  console.log(`Excel rows (raw): ${excelAll.length}`)

  // 3. Dedupe Excel
  const { unique: excelData, dupes: excelDupes } = dedupeExcel(excelAll)
  console.log(`Excel rows (deduped): ${excelData.length}`)
  if (excelDupes.length > 0) {
    console.log(`Excel duplicates skipped: ${excelDupes.length}`)
  }

  // 4. Load DB profiles
  const profileRes = await client.query(
    "SELECT id, nama, nim FROM profiles WHERE role = 'user' AND status_akun = 'aktif'"
  )
  const profiles = profileRes.rows
  console.log(`DB active users: ${profiles.length}`)

  // 5. Build name → profile map
  const nameMap = new Map()
  profiles.forEach(p => {
    const key = normalize(p.nama)
    if (key) nameMap.set(key, p)
  })

  // 6. Load existing penilaian
  const penRes = await client.query(
    'SELECT user_id, posttest FROM penilaian_asa WHERE periode = $1',
    [PERIODE]
  )
  const existingMap = new Map()
  penRes.rows.forEach(p => existingMap.set(p.user_id, p))
  console.log(`Existing penilaian records: ${penRes.rows.length}\n`)

  // 7. Match & process
  const report = {
    totalExcelRaw: excelAll.length,
    totalExcelDeduped: excelData.length,
    matched: 0,
    seeded: 0,
    overwritten: 0,
    unmatched: [],
    alreadyExistingSkipped: 0,
    conflicts: [],
    failed: 0
  }

  for (const row of excelData) {
    const excelName = row['NAMA LENGKAP']
    const score = row['Score']
    const nim = row['NIM']
    const prodi = row['PROGRAM STUDI']
    const kelompok = row['NAMA KELOMPOK']

    if (!excelName || score === undefined || score === null || score === '' || typeof score !== 'number') {
      report.failed++
      continue
    }

    const profile = nameMap.get(normalize(excelName))

    if (!profile) {
      report.unmatched.push({
        nama: excelName.trim(),
        nim: nim || '-',
        prodi: prodi || '-',
        kelompok: kelompok || '-',
        score
      })
      continue
    }

    report.matched++

    // Check existing
    const existing = existingMap.get(profile.id)
    if (existing && existing.posttest > 0) {
      if (existing.posttest === score) {
        // Same score — skip, already correct
        report.alreadyExistingSkipped++
        continue
      }
      // Different score — overwrite with Excel (source of truth)
      report.conflicts.push({
        nama: profile.nama,
        nim: profile.nim || '-',
        dbScore: existing.posttest,
        excelScore: score,
        action: 'Overwritten'
      })
    }

    if (DRY_RUN) {
      console.log(`  [DRY] ${existing ? 'Overwrite' : 'Insert'}: ${profile.nama} | posttest=${score}`)
      report.seeded++
      continue
    }

    try {
      if (existing) {
        await client.query(
          'UPDATE penilaian_asa SET posttest = $1 WHERE user_id = $2 AND periode = $3',
          [Number(score), profile.id, PERIODE]
        )
        report.overwritten++
      } else {
        await client.query(
          `INSERT INTO penilaian_asa (user_id, periode, posttest, sikap_kedisiplinan, keaktifan, roadmap)
           VALUES ($1, $2, $3, 0, 0, 0)
           ON CONFLICT (user_id, periode) DO UPDATE SET posttest = $3`,
          [profile.id, PERIODE, Number(score)]
        )
      }
      report.seeded++
    } catch (e) {
      console.error(`  FAILED: ${profile.nama} - ${e.message}`)
      report.failed++
    }
  }

  // 8. Print report
  console.log('\n=== SEED REPORT ===')
  console.log(`Excel rows (raw):       ${report.totalExcelRaw}`)
  console.log(`Excel rows (deduped):   ${report.totalExcelDeduped}`)
  console.log(`Matched:                ${report.matched}`)
  console.log(`Successfully seeded:    ${report.seeded}`)
  console.log(`  - New inserts:        ${report.seeded - report.overwritten}`)
  console.log(`  - Overwritten:        ${report.overwritten}`)
  console.log(`Already same score:     ${report.alreadyExistingSkipped}`)
  console.log(`Unmatched:              ${report.unmatched.length}`)
  console.log(`Failed:                 ${report.failed}`)

  if (excelDupes.length > 0) {
    console.log('\n--- EXCEL DUPLICATES (skipped, first entry used) ---')
    excelDupes.forEach(d => {
      console.log(`  ${d.nama} | NIM: ${d.nim} | Score: ${d.score}`)
    })
  }

  if (report.unmatched.length > 0) {
    console.log('\n--- UNMATCHED USERS ---')
    report.unmatched.forEach(u => {
      console.log(`  ${u.nama} | NIM: ${u.nim} | Prodi: ${u.prodi} | Kelompok: ${u.kelompok} | Score: ${u.score}`)
    })
  }

  if (report.conflicts.length > 0) {
    console.log('\n--- CONFLICTS (overwritten with Excel) ---')
    report.conflicts.forEach(c => {
      console.log(`  ${c.nama} | NIM: ${c.nim} | DB: ${c.dbScore} | Excel: ${c.excelScore} | ${c.action}`)
    })
  }

  // 9. Final verification
  const finalRes = await client.query(
    'SELECT count(*) as total, count(CASE WHEN posttest > 0 THEN 1 END) as has_posttest FROM penilaian_asa WHERE periode = $1',
    [PERIODE]
  )
  console.log(`\nFinal verification: ${finalRes.rows[0].total} records, ${finalRes.rows[0].has_posttest} with posttest > 0`)

  // 10. Verify no other fields changed (spot check)
  const spotCheck = await client.query(
    `SELECT user_id, posttest, kehadiran, amalan_yaumi, sikap_kedisiplinan, keaktifan, roadmap
     FROM penilaian_asa WHERE periode = $1 AND (kehadiran > 0 OR amalan_yaumi > 0 OR sikap_kedisiplinan > 0)
     LIMIT 5`,
    [PERIODE]
  )
  if (spotCheck.rows.length > 0) {
    console.log('\nSpot check (other fields intact):')
    spotCheck.rows.forEach(r => {
      console.log(`  ${r.user_id.slice(0,8)}... | post:${r.posttest} keh:${r.kehadiran} amal:${r.amalan_yaumi} sikap:${r.sikap_kedisiplinan} aktif:${r.keaktifan} road:${r.roadmap}`)
    })
  }

  // Save report
  writeFileSync(join(ROOT, 'seed-posttest-report.json'), JSON.stringify(report, null, 2))
  console.log('\nReport saved to seed-posttest-report.json')

  await client.end()
}

main().catch(e => { console.error(e); process.exit(1) })
