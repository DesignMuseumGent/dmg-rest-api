// utils/embedding_path.js
//
// Paths between two objects in CLIP image-embedding space.
//
//   graph — shortest route through the precomputed neighbour graph
//           (object_similar_adj). Every step resembles the previous one:
//           a chain of resemblances that stays on the collection.
//   line  — the straight arc between the two objects (slerp on the unit
//           sphere), with the nearest published object at each point:
//           what lies geometrically in between.

import { supabase } from '../../supabaseClient.js'
import { applyImagesToObject } from './iiif_images.js'

const GRAPH_TTL_MS = 60 * 60 * 1000
const PAGE = 1000
const COST_POWER = 2      // (1 - similarity)^2: prefers many small steps over a few big jumps

export const MAX_STEPS = 20
export const DEFAULT_STEPS = 5

// ─────────────────────────────────────────────────────────────────────────
// GRAPH — loaded once, cached, refreshed hourly (neighbours change per
// pipeline run, not per request). Concurrent refreshes share one load.
// ─────────────────────────────────────────────────────────────────────────
let graphCache = { graph: null, loadedAt: 0, pending: null }

async function loadGraph() {
    const graph = new Map()   // ref → Map(neighbour → { cost, similarity })
    const addEdge = (a, b, similarity) => {
        const cost = Math.pow(Math.max(0, 1 - similarity), COST_POWER)
        if (!graph.has(a)) graph.set(a, new Map())
        const existing = graph.get(a).get(b)
        if (!existing || cost < existing.cost) graph.get(a).set(b, { cost, similarity })
    }

    for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
            .from('object_similar_adj')
            .select('object_ref, neighbours, similarities')
            .order('object_ref', { ascending: true })
            .range(from, from + PAGE - 1)
        if (error) throw new Error(`object_similar_adj: ${error.message}`)
        for (const row of data ?? []) {
            row.neighbours.forEach((n, i) => {
                // kNN lists are directed; treat resemblance as mutual so the
                // graph stays connected and paths can run both ways.
                addEdge(row.object_ref, n, row.similarities[i])
                addEdge(n, row.object_ref, row.similarities[i])
            })
        }
        if (!data || data.length < PAGE) break
    }
    return graph
}

export async function getGraph() {
    if (graphCache.graph && Date.now() - graphCache.loadedAt < GRAPH_TTL_MS) return graphCache.graph
    if (!graphCache.pending) {
        graphCache.pending = loadGraph()
            .then(graph => { graphCache = { graph, loadedAt: Date.now(), pending: null }; return graph })
            .catch(err => {
                graphCache.pending = null
                if (graphCache.graph) { console.error(err.message); return graphCache.graph }  // serve stale
                throw err
            })
    }
    return graphCache.pending
}

// Minimal binary heap for Dijkstra
class MinHeap {
    constructor() { this.a = [] }
    get size() { return this.a.length }
    push(item) {
        const a = this.a; a.push(item)
        let i = a.length - 1
        while (i > 0) {
            const p = (i - 1) >> 1
            if (a[p][0] <= a[i][0]) break
                ;[a[p], a[i]] = [a[i], a[p]]; i = p
        }
    }
    pop() {
        const a = this.a, top = a[0], last = a.pop()
        if (a.length > 0) {
            a[0] = last
            let i = 0
            for (;;) {
                const l = 2 * i + 1, r = l + 1
                let m = i
                if (l < a.length && a[l][0] < a[m][0]) m = l
                if (r < a.length && a[r][0] < a[m][0]) m = r
                if (m === i) break
                    ;[a[m], a[i]] = [a[i], a[m]]; i = m
            }
        }
        return top
    }
}

/** Shortest path in the neighbour graph. Returns [{ ref, similarity }] or null. */
export function shortestPath(graph, from, to) {
    if (!graph.has(from) || !graph.has(to)) return null
    const dist = new Map([[from, 0]])
    const prev = new Map()
    const heap = new MinHeap()
    heap.push([0, from])

    while (heap.size) {
        const [d, node] = heap.pop()
        if (node === to) break
        if (d > (dist.get(node) ?? Infinity)) continue
        for (const [next, { cost }] of graph.get(node)) {
            const nd = d + cost
            if (nd < (dist.get(next) ?? Infinity)) {
                dist.set(next, nd)
                prev.set(next, node)
                heap.push([nd, next])
            }
        }
    }
    if (!dist.has(to)) return null

    const path = [to]
    while (path[0] !== from) path.unshift(prev.get(path[0]))
    return path.map((ref, i) => ({
        ref,
        similarity: i === 0 ? null : graph.get(path[i - 1]).get(ref).similarity,
    }))
}

// ─────────────────────────────────────────────────────────────────────────
// LINE — slerp between object vectors, nearest published object per point
// ─────────────────────────────────────────────────────────────────────────
const parseVector = (v) => (typeof v === 'string' ? JSON.parse(v) : v)

const normalize = (v) => {
    const n = Math.hypot(...v) || 1
    return v.map(x => x / n)
}

/** Object vector = normalised mean of its view embeddings. null if none. */
export async function getObjectVector(ref) {
    const { data, error } = await supabase
        .from('object_image_embeddings')
        .select('embedding')
        .eq('object_ref', ref)
        .not('embedding', 'is', null)
    if (error) throw new Error(`object_image_embeddings: ${error.message}`)
    if (!data?.length) return null

    const vecs = data.map(r => normalize(parseVector(r.embedding)))
    const mean = vecs[0].map((_, i) => vecs.reduce((s, v) => s + v[i], 0) / vecs.length)
    return normalize(mean)
}

function slerp(a, b, t) {
    const dot = Math.min(1, Math.max(-1, a.reduce((s, x, i) => s + x * b[i], 0)))
    const omega = Math.acos(dot)
    if (omega < 1e-6) return a.map((x, i) => x + t * (b[i] - x))
    const so = Math.sin(omega)
    const wa = Math.sin((1 - t) * omega) / so
    const wb = Math.sin(t * omega) / so
    return normalize(a.map((x, i) => wa * x + wb * b[i]))
}

/** Interpolated path: [{ ref, t, similarity }] for the in-between steps only. */
export async function linePath(from, to, vecFrom, vecTo, steps) {
    const ts = Array.from({ length: steps }, (_, i) => (i + 1) / (steps + 1))

    // All points in parallel; ask for spares so duplicates can be resolved.
    const candidates = await Promise.all(ts.map(async t => {
        const point = slerp(vecFrom, vecTo, t)
        const { data, error } = await supabase.rpc('nearest_objects_to_vector', {
            query_embedding: `[${point.join(',')}]`,
            match_count: steps + 2,
            exclude: [from, to],
        })
        if (error) throw new Error(`nearest_objects_to_vector: ${error.message}`)
        return { t, hits: data ?? [] }
    }))

    // Greedy, in order along the line: each point takes its nearest unused object.
    const used = new Set()
    const out = []
    for (const { t, hits } of candidates) {
        const hit = hits.find(h => !used.has(h.object_ref))
        if (!hit) continue
        used.add(hit.object_ref)
        out.push({ ref: hit.object_ref, t: Math.round(t * 1000) / 1000, similarity: hit.similarity })
    }
    return out
}

// ─────────────────────────────────────────────────────────────────────────
// MEMBERS — label + image per step, published objects only
// ─────────────────────────────────────────────────────────────────────────
export async function fetchSummaries(refs) {
    const { data, error } = await supabase
        .from('dmg_objects_LDES')
        .select('objectNumber, object_title_nl, iiif_image_uris')
        .in('objectNumber', refs)
        .eq('STATUS', 'HEALTHY')
        .eq('is_canonical', true)
        .eq('is_hidden', false)
    if (error) throw new Error(`dmg_objects_LDES: ${error.message}`)
    return new Map((data ?? []).map(r => [r.objectNumber, r]))
}

export function buildStep(row, BASE_URI, position, extra = {}) {
    const node = {
        "@id": `${BASE_URI}id/object/${row.objectNumber}`,
        "@type": "crm:E22_Human-Made_Object",
        "rdfs:label": row.object_title_nl ?? row.objectNumber,
        position,
        ...extra,
    }
    applyImagesToObject(node, row)
    return node
}