#!/usr/bin/env node

/**
 * ASA 2026 Participant Provisioning Script
 * 
 * Creates auth accounts and profiles for ASA 2026 participants.
 * - Generates unique NIM: ASA26001, ASA26002, etc.
 * - Generates unique email: participant001@halaqah.com, etc.
 * - Default password: 123456
 * - Role: user
 * - Status: aktif
 * 
 * Usage:
 *   node scripts/provision-asa-2026.js [--dry-run]
 * 
 * Requirements:
 *   - .env.local with VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY
 *   - CSV files in project root
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ========== CONFIG ==========
const DRY_RUN = process.argv.includes('--dry-run')
const DEFAULT_PASSWORD = '123456'
const NIM_PREFIX = 'ASA26'
const EMAIL_DOMAIN = 'halaqah.com'

// ========== LOAD ENV ==========
function loadEnv() {
  const envPath = join(ROOT, '.env.local')
  let env = {}
  try {
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const value = trimmed.slice(eqIdx + 1).trim()
      env[key] = value
    }
  } catch (e) {
    console.error('❌ Cannot read .env.local:', e.message)
    process.exit(1)
  }

  const url = env.VITE_SUPABASE_URL
  const serviceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  return { url, serviceKey }
}

// ========== CSV PARSER ==========
function parseCSV(content) {
  const lines = content.split('\n')
  const participants = []
  let currentGroup = 0
  let currentMentor = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cols = line.split(',').map(c => c.trim())

    // Mentor row
    if (cols[0] === 'Mentor' && cols[1]) {
      currentMentor = cols[1]
      continue
    }

    // Header row
    if (cols[0] === 'No') continue

    // Participant row: No, Nama, Prodi, Kelompok
    if (cols[0] && !isNaN(cols[0]) && cols[1]) {
      const no = parseInt(cols[0])
      const nama = cols[1]
      const prodi = cols[2] || ''
      const kelompok = cols[3] ? parseInt(cols[3]) : null

      if (kelompok) currentGroup = kelompok

      participants.push({
        nama,
        prodi,
        kelompok: currentGroup,
        mentor: currentMentor
      })
    }
  }

  return participants
}

// ========== LOAD CSV ==========
function loadCSV(filename) {
  try {
    const path = join(ROOT, filename)
    const content = readFileSync(path, 'utf-8')
    return parseCSV(content)
  } catch (e) {
    console.error(`❌ Cannot read ${filename}:`, e.message)
    return []
  }
}

// ========== GENERATE NIM & EMAIL ==========
function generateNIM(index) {
  return `${NIM_PREFIX}${String(index).padStart(3, '0')}`
}

function generateEmail(nama, index) {
  // Simple email: participant001@halaqah.com
  return `participant${String(index).padStart(3, '0')}@${EMAIL_DOMAIN}`
}

// ========== MAIN ==========
async function main() {
  console.log('========================================')
  console.log('ASA 2026 PARTICIPANT PROVISIONING')
  console.log('========================================')
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`)
  console.log()

  // Load env
  const { url, serviceKey } = loadEnv()
  const supabase = createClient(url, serviceKey)

  // Load CSVs
  const ikhwan = loadCSV('KELOMPOK_ASA_2026_Ikhwan.csv')
  const akhwat = loadCSV('KELOMPOK_ASA_2026_Akhwat.csv')

  console.log('Source:')
  console.log(`- Ikhwan : ${ikhwan.length} participants`)
  console.log(`- Akhwat : ${akhwat.length} participants`)
  console.log()

  // Combine and deduplicate
  const allParticipants = [
    ...ikhwan.map(p => ({ ...p, source: 'Ikhwan' })),
    ...akhwat.map(p => ({ ...p, source: 'Akhwat' }))
  ]

  // Check for duplicate names (same person in both lists)
  const seenNames = new Set()
  const uniqueParticipants = []
  const duplicateNames = []

  for (const p of allParticipants) {
    const normalizedName = p.nama.toLowerCase().trim()
    if (seenNames.has(normalizedName)) {
      duplicateNames.push(p)
    } else {
      seenNames.add(normalizedName)
      uniqueParticipants.push(p)
    }
  }

  if (duplicateNames.length > 0) {
    console.log(`⚠️  Duplicate names found: ${duplicateNames.length}`)
    duplicateNames.forEach(p => console.log(`   - ${p.nama} (${p.source})`))
    console.log()
  }

  // Get existing auth users
  console.log('Checking existing auth users...')
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existingEmails = new Set(existingUsers?.users?.map(u => u.email) || [])
  console.log(`Existing auth users: ${existingEmails.size}`)
  console.log()

  // Get existing profiles
  const { data: existingProfiles } = await supabase.from('profiles').select('nim, email')
  const existingNIMs = new Set(existingProfiles?.map(p => p.nim).filter(Boolean) || [])
  const existingProfileEmails = new Set(existingProfiles?.map(p => p.email).filter(Boolean) || [])
  console.log(`Existing profiles: ${existingProfiles?.length || 0}`)
  console.log()

  // Provisioning
  const results = {
    created: 0,
    skipped_existing: 0,
    duplicate_nim: 0,
    invalid_nim: 0,
    failed: 0,
    details: []
  }

  let nimCounter = 1

  for (const participant of uniqueParticipants) {
    const nim = generateNIM(nimCounter)
    const email = generateEmail(participant.nama, nimCounter)

    // Validate NIM
    if (!nim || nim.trim() === '') {
      results.invalid_nim++
      results.details.push({
        nim,
        nama: participant.nama,
        source: participant.source,
        status: 'INVALID_NIM',
        reason: 'Empty NIM',
        auth_user_id: ''
      })
      continue
    }

    // Check duplicate NIM
    if (existingNIMs.has(nim)) {
      results.duplicate_nim++
      results.details.push({
        nim,
        nama: participant.nama,
        source: participant.source,
        status: 'DUPLICATE_NIM',
        reason: 'NIM already exists in database',
        auth_user_id: ''
      })
      continue
    }

    // Check existing email
    if (existingEmails.has(email) || existingProfileEmails.has(email)) {
      results.skipped_existing++
      results.details.push({
        nim,
        nama: participant.nama,
        source: participant.source,
        status: 'SKIPPED_EXISTING',
        reason: 'Email already exists',
        auth_user_id: ''
      })
      nimCounter++
      continue
    }

    // Create auth user
    if (DRY_RUN) {
      results.created++
      results.details.push({
        nim,
        nama: participant.nama,
        source: participant.source,
        status: 'CREATED (DRY RUN)',
        reason: 'Would create',
        auth_user_id: `dry-run-${nimCounter}`
      })
      existingNIMs.add(nim)
      nimCounter++
      continue
    }

    try {
      const { data: userData, error: userError } = await supabase.auth.admin.createUser({
        email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: {
          nama: participant.nama
        }
      })

      if (userError) {
        results.failed++
        results.details.push({
          nim,
          nama: participant.nama,
          source: participant.source,
          status: 'FAILED',
          reason: userError.message,
          auth_user_id: ''
        })
        continue
      }

      // Update profile with NIM, role, status, prodi, etc.
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          nim,
          role: 'user',
          status_akun: 'aktif',
          prodi: participant.prodi,
          email
        })
        .eq('id', userData.user.id)

      if (profileError) {
        console.error(`⚠️  Profile update failed for ${participant.nama}:`, profileError.message)
      }

      results.created++
      results.details.push({
        nim,
        nama: participant.nama,
        source: participant.source,
        status: 'CREATED',
        reason: 'New participant',
        auth_user_id: userData.user.id
      })

      existingNIMs.add(nim)
      nimCounter++

      // Progress indicator
      if (results.created % 10 === 0) {
        console.log(`  Created ${results.created} accounts...`)
      }
    } catch (e) {
      results.failed++
      results.details.push({
        nim,
        nama: participant.nama,
        source: participant.source,
        status: 'FAILED',
        reason: e.message,
        auth_user_id: ''
      })
    }
  }

  // Print results
  console.log()
  console.log('RESULT:')
  console.log('----------------------------------------')
  console.log(`Created             : ${results.created}`)
  console.log(`Already Existing    : ${results.skipped_existing}`)
  console.log(`Duplicate NIM       : ${results.duplicate_nim}`)
  console.log(`Invalid NIM         : ${results.invalid_nim}`)
  console.log(`Failed              : ${results.failed}`)
  console.log('----------------------------------------')
  console.log(`Total Processed     : ${uniqueParticipants.length}`)
  console.log('========================================')

  // Save report
  const reportPath = join(ROOT, 'participant-provisioning-report.csv')
  const reportHeader = 'nim,nama,source,status,reason,auth_user_id'
  const reportRows = results.details.map(d =>
    `${d.nim},"${d.nama}",${d.source},${d.status},"${d.reason}",${d.auth_user_id}`
  )
  writeFileSync(reportPath, [reportHeader, ...reportRows].join('\n'))
  console.log()
  console.log(`📄 Report saved to: ${reportPath}`)

  // Save summary
  const summaryPath = join(ROOT, 'participant-provisioning-summary.json')
  writeFileSync(summaryPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    dry_run: DRY_RUN,
    ikhwan_count: ikhwan.length,
    akhwat_count: akhwat.length,
    total_unique: uniqueParticipants.length,
    results: {
      created: results.created,
      skipped_existing: results.skipped_existing,
      duplicate_nim: results.duplicate_nim,
      invalid_nim: results.invalid_nim,
      failed: results.failed
    }
  }, null, 2))
  console.log(`📊 Summary saved to: ${summaryPath}`)
}

main().catch(e => {
  console.error('❌ Fatal error:', e)
  process.exit(1)
})
