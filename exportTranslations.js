// ---------------------------------------------------------------------------
// exportTranslations.js
// Exports all NL source strings from dmg_translations as a CSV file with
// empty FR and EN columns ready for translators to fill in.
// Rows that already have FR/EN translations are included with those values
// pre-filled — so re-exporting never loses existing work.
//
// Usage: node exportTranslations.js
// Output: translations_export_YYYY-MM-DD.csv
// ---------------------------------------------------------------------------

import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'

dotenv.config()

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY
)

function escapeCsv(val) {
    if (val === null || val === undefined) return ''
    const str = String(val)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
    }
    return str
}

async function exportTranslations() {
    console.log('📤 Exporting translations...')

    // fetch all NL rows
    const { data: nlRows, error: nlError } = await supabase
        .from('dmg_translations')
        .select('record_type, record_id, field, field_path, value')
        .eq('lang', 'nl')
        .order('field', { ascending: true })
        .order('field_path', { ascending: true })
        .order('record_id', { ascending: true })

    if (nlError) {
        console.error('Fetch error:', nlError.message)
        return
    }

    // fetch all existing FR rows
    const { data: frRows } = await supabase
        .from('dmg_translations')
        .select('record_type, record_id, field, field_path, value')
        .eq('lang', 'fr')

    // fetch all existing EN rows
    const { data: enRows } = await supabase
        .from('dmg_translations')
        .select('record_type, record_id, field, field_path, value')
        .eq('lang', 'en')

    // build lookup maps for existing translations
    const key = (row) =>
        `${row.record_type}|${row.record_id}|${row.field}|${row.field_path ?? ''}`

    const frMap = {}
    for (const r of (frRows || [])) frMap[key(r)] = r.value

    const enMap = {}
    for (const r of (enRows || [])) enMap[key(r)] = r.value

    // build CSV
    const headers = [
        'record_type',
        'record_id',
        'field',
        'field_path',
        'value_nl',
        'value_fr',
        'value_en'
    ]

    const lines = [headers.join(',')]

    for (const row of nlRows) {
        const k = key(row)
        lines.push([
            escapeCsv(row.record_type),
            escapeCsv(row.record_id),
            escapeCsv(row.field),
            escapeCsv(row.field_path),
            escapeCsv(row.value),
            escapeCsv(frMap[k] ?? ''),
            escapeCsv(enMap[k] ?? '')
        ].join(','))
    }

    const filename = `translations_export_${new Date().toISOString().slice(0, 10)}.csv`
    writeFileSync(filename, lines.join('\n'), 'utf-8')

    const missing_fr = nlRows.filter(r => !frMap[key(r)]).length
    const missing_en = nlRows.filter(r => !enMap[key(r)]).length

    console.log(`✅ Exported ${nlRows.length} rows to ${filename}`)
    console.log(`   Missing FR: ${missing_fr}`)
    console.log(`   Missing EN: ${missing_en}`)
}

exportTranslations().catch(console.error)