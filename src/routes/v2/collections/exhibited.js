// src/routes/v2/collections/exhibited.js
//
// GET /id/exhibited?page=1&itemsPerPage=25&timeline=true
//
// Published objects ranked by the number of exhibitions they appeared in,
// each with its exhibitions (crm:P12i_was_present_at, date-ordered).
// timeline=true adds every dated exhibition the museum registered, so a
// client can draw an object's history against the museum's whole programme.
//
// Reads the views from NNN_exhibited.sql. Register next to requestObjects:
//   import { requestExhibited } from './collections/exhibited.js'
//   requestExhibited(app, BASE_URI)

import { supabase } from '../../../../supabaseClient.js'
import { applyImagesToObject } from '../../../utils/iiif_images.js'

const PAGE = 1000

const CONTEXT = {
    "crm":   "http://www.cidoc-crm.org/cidoc-crm/",
    "rdfs":  "http://www.w3.org/2000/01/rdf-schema#",
    "hydra": "http://www.w3.org/ns/hydra/core#",
    "xsd":   "http://www.w3.org/2001/XMLSchema#",
}

const COMMENT =
    'Published objects ranked by how many of the museum\u2019s registered exhibitions list them. ' +
    'It measures registration as much as exposure: older exhibitions often carry no object list, ' +
    'so objects shown mostly in earlier decades rank lower than their history warrants. ' +
    'Sets and their parts are counted separately.'

function timeSpan(start, end) {
    if (!start && !end) return null
    return {
        "@type": "crm:E52_Time-Span",
        "rdfs:label": [start, end].filter(Boolean).join('/'),
        ...(start && { "crm:P82a_begin_of_the_begin": { "@type": "xsd:date", "@value": start } }),
        ...(end   && { "crm:P82b_end_of_the_end":     { "@type": "xsd:date", "@value": end } }),
    }
}

async function loadTimeline() {
    const rows = []
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
            .from('exhibition_timeline')
            .select('exh_pid, title, starts, ends, object_count')
            .not('starts', 'is', null)
            .order('starts', { ascending: true })
            .range(from, from + PAGE - 1)
        if (error) throw new Error(`exhibition_timeline: ${error.message}`)
        rows.push(...(data ?? []))
        if (!data || data.length < PAGE) break
    }
    return rows
}

export function requestExhibited(app, BASE_URI) {
    app.get('/id/exhibited', async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json')
        res.setHeader('Content-Disposition', 'inline')

        const itemsPerPage = Math.min(Math.max(parseInt(req.query.itemsPerPage) || 25, 1), 100)
        const page = Math.max(parseInt(req.query.page) || 1, 1)
        const offset = (page - 1) * itemsPerPage
        const withTimeline = req.query.timeline === 'true'

        const collectionId = `${BASE_URI}id/exhibited`
        const pageUrl = (p) => {
            const q = new URLSearchParams({ page: p, itemsPerPage, ...(withTimeline && { timeline: 'true' }) })
            return `${collectionId}?${q}`
        }

        try {
            const [rank, timeline] = await Promise.all([
                supabase
                    .from('object_exhibition_rank')
                    .select('object_ref, title, iiif_image_uris, exhibition_count, rank, first_shown, last_shown, exhibitions',
                        { count: 'exact' })
                    .order('exhibition_count', { ascending: false })
                    .order('object_ref', { ascending: true })
                    .range(offset, offset + itemsPerPage - 1),
                withTimeline ? loadTimeline() : Promise.resolve(null),
            ])

            if (rank.error) {
                console.error('exhibited rank error:', rank.error.message)
                return res.status(500).json({ error: 'Error fetching exhibited objects' })
            }

            const members = (rank.data ?? []).map(r => {
                const node = {
                    "@id": `${BASE_URI}id/object/${r.object_ref}`,
                    "@type": "crm:E22_Human-Made_Object",
                    "rdfs:label": r.title ?? r.object_ref,
                    rank: r.rank,
                    exhibitionCount: r.exhibition_count,
                    ...(r.first_shown && { firstShown: r.first_shown }),
                    ...(r.last_shown && { lastShown: r.last_shown }),
                    "crm:P12i_was_present_at": (r.exhibitions ?? []).map(x => {
                        const span = timeSpan(x.start, x.end)
                        return {
                            "@id": `${BASE_URI}id/exhibition/${x.exh_pid}`,
                            "@type": "crm:E7_Activity",
                            "rdfs:label": x.title ?? x.exh_pid,
                            ...(span && { "crm:P4_has_time-span": span }),
                        }
                    }),
                }
                // applyImagesToObject reads the objects-table row shape, which
                // keys on objectNumber; this view calls it object_ref.
                applyImagesToObject(node, { ...r, objectNumber: r.object_ref })
                if (!node.image) {
                    const first = Array.isArray(r.iiif_image_uris) ? r.iiif_image_uris[0] : null
                    if (first) node.image = {
                        "@id": first,
                        "@type": "crm:E38_Image",
                        ...(first.includes('/full/max/') && { thumbnail: first.replace('/full/max/', '/full/thm/') }),
                    }
                }
                return node
            })

            const total = rank.count ?? members.length
            const totalPages = Math.max(1, Math.ceil(total / itemsPerPage))
            const view = {
                "@id": pageUrl(page),
                "@type": "hydra:PartialCollectionView",
                "hydra:first": pageUrl(1),
                "hydra:last": pageUrl(totalPages),
                ...(page > 1 && { "hydra:previous": pageUrl(page - 1) }),
                ...(page < totalPages && { "hydra:next": pageUrl(page + 1) }),
            }

            res.setHeader('Cache-Control', 'public, max-age=3600')
            return res.status(200).json({
                "@context": CONTEXT,
                "@id": collectionId,
                "@type": "hydra:Collection",
                "rdfs:label": "Objects ranked by the number of exhibitions they appeared in",
                "rdfs:comment": COMMENT,
                "hydra:totalItems": total,
                "hydra:view": view,
                "hydra:member": members,
                ...(timeline && {
                    exhibitionTimeline: timeline.map(t => ({
                        "@id": `${BASE_URI}id/exhibition/${t.exh_pid}`,
                        "rdfs:label": t.title ?? t.exh_pid,
                        start: t.starts,
                        ...(t.ends && { end: t.ends }),
                        objectCount: t.object_count,
                    })),
                }),
            })
        } catch (error) {
            console.error('Error handling exhibited request:', error)
            return res.status(500).json({ error: 'Internal Server Error' })
        }
    })
}