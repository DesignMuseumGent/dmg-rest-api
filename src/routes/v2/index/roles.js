import { supabase } from '../../../../supabaseClient.js'

export function requestRoles(app, BASE_URI) {
    app.get('/id/roles', async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json')
        res.setHeader('Content-Disposition', 'inline')

        try {
            const { data, error } = await supabase
                .rpc('get_role_stats')

            if (error) {
                console.error('Role stats error:', error.message)
                return res.status(500).json({ error: 'Error fetching roles' })
            }

            return res.status(200).json({
                "@context": {
                    "crm":   "http://www.cidoc-crm.org/cidoc-crm/",
                    "rdfs":  "http://www.w3.org/2000/01/rdf-schema#",
                    "hydra": "http://www.w3.org/ns/hydra/core#"
                },
                "@id": `${BASE_URI}id/roles`,
                "@type": "hydra:Collection",
                "rdfs:label": "Role index",
                "rdfs:comment": "All roles in the Design Museum Gent agent records with agent counts",
                "hydra:totalItems": (data || []).length,
                "hydra:member": (data || []).map(row => ({
                    "@type":       "crm:E55_Type",
                    "rdfs:label":  row.role,
                    "agent_count": parseInt(row.agent_count),
                    "filter":      `${BASE_URI}id/agents?role=${encodeURIComponent(row.role)}`
                }))
            })

        } catch (error) {
            console.error('Error handling roles request:', error)
            return res.status(500).json({ error: 'Internal Server Error' })
        }
    })
}