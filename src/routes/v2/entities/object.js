import { fetchObjectByID } from "../../../utils/parsers.js";

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
                        .setHeader('Location', `${BASE_URI}/id/object/${resolvedNumber}`)
                        .json({
                            message: `This object has been merged into ${resolvedNumber}.`,
                            resolved: `${BASE_URI}/id/object/${resolvedNumber}`
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
                    "@id": `${BASE_URI}/id/object/${isPartOf}`,
                    "@type": "crm:E22_Human-Made_Object"
                }
            }

            if (hasParts) {
                const parts = typeof hasParts === 'string'
                    ? hasParts.split(',').map(p => p.trim()).filter(Boolean)
                    : Array.isArray(hasParts) ? hasParts : []

                if (parts.length > 0) {
                    obj["crm:P46_has_component"] = parts.map(p => ({
                        "@id": `${BASE_URI}/id/object/${p}`,
                        "@type": "crm:E22_Human-Made_Object"
                    }))
                }
            }
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

            return res.status(200).json(obj)

        } catch (error) {
            console.error('Error handling object request:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    };

    app.get(`/id/object/:ObjectPID`, objectHandler);
    app.get(`/id/ark:/29417/object/:ObjectPID`, objectHandler);
}