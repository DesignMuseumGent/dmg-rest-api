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

            //console.log(record)

            const row = record[0]

            if (row["RESOLVES_TO"]) {
                //console.log(`\n🔀 Resolver triggered for: ${ObjectPID}`)
                //console.log(`   RESOLVES_TO value: "${row["RESOLVES_TO"]}"`)

                const resolvedNumber = row["RESOLVES_TO"].replace("id/object/", "")
                //console.log(`   Resolved object number: "${resolvedNumber}"`)

                // skip self-referencing resolvers
                if (resolvedNumber === ObjectPID) {
                   // console.log(`   ⚠️  RESOLVES_TO points to itself — skipping resolver, serving record directly`)
                } else if (resolvedNumber.includes("REMOVED")) {
                    //console.log(`   ❌ Object is marked as REMOVED — returning 410`)
                    return res.status(410).json({ error: "This object has been permanently removed from our collection." })
                } else {
                   // console.log(`   ↪ Redirecting to: ${BASE_URI}id/object/${resolvedNumber}`)
                    return res.status(301)
                        .setHeader('Location', `${BASE_URI}/id/object/${resolvedNumber}`)
                        .json({
                            message: `This object has been merged into ${resolvedNumber}.`,
                            resolved: `${BASE_URI}/id/object/${resolvedNumber}`
                        })
                }
            }

            //console.log(`✅ Serving record directly for ${ObjectPID}`)

            const obj = row["json_ld_v2"] ?? {}

            // enrich with multilingual titles from separate columns
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

            // enrich with multilingual descriptions from separate columns
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

            if (showColors) {
                // enrich with color data
                const colorsData = row["colors"] ?? null
                const iiifImageUri = row["iiif_image_uris"]?.[0] ?? null

                if (colorsData && iiifImageUri) {
                    // colorsData is an array of images, each containing an array of colors
                    const colorFeatures = colorsData.map((imageColors, imageIndex) => {
                        // group by base color and sum percentages
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
                                // exact HEX colors as E26_Physical_Feature
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
                                        "crm:P2_has_type": {
                                            "@id": "http://vocab.getty.edu/aat/300056130",
                                            "@type": "crm:E55_Type",
                                            "rdfs:label": "color"
                                        },
                                        // percentage as E54_Dimension
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
                                        },
                                        // CSS name as rdfs:label
                                        "rdfs:label": c.css
                                    }))
                                },
                                // base colors as E26_Physical_Feature
                                {
                                    "@id": `${obj["@id"]}/visual/image/${imageIndex + 1}/colors/base`,
                                    "@type": "crm:E26_Physical_Feature",
                                    "crm:P2_has_type": {
                                        "@id": "http://vocab.getty.edu/aat/300056130",
                                        "@type": "crm:E55_Type",
                                        "rdfs:label": "color"
                                    },
                                    "rdfs:comment": "Dominant base colors clustered for indexing",
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