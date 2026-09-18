import { supabase } from '../../../../supabaseClient.js'

export function requestProduction(app, BASE_URI) {
    const handler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json')
        res.setHeader('Content-Disposition', 'inline')

        try {
            // Bucket size in years. 10 is a decade; 5 and 25 are the other
            // readings that stay legible. Clamped so a request for bucket=1
            // cannot ask for 700 rows of noise.
            const bucket = Math.min(Math.max(parseInt(req.query.bucket) || 10, 5), 100)

            // Axis range. Defaults start at 1600: everything earlier accounts
            // for about 1.2% of the weight, and stretching back to 1300 for
            // that gives three quarters of the width to a flat line.
            const yearFrom = Math.max(parseInt(req.query.yearFrom) || 1600, 1)
            const yearTo   = Math.min(parseInt(req.query.yearTo)   || 2030, 2100)

            const onDisplay = req.query.onDisplay === 'true'
            const q = req.query.q?.trim() || null

            const { data, error } = await supabase.rpc('get_production_density', {
                bucket_size: bucket,
                year_from: yearFrom,
                year_to: yearTo,
                only_on_display: onDisplay,
                search_query: q,
            })

            if (error) {
                console.error('Production density error:', error.message)
                return res.status(500).json({ error: 'Error fetching production density' })
            }

            const rows = data || []
            const totalWeight = rows.reduce((sum, r) => sum + parseFloat(r.weight), 0)

            const query = [
                bucket !== 10 ? `bucket=${bucket}` : null,
                yearFrom !== 1600 ? `yearFrom=${yearFrom}` : null,
                yearTo !== 2030 ? `yearTo=${yearTo}` : null,
                onDisplay ? 'onDisplay=true' : null,
                q ? `q=${encodeURIComponent(q)}` : null,
            ].filter(Boolean).join('&')

            return res.status(200).json({
                '@context': {
                    crm: 'http://www.cidoc-crm.org/cidoc-crm/',
                    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
                    hydra: 'http://www.w3.org/ns/hydra/core#',
                },
                '@id': `${BASE_URI}id/production${query ? `?${query}` : ''}`,
                '@type': 'hydra:Collection',
                'rdfs:label': 'Production density',
                'rdfs:comment':
                    'How much of the published collection was in production in each period. ' +
                    'Each object contributes a total weight of 1, spread evenly across the years ' +
                    'of its production span, so precisely dated objects concentrate and vaguely ' +
                    'dated ones spread thin. Covers only objects published through this API.',

                bucket_size: bucket,
                year_from: yearFrom,
                year_to: yearTo,
                // Sums to the number of dated objects whose spans fall inside
                // the range — so a bucket's weight is a genuine share of it.
                total_weight: Math.round(totalWeight * 1000) / 1000,

                buckets: rows.map((row) => {
                    const weight = parseFloat(row.weight)
                    const touching = parseInt(row.object_count)
                    return {
                        year: parseInt(row.bucket_start),
                        // The honest measure: share of the collection dated here.
                        weight,
                        share_pct: totalWeight
                            ? Math.round((weight / totalWeight) * 10000) / 100
                            : 0,
                        // Objects whose span merely TOUCHES this bucket. Wide
                        // spans are counted in full in every bucket they cross,
                        // so this sums to far more than the collection — it is
                        // not a share of anything.
                        object_count: touching,
                        // Dated to a single year. Needs no interpretation.
                        exact_count: parseInt(row.exact_count),
                        // How vaguely this period is dated: 1 means every
                        // object here is pinned to a year, 9 means the average
                        // object spans nine buckets.
                        spread_factor: weight
                            ? Math.round((touching / weight) * 10) / 10
                            : null,
                        filter: `${BASE_URI}id/objects?date=${row.bucket_start}/${row.bucket_start + bucket - 1}`,
                    }
                }),
            })
        } catch (err) {
            console.error('Error handling production request:', err)
            return res.status(500).json({ error: 'Internal Server Error' })
        }
    }

    app.get('/id/production', handler)
}