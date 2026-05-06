import { supabase } from '../../../supabaseClient.js';

export function requestColors(app, BASE_URI) {
    const colorsHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json');
        res.setHeader('Content-Disposition', 'inline');

        try {
            const [
                { data: baseData, error: baseError },
                { data: cssData, error: cssError }
            ] = await Promise.all([
                supabase.rpc('get_base_color_stats'),
                supabase.rpc('get_css_color_stats')
            ])

            if (baseError) {
                console.error('Base color stats error:', baseError.message)
                return res.status(500).json({ error: 'Error fetching base color stats' })
            }

            if (cssError) {
                console.error('CSS color stats error:', cssError.message)
                return res.status(500).json({ error: 'Error fetching CSS color stats' })
            }

            const response = {
                "@context": {
                    "crm": "http://www.cidoc-crm.org/cidoc-crm/",
                    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
                    "hydra": "http://www.w3.org/ns/hydra/core#"
                },
                "@id": `${BASE_URI}/id/colors`,
                "@type": "hydra:Collection",
                "rdfs:label": "Color index",
                "rdfs:comment": "Color distribution across the Design Museum Gent collection with weighted statistics",
                "base_colors": (baseData || []).map(row => ({
                    "value": row.color,
                    "object_count": parseInt(row.object_count),
                    "collection_share_pct": parseFloat(row.collection_share_pct),
                    "avg_dominance_pct": parseFloat(row.avg_dominance_pct),
                    "filter": `${BASE_URI}/id/objects?color=${row.color}`,
                    "dominant": `${BASE_URI}/id/colors/dominant?color=${encodeURIComponent(row.color)}`
                })),
                "css_colors": (cssData || []).map(row => ({
                    "value": row.color,
                    "object_count": parseInt(row.object_count),
                    "collection_share_pct": parseFloat(row.collection_share_pct),
                    "avg_dominance_pct": parseFloat(row.avg_dominance_pct),
                    "filter": `${BASE_URI}/id/objects?cssColor=${encodeURIComponent(row.color)}`,
                    "dominant": `${BASE_URI}/id/colors/dominant?cssColor=${encodeURIComponent(row.color)}`
                }))
            }

            return res.status(200).json(response)

        } catch (error) {
            console.error('Error handling colors request:', error)
            return res.status(500).json({ error: 'Internal Server Error' })
        }
    }

    // dominant objects by base color or css color
    const dominantHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json');
        res.setHeader('Content-Disposition', 'inline');

        try {
            const limit = Math.min(parseInt(req.query.limit) || 20, 100)
            const baseColor = req.query.color ?? null
            const cssColor = req.query.cssColor ?? null

            if (!baseColor && !cssColor) {
                return res.status(400).json({ error: 'Provide either ?color= or ?cssColor=' })
            }

            let data, error

            if (baseColor) {
                ({ data, error } = await supabase.rpc('get_objects_by_color_dominance', {
                    target_color: baseColor,
                    result_limit: limit
                }))
            } else {
                ({ data, error } = await supabase.rpc('get_objects_by_css_color_dominance', {
                    target_color: cssColor,
                    result_limit: limit
                }))
            }

            if (error) {
                console.error('Dominant color error:', error.message)
                return res.status(500).json({ error: 'Error fetching dominant color objects' })
            }

            const colorLabel = baseColor ?? cssColor
            const filterParam = baseColor ? `color=${encodeURIComponent(baseColor)}` : `cssColor=${encodeURIComponent(cssColor)}`

            return res.status(200).json({
                "@context": {
                    "crm": "http://www.cidoc-crm.org/cidoc-crm/",
                    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
                    "hydra": "http://www.w3.org/ns/hydra/core#"
                },
                "@id": `${BASE_URI}/id/colors/dominant?${filterParam}&limit=${limit}`,
                "@type": "hydra:Collection",
                "rdfs:label": `Objects most dominant in ${colorLabel}`,
                "hydra:totalItems": (data || []).length,
                "hydra:member": (data || []).map(row => ({
                    "@id": `${BASE_URI}/id/object/${row.objectNumber}`,
                    "@type": "crm:E22_Human-Made_Object",
                    "rdfs:label": row.object_title_nl,
                    "dominance_pct": parseFloat(row.dominance_pct),
                    ...(row.iiif_manifest && {
                        "crm:P129i_is_subject_of": {
                            "@id": row.iiif_manifest,
                            "@type": "crm:E73_Information_Object"
                        }
                    })
                }))
            })

        } catch (error) {
            console.error('Error handling dominant color request:', error)
            return res.status(500).json({ error: 'Internal Server Error' })
        }
    }

    app.get('/id/colors', colorsHandler)
    app.get('/id/colors/dominant', dominantHandler)
}