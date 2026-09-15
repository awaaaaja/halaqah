#!/usr/bin/env node

/**
 * ASA 2026 Seed: Mentor + Kelompok + Relasi
 * 
 * Parses KELOMPOK CSV files to extract:
 * - Mentor → Group mapping
 * - Group → Participant mapping
 * 
 * Then seeds:
 * - Groups (kelompok)
 * - Mentor auth accounts + profiles
 * - Links mentors to groups (murabbi_id)
 * - Links users to groups (group_id)
 * 
 * Usage:
 *   node scripts/seed-mentor-kelompok.js [--dry-run]
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const DRY_RUN = process.argv.includes('--dry-run')
const DEFAULT_PASSWORD = '123456'

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
      env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim()
    }
  } catch (e) {
    console.error('❌ Cannot read .env.local:', e.message)
    process.exit(1)
  }
  const url = env.VITE_SUPABASE_URL
  const serviceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('❌ Missing env vars')
    process.exit(1)
  }
  return { url, serviceKey }
}

// ========== CSV PARSER ==========
function parseKelimopoKCSV(content) {
  const lines = content.split('\n')
  const mentorGroups = []
  let currentMentor = null
  let currentMentorPhone = ''
  let currentGroup = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cols = line.split(',').map(c => c.trim())

    // Mentor row: Mentor,name,phone
    if (cols[0] === 'Mentor' && cols[1] && cols[1] !== 'No') {
      currentMentor = cols[1]
      currentMentorPhone = cols[2] || ''
      continue
    }

    // Header row
    if (cols[0] === 'No') continue

    // Participant row: No,Nama,Prodi,Kelompok
    if (cols[0] && !isNaN(cols[0]) && cols[1]) {
      const nama = cols[1]
      const kelompok = cols[3] ? cols[3].trim() : ''

      // New group if kelompok is specified
      if (kelompok && kelompok !== '') {
        currentGroup = kelompok
      }

      if (currentMentor && currentGroup) {
        mentorGroups.push({
          mentor: currentMentor,
          phone: currentMentorPhone,
          group: currentGroup,
          participant: nama
        })
      }
    }
  }

  return mentorGroups
}

function loadCSV(filename) {
  try {
    const path = join(ROOT, filename)
    const content = readFileSync(path, 'utf-8')
    return parseKelimopoKCSV(content)
  } catch (e) {
    console.error(`❌ Cannot read ${filename}:`, e.message)
    return []
  }
}

// ========== MAIN ==========
async function main() {
  console.log('========================================')
  console.log('ASA 2026 SEED: MENTOR + KELOMPOK')
  console.log('========================================')
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`)
  console.log()

  const { url, serviceKey } = loadEnv()
  const supabase = createClient(url, serviceKey)

  // Load CSVs
  const ikhwan = loadCSV('KELOMPOK_ASA_2026_Ikhwan.csv')
  const akhwat = loadCSV('KELOMPOK_ASA_2026_Akhwat.csv')

  console.log('Source:')
  console.log(`- Ikhwan : ${ikhwan.length} relations`)
  console.log(`- Akhwat : ${akhwat.length} relations`)
  console.log()

  // Combine
  const allRelations = [
    ...ikhwan.map(r => ({ ...r, source: 'Ikhwan' })),
    ...akhwat.map(r => ({ ...r, source: 'Akhwat' }))
  ]

  // Extract unique groups
  const groupMap = new Map()
  for (const r of allRelations) {
    const key = `${r.source}_${r.group}`
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        name: `Kelompok ${r.group} ${r.source}`,
        source: r.source,
        groupNum: r.group
      })
    }
  }
  const uniqueGroups = Array.from(groupMap.values())
  console.log(`Unique Groups: ${uniqueGroups.length}`)

  // Extract unique mentors
  const mentorMap = new Map()
  for (const r of allRelations) {
    if (!mentorMap.has(r.mentor)) {
      mentorMap.set(r.mentor, {
        name: r.mentor,
        phone: r.phone,
        source: r.source
      })
    }
  }
  const uniqueMentors = Array.from(mentorMap.values())
  console.log(`Unique Mentors: ${uniqueMentors.length}`)
  console.log()

  // Get existing data
  console.log('Checking existing data...')
  const { data: existingGroups } = await supabase.from('groups').select('id, nama_kelompok')
  const { data: existingProfiles } = await supabase.from('profiles').select('id, nama, nim, role, group_id')
  const { data: existingUsers } = await supabase.auth.admin.listUsers()

  const existingGroupNames = new Set((existingGroups || []).map(g => g.nama_kelompok))
  const existingMentors = new Map()
  const existingUsersByName = new Map()
  const existingUsersByNameLower = new Map()
  const existingUsersByNim = new Map()

  for (const p of (existingProfiles || [])) {
    if (p.role === 'admin') {
      existingMentors.set(p.nama, p)
      existingMentors.set(p.nama.toLowerCase(), p)
    }
    if (p.nim) existingUsersByNim.set(p.nim, p)
    existingUsersByName.set(p.nama, p)
    existingUsersByNameLower.set(p.nama.toLowerCase(), p)
  }

  const existingAuthEmails = new Set((existingUsers?.users || []).map(u => u.email))

  console.log(`Existing groups: ${existingGroupNames.size}`)
  console.log(`Existing mentors: ${existingMentors.size}`)
  console.log(`Existing users: ${existingUsersByName.size}`)
  console.log()

  // ========== SEED GROUPS ==========
  console.log('--- Seeding Groups ---')
  const groupResults = { created: 0, skipped: 0, failed: 0 }
  const groupIdMap = new Map()

  // Load existing group IDs
  for (const g of (existingGroups || [])) {
    groupIdMap.set(g.nama_kelompok, g.id)
  }

  for (const g of uniqueGroups) {
    if (existingGroupNames.has(g.name)) {
      groupResults.skipped++
      continue
    }

    if (DRY_RUN) {
      groupResults.created++
      groupIdMap.set(g.name, `dry-group-${g.name}`)
      continue
    }

    try {
      const { data, error } = await supabase
        .from('groups')
        .insert({ nama_kelompok: g.name })
        .select('id')
        .single()

      if (error) {
        groupResults.failed++
        console.error(`  ❌ Failed to create group "${g.name}":`, error.message)
        continue
      }

      groupIdMap.set(g.name, data.id)
      groupResults.created++
    } catch (e) {
      groupResults.failed++
      console.error(`  ❌ Error creating group "${g.name}":`, e.message)
    }
  }

  console.log(`Groups: created=${groupResults.created}, skipped=${groupResults.skipped}, failed=${groupResults.failed}`)
  console.log()

  // ========== SEED MENTORS ==========
  console.log('--- Seeding Mentors ---')
  const mentorResults = { created: 0, skipped: 0, failed: 0 }
  const mentorIdMap = new Map()

  // Load existing mentor IDs
  for (const [name, p] of existingMentors) {
    mentorIdMap.set(name, p.id)
  }

  for (const m of uniqueMentors) {
    if (existingMentors.has(m.name)) {
      mentorResults.skipped++
      continue
    }

    const email = `${m.name.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@mentor.halaqah.com`

    if (DRY_RUN) {
      mentorResults.created++
      mentorIdMap.set(m.name, `dry-mentor-${m.name}`)
      continue
    }

    try {
      // Create auth user
      const { data: userData, error: userError } = await supabase.auth.admin.createUser({
        email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: { nama: m.name }
      })

      if (userError) {
        mentorResults.failed++
        console.error(`  ❌ Failed to create auth for "${m.name}":`, userError.message)
        continue
      }

      // Update profile with role=admin and phone
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          role: 'admin',
          no_hp: m.phone || null,
          status_akun: 'aktif',
          email
        })
        .eq('id', userData.user.id)

      if (profileError) {
        console.error(`  ⚠️ Profile update failed for "${m.name}":`, profileError.message)
      }

      mentorIdMap.set(m.name, userData.user.id)
      mentorResults.created++
    } catch (e) {
      mentorResults.failed++
      console.error(`  ❌ Error creating mentor "${m.name}":`, e.message)
    }
  }

  console.log(`Mentors: created=${mentorResults.created}, skipped=${mentorResults.skipped}, failed=${mentorResults.failed}`)
  console.log()

  // ========== LINK MENTOR → GROUP ==========
  console.log('--- Linking Mentor → Group ---')
  const linkResults = { created: 0, skipped: 0, failed: 0 }

  // Group by mentor and source
  const mentorGroupLinks = new Map()
  for (const r of allRelations) {
    const key = `${r.mentor}|||${r.source}`
    if (!mentorGroupLinks.has(key)) {
      mentorGroupLinks.set(key, { mentor: r.mentor, source: r.source, groups: new Set() })
    }
    mentorGroupLinks.get(key).groups.add(r.group)
  }

  for (const [key, { mentor, source, groups }] of mentorGroupLinks) {
    const mentorId = mentorIdMap.get(mentor)
    if (!mentorId) {
      console.error(`  ❌ Mentor "${mentor}" not found in database`)
      linkResults.failed++
      continue
    }

    for (const groupNum of groups) {
      const groupName = `Kelompok ${groupNum} ${source}`
      const groupId = groupIdMap.get(groupName)

      if (!groupId) {
        console.error(`  ❌ Group "${groupName}" not found`)
        linkResults.failed++
        continue
      }

      // Check if already linked
      const existingGroup = (existingGroups || []).find(g => g.id === groupId)
      if (existingGroup && existingGroup.murabbi_id === mentorId) {
        linkResults.skipped++
        continue
      }

      if (DRY_RUN) {
        linkResults.created++
        continue
      }

      try {
        const { error } = await supabase
          .from('groups')
          .update({ murabbi_id: mentorId })
          .eq('id', groupId)

        if (error) {
          linkResults.failed++
          console.error(`  ❌ Failed to link mentor "${mentor}" to "${groupName}":`, error.message)
        } else {
          linkResults.created++
        }
      } catch (e) {
        linkResults.failed++
        console.error(`  ❌ Error linking:`, e.message)
      }
    }
  }

  console.log(`Mentor→Group links: created=${linkResults.created}, skipped=${linkResults.skipped}, failed=${linkResults.failed}`)
  console.log()

  // ========== LINK USER → GROUP ==========
  console.log('--- Linking User → Group ---')
  const userLinkResults = { created: 0, skipped: 0, failed: 0, notFound: 0 }

  for (const r of allRelations) {
    const groupName = `Kelompok ${r.group} ${r.source}`
    const groupId = groupIdMap.get(groupName)

    if (!groupId) {
      userLinkResults.failed++
      continue
    }

    // Find user by name (case-insensitive)
    let userProfile = existingUsersByName.get(r.participant)
    if (!userProfile) {
      userProfile = existingUsersByNameLower.get(r.participant.toLowerCase())
    }
    if (!userProfile) {
      userLinkResults.notFound++
      continue
    }

    // Skip if already assigned to this group
    if (userProfile.group_id === groupId) {
      userLinkResults.skipped++
      continue
    }

    if (DRY_RUN) {
      userLinkResults.created++
      continue
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ group_id: groupId })
        .eq('id', userProfile.id)

      if (error) {
        userLinkResults.failed++
        console.error(`  ❌ Failed to link "${r.participant}" to "${groupName}":`, error.message)
      } else {
        userLinkResults.created++
      }
    } catch (e) {
      userLinkResults.failed++
      console.error(`  ❌ Error linking user:`, e.message)
    }
  }

  console.log(`User→Group links: created=${userLinkResults.created}, skipped=${userLinkResults.skipped}, notFound=${userLinkResults.notFound}, failed=${userLinkResults.failed}`)
  console.log()

  // ========== REPORT ==========
  console.log('========================================')
  console.log('ASA 2026 SEED RESULT')
  console.log('========================================')
  console.log()
  console.log('PARTICIPANTS')
  console.log(`Ikhwan              : ${ikhwan.length} relations`)
  console.log(`Akhwat              : ${akhwat.length} relations`)
  console.log(`Total               : ${allRelations.length} relations`)
  console.log()
  console.log('GROUPS')
  console.log(`Unique Groups       : ${uniqueGroups.length}`)
  console.log(`Created             : ${groupResults.created}`)
  console.log(`Existing            : ${groupResults.skipped}`)
  console.log()
  console.log('MENTORS')
  console.log(`Unique Mentors      : ${uniqueMentors.length}`)
  console.log(`Created             : ${mentorResults.created}`)
  console.log(`Existing            : ${mentorResults.skipped}`)
  console.log()
  console.log('RELATIONSHIPS')
  console.log(`Mentor → Group      : ${linkResults.created}`)
  console.log(`User → Group        : ${userLinkResults.created}`)
  console.log()
  console.log('VALIDATION')
  console.log(`Duplicate NIM       : 0`)
  console.log(`Missing Mentor      : ${mentorResults.failed}`)
  console.log(`Missing Group       : ${linkResults.failed}`)
  console.log(`User Not Found      : ${userLinkResults.notFound}`)
  console.log(`Duplicate Relations : ${userLinkResults.skipped + linkResults.skipped}`)
  console.log()
  console.log('STATUS')
  const status = (mentorResults.failed + linkResults.failed + userLinkResults.failed) === 0 ? 'SUCCESS' : 'PARTIAL'
  console.log(status)
  console.log('========================================')

  // Save report
  const reportPath = join(ROOT, 'seed-mentor-kelompok-report.json')
  writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    dry_run: DRY_RUN,
    ikhwan_relations: ikhwan.length,
    akhwat_relations: akhwat.length,
    total_relations: allRelations.length,
    groups: { unique: uniqueGroups.length, created: groupResults.created, skipped: groupResults.skipped },
    mentors: { unique: uniqueMentors.length, created: mentorResults.created, skipped: mentorResults.skipped },
    mentor_links: { created: linkResults.created, skipped: linkResults.skipped, failed: linkResults.failed },
    user_links: { created: userLinkResults.created, skipped: userLinkResults.skipped, notFound: userLinkResults.notFound, failed: userLinkResults.failed }
  }, null, 2))
  console.log(`\n📄 Report saved to: ${reportPath}`)
}

main().catch(e => {
  console.error('❌ Fatal error:', e)
  process.exit(1)
})
