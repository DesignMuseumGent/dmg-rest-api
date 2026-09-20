import { supabase } from '../../../../supabaseClient.js'
import { applyImagesToObject } from '../../../utils/iiif_images.js' // adjust path if your layout differs

/**
 * /id/object/{PID}/similar — objects that look and read like this one.
 *
 * Nearest neighbours in CLIP image-embedding space (ViT-L-14-openai, 768
 * dimensions). CLIP is trained against captions, so this groups by subject
 * as much as by form: the neighbours of a decorated tile are other tiles
 * depicting sea creatures, across different designs and centuries.
 *
 * Requires migration 014.
 *
 * COVERAGE: 7,307 of 10,238 published objects carry an embedding. An object
 * without one returns an empty collection — not a 404, because the object
 * exists and the question is simply unanswerable for it.
 */
export function requestSimilar(app, BASE_URI) {
    const handler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json')
        res.setHeader('Content-Disposition', 'inline')

        try {
            const pid = req.params.ObjectPID
            const limit = Math.min(Math.max(parseInt(req.query.limit) || 12, 1), 50)

            // Cosine similarity of unit vectors runs 0-1 here in practice.
            // Measured neighbours of a good match sit around 0.92; unrelated
            // objects around 0.6. Default 0 returns everything ranked, which
            // is the honest default — a threshold would hide the fact that
            // some objects have no close neighbours at all.
            const minSimilarity = Math.min(
                Math.max(parseFloat(req.query.minSimilarity) || 0, 0),
                1,
            )

            const { data, error } = await supabase.rpc('get_similar_objects', {
                target_object: pid,
                result_limit: limit,
                min_similarity: minSimilarity,
            })

            if (error) {
                console.error('Similar objects error:', error.message)
                return res.status(500).json({ error: 'Error fetching similar objects' })
            }

            const rows = data || []

            const query = [
                limit !== 12 ? `limit=${limit}` : null,
                minSimilarity ? `minSimilarity=${minSimilarity}` : null,
            ].filter(Boolean).join('&')

            return res.status(200).json({
                '@context': {
                    crm: 'http://www.cidoc-crm.org/cidoc-crm/',
                    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
                    hydra: 'http://www.w3.org/ns/hydra/core#',
                },
                '@id': `${BASE_URI}id/object/${pid}/similar${query ? `?${query}` : ''}`,
                '@type': 'hydra:Collection',
                'rdfs:label': `Objects visually similar to ${pid}`,
                'rdfs:comment':
                    'Nearest neighbours in CLIP image-embedding space (ViT-L-14-openai). ' +
                    'Computed from the photographs alone — no cataloguing, no thesaurus. ' +
                    'Covers the 7,307 published objects that carry an embedding; an empty ' +
                    'collection means this object has none, not that it has no similars.',

                // Not a match score in any absolute sense: cosine similarity
                // between unit vectors. Useful for ranking and for judging how
                // close a set is, not as a probability.
                'hydra:totalItems': rows.length,

                'hydra:member': rows.map((row) => {
                    const member = {
                        '@id': `${BASE_URI}id/object/${row.objectNumber}`,
                        '@type': 'crm:E22_Human-Made_Object',
                        'rdfs:label': row.object_title_nl,
                        similarity: parseFloat(row.similarity),
                    }

                    applyImagesToObject(member, row)

                    if (row.iiif_manifest) {
                        member['crm:P129i_is_subject_of'] = {
                            '@id': row.iiif_manifest,
                            '@type': 'crm:E73_Information_Object',
                        }
                    }

                    return member
                }),
            })
        } catch (err) {
            console.error('Error handling similar objects request:', err)
            return res.status(500).json({ error: 'Internal Server Error' })
        }
    }

    app.get('/id/object/:ObjectPID/similar', handler)
}