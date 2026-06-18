// ---------------------------------------------------------------------------
// CIDOC TYPE
// ---------------------------------------------------------------------------

export function cidocType(agentType) {
    if (agentType === 'individual')   return 'crm:E21_Person'
    if (agentType === 'organisation') return 'crm:E74_Group'
    return 'crm:E39_Actor'
}

// ---------------------------------------------------------------------------
// RELATION → CIDOC-CRM PROPERTY MAP
// ---------------------------------------------------------------------------

const RELATION_CIDOC = {
    parent_of:    { property: 'crm:P152i_is_parent_of',                   type: 'crm:E21_Person' },
    child_of:     { property: 'crm:P152_has_parent',                      type: 'crm:E21_Person' },
    spouse_of:    { property: 'crm:P107i_is_current_or_former_member_of', type: 'crm:E39_Actor',  note: 'spouse' },
    sibling_of:   { property: 'crm:P107i_is_current_or_former_member_of', type: 'crm:E39_Actor',  note: 'sibling' },
    employer_of:  { property: 'crm:P107_has_current_or_former_member',    type: 'crm:E39_Actor',  note: 'employee' },
    employee_of:  { property: 'crm:P107i_is_current_or_former_member_of', type: 'crm:E74_Group',  note: 'employee' },
    mentor_of:    { property: 'crm:P107_has_current_or_former_member',    type: 'crm:E39_Actor',  note: 'student' },
    student_of:   { property: 'crm:P107i_is_current_or_former_member_of', type: 'crm:E39_Actor',  note: 'mentor' },
    collaborator: { property: 'crm:P107i_is_current_or_former_member_of', type: 'crm:E39_Actor',  note: 'collaborator' },
    member_of:    { property: 'crm:P107i_is_current_or_former_member_of', type: 'crm:E74_Group',  note: 'member' },
    has_member:   { property: 'crm:P107_has_current_or_former_member',    type: 'crm:E39_Actor',  note: 'member' },
    founded:      { property: 'crm:P107_has_current_or_former_member',    type: 'crm:E74_Group',  note: 'founded' },
    founded_by:   { property: 'crm:P107i_is_current_or_former_member_of', type: 'crm:E39_Actor',  note: 'founder' },
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

// Normalise any value to an array, filtering out nulls
const toArray = (v) => {
    if (v == null) return []
    return Array.isArray(v) ? v : [v]
}

// Merge new nodes into an existing property, always producing an array
// when there is more than one node, or a single object when there is exactly one
const mergeProperty = (obj, prop, newNodes) => {
    if (!newNodes || newNodes.length === 0) return
    const existing = toArray(obj[prop])
    const merged   = [...existing, ...newNodes]
    obj[prop]      = merged.length === 1 ? merged[0] : merged
}

// ---------------------------------------------------------------------------
// BIO PARSING
// ---------------------------------------------------------------------------

export function parseBios(wikipedia_bios) {
    if (!wikipedia_bios) return { bios: [], labels: [], thumbnail: null }

    // shape: { nl: { title, snippet, thumbnail, status, source }, fr: {...}, en: {...} }
    const langMap = { nl: 'NLD', fr: 'FRA', en: 'ENG' }

    const bios      = []
    const labels    = []
    let   thumbnail = null

    for (const [lang, data] of Object.entries(wikipedia_bios)) {
        if (!data || data.status === 'no_qid' || data.status === 'error') continue

        const cidocLang = langMap[lang]
        if (!cidocLang) continue

        // biographical snippet
        if (data.snippet && data.snippet !== 'no data') {
            bios.push({
                "@type": "crm:E33_Linguistic_Object",
                "rdfs:label": data.snippet,
                "crm:P2_has_type": {
                    "@id":        "http://vocab.getty.edu/aat/300080091",
                    "@type":      "crm:E55_Type",
                    "rdfs:label": "description"
                },
                "crm:P72_has_language": {
                    "@id": `http://publications.europa.eu/resource/authority/language/${cidocLang}`
                },
                ...(data.source && data.source !== 'no data' && {
                    "crm:P129i_is_subject_of": {
                        "@id":        data.source,
                        "@type":      "crm:E73_Information_Object",
                        "rdfs:label": `Wikipedia (${lang})`
                    }
                })
            })
        }

        // Wikipedia title as appellation
        if (data.title && data.title !== 'no data') {
            labels.push({
                "@type": "crm:E41_Appellation",
                "rdfs:label": data.title,
                "crm:P72_has_language": {
                    "@id": `http://publications.europa.eu/resource/authority/language/${cidocLang}`
                }
            })
        }

        // thumbnail — first non-null across languages
        if (!thumbnail && data.thumbnail?.source) {
            thumbnail = data.thumbnail.source
        }
    }

    return { bios, labels, thumbnail }
}

// ---------------------------------------------------------------------------
// APPLY BIOS AND RELATIONS TO OBJ
// ---------------------------------------------------------------------------

export function applyBiosToObj(obj, row) {

    // ── agent type ───────────────────────────────────────────
    obj['@type'] = cidocType(row['agent_type'])

    // ── wikipedia data ───────────────────────────────────────
    const { bios, labels, thumbnail } = parseBios(row['wikipedia_bios'])

    // bios → merge into crm:P67i_is_referred_to_by
    // (may already contain descriptions from the harvester)
    if (bios.length > 0) {
        mergeProperty(obj, 'crm:P67i_is_referred_to_by', bios)
    }

    // Wikipedia titles → merge into crm:P1_is_identified_by
    // (may already contain appellations from the harvester)
    if (labels.length > 0) {
        mergeProperty(obj, 'crm:P1_is_identified_by', labels)
    }

    // thumbnail — convenience key, not a CIDOC property
    if (thumbnail) {
        obj['thumbnail'] = thumbnail
    }

    // ── agent relations ──────────────────────────────────────
    // Relations come from dmg_agent_relations via fetchByAgentID.
    // crm:P107i_is_current_or_former_member_of may already contain
    // nationality data from the harvester (geonames URI, no crm:P2_has_type).
    // We merge relation nodes into that property so both are preserved.
    // Consumers can distinguish:
    //   - nationality: no crm:P2_has_type, @id points to geonames
    //   - relation:    has crm:P2_has_type, @id points to /v2/id/agent/

    if (Array.isArray(row._relations) && row._relations.length > 0) {
        const grouped = {}

        for (const rel of row._relations) {
            const mapping = RELATION_CIDOC[rel.relation]
            if (!mapping) continue

            const prop = mapping.property
            if (!grouped[prop]) grouped[prop] = []

            const node = {
                "@id":   `https://data.designmuseumgent.be/v2/id/agent/${rel.agent_id_b}`,
                "@type": mapping.type
            }

            // qualifier distinguishes relations that share the same CRM property
            if (mapping.note) {
                node["crm:P2_has_type"] = {
                    "@id":        `https://data.designmuseumgent.be/v2/id/type/relation/${rel.relation}`,
                    "@type":      "crm:E55_Type",
                    "rdfs:label": rel.relation.replace(/_/g, ' ')
                }
            }

            grouped[prop].push(node)
        }

        for (const [prop, nodes] of Object.entries(grouped)) {
            // merge with existing value (e.g. nationality already in json_ld_v2)
            mergeProperty(obj, prop, nodes)
        }
    }

    return obj
}