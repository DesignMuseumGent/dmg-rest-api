import { supabase } from '../../../../supabaseClient.js';
import { buildLinkHeader } from '../../../utils/linkHeader.js'

export function requestAgents(app, BASE_URI) {
    const agentsHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json');
        res.setHeader('Content-Disposition', 'inline');

        try {
            const page = parseInt(req.query.page) || 1
            const itemsPerPage = parseInt(req.query.itemsPerPage) || 10
            const fullRecord = req.query.fullRecord === 'true'
            const modifiedSince = req.query.modifiedSince ?? null
            const searchQuery = req.query.q ?? null
            const offset = (page - 1) * itemsPerPage

            if (modifiedSince && isNaN(new Date(modifiedSince).getTime())) {
                return res.status(400).json({ error: 'Invalid modifiedSince format. Use YYYY-MM-DD.' })
            }

            const selectFields = fullRecord
                ? 'agent_ID, json_ld_v2, wikipedia_bios'
                : 'agent_ID, json_ld_v2'

            const nationalityFilter = req.query.nationality
                ? req.query.nationality.split(',').map(n => n.trim())
                : null

            const applyFilters = (query) => {
                if (modifiedSince) query = query.gte('generated_at_time', new Date(modifiedSince).toISOString())
                if (searchQuery) query = query.textSearch('search_vector', searchQuery, {
                    type: 'websearch',
                    config: 'simple'
                })
                if (nationalityFilter?.length > 0) query = query.contains('nationalities', nationalityFilter)
                return query
            }

            // count query
            const { count, error: countError } = await applyFilters(
                supabase.from('dmg_personen_LDES').select('agent_ID', { count: 'exact', head: true })
            )

            if (countError) {
                console.error('Count error:', countError.message)
                return res.status(500).json({ error: 'Error fetching agents' })
            }

            // data query
            const { data, error } = await applyFilters(
                supabase.from('dmg_personen_LDES')
                    .select(selectFields)
                    .order('agent_ID', { ascending: true })
                    .range(offset, offset + itemsPerPage - 1)
            )

            if (error) {
                console.error('Fetch error:', error.message)
                return res.status(500).json({ error: 'Error fetching agents' })
            }

            const totalPages = Math.ceil(count / itemsPerPage)
            const collectionId = `${BASE_URI}/id/agents`

            const buildParams = (p) => {
                const params = new URLSearchParams({
                    page: p,
                    itemsPerPage,
                    ...(fullRecord && { fullRecord: 'true' }),
                    ...(modifiedSince && { modifiedSince }),
                    ...(searchQuery && { q: searchQuery }),
                    ...(nationalityFilter && { nationality: nationalityFilter.join(',') })
                })
                return `${collectionId}?${params.toString()}`
            }

            const hydraView = {
                "@id": buildParams(page),
                "@type": "hydra:PartialCollectionView",
                "hydra:first": buildParams(1),
                "hydra:last": buildParams(totalPages),
            }

            if (page > 1) hydraView["hydra:previous"] = buildParams(page - 1)
            if (page < totalPages) hydraView["hydra:next"] = buildParams(page + 1)

            const members = (data || []).map(row => {
                const obj = row["json_ld_v2"] ?? {}

                if (!fullRecord) {
                    return {
                        "@id": obj["@id"] ?? `${BASE_URI}/id/agent/${row.agent_ID}`,
                        "@type": "crm:E39_Actor",
                        "rdfs:label": obj["rdfs:label"] ?? row.agent_ID
                    }
                }

                if (obj["@context"]) {
                    obj["@context"]["dcterms"] = "http://purl.org/dc/terms/"
                }

                let biosRaw = row["wikipedia_bios"]
                const linguisticObjects = []
                const titles = []

                const pushBio = (text, lang, src) => {
                    if (!text || typeof text !== 'string') return
                    if (text.trim().toLowerCase() === 'no data') return
                    const entry = {
                        "@type": "crm:E33_Linguistic_Object",
                        "rdfs:label": text,
                        "crm:P2_has_type": {
                            "@id": "https://data.designmuseumgent.be/v2/id/type/biography",
                            "@type": "crm:E55_Type",
                            "rdfs:label": "Biografie"
                        }
                    }
                    if (lang) entry["crm:P72_has_language"] = { "rdfs:label": lang }
                    if (src) {
                        entry["crm:P67_refers_to"] = { "@id": src }
                        if (src.includes("wikipedia.org")) {
                            entry["dcterms:license"] = "https://creativecommons.org/licenses/by-sa/4.0/"
                        }
                    }
                    linguisticObjects.push(entry)
                }

                try {
                    if (typeof biosRaw === 'string') {
                        const trimmed = biosRaw.trim()
                        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                            try { biosRaw = JSON.parse(trimmed) } catch {}
                        }
                    }

                    if (Array.isArray(biosRaw)) {
                        for (const b of biosRaw) {
                            if (!b || typeof b !== 'object') continue
                            const text = b['@value'] || b.value || b.text || b.bio || b.snippet
                            const lang = b['@language'] || b.language || b.lang
                            const src = b['dcterms:source'] || b.source || b.url
                            pushBio(text, lang, src)
                        }
                    } else if (biosRaw && typeof biosRaw === 'object') {
                        for (const [lang, v] of Object.entries(biosRaw)) {
                            if (typeof v === 'string') {
                                pushBio(v, lang)
                            } else if (v && typeof v === 'object') {
                                const text = v['@value'] || v.value || v.text || v.bio || v.snippet
                                const src = v['dcterms:source'] || v.source || v.url
                                pushBio(text, lang, src)

                                const langMap = { nl: "NLD", en: "ENG", fr: "FRA" }
                                if (v.title && langMap[lang]) {
                                    titles.push({
                                        "@type": "crm:E41_Appellation",
                                        "rdfs:label": v.title,
                                        "crm:P2_has_type": {
                                            "@id": "http://vocab.getty.edu/aat/300404670",
                                            "@type": "crm:E55_Type",
                                            "rdfs:label": "preferred title"
                                        },
                                        "crm:P72_has_language": {
                                            "@id": `http://publications.europa.eu/resource/authority/language/${langMap[lang]}`
                                        },
                                        ...(src && { "crm:P67_refers_to": { "@id": src } }),
                                        ...(src?.includes("wikipedia.org") && {
                                            "dcterms:license": "https://creativecommons.org/licenses/by-sa/4.0/"
                                        })
                                    })
                                }
                            }
                        }
                    } else if (typeof biosRaw === 'string') {
                        pushBio(biosRaw)
                    }
                } catch (e) {
                    console.error('Error parsing wikipedia_bios:', e)
                }

                if (titles.length > 0) {
                    if (Array.isArray(obj["crm:P1_is_identified_by"])) {
                        obj["crm:P1_is_identified_by"].push(...titles)
                    } else {
                        obj["crm:P1_is_identified_by"] = titles
                    }
                }

                if (linguisticObjects.length > 0) {
                    obj["crm:P67i_is_referred_to_by"] = linguisticObjects
                }

                return obj
            })

            const response = {
                "@context": {
                    "crm": "http://www.cidoc-crm.org/cidoc-crm/",
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

            const linkHeader = buildLinkHeader(hydraView)
            if (linkHeader) res.setHeader('Link', linkHeader)

            return res.status(200).json(response)

        } catch (error) {
            console.error('Error handling agents request:', error)
            return res.status(500).json({ error: 'Internal Server Error' })
        }
    }

    app.get('/id/agents', agentsHandler)
}