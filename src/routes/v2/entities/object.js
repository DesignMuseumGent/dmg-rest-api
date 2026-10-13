import * as dotenv from 'dotenv'
import { supabase } from '../../../../supabaseClient.js'
import { buildModifiedSince, getLastFetch, setLastFetch } from "../utils/harvestLog.js"
import { buildLookupMaps } from '../utils/lookupMaps.js'
import {
    buildObjectJsonLd,
    extractYear
} from '../utils/buildObjectJsonLd.js'

dotenv.config()

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const isDMGObject = (url) => url?.includes('/dmg/') ?? false

// ---------------------------------------------------------------------------
// TEXT FIELDS
//
// NL always comes from the source. FR/EN are only written when the source
// actually supplies them: the source almost never does, and those columns are
// filled from dmg_translations (backfill_object_translations.sql). Writing
// `null` here would wipe the translations on every incremental update.
// ---------------------------------------------------------------------------

function textFields(item) {
    const fields = {
        object_title_nl:       item.titel_nl || item.titel || null,
        object_description_nl: item.omschrijving_nl || item.omschrijving || null,
    }
    if (item.titel_fr)        fields.object_title_fr       = item.titel_fr
    if (item.titel_en)        fields.object_title_en       = item.titel_en
    if (item.omschrijving_fr) fields.object_description_fr = item.omschrijving_fr
    if (item.omschrijving_en) fields.object_description_en = item.omschrijving_en
    return fields
}

// ---------------------------------------------------------------------------
// MAIN HARVEST
// ---------------------------------------------------------------------------

export async function getObjectData() {

    const lastFetch = await getLastFetch('objects')
    const modifiedSince = buildModifiedSince(lastFetch)

    let baseUrl = process.env.API_ARTEFACTS_URL
    if (modifiedSince) {
        baseUrl += `${baseUrl.includes('?') ? '&' : '?'}modifiedSince=${modifiedSince}`
        console.log(`📅 Incremental harvest from ${modifiedSince}`)
    } else {
        console.log(`📅 Full harvest — no previous fetch recorded`)
    }

    let url = baseUrl
    let processedCount = 0
    let validCount = 0
    let writtenCount = 0
    let totalRecords = null

    const { agentMap, conceptMap, objectMap, exhibitionMap } = await buildLookupMaps()

    while (url) {
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to fetch erfgoedAPI data: ' + res.statusText)
        const data = await res.json()

        if (totalRecords === null) totalRecords = data.total ?? '?'

        if (data.items && Array.isArray(data.items)) {
            for (const item of data.items) {
                processedCount++

                if (!isDMGObject(item.id)) continue
                validCount++

                const objectNumber = item.objectNummer
                if (!objectNumber) continue

                const built = buildObjectJsonLd(item, { agentMap, conceptMap, objectMap, exhibitionMap })
                if (!built) continue

                const { object, generatedAtTime, production_year_begin, production_year_end } = built

                const result = await saveObject(
                    item, object, generatedAtTime,
                    production_year_begin, production_year_end,
                    processedCount, totalRecords
                )
                if (result === 'inserted' || result === 'updated') writtenCount++
            }
        }

        console.log(`📄 page ${data.page} done — processed ${processedCount}/${totalRecords} | valid: ${validCount} | written: ${writtenCount}`)
        url = data.next
        if (url) await sleep(250)
    }

    await setLastFetch('objects')
    console.log(`✅ Done. ${validCount} valid objects, ${writtenCount} written.`)
}

// ---------------------------------------------------------------------------
// SAVE
// ---------------------------------------------------------------------------

async function saveObject(item, jsonLd, generatedAtTime, production_year_begin, production_year_end, current, total) {
    const objectNumber = item.objectNummer
    const progress = `[${current}/${total}]`

    const { data: existing, error: checkError } = await supabase
        .from('dmg_objects_LDES')
        .select('objectNumber')
        .eq('objectNumber', objectNumber)
        .maybeSingle()

    if (checkError) {
        console.error(`${progress} ✖ check failed for ${objectNumber}:`, checkError.message)
        return 'error'
    }

    // Shared between update and insert.
    const payload = {
        json_ld_v2: jsonLd,
        generated_at_time: generatedAtTime,
        ...textFields(item),
        // iiif_manifest: item.iiifManifestUri || null,
        production_year_begin,
        production_year_end
    }

    if (existing) {
        const { error } = await supabase
            .from('dmg_objects_LDES')
            .update(payload)
            .eq('objectNumber', objectNumber)

        if (error) {
            console.error(`${progress} ✖ update failed for ${objectNumber}:`, error.message)
            return 'error'
        }
        console.log(`${progress} ↻ updated ${objectNumber}`)
        return 'updated'

    } else {
        const { error } = await supabase
            .from('dmg_objects_LDES')
            .insert({
                objectNumber,
                is_version_of: item.id,
                ...payload
            })

        if (error) {
            console.error(`${progress} ✖ insert failed for ${objectNumber}:`, error.message)
            return 'error'
        }
        console.log(`${progress} + inserted ${objectNumber}`)
        return 'inserted'
    }
}