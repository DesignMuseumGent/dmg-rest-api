import { fetchByAgentID } from "../../../utils/parsers.js";
import { supabase } from '../../../../supabaseClient.js';

// ---------------------------------------------------------------------------
// SHARED HELPERS
// ---------------------------------------------------------------------------

export const cidocType = (agentType) => {
    if (agentType === 'individual')   return 'crm:E21_Person'
    if (agentType === 'organisation') return 'crm:E74_Group'
    return 'crm:E39_Actor'
}

const parseBios = (biosRaw) => {
    const linguisticObjects = []
    const titles = []
    let thumbnail = null

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
                pushBio(
                    b['@value'] || b.value || b.text || b.bio || b.snippet,
                    b['@language'] || b.language || b.lang,
                    b['dcterms:source'] || b.source || b.url
                )
            }
        } else if (biosRaw && typeof biosRaw === 'object') {
            const langMap = { nl: "NLD", en: "ENG", fr: "FRA" }
            for (const [lang, v] of Object.entries(biosRaw)) {
                if (typeof v === 'string') {
                    pushBio(v, lang)
                } else if (v && typeof v === 'object') {
                    const text = v['@value'] || v.value || v.text || v.bio || v.snippet
                    const src  = v['dcterms:source'] || v.source || v.url
                    pushBio(text, lang, src)
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

            // thumbnail — first available across nl → en → fr
            for (const lang of ['nl', 'en', 'fr']) {
                if (biosRaw[lang]?.thumbnail?.source) {
                    thumbnail = biosRaw[lang].thumbnail
                    break
                }
            }
        } else if (typeof biosRaw === 'string') {
            pushBio(biosRaw)
        }
    } catch (e) {
        console.error('Error parsing wikipedia_bios:', e)
    }

    return { linguisticObjects, titles, thumbnail, biosRaw }
}

export const applyBiosToObj = (obj, row) => {
    if (obj["@context"]) obj["@context"]["dcterms"] = "http://purl.org/dc/terms/"

    const { linguisticObjects, titles, thumbnail, biosRaw } = parseBios(row["wikipedia_bios"])

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

    if (thumbnail) {
        obj["crm:P65_shows_visual_item"] = {
            "@type": "crm:E36_Visual_Item",
            "crm:P2_has_type": {
                "@id": "http://vocab.getty.edu/aat/300264863",
                "@type": "crm:E55_Type",
                "rdfs:label": "digital image"
            },
            "crm:P138i_has_representation": {
                "@id": thumbnail.source,
                "@type": "crm:E38_Image",
                ...(thumbnail.width && {
                    "crm:P43_has_dimension": [
                        {
                            "@type": "crm:E54_Dimension",
                            "crm:P2_has_type": {
                                "@id": "http://vocab.getty.edu/aat/300055647",
                                "@type": "crm:E55_Type",
                                "rdfs:label": "width"
                            },
                            "crm:P90_has_value": thumbnail.width,
                            "crm:P91_has_unit": { "@id": "http://vocab.getty.edu/aat/300266190", "rdfs:label": "px" }
                        },
                        {
                            "@type": "crm:E54_Dimension",
                            "crm:P2_has_type": {
                                "@id": "http://vocab.getty.edu/aat/300055644",
                                "@type": "crm:E55_Type",
                                "rdfs:label": "height"
                            },
                            "crm:P90_has_value": thumbnail.height,
                            "crm:P91_has_unit": { "@id": "http://vocab.getty.edu/aat/300266190", "rdfs:label": "px" }
                        }
                    ]
                })
            },
            "dcterms:license": "https://creativecommons.org/licenses/by-sa/4.0/",
            "crm:P67_refers_to": {
                "@id": biosRaw?.[['nl','en','fr'].find(l => biosRaw?.[l]?.thumbnail?.source)]?.source
            }
        }
    }

    // apply agent type as @type
    if (row["agent_type"]) {
        obj["@type"] = cidocType(row["agent_type"])
    }

    return obj
}

// ---------------------------------------------------------------------------
// SINGLE AGENT
// ---------------------------------------------------------------------------

export function requestAgent(app, BASE_URI) {
    const agentHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json')
        res.setHeader('Content-Disposition', 'inline')

        try {
            const record = await fetchByAgentID(req.params.agentPID)
            if (!record || record.length === 0) {
                return res.status(404).json({ error: 'Agent not found' })
            }

            const row = record[0] ?? {}
            const obj = row["json_ld_v2"] ?? {}

            if (row["generated_at_time"]) {
                const lastModified = new Date(row["generated_at_time"]).toUTCString()
                res.setHeader('Last-Modified', lastModified)
                res.setHeader('ETag', `"${req.params.agentPID}-${new Date(row["generated_at_time"]).getTime()}"`)
                res.setHeader('Cache-Control', 'public, max-age=3600')
            }

            applyBiosToObj(obj, row)

            return res.status(200).json(obj)

        } catch (error) {
            console.error(error)
            return res.status(500).json({ error: 'Error fetching agent data' })
        }
    }

    const headHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json')
        try {
            const { data, error } = await supabase
                .from('dmg_personen_LDES')
                .select('"agent_ID", generated_at_time')
                .eq('agent_ID', req.params.agentPID)
                .maybeSingle()

            if (error) return res.status(500).end()
            if (!data)  return res.status(404).end()

            if (data['generated_at_time']) {
                const lastModified = new Date(data['generated_at_time']).toUTCString()
                res.setHeader('Last-Modified', lastModified)
                res.setHeader('ETag', `"${req.params.agentPID}-${new Date(data['generated_at_time']).getTime()}"`)
                res.setHeader('Cache-Control', 'public, max-age=3600')
            }

            return res.status(200).end()
        } catch (error) {
            console.error('Error handling HEAD request:', error)
            return res.status(500).end()
        }
    }

    app.get('/id/agent/:agentPID', agentHandler)
    app.get('/id/ark:/29417/agent/:agentPID', agentHandler)
    app.head('/id/agent/:agentPID', headHandler)
    app.head('/id/ark:/29417/agent/:agentPID', headHandler)
}