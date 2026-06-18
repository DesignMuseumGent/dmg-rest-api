import * as dotenv from 'dotenv'
import { validateMember } from "../utils/validateMember.js"
import { supabase } from '../subabaseClient.js'
import { NATIONALITIES } from '../utils/nationalities.js'
import { buildModifiedSince, getLastFetch, setLastFetch } from "../utils/harvestLog.js"

dotenv.config()

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const extractIdFromUrl = (url) => {
    if (!url) return null
    const match = url.match(/\/(\d+)$/)
    return match ? match[1] : null
}

export async function getAgentData() {

    const lastFetch = await getLastFetch('agents')
    const modifiedSince = buildModifiedSince(lastFetch)

    let baseUrl = process.env.API_AGENTS_URL
    if (modifiedSince) {
        baseUrl += `${baseUrl.includes('?') ? '&' : '?'}modifiedSince=${modifiedSince}`
        console.log(`📅 Incremental harvest from ${modifiedSince}`)
    } else {
        console.log(`📅 Full harvest — no previous fetch recorded`)
    }

    let url = baseUrl
    let writtenCount = 0
    let validCount = 0
    let processedCount = 0
    let totalRecords = null

    const unmappedNationalities = new Set()

    while (url) {
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to fetch erfgoedAPI data: ' + res.statusText)
        const data = await res.json()

        if (totalRecords === null) totalRecords = data.total

        if (data.items && Array.isArray(data.items)) {
            for (const item of data.items) {
                processedCount++

                if (!await validateMember(item, 53)) continue
                validCount++

                const baseId = `https://data.designmuseumgent.be/v2/id/agent/${item.internReferentieNummer}`
                const generatedAtTime = item.lastModifiedDate || new Date().toISOString()

                // owl:sameAs — always array
                const sameAs = [
                    item.id,
                    ...(item.externalIds || []).filter(extId => extId !== item.id)
                ]

                const person = {
                    "@context": {
                        "owl":    "https://www.w3.org/2002/07/owl#",
                        "crm":    "http://www.cidoc-crm.org/cidoc-crm/",
                        "rdfs":   "http://www.w3.org/2000/01/rdf-schema#",
                        "xsd":    "http://www.w3.org/2001/XMLSchema#",
                        "prov":   "http://www.w3.org/ns/prov#",
                        "person": "http://www.w3.org/ns/person#"
                    },
                    "@id":    baseId,
                    "@type":  "crm:E39_Actor",
                    "owl:sameAs": sameAs,
                    "rdfs:label": item.volledigeNaam,
                    "prov:generatedAtTime": {
                        "@value": generatedAtTime,
                        "@type":  "xsd:dateTime"
                    },
                    // always array from the start
                    "crm:P1_is_identified_by": []
                }

                // ── identifiers ──────────────────────────────────────────
                if (item.volledigeNaam) {
                    person["crm:P1_is_identified_by"].push({
                        "@id":    `${baseId}/appellation/preferred`,
                        "@type":  "crm:E41_Appellation",
                        "rdfs:label": item.volledigeNaam
                    })
                }

                for (const [i, alt] of (item.alternatieveNamen || []).entries()) {
                    person["crm:P1_is_identified_by"].push({
                        "@id":    `${baseId}/appellation/alt-${i}`,
                        "@type":  "crm:E41_Appellation",
                        "rdfs:label": alt
                    })
                }

                if (item.internReferentieNummer) {
                    person["crm:P1_is_identified_by"].push({
                        "@id":    `${baseId}/identifier/intern`,
                        "@type":  "crm:E42_Identifier",
                        "rdfs:label": item.internReferentieNummer,
                        "crm:P2_has_type": {
                            "@id":    "https://data.designmuseumgent.be/v2/id/type/intern-referentienummer",
                            "@type":  "crm:E55_Type",
                            "rdfs:label": "Intern referentienummer"
                        }
                    })
                }

                // ── gender — always array ────────────────────────────────
                if (item.geslacht) {
                    person["crm:P2_has_type"] = [
                        {
                            "@id":   item.geslacht,
                            "@type": "crm:E55_Type"
                        }
                    ]
                }

                // ── birth event ──────────────────────────────────────────
                if (item.geboortedatum || item.geboorteplaats) {
                    person["crm:P98i_was_born"] = buildEvent(
                        `${baseId}/birth`, "crm:E67_Birth",
                        item.geboortedatum, item.geboorteplaats
                    )
                }

                // ── death event ──────────────────────────────────────────
                if (item.sterfdatum || item.sterfplaats) {
                    person["crm:P100i_died_in"] = buildEvent(
                        `${baseId}/death`, "crm:E69_Death",
                        item.sterfdatum, item.sterfplaats
                    )
                }

                // ── nationality ──────────────────────────────────────────
                // person:citizenship is used instead of crm:P107i_is_current_or_former_member_of
                // to unambiguously distinguish nationality from curated group membership
                // relations (member_of, employee_of, etc.) which use P107i.
                // Value is a crm:E53_Place with multilingual rdfs:label from nationalities.js.
                if (item.nationaliteit) {
                    const key   = item.nationaliteit.trim().toLowerCase()
                    const match = NATIONALITIES[key]
                    if (match) {
                        person["person:citizenship"] = match
                    } else {
                        unmappedNationalities.add(item.nationaliteit.trim())
                    }
                }

                const result = await saveAgent(item, person, generatedAtTime, processedCount, totalRecords)
                if (result === 'inserted' || result === 'updated') writtenCount++
            }
        }

        console.log(`📄 page ${data.page} done — processed ${processedCount}/${totalRecords} records`)
        url = data.next
        if (url) await sleep(250)
    }

    await setLastFetch('agents')

    if (unmappedNationalities.size > 0) {
        console.log('\n⚠️  Unmapped nationalities — add these to nationalities.js:')
        for (const n of [...unmappedNationalities].sort()) {
            console.log(`  "${n.toLowerCase()}": { ... }`)
        }
    } else {
        console.log('✅ All nationalities mapped.')
    }

    console.log(`✅ Done. ${validCount} valid agents, ${writtenCount} written.`)
}

