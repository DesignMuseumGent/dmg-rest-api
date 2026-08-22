// ---------------------------------------------------------------------------
// importCmsExhibitions.js
// Imports exhibition titles and descriptions from the old CMS export into
// dmg_tentoonstelling_LDES, matching on title_NL (case-insensitive).
//
// Matches by normalised title_NL — strips punctuation and lowercases both
// the CMS title and the DB title before comparing.
//
// Only writes fields that are non-empty and differ from what's already there.
// Safe to re-run.
//
// Usage: node importCmsExhibitions.js
// ---------------------------------------------------------------------------

import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

dotenv.config()

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY ?? process.env.SUPABASE_KEY
)

const __dir = dirname(fileURLToPath(import.meta.url))

const normalize = (str) =>
    (str || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()

async function importCmsExhibitions() {
    console.log('📥 Importing CMS exhibition content...')

    const cms = JSON.parse(readFileSync(join(__dir, 'cms_exhibitions.json'), 'utf-8'))
    const useful = cms.filter(r => r.text_en || r.text_fr || r.title_en || r.title_fr)
    console.log(`   CMS entries with content to import: ${useful.length}`)

    // fetch all exhibitions from Supabase
    const { data: dbRows, error } = await supabase
        .from('dmg_tentoonstelling_LDES')
        .select('id, exh_PID, title_NL, title_EN, title_FR, text_NL, text_EN, text_FR')

    if (error) {
        console.error('Fetch error:', error.message)
        return
    }

    // build lookup: normalised title_NL → db row
    const dbMap = {}
    for (const row of dbRows) {
        const key = normalize(row.title_NL)
        if (key) dbMap[key] = row
    }

    console.log(`   DB exhibitions: ${dbRows.length}`)

    let matched   = 0
    let updated   = 0
    let skipped   = 0
    let unmatched = 0

    for (const cms_row of useful) {
        const key = normalize(cms_row.title_nl)
        const dbRow = dbMap[key]

        if (!dbRow) {
            console.log(`  ✗ no match: "${cms_row.title_nl}" (${cms_row.slug})`)
            unmatched++
            continue
        }

        matched++

        // build update payload — only fields with new content
        const payload = {}

        if (cms_row.title_en && !dbRow.title_EN) {
            payload.title_EN = cms_row.title_en
        }
        if (cms_row.title_fr && !dbRow.title_FR) {
            payload.title_FR = cms_row.title_fr
        }
        if (cms_row.text_en && !dbRow.text_EN) {
            payload.text_EN = cms_row.text_en
        }
        if (cms_row.text_fr && !dbRow.text_FR) {
            payload.text_FR = cms_row.text_fr
        }

        if (cms_row.text_nl && !dbRow.text_NL) {
            payload.text_NL = cms_row.text_nl
        }

        if (Object.keys(payload).length === 0) {
            skipped++
            continue
        }

        const { error: updateError } = await supabase
            .from('dmg_tentoonstelling_LDES')
            .update(payload)
            .eq('id', dbRow.id)

        if (updateError) {
            console.error(`  ✖ update failed for ${dbRow.exh_PID}:`, updateError.message)
        } else {
            const fields = Object.keys(payload).join(', ')
            console.log(`  ✓ ${dbRow.exh_PID} "${dbRow.title_NL}" — ${fields}`)
            updated++
        }
    }

    console.log(`\n✅ Done.`)
    console.log(`   Matched  : ${matched}`)
    console.log(`   Updated  : ${updated}`)
    console.log(`   Skipped (already had content): ${skipped}`)
    console.log(`   Unmatched: ${unmatched}`)
}

importCmsExhibitions().catch(console.error)