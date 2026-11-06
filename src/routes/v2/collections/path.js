// routes/v2/collections/path.js
//
// GET /id/path?from=<objectNumber>&to=<objectNumber>&mode=graph|line&steps=5
//
// A path between two collection objects in CLIP image-embedding space.
//   mode=graph (default) — chain of resemblances through the neighbour graph
//   mode=line            — nearest objects along the straight arc between both
//                          (steps = number of in-between points, 1–20)

import {
    getGraph, shortestPath, getObjectVector, linePath,
    fetchSummaries, buildStep, MAX_STEPS, DEFAULT_STEPS,
} from '../../../utils/embedding_path.js'

const CONTEXT = {
    "crm":   "http://www.cidoc-crm.org/cidoc-crm/",
    "rdfs":  "http://www.w3.org/2000/01/rdf-schema#",
    "hydra": "http://www.w3.org/ns/hydra/core#",
}

const COMMENTS = {
    graph:
        'Shortest chain of visual resemblances between two objects, through each object’s ' +
        'nearest neighbours in CLIP image-embedding space (ViT-L-14-openai). Every step ' +
        'resembles the previous one; similarity is to the previous step. Computed from the ' +
        'photographs alone — no cataloguing, no thesaurus.',
    line:
        'Objects nearest to evenly spaced points on the straight arc between two objects in ' +
        'CLIP image-embedding space (ViT-L-14-openai). Shows what lies geometrically in between; ' +
        'similarity is to the interpolated point, t its position from 0 (from) to 1 (to). ' +
        'Computed from the photographs alone — no cataloguing, no thesaurus.',
}

export function requestPath(app, BASE_URI) {
    const pathHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json')
        res.setHeader('Content-Disposition', 'inline')

        const from = req.query.from?.trim()
        const to   = req.query.to?.trim()
        const mode = req.query.mode === 'line' ? 'line' : 'graph'
        const steps = Math.min(Math.max(parseInt(req.query.steps) || DEFAULT_STEPS, 1), MAX_STEPS)

        if (!from || !to) return res.status(400).json({ error: 'Both ?from= and ?to= object numbers are required.' })
        if (from === to)  return res.status(400).json({ error: '?from= and ?to= must be different objects.' })

        const params = new URLSearchParams({ from, to, mode, ...(mode === 'line' && { steps }) })
        const pathId = `${BASE_URI}id/path?${params.toString()}`

        try {
            // Both ends must be published objects.
            const ends = await fetchSummaries([from, to])
            for (const ref of [from, to]) {
                if (!ends.has(ref)) return res.status(404).json({ error: `Object ${ref} not found or not published.` })
            }

            let route   // [{ ref, similarity, t? }] including both ends

            if (mode === 'graph') {
                const graph = await getGraph()
                for (const ref of [from, to]) {
                    if (!graph.has(ref)) {
                        return res.status(404).json({ error: `Object ${ref} has no image embedding, so it is not part of the similarity graph.` })
                    }
                }
                route = shortestPath(graph, from, to)
                if (!route) {
                    return res.status(404).json({
                        error: `No chain of resemblances connects ${from} and ${to}: they sit in separate regions of the similarity graph.`,
                        hint: `Try ${BASE_URI}id/path?from=${from}&to=${to}&mode=line`,
                    })
                }
            } else {
                const [vecFrom, vecTo] = await Promise.all([getObjectVector(from), getObjectVector(to)])
                for (const [ref, vec] of [[from, vecFrom], [to, vecTo]]) {
                    if (!vec) return res.status(404).json({ error: `Object ${ref} has no image embedding.` })
                }
                const middle = await linePath(from, to, vecFrom, vecTo, steps)
                route = [
                    { ref: from, t: 0, similarity: null },
                    ...middle,
                    { ref: to, t: 1, similarity: null },
                ]
            }

            // Labels + images for the in-between steps (ends already fetched).
            const middleRefs = route.slice(1, -1).map(s => s.ref)
            const summaries = middleRefs.length ? await fetchSummaries(middleRefs) : new Map()
            for (const [k, v] of ends) summaries.set(k, v)

            const members = route
                .filter(s => summaries.has(s.ref))   // drops a step unpublished since the graph loaded
                .map((s, i) => buildStep(summaries.get(s.ref), BASE_URI, i, {
                    ...(s.t !== undefined && { t: s.t }),
                    ...(s.similarity !== null && s.similarity !== undefined && {
                        similarity: Math.round(s.similarity * 10000) / 10000,
                    }),
                }))

            res.setHeader('Cache-Control', 'public, max-age=3600')
            return res.status(200).json({
                "@context": CONTEXT,
                "@id": pathId,
                "@type": "hydra:Collection",
                "rdfs:label": `Visual path from ${from} to ${to}`,
                "rdfs:comment": COMMENTS[mode],
                mode,
                "hydra:totalItems": members.length,
                "hydra:member": members,
            })

        } catch (error) {
            console.error('Error handling path request:', error)
            return res.status(500).json({ error: 'Internal Server Error' })
        }
    }

    app.get('/id/path', pathHandler)
}