function buildEvent(id, type, date, place) {
    const event = { "@id": id, "@type": type }

    if (date) {
        event["crm:P4_has_time-span"] = {
            "@type":      "crm:E52_Time-Span",
            "rdfs:label": date
        }
    }

    if (place?.uri) {
        event["crm:P7_took_place_at"] = {
            "@id":        place.uri,
            "@type":      "crm:E53_Place",
            "rdfs:label": place.label
        }
    }

    return event
}

async function saveAgent(item, jsonLd, generatedAtTime, current, total) {
    const agentId   = item.internReferentieNummer
    const datahubId = extractIdFromUrl(item.id)
    const progress  = `[${current}/${total}]`

    const { data: existing, error: checkError } = await supabase
        .from('dmg_personen_LDES')
        .select('agent_ID')
        .eq('agent_ID', agentId)
        .maybeSingle()

    if (checkError) {
        console.error(`${progress} ✖ check failed for ${agentId}:`, checkError.message)
        return 'error'
    }

    if (existing) {
        const { error } = await supabase
            .from('dmg_personen_LDES')
            .update({
                json_ld_v2:        jsonLd,
                generated_at_time: generatedAtTime
            })
            .eq('agent_ID', agentId)

        if (error) {
            console.error(`${progress} ✖ update failed for ${agentId}:`, error.message)
            return 'error'
        }
        console.log(`${progress} ↻ updated ${agentId}`)
        return 'updated'

    } else {
        const { error } = await supabase
            .from('dmg_personen_LDES')
            .insert({
                agent_ID:          agentId,
                id:                datahubId,
                json_ld_v2:        jsonLd,
                generated_at_time: generatedAtTime
            })

        if (error) {
            console.error(`${progress} ✖ insert failed for ${agentId}:`, error.message)
            return 'error'
        }
        console.log(`${progress} + inserted ${agentId} (id: ${datahubId})`)
        return 'inserted'
    }
}