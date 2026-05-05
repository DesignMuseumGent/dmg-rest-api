import { supabase } from '../../../../supabaseClient.js';

export function requestConcepts(app, BASE_URI) {
    const conceptsHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json');
        res.setHeader('Content-Disposition', 'inline');

        try {
            const page = parseInt(req.query.page) || 1
            const itemsPerPage = Math.min(parseInt(req.query.itemsPerPage) || 10, 100)
            const fullRecord = req.query.fullRecord === 'true'
            const modifiedSince = req.query.modifiedSince ?? null
            const searchQuery = req.query.q ?? null
            const offset = (page - 1) * itemsPerPage

            if (modifiedSince && isNaN(new Date(modifiedSince).getTime())) {
                return res.status(400).json({ error: 'Invalid modifiedSince format. Use YYYY-MM-DD.' })
            }

            const selectFields = fullRecord
                ? 'id, json_ld_v2, concept_label_nl, concept_label_fr, concept_label_en, concept_scope_nl, concept_scope_fr, concept_scope_en'
                : 'id, concept_label_nl'

            const applyFilters = (query) => {
                if (modifiedSince) query = query.gte('generated_at_time', new Date(modifiedSince).toISOString())
                if (searchQuery) query = query.textSearch('search_vector', searchQuery, {
                    type: 'websearch',
                    config: 'dutch'
                })
                return query
            }

            // count query
            const { count, error: countError } = await applyFilters(
                supabase
                    .from('dmg_thesaurus_LDES')
                    .select('id', { count: 'exact', head: true })
            )

            if (countError) {
                console.error('Count error:', JSON.stringify(countError, null, 2))
                return res.status(500).json({ error: 'Error fetching concepts' })
            }

            // data query
            const { data, error } = await applyFilters(
                supabase
                    .from('dmg_thesaurus_LDES')
                    .select(selectFields)
                    .order('id', { ascending: true })
                    .range(offset, offset + itemsPerPage - 1)
            )

            if (error) {
                console.error('Fetch error:', JSON.stringify(error, null, 2))
                return res.status(500).json({ error: 'Error fetching concepts' })
            }

            const totalPages = Math.ceil(count / itemsPerPage)
            const collectionId = `${BASE_URI}/id/concepts`

            const buildParams = (p) => {
                const params = new URLSearchParams({
                    page: p,
                    itemsPerPage,
                    ...(fullRecord && { fullRecord: 'true' }),
                    ...(modifiedSince && { modifiedSince }),
                    ...(searchQuery && { q: searchQuery })
                })
                return `${collectionId}?${params.toString()}`
            }

            const hydraView = {
                "@id": buildParams(page),
                "@type": "hydra:PartialCollectionView",
                "hydra:first": buildParams(1),
                "hydra:last": buildParams(totalPages)
            }

            if (page > 1) hydraView["hydra:previous"] = buildParams(page - 1)
            if (page < totalPages) hydraView["hydra:next"] = buildParams(page + 1)

            const members = (data || []).map(row => {
                if (!fullRecord) {
                    return {
                        "@id": `${BASE_URI}/id/concept/${row.id}`,
                        "@type": "crm:E55_Type",
                        "rdfs:label": row["concept_label_nl"] ?? row.id
                    }
                }

                const obj = row["json_ld_v2"] ?? {}

                const prefLabels = []
                if (row["concept_label_nl"]) prefLabels.push({ "@value": row["concept_label_nl"], "@language": "nl" })
                if (row["concept_label_fr"]) prefLabels.push({ "@value": row["concept_label_fr"], "@language": "fr" })
                if (row["concept_label_en"]) prefLabels.push({ "@value": row["concept_label_en"], "@language": "en" })

                if (prefLabels.length > 0) {
                    obj["skos:prefLabel"] = prefLabels
                }

                const scopeNotes = []
                if (row["concept_scope_nl"]) scopeNotes.push({ "@value": row["concept_scope_nl"], "@language": "nl" })
                if (row["concept_scope_fr"]) scopeNotes.push({ "@value": row["concept_scope_fr"], "@language": "fr" })
                if (row["concept_scope_en"]) scopeNotes.push({ "@value": row["concept_scope_en"], "@language": "en" })

                if (scopeNotes.length > 0) {
                    obj["skos:scopeNote"] = scopeNotes
                }

                return obj
            })

            const response = {
                "@context": {
                    "crm": "http://www.cidoc-crm.org/cidoc-crm/",
                    "skos": "http://www.w3.org/2004/02/skos/core#",
                    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
                    "hydra": "http://www.w3.org/ns/hydra/core#",
                    "owl": "https://www.w3.org/2002/07/owl#"
                },
                "@id": collectionId,
                "@type": "hydra:Collection",
                "hydra:totalItems": count,
                "hydra:view": hydraView,
                "hydra:member": members
            }

            return res.status(200).json(response)

        } catch (error) {
            console.error('Error handling concepts request:', error)
            return res.status(500).json({ error: 'Internal Server Error' })
        }
    }

    app.get('/id/concepts', conceptsHandler)
}