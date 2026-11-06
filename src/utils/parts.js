// utils/parts.js
//
// Koepelrecord → enkelvoudige records (crm:P106_is_composed_of).
// Default: bare links, no extra query. With ?expandParts=true each part gets
// its label, NL/FR/EN titles and image(s), fetched in one batched query per
// request (per page on /objects).
// Only HEALTHY + canonical parts are expanded (same hard rule as every public
// listing), which also hides parts flipped UNHEALTHY since relations last ran.

import { supabase } from '../../supabaseClient.js'
import { applyImagesToObject } from './iiif_images.js'

const CHUNK = 200   // keep .in() query strings well under gateway limits

export function parseParts(hasParts) {
    if (!hasParts) return []
    if (typeof hasParts === 'string') return hasParts.split(',').map(p => p.trim()).filter(Boolean)
    return Array.isArray(hasParts) ? hasParts : []
}

export function bareParts(parts, BASE_URI) {
    return parts.map(p => ({
        "@id": `${BASE_URI}id/object/${p}`,
        "@type": "crm:E22_Human-Made_Object"
    }))
}

async function fetchPartRows(partNumbers) {
    const rows = []
    for (let i = 0; i < partNumbers.length; i += CHUNK) {
        const { data, error } = await supabase
            .from('dmg_objects_LDES')
            .select('objectNumber, object_title_nl, object_title_fr, object_title_en, iiif_image_uris')
            .in('objectNumber', partNumbers.slice(i, i + CHUNK))
            .eq('STATUS', 'HEALTHY')
            .eq('is_canonical', true)
        if (error) throw new Error(error.message)
        rows.push(...(data ?? []))
    }
    return new Map(rows.map(r => [r.objectNumber, r]))
}

function buildPartNode(r, BASE_URI) {
    const titles = [
        ["NLD", r.object_title_nl],
        ["FRA", r.object_title_fr],
        ["ENG", r.object_title_en],
    ].filter(([, v]) => v)

    const node = {
        "@id": `${BASE_URI}id/object/${r.objectNumber}`,
        "@type": "crm:E22_Human-Made_Object",
        "rdfs:label": r.object_title_nl ?? r.objectNumber,
        ...(titles.length > 0 && {
            "crm:P1_is_identified_by": titles.map(([lang, value]) => ({
                "@type": "crm:E41_Appellation",
                "rdfs:label": value,
                "crm:P72_has_language": {
                    "@id": `http://publications.europa.eu/resource/authority/language/${lang}`
                }
            }))
        }),
    }
    applyImagesToObject(node, r)   // same image shape as the full record
    return node
}

/**
 * Expanded part nodes for one or more koepelrecords in a single batched lookup.
 * @param partsByOwner Map<ownerObjectNumber, string[]>  (parts in hasParts order)
 * @returns Map<ownerObjectNumber, node[]> — falls back to bare links on error
 */
export async function expandPartsBatch(partsByOwner, BASE_URI) {
    const result = new Map()
    const all = [...new Set([...partsByOwner.values()].flat())]
    if (all.length === 0) {
        for (const owner of partsByOwner.keys()) result.set(owner, [])
        return result
    }

    try {
        const byNumber = await fetchPartRows(all)
        for (const [owner, parts] of partsByOwner) {
            result.set(owner, parts.filter(p => byNumber.has(p)).map(p => buildPartNode(byNumber.get(p), BASE_URI)))
        }
    } catch (err) {
        console.error('Part expansion failed:', err.message)
        for (const [owner, parts] of partsByOwner) result.set(owner, bareParts(parts, BASE_URI))
    }
    return result
}