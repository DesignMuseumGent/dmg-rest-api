import { supabase } from '../../../../supabaseClient.js'
import { buildLinkHeader } from '../../../utils/linkHeader.js'
import { applyBiosToObj, cidocType } from '../../../utils/agentHelpers.js'


export function requestAgents(app, BASE_URI) {
    const agentsHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json')
        res.setHeader('Content-Disposition', 'inline')

        try {
            const page          = parseInt(req.query.page) || 1
            const itemsPerPage  = Math.min(parseInt(req.query.itemsPerPage) || 10, 100)
            const offset        = (page - 1) * itemsPerPage
            const fullRecord    = req.query.fullRecord === 'true'
            const modifiedSince = req.query.modifiedSince ?? null
            const searchQuery   = req.query.q ?? null
            const hasBio        = req.query.hasBio === 'true'
            const languageFilter = req.query.language?.toUpperCase() || null
            const agentTypeFilter = req.query.type?.trim().toLowerCase() || null

            const nationalityFilter = req.query.nationality
                ? req.query.nationality.split(',').map(n => n.trim())
                : null
            const roleFilter = req.query.role
                ? req.query.role.split(',').map(r => r.trim().toLowerCase())
                : null

            if (modifiedSince && isNaN(new Date(modifiedSince).getTime())) {
                return res.status(400).json({ error: 'Invalid modifiedSince format. Use YYYY-MM-DD.' })
            }

            const selectFields = fullRecord
                ? 'agent_ID, json_ld_v2, wikipedia_bios, has_bio_nl, has_bio_fr, has_bio_en, agent_type'
                : 'agent_ID, json_ld_v2, agent_type'

            const applyFilters = (q) => {
                if (modifiedSince)              q = q.gte('generated_at_time', new Date(modifiedSince).toISOString())
                if (searchQuery)                q = q.textSearch('search_vector', searchQuery, { type: 'websearch', config: 'simple' })
                if (nationalityFilter?.length)  q = q.contains('nationalities', nationalityFilter)
                if (roleFilter?.length)         q = q.contains('roles', roleFilter)
                if (hasBio)                     q = q.not('wikipedia_bios', 'is', null)
                if (agentTypeFilter)            q = q.eq('agent_type', agentTypeFilter)
                if (languageFilter) {
                    const col = { NLD: 'has_bio_nl', FRA: 'has_bio_fr', ENG: 'has_bio_en' }[languageFilter]
                    if (col) q = q.eq(col, true)
                }
                return q
            }

            const [{ count, error: countError }, { data, error }] = await Promise.all([
                applyFilters(supabase.from('dmg_personen_LDES').select('agent_ID', { count: 'exact', head: true })),
                applyFilters(supabase.from('dmg_personen_LDES').select(selectFields).order('agent_ID', { ascending: true }).range(offset, offset + itemsPerPage - 1))
            ])

            if (countError) {
                console.error('Count error:', countError.message)
                return res.status(500).json({ error: 'Error fetching agents' })
            }
            if (error) {
                console.error('Fetch error:', error.message)
                return res.status(500).json({ error: 'Error fetching agents' })
            }

            const totalPages = Math.ceil(count / itemsPerPage)
            const collectionId = `${BASE_URI}id/agents`

            const buildParams = (p) => {
                const params = new URLSearchParams({
                    page: p,
                    itemsPerPage,
                    ...(fullRecord          && { fullRecord: 'true' }),
                    ...(modifiedSince       && { modifiedSince }),
                    ...(searchQuery         && { q: searchQuery }),
                    ...(nationalityFilter   && { nationality: nationalityFilter.join(',') }),
                    ...(roleFilter          && { role: roleFilter.join(',') }),
                    ...(languageFilter      && { language: languageFilter }),
                    ...(hasBio              && { hasBio: 'true' }),
                    ...(agentTypeFilter     && { type: agentTypeFilter })
                })
                return `${collectionId}?${params.toString()}`
            }

            const hydraView = {
                "@id": buildParams(page),
                "@type": "hydra:PartialCollectionView",
                "hydra:first": buildParams(1),
                "hydra:last": buildParams(totalPages)
            }
            if (page > 1)          hydraView["hydra:previous"] = buildParams(page - 1)
            if (page < totalPages) hydraView["hydra:next"]     = buildParams(page + 1)

            // after fetching data, before building members — full record only
            let relationsMap = {}
            if (fullRecord && data?.length > 0) {
                const agentIds = data.map(r => r.agent_ID)
                const { data: allRelations } = await supabase
                    .from('dmg_agent_relations')
                    .select('agent_id_a, relation, agent_id_b')
                    .in('agent_id_a', agentIds)

                for (const rel of (allRelations || [])) {
                    if (!relationsMap[rel.agent_id_a]) relationsMap[rel.agent_id_a] = []
                    relationsMap[rel.agent_id_a].push({ relation: rel.relation, agent_id_b: rel.agent_id_b })
                }
            }

            const members = (data || []).map(row => {
                const obj = row["json_ld_v2"] ?? {}
                const type = cidocType(row["agent_type"])

                if (!fullRecord) {
                    return {
                        "@id":       obj["@id"] ?? `${BASE_URI}id/agent/${row.agent_ID}`,
                        "@type":     type,
                        "rdfs:label": obj["rdfs:label"] ?? row.agent_ID
                    }
                }

                row._relations = relationsMap[row.agent_ID] || []
                return applyBiosToObj(obj, row)
            })

            const linkHeader = buildLinkHeader(hydraView)
            if (linkHeader) res.setHeader('Link', linkHeader)

            return res.status(200).json({
                "@context": {
                    "crm": "http://www.cidoc-crm.org/cidoc-crm/",
                    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
                    "hydra": "http://www.w3.org/ns/hydra/core#",
                    "owl": "https://www.w3.org/2002/07/owl#",
                    "person": "http://www.w3.org/ns/person#"
                },
                "@id": collectionId,
                "@type": "hydra:Collection",
                "hydra:totalItems": count,
                "hydra:view": hydraView,
                "hydra:member": members
            })

        } catch (error) {
            console.error('Error handling agents request:', error)
            return res.status(500).json({ error: 'Internal Server Error' })
        }
    }

    app.get('/id/agents', agentsHandler)
}