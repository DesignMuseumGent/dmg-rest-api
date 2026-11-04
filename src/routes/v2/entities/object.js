import { fetchObjectByID } from "../../../utils/parsers.js";
import { applyImagesToObject } from "../../../utils/iiif_images.js";
import { supabase } from '../../../../supabaseClient.js'
import { applyColorVisualItems, dedupeExhibitions } from '../../../utils/visual_items.js'


// Bump this whenever the SHAPE of the JSON-LD output changes, so clients and
// CDNs holding an ETag from the old shape revalidate instead of getting a 304.
const SHAPE_VERSION = 's2'

// Last change to OUR representation of the object: either a source change
// (generated_at_time, the LDES/PROV timestamp) or a local change
// (modified_at — exhibition links, translations, colors, relations, status).
// Used for Last-Modified and ETag so revalidating clients see local fixes too.
const changedAt = (row) => new Date(Math.max(
    row?.generated_at_time ? Date.parse(row.generated_at_time) : 0,
    row?.modified_at       ? Date.parse(row.modified_at)       : 0,
))

// The ?colors=true variant has a different body, so it needs its own ETag.
function setCacheHeaders(res, ObjectPID, row, showColors = false) {
    const ts = changedAt(row)
    if (ts.getTime() > 0) {
        res.setHeader('Last-Modified', ts.toUTCString())
        res.setHeader('ETag', `"${ObjectPID}-${ts.getTime()}-${SHAPE_VERSION}${showColors ? 'c' : ''}"`)
        res.setHeader('Cache-Control', 'public, max-age=3600')
    }
}

export function requestObject(app, BASE_URI) {
    const objectHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json');
        res.setHeader('Content-Disposition', 'inline');
        const showColors = req.query.colors === 'true'

        const { ObjectPID } = req.params;

        if (ObjectPID === "REMOVED") {
            return res.status(410).json({ error: "This object has been permanently removed from our collection." });
        }

        try {
            const record = await fetchObjectByID(ObjectPID);

            if (!record || record.length === 0) {
                return res.status(404).json({ error: 'Object not found' });
            }

            const row = record[0]

            if (row["RESOLVES_TO"]) {
                const resolvedNumber = row["RESOLVES_TO"].replace("id/object/", "")

                if (resolvedNumber === ObjectPID) {
                    // self-referencing resolver — serve directly
                } else if (resolvedNumber.includes("REMOVED")) {
                    return res.status(410).json({ error: "This object has been permanently removed from our collection." })
                } else {
                    return res.status(301)
                        .setHeader('Location', `${BASE_URI}id/object/${resolvedNumber}`)
                        .json({
                            message: `This object has been merged into ${resolvedNumber}.`,
                            resolved: `${BASE_URI}id/object/${resolvedNumber}`
                        })
                }
            }

            const obj = row["json_ld_v2"] ?? {}

            // ── multilingual titles ──────────────────────────────────────
            const appellations = []
            if (row["object_title_nl"]) appellations.push({ lang: "NLD", value: row["object_title_nl"] })
            if (row["object_title_fr"]) appellations.push({ lang: "FRA", value: row["object_title_fr"] })
            if (row["object_title_en"]) appellations.push({ lang: "ENG", value: row["object_title_en"] })

            if (appellations.length > 0) {
                const langsToReplace = ["NLD", "FRA", "ENG"]
                if (Array.isArray(obj["crm:P1_is_identified_by"])) {
                    obj["crm:P1_is_identified_by"] = obj["crm:P1_is_identified_by"].filter(node => {
                        const langId = node["crm:P72_has_language"]?.["@id"] ?? ""
                        return !langsToReplace.some(l => langId.endsWith(l))
                    })
                }
                obj["crm:P1_is_identified_by"] = [
                    ...(obj["crm:P1_is_identified_by"] ?? []),
                    ...appellations.map(a => ({
                        "@type": "crm:E41_Appellation",
                        "rdfs:label": a.value,
                        "crm:P72_has_language": {
                            "@id": `http://publications.europa.eu/resource/authority/language/${a.lang}`
                        }
                    }))
                ]
            }

            // ── multilingual descriptions ────────────────────────────────
            const descriptions = []
            if (row["object_description_nl"]) descriptions.push({ lang: "NLD", value: row["object_description_nl"] })
            if (row["object_description_fr"]) descriptions.push({ lang: "FRA", value: row["object_description_fr"] })
            if (row["object_description_en"]) descriptions.push({ lang: "ENG", value: row["object_description_en"] })

            if (descriptions.length > 0) {
                obj["crm:P67i_is_referred_to_by"] = descriptions.map(d => ({
                    "@type": "crm:E33_Linguistic_Object",
                    "rdfs:label": d.value,
                    "crm:P2_has_type": {
                        "@id": "http://vocab.getty.edu/aat/300080091",
                        "@type": "crm:E55_Type",
                        "rdfs:label": "description"
                    },
                    "crm:P72_has_language": {
                        "@id": `http://publications.europa.eu/resource/authority/language/${d.lang}`
                    }
                }))
            }

            // ── exhibitions — de-duplicate on @id ────────────────────────
            // Safety net: the duplicate (e.g. TE_2016-008 twice on 1977-0002)
            // most likely originates upstream in json_ld_v2 / exhibition linking.
            dedupeExhibitions(obj)

            // ── isPartOf — this object is a member of a koepelrecord set ─
            // Overwrite from computed column — single value, no rich data lost
            delete obj["crm:P46i_forms_part_of"]
            const isPartOf = row["isPartOf"] ?? null

            if (isPartOf) {
                obj["crm:P46i_forms_part_of"] = {
                    "@id": `${BASE_URI}id/object/${isPartOf}`,
                    "@type": "crm:E22_Human-Made_Object"
                }
            }

            // ── hasParts — koepelrecord: this set is composed of these objects
            // Uses crm:P106_is_composed_of — distinct from crm:P46_has_component
            // crm:P46_has_component (fysiekeOnderdelen with names, materials, dimensions)
            // is left untouched from json_ld_v2
            delete obj["crm:P106_is_composed_of"]
            const hasParts = row["hasParts"] ?? null

            if (hasParts) {
                const parts = typeof hasParts === 'string'
                    ? hasParts.split(',').map(p => p.trim()).filter(Boolean)
                    : Array.isArray(hasParts) ? hasParts : []

                if (parts.length > 0) {
                    obj["crm:P106_is_composed_of"] = parts.map(p => ({
                        "@id": `${BASE_URI}id/object/${p}`,
                        "@type": "crm:E22_Human-Made_Object"
                    }))
                }
            }

            // ── collection presentation ──────────────────────────────
            if (row["COLLECTION_PRESENTATION"] === true) {
                obj["crm:P55_has_current_location"] = {
                    "@id":   "https://data.designmuseumgent.be/v2/id/place/collection-presentation",
                    "@type": "crm:E53_Place",
                    "crm:P2_has_type": {
                        "@id":        "http://vocab.getty.edu/aat/300054766",
                        "@type":      "crm:E55_Type",
                        "rdfs:label": "permanent collection display"
                    },
                    "rdfs:label": "Collection presentation Design Museum Gent"
                }
            }


            // ── IIIF images ──────────────────────────────────────────────
            applyImagesToObject(obj, row)

            // ── color data — only when ?colors=true ─────────────────────
            if (showColors) applyColorVisualItems(obj, row)

            // ── media — video and audio ──────────────────────────────────
            const media = row["_media"] ?? []

            if (media.length > 0) {
                const mediaNodes = media.map(m => ({
                    "@id": m.url,
                    "@type": "crm:E73_Information_Object",
                    "crm:P2_has_type": m.type === 'video'
                        ? { "@id": "http://vocab.getty.edu/aat/300263419", "@type": "crm:E55_Type", "rdfs:label": "video" }
                        : { "@id": "http://vocab.getty.edu/aat/300263472", "@type": "crm:E55_Type", "rdfs:label": "audio" },
                    ...(m.title && {
                        "crm:P102_has_title": { "@type": "crm:E35_Title", "rdfs:label": m.title }
                    }),
                    ...(m.date && {
                        "crm:P4_has_time-span": {
                            "@type": "crm:E52_Time-Span",
                            "rdfs:label": m.date,
                            "crm:P82a_begin_of_the_begin": { "@type": "xsd:gYear", "@value": m.date },
                            "crm:P82b_end_of_the_end":     { "@type": "xsd:gYear", "@value": m.date }
                        }
                    })
                }))

                const existing = obj["crm:P129i_is_subject_of"]
                if (existing) {
                    const existingArray = Array.isArray(existing) ? existing : [existing]
                    obj["crm:P129i_is_subject_of"] = [...existingArray, ...mediaNodes]
                } else {
                    obj["crm:P129i_is_subject_of"] = mediaNodes.length === 1 ? mediaNodes[0] : mediaNodes
                }
            }

            // ── projects ─────────────────────────────────────────────────
            const projects = row["_projects"] ?? []

            if (projects.length > 0) {
                obj["crm:P15i_was_motivation_of"] = projects.map(p => ({
                    "@type": "crm:E7_Activity",
                    "crm:P2_has_type": {
                        "@id": "http://vocab.getty.edu/aat/300404591",
                        "@type": "crm:E55_Type",
                        "rdfs:label": "creative project"
                    },
                    ...(p.title && { "crm:P102_has_title": { "@type": "crm:E35_Title", "rdfs:label": p.title } }),
                    ...(p.url   && { "crm:P129i_is_subject_of": { "@id": p.url, "@type": "crm:E73_Information_Object" } }),
                    ...(p.date  && {
                        "crm:P4_has_time-span": {
                            "@type": "crm:E52_Time-Span",
                            "rdfs:label": p.date,
                            "crm:P82a_begin_of_the_begin": { "@type": "xsd:gYear", "@value": p.date },
                            "crm:P82b_end_of_the_end":     { "@type": "xsd:gYear", "@value": p.date }
                        }
                    })
                }))
            }

            // ── cache headers ────────────────────────────────────────────
            setCacheHeaders(res, ObjectPID, row, showColors)

            return res.status(200).json(obj)

        } catch (error) {
            console.error('Error handling object request:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    };

    const headHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json')

        const showColors = req.query.colors === 'true'
        const { ObjectPID } = req.params

        if (ObjectPID === 'REMOVED') return res.status(410).end()

        try {
            const { data, error } = await supabase
                .from('dmg_objects_LDES')
                .select('objectNumber, RESOLVES_TO, generated_at_time, modified_at')
                .eq('objectNumber', ObjectPID)
                .maybeSingle()

            if (error) return res.status(500).end()
            if (!data)  return res.status(404).end()

            if (data['RESOLVES_TO']) {
                const resolvedNumber = data['RESOLVES_TO'].replace('id/object/', '')
                if (resolvedNumber.includes('REMOVED')) return res.status(410).end()
                if (resolvedNumber !== ObjectPID) {
                    return res
                        .status(301)
                        .setHeader('Location', `${BASE_URI}id/object/${resolvedNumber}`)
                        .end()
                }
            }

            setCacheHeaders(res, ObjectPID, data, showColors)

            return res.status(200).end()

        } catch (error) {
            console.error('Error handling HEAD request:', error)
            return res.status(500).end()
        }
    }

    app.get(`/id/object/:ObjectPID`, objectHandler);
    app.get(`/id/ark:/29417/object/:ObjectPID`, objectHandler);
    app.head('/id/object/:ObjectPID', headHandler)
    app.head('/id/ark:/29417/object/:ObjectPID', headHandler)
}