import { supabase } from '../../../../supabaseClient.js'

export function requestTypes(app, BASE_URI) {
    const typesHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json')
        res.setHeader('Content-Disposition', 'inline')

        try {
            const { data, error } = await supabase
                .rpc('get_object_type_stats')

            if (error) {
                console.error('Type stats error:', error.message)
                return res.status(500).json({ error: 'Error fetching object types' })
            }

            const response = {
                "@context": {
                    "crm": "http://www.cidoc-crm.org/cidoc-crm/",
                    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
                    "hydra": "http://www.w3.org/ns/hydra/core#"
                },
                "@id": `${BASE_URI}id/types`,
                "@type": "hydra:Collection",
                "rdfs:label": "Object type index",
                "rdfs:comment": "All object types in the Design Museum Gent collection with object counts",
                "hydra:totalItems": (data || []).length,
                "hydra:member": (data || []).map(row => ({
                    "@id": row.type_id,
                    "@type": "crm:E55_Type",
                    "rdfs:label": row.type_label,
                    "object_count": parseInt(row.object_count),
                    "filter": `${BASE_URI}/id/objects?type=${encodeURIComponent(row.type_label)}`
                }))
            }

            return res.status(200).json(response)

        } catch (error) {
            console.error('Error handling types request:', error)
            return res.status(500).json({ error: 'Internal Server Error' })
        }
    }

    app.get('/id/types', typesHandler)
}