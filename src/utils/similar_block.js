// utils/similar_block.js
//
// Inline "similar objects" for /objects?fullRecord=true&similar=true.
// Reads precomputed neighbours from object_similar (written by
// typicallity.py), keeps only HEALTHY + canonical neighbours, and builds the
// same hydra:Collection shape as /id/object/{PID}/similar so the inline block
// and the endpoint read as one thing.

import { supabase } from '../../supabaseClient.js'

export const SIMILAR_LABEL = (pid) => `Objects visually similar to ${pid}`

// No hard-coded count: coverage grows every time the embeddings step runs.
export const SIMILAR_COMMENT =
    'Nearest neighbours in CLIP image-embedding space (ViT-L-14-openai). ' +
    'Computed from the photographs alone — no cataloguing, no thesaurus. ' +
    'Covers the published objects that carry an embedding; an empty ' +
    'collection means this object has none, not that it has no similars.'

export const SIMILAR_DEFAULT_LIMIT = 5
export const SIMILAR_MAX_LIMIT = 20          // = ranks stored per object

const IN_CHUNK = 200                          // keep .in() query strings small

export function parseSimilarLimit(raw) {
    const n = parseInt(raw)
    if (!Number.isFinite(n)) return SIMILAR_DEFAULT_LIMIT
    return Math.min(Math.max(n, 1), SIMILAR_MAX_LIMIT)
}

async function selectIn(table, columns, column, values, extra = (q) => q) {
    const out = []
    for (let i = 0; i < values.length; i += IN_CHUNK) {
        const chunk = values.slice(i, i + IN_CHUNK)
        const { data, error } = await extra(
            supabase.from(table).select(columns).in(column, chunk)
        )
        if (error) throw new Error(`${table}: ${error.message}`)
        out.push(...(data ?? []))
    }
    return out
}

/**
 * Neighbours for a page of objects.
 * @returns Map<objectNumber, Array<{ ref, label, similarity }>>  (healthy only, ≤ limit)
 */
export async function fetchSimilarForObjects(objectNumbers, limit = SIMILAR_DEFAULT_LIMIT) {
    const result = new Map(objectNumbers.map(n => [n, []]))
    if (objectNumbers.length === 0) return result

    const pairs = await selectIn(
        'object_similar',
        'object_ref, neighbour_ref, rank, similarity',
        'object_ref',
        objectNumbers,
        (q) => q.order('rank', { ascending: true }),
    )
    if (pairs.length === 0) return result

    // Hard rule: public endpoints only ever expose HEALTHY records — that
    // includes objects mentioned as neighbours.
    const neighbourRefs = [...new Set(pairs.map(p => p.neighbour_ref))]
    const healthy = await selectIn(
        'dmg_objects_LDES',
        'objectNumber, object_title_nl',
        'objectNumber',
        neighbourRefs,
        (q) => q.eq('STATUS', 'HEALTHY').eq('is_canonical', true),
    )
    const titles = new Map(healthy.map(r => [r.objectNumber, r.object_title_nl]))

    pairs.sort((a, b) => a.rank - b.rank)
    for (const p of pairs) {
        if (!titles.has(p.neighbour_ref)) continue
        const list = result.get(p.object_ref)
        if (list && list.length < limit) {
            list.push({ ref: p.neighbour_ref, label: titles.get(p.neighbour_ref), similarity: p.similarity })
        }
    }
    return result
}

export function buildSimilarBlock(pid, neighbours, BASE_URI) {
    return {
        '@id': `${BASE_URI}id/object/${pid}/similar`,
        '@type': 'hydra:Collection',
        'rdfs:label': SIMILAR_LABEL(pid),
        'rdfs:comment': SIMILAR_COMMENT,
        'hydra:totalItems': neighbours.length,
        'hydra:member': neighbours.map(n => ({
            '@id': `${BASE_URI}id/object/${n.ref}`,
            '@type': 'crm:E22_Human-Made_Object',
            'rdfs:label': n.label,
            similarity: Math.round(n.similarity * 10000) / 10000,
        })),
    }
}

// Attach to a record without clobbering an existing rdfs:seeAlso.
export function attachSimilar(obj, block) {
    const existing = obj['rdfs:seeAlso']
    obj['rdfs:seeAlso'] = existing
        ? [...(Array.isArray(existing) ? existing : [existing]), block]
        : block
    return obj
}