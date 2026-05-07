import { supabase } from '../../../../supabaseClient.js'

export function requestMaterials(app, BASE_URI) {
    app.get('/id/materials', async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json')
        res.setHeader('Content-Disposition', 'inline')

        try {
            const { data, error } = await supabase
                .rpc('get_material_stats')

            if (error) {
                console.error('Material stats error:', error.message)
                return res.status(500).json({ error: 'Error fetching materials' })
            }

            return res.status(200).json({
                "@context": {
                    "crm": "http://www.cidoc-crm.org/cidoc-crm/",
                    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
                    "hydra": "http://www.w3.org/ns/hydra/core#"
                },
                "@id": `${BASE_URI}id/materials`,
                "@type": "hydra:Collection",
                "rdfs:label": "Material index",
                "rdfs:comment": "All materials in the Design Museum Gent collection with object counts",
                "hydra:totalItems": (data || []).length,
                "hydra:member": (data || []).map(row => ({
                    "@type": "crm:E57_Material",
                    "rdfs:label": row.material,
                    "object_count": parseInt(row.object_count),
                    "filter": `${BASE_URI}id/objects?material=${encodeURIComponent(row.material)}`
                }))
            })

        } catch (error) {
            console.error('Error handling materials request:', error)
            return res.status(500).json({ error: 'Internal Server Error' })
        }
    })
}