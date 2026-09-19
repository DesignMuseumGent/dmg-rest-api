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

            const { data, error } = await supabase.rpc('get_time_index', {
                bucket_size: bucket,
                year_from: yearFrom,
                year_to: yearTo,
                only_on_display: onDisplay,
                search_query: q,
            })

            if (error) {
                console.error('Time index error:', error.message)
                return res.status(500).json({ error: 'Error fetching time index' })
            }

            // generate_series includes its endpoint, so the last bucket is an
            // empty one at year_to. Drop trailing empties rather than drawing
            // a zero column at the axis edge.
            let rows = data || []
            while (rows.length &&
            parseFloat(rows[rows.length - 1].production_weight) === 0 &&
            parseInt(rows[rows.length - 1].acquired) === 0) {
                rows = rows.slice(0, -1)
            }

            const totalWeight = rows.reduce((sum, r) => sum + parseFloat(r.production_weight), 0)
            const totalAcquired = rows.reduce((sum, r) => sum + parseInt(r.acquired), 0)

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
                'rdfs:label': 'Time index',
                'rdfs:comment':
                    'Two measures of time on the same periods. Production: how much of the ' +
                    'published collection was being made then, with each object contributing a ' +
                    'total weight of 1 spread across the years of its span. Acquisition: how ' +
                    'many objects entered the collection then, as a plain count. The two answer ' +
                    'different questions — when the objects were made, and when the collection ' +
                    'grew. Covers only objects published through this API.',

                bucket_size: bucket,
                year_from: yearFrom,
                year_to: yearTo,
                // Sums to the number of dated objects whose spans fall inside
                // the range — so a bucket's weight is a genuine share of it.
                total_weight: Math.round(totalWeight * 1000) / 1000,
                // Objects with a recorded acquisition year inside the range.
                // 7,481 of 10,238 healthy objects carry one.
                total_acquired: totalAcquired,

                buckets: rows.map((row) => {
                    const weight = parseFloat(row.production_weight)
                    const touching = parseInt(row.production_touch)
                    const acquired = parseInt(row.acquired)
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
                        exact_count: parseInt(row.production_exact),

                        // Acquisition is a POINT, not a span: the museum took
                        // the object on one day, so this is a plain count with
                        // no weighting. It shares the axis with `weight` only
                        // because one unit of weight is one object — they are
                        // not the same quantity.
                        acquired,
                        acquired_pct: totalAcquired
                            ? Math.round((acquired / totalAcquired) * 10000) / 100
                            : 0,
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