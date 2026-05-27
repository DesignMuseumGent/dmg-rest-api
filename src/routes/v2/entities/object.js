import { fetchObjectByID } from "../../../utils/parsers.js";
import { applyImagesToObject } from "../../../utils/iiif_images.js"; // adjust path if your layout differs

export function requestObject(app, BASE_URI) {
    const objectHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json');
        res.setHeader('Content-Disposition', 'inline');
        const showColors = req.query.colors === 'true'

        const { ObjectPID } = req.params;

        // handle permanently removed objects
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

            // multilingual titles
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

            // multilingual descriptions
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

            // hasParts / isPartOf — always overwrite json_ld_v2 with computed relations columns
            const isPartOf = row["isPartOf"] ?? null
            const hasParts = row["hasParts"] ?? null


            // always delete existing values from json_ld_v2 first
            delete obj["crm:P46_has_component"]
            delete obj["crm:P46i_forms_part_of"]

            if (isPartOf) {
                obj["crm:P46i_forms_part_of"] = {
                    "@id": `${BASE_URI}id/object/${isPartOf}`,
                    "@type": "crm:E22_Human-Made_Object"
                }
            }

            if (hasParts) {
                const parts = typeof hasParts === 'string'
                    ? hasParts.split(',').map(p => p.trim()).filter(Boolean)
                    : Array.isArray(hasParts) ? hasParts : []

                if (parts.length > 0) {
                    obj["crm:P46_has_component"] = parts.map(p => ({
                        "@id": `${BASE_URI}id/object/${p}`,
                        "@type": "crm:E22_Human-Made_Object"
                    }))
                }
            }

            // ---------------------------------------------------------------
            // IIIF images — direct, validated links with rights and attribution
            // ---------------------------------------------------------------
            // Adds:
            //   - crm:P138i_has_representation : array of crm:E38_Image blocks
            //                                    (the canonical CIDOC property)
            //   - image : the first image, repeated as a convenience key
            // No-op when the row has no validated images.
            applyImagesToObject(obj, row)

            // color data — only when ?colors=true
            if (showColors) {
                const colorsData = row["colors"] ?? null
                const iiifImageUri = row["iiif_image_uris"]?.[0] ?? null

                if (colorsData && iiifImageUri) {
                    const colorFeatures = colorsData.map((imageColors, imageIndex) => {
                        const baseColorMap = {}
                        for (const c of imageColors) {
                            if (!baseColorMap[c.base]) baseColorMap[c.base] = 0
                            baseColorMap[c.base] += c.percentage
                        }

                        return {
                            "@id": `${obj["@id"]}/visual/image/${imageIndex + 1}`,
                            "@type": "crm:E36_Visual_Item",
                            "crm:P2_has_type": {
                                "@id": "http://vocab.getty.edu/aat/300264863",
                                "@type": "crm:E55_Type",
                                "rdfs:label": "digital image"
                            },
                            "crm:P138i_has_representation": {
                                "@id": iiifImageUri,
                                "@type": "crm:E38_Image"
                            },
                            "crm:P56_bears_feature": [
                                {
                                    "@id": `${obj["@id"]}/visual/image/${imageIndex + 1}/colors/hex`,
                                    "@type": "crm:E26_Physical_Feature",
                                    "crm:P2_has_type": {
                                        "@id": "http://vocab.getty.edu/aat/300056130",
                                        "@type": "crm:E55_Type",
                                        "rdfs:label": "color"
                                    },
                                    "rdfs:comment": "Dominant colors extracted from the digital image as HEX values",
                                    "crm:P3_has_note": imageColors.map(c => ({
                                        "@type": "crm:E62_String",
                                        "rdf:value": c.hex,
                                        "rdfs:label": c.css,
                                        "crm:P43_has_dimension": {
                                            "@type": "crm:E54_Dimension",
                                            "crm:P2_has_type": {
                                                "@id": "http://vocab.getty.edu/aat/300417476",
                                                "@type": "crm:E55_Type",
                                                "rdfs:label": "percentage"
                                            },
                                            "crm:P90_has_value": {
                                                "@value": Math.round(c.percentage * 100 * 100) / 100,
                                                "@type": "xsd:decimal"
                                            },
                                            "crm:P91_has_unit": {
                                                "@id": "http://vocab.getty.edu/aat/300417476",
                                                "rdfs:label": "%"
                                            }
                                        }
                                    }))
                                },
                                {
                                    "@id": `${obj["@id"]}/visual/image/${imageIndex + 1}/colors/base`,
                                    "@type": "crm:E26_Physical_Feature",
                                    "crm:P2_has_type": {
                                        "@id": "http://vocab.getty.edu/aat/300056130",
                                        "@type": "crm:E55_Type",
                                        "rdfs:label": "color"
                                    },
                                    "rdfs:comment": "Dominant base colors grouped and aggregated for indexing",
                                    "crm:P3_has_note": Object.entries(baseColorMap)
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([base, pct]) => ({
                                            "@type": "crm:E62_String",
                                            "rdf:value": base,
                                            "crm:P43_has_dimension": {
                                                "@type": "crm:E54_Dimension",
                                                "crm:P2_has_type": {
                                                    "@id": "http://vocab.getty.edu/aat/300417476",
                                                    "@type": "crm:E55_Type",
                                                    "rdfs:label": "percentage"
                                                },
                                                "crm:P90_has_value": {
                                                    "@value": Math.round(pct * 100 * 100) / 100,
                                                    "@type": "xsd:decimal"
                                                },
                                                "crm:P91_has_unit": {
                                                    "@id": "http://vocab.getty.edu/aat/300417476",
                                                    "rdfs:label": "%"
                                                }
                                            }
                                        }))
                                }
                            ]
                        }
                    })

                    obj["crm:P65_shows_visual_item"] = colorFeatures.length === 1
                        ? colorFeatures[0]
                        : colorFeatures
                }
            }

            // media — video and audio
            const media = row["_media"] ?? []

            if (media.length > 0) {
                const mediaNodes = media.map(m => {
                    const isVideo = m.type === 'video'

                    return {
                        "@id": m.url,
                        "@type": "crm:E73_Information_Object",
                        "crm:P2_has_type": isVideo
                            ? {
                                "@id": "http://vocab.getty.edu/aat/300263419",
                                "@type": "crm:E55_Type",
                                "rdfs:label": "video"
                            }
                            : {
                                "@id": "http://vocab.getty.edu/aat/300263472",
                                "@type": "crm:E55_Type",
                                "rdfs:label": "audio"
                            },
                        ...(m.title && {
                            "crm:P102_has_title": {
                                "@type": "crm:E35_Title",
                                "rdfs:label": m.title
                            }
                        }),
                        ...(m.date && {
                            "crm:P4_has_time-span": {
                                "@type": "crm:E52_Time-Span",
                                "rdfs:label": m.date,
                                "crm:P82a_begin_of_the_begin": {
                                    "@type": "xsd:gYear",
                                    "@value": m.date
                                },
                                "crm:P82b_end_of_the_end": {
                                    "@type": "xsd:gYear",
                                    "@value": m.date
                                }
                            }
                        })
                    }
                })

                // merge with existing P129i_is_subject_of (IIIF manifest)
                const existing = obj["crm:P129i_is_subject_of"]
                if (existing) {
                    const existingArray = Array.isArray(existing) ? existing : [existing]
                    obj["crm:P129i_is_subject_of"] = [...existingArray, ...mediaNodes]
                } else {
                    obj["crm:P129i_is_subject_of"] = mediaNodes.length === 1
                        ? mediaNodes[0]
                        : mediaNodes
                }
            }

            // projects — creative projects inspired by or using this object
            const projects = row["_projects"] ?? []

            if (projects.length > 0) {
                obj["crm:P15i_was_motivation_of"] = projects.map(p => ({
                    "@type": "crm:E7_Activity",
                    "crm:P2_has_type": {
                        "@id": "http://vocab.getty.edu/aat/300404591",
                        "@type": "crm:E55_Type",
                        "rdfs:label": "creative project"
                    },
                    ...(p.title && {
                        "crm:P102_has_title": {
                            "@type": "crm:E35_Title",
                            "rdfs:label": p.title
                        }
                    }),
                    ...(p.url && {
                        "crm:P129i_is_subject_of": {
                            "@id": p.url,
                            "@type": "crm:E73_Information_Object"
                        }
                    }),
                    ...(p.date && {
                        "crm:P4_has_time-span": {
                            "@type": "crm:E52_Time-Span",
                            "rdfs:label": p.date,
                            "crm:P82a_begin_of_the_begin": {
                                "@type": "xsd:gYear",
                                "@value": p.date
                            },
                            "crm:P82b_end_of_the_end": {
                                "@type": "xsd:gYear",
                                "@value": p.date
                            }
                        }
                    })
                }))
            }

            if (row["generated_at_time"]) {
                const lastModified = new Date(row["generated_at_time"]).toUTCString()
                res.setHeader('Last-Modified', lastModified)
                res.setHeader('ETag', `"${ObjectPID}-${new Date(row["generated_at_time"]).getTime()}"`)
                res.setHeader('Cache-Control', 'public, max-age=3600')
            }

            return res.status(200).json(obj)

        } catch (error) {
            console.error('Error handling object request:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    };

    const headHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json')

        const { ObjectPID } = req.params

        if (ObjectPID === 'REMOVED') return res.status(410).end()

        try {
            const { data, error } = await supabase
                .from('dmg_objects_LDES')
                .select('objectNumber, RESOLVES_TO, generated_at_time')
                .eq('objectNumber', ObjectPID)
                .maybeSingle()

            if (error) return res.status(500).end()
            if (!data) return res.status(404).end()

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

            if (data['generated_at_time']) {
                const lastModified = new Date(data['generated_at_time']).toUTCString()
                res.setHeader('Last-Modified', lastModified)
                res.setHeader('ETag', `"${ObjectPID}-${new Date(data['generated_at_time']).getTime()}"`)
                res.setHeader('Cache-Control', 'public, max-age=3600')
            }

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