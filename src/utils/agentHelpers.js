import {supabase} from "../../supabaseClient.js";

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
// BIO PARSING
// ---------------------------------------------------------------------------

export function parseBios(wikipedia_bios) {
    if (!wikipedia_bios) return []
    const bios = Array.isArray(wikipedia_bios) ? wikipedia_bios : [wikipedia_bios]
    return bios
        .filter(b => b?.text && b?.lang)
        .map(b => ({
            "@type": "crm:E33_Linguistic_Object",
            "rdfs:label": b.text,
            "crm:P2_has_type": {
                "@id": "http://vocab.getty.edu/aat/300080091",
                "@type": "crm:E55_Type",
                "rdfs:label": "description"
            },
            "crm:P72_has_language": {
                "@id": `http://publications.europa.eu/resource/authority/language/${b.lang.toUpperCase()}`
            }
        }))
}

// ---------------------------------------------------------------------------
// APPLY BIOS AND RELATIONS TO OBJ
// ---------------------------------------------------------------------------

export function applyBiosToObj(obj, row) {
    // agent type
    const type = cidocType(row['agent_type'])
    obj['@type'] = type

    // wikipedia bios
    const bios = parseBios(row['wikipedia_bios'])
    if (bios.length > 0) {
        const existing = Array.isArray(obj['crm:P67i_is_referred_to_by'])
            ? obj['crm:P67i_is_referred_to_by']
            : obj['crm:P67i_is_referred_to_by']
                ? [obj['crm:P67i_is_referred_to_by']]
                : []
        obj['crm:P67i_is_referred_to_by'] = [...existing, ...bios]
    }

    // agent relations as CIDOC-CRM properties
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

            // add type qualifier where multiple relations share the same CRM property
            if (mapping.note) {
                node["crm:P2_has_type"] = {
                    "@id": `https://data.designmuseumgent.be/v2/id/type/relation/${rel.relation}`,
                    "@type": "crm:E55_Type",
                    "rdfs:label": rel.relation.replace(/_/g, ' ')
                }
            }

            grouped[prop].push(node)
        }

        for (const [prop, nodes] of Object.entries(grouped)) {
            obj[prop] = nodes.length === 1 ? nodes[0] : nodes
        }
    }

    return obj
}