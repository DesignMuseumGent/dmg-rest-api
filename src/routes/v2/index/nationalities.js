import { supabase } from '../../../../supabaseClient.js'

export function requestNationalities(app, BASE_URI) {
    app.get('/id/nationalities', async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json')
        res.setHeader('Content-Disposition', 'inline')

        try {
            const { data, error } = await supabase
                .rpc('get_nationality_stats')

            if (error) {
                console.error('Nationality stats error:', error.message)
                return res.status(500).json({ error: 'Error fetching nationalities' })
            }

            return res.status(200).json({
                "@context": {
                    "crm": "http://www.cidoc-crm.org/cidoc-crm/",
                    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
                    "hydra": "http://www.w3.org/ns/hydra/core#"
                },
                "@id": `${BASE_URI}id/nationalities`,
                "@type": "hydra:Collection",
                "rdfs:label": "Nationality index",
                "rdfs:comment": "All nationalities in the Design Museum Gent agent records with agent counts",
                "hydra:totalItems": (data || []).length,
                "hydra:member": (data || []).map(row => ({
                    "@type": "crm:E55_Type",
                    "rdfs:label": row.nationality,
                    "agent_count": parseInt(row.agent_count),
                    "filter": `${BASE_URI}id/agents?nationality=${encodeURIComponent(row.nationality)}`
                }))
            })

        } catch (error) {
            console.error('Error handling nationalities request:', error)
            return res.status(500).json({ error: 'Internal Server Error' })
        }
    })
}

