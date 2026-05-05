import { supabase } from '../../../supabaseClient.js';

export function requestColors(app, BASE_URI) {
    const colorsHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json');
        res.setHeader('Content-Disposition', 'inline');

        try {
            // fetch base color counts via rpc
            const { data: baseData, error: baseError } = await supabase
                .rpc('get_base_color_counts')

            if (baseError) {
                console.error('Base color count error:', baseError.message)
                return res.status(500).json({ error: 'Error fetching base colors' })
            }

            // fetch css color counts via rpc
            const { data: cssData, error: cssError } = await supabase
                .rpc('get_css_color_counts')

            if (cssError) {
                console.error('CSS color count error:', cssError.message)
                return res.status(500).json({ error: 'Error fetching CSS colors' })
            }

            const response = {
                "@context": {
                    "crm": "http://www.cidoc-crm.org/cidoc-crm/",
                    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
                    "hydra": "http://www.w3.org/ns/hydra/core#"
                },
                "@id": `${BASE_URI}id/colors`,
                "@type": "hydra:Collection",
                "rdfs:label": "Color index",
                "rdfs:comment": "All available colors in the Design Museum Gent collection with object counts",
                "base_colors": (baseData || []).map(row => ({
                    "value": row.color,
                    "count": parseInt(row.count),
                    "filter": `${BASE_URI}id/objects?color=${row.color}`
                })),
                "css_colors": (cssData || []).map(row => ({
                    "value": row.color,
                    "count": parseInt(row.count),
                    "filter": `${BASE_URI}id/objects?cssColor=${encodeURIComponent(row.color)}`
                }))
            }

            return res.status(200).json(response)

        } catch (error) {
            console.error('Error handling colors request:', error)
            return res.status(500).json({ error: 'Internal Server Error' })
        }
    }

    app.get('/id/colors', colorsHandler)
}