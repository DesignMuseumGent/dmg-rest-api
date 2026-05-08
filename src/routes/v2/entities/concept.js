import { fetchByConceptID } from "../../../utils/parsers.js";

export function requestConcept(app, BASE_URI) {
    const conceptHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json');
        res.setHeader('Content-Disposition', 'inline');

        try {
            const ConceptPID = req.params.ConceptPID;
            const record = await fetchByConceptID(ConceptPID);

            if (!record || record.length === 0) {
                return res.status(404).json({ error: 'Concept not found' });
            }

            const row = record[0]
            const obj = row["json_ld_v2"] ?? {}

            // multilingual preferred labels
            const prefLabels = []
            if (row["concept_label_nl"]) prefLabels.push({ "@value": row["concept_label_nl"], "@language": "nl" })
            if (row["concept_label_fr"]) prefLabels.push({ "@value": row["concept_label_fr"], "@language": "fr" })
            if (row["concept_label_en"]) prefLabels.push({ "@value": row["concept_label_en"], "@language": "en" })

            if (prefLabels.length > 0) {
                obj["skos:prefLabel"] = prefLabels
            }

            // multilingual scope notes
            const scopeNotes = []
            if (row["concept_scope_nl"]) scopeNotes.push({ "@value": row["concept_scope_nl"], "@language": "nl" })
            if (row["concept_scope_fr"]) scopeNotes.push({ "@value": row["concept_scope_fr"], "@language": "fr" })
            if (row["concept_scope_en"]) scopeNotes.push({ "@value": row["concept_scope_en"], "@language": "en" })

            if (scopeNotes.length > 0) {
                obj["skos:scopeNote"] = scopeNotes
            }

            // cache headers
            if (row["generated_at_time"]) {
                const lastModified = new Date(row["generated_at_time"]).toUTCString()
                res.setHeader('Last-Modified', lastModified)
                res.setHeader('ETag', `"${ConceptPID}-${new Date(row["generated_at_time"]).getTime()}"`)
                res.setHeader('Cache-Control', 'public, max-age=3600')
            }

            return res.status(200).json(obj)

        } catch (e) {
            console.error(e)
            return res.status(500).json({ error: 'Error fetching concept data' })
        }
    }

    const headHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json')

        try {
            const { data, error } = await supabase
                .from('dmg_thesaurus_LDES')
                .select('id, generated_at_time')
                .eq('id', req.params.ConceptPID)
                .maybeSingle()

            if (error) return res.status(500).end()
            if (!data) return res.status(404).end()

            if (data['generated_at_time']) {
                const lastModified = new Date(data['generated_at_time']).toUTCString()
                res.setHeader('Last-Modified', lastModified)
                res.setHeader('ETag', `"${req.params.ConceptPID}-${new Date(data['generated_at_time']).getTime()}"`)
                res.setHeader('Cache-Control', 'public, max-age=3600')
            }

            return res.status(200).end()

        } catch (error) {
            console.error('Error handling HEAD request:', error)
            return res.status(500).end()
        }
    }

    app.get('/id/concept/:ConceptPID', conceptHandler)
    app.head('/id/concept/:ConceptPID', headHandler)
}