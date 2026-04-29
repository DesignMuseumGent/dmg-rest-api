import { fetchObjectByID } from "../../../utils/parsers.js";

export function requestObject(app, BASE_URI) {
    const objectHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json');
        res.setHeader('Content-Disposition', 'inline');

        const { ObjectPID } = req.params;

        try {
            const record = await fetchObjectByID(ObjectPID);

            if (!record || record.length === 0) {
                return res.status(404).json({ error: 'Object not found' });
            }

            const row = record[0]
            const obj = row["json_ld_v2"] ?? {}

            // enrich with multilingual titles from separate columns
            const appellations = []
            if (row["object_title_nl"]) appellations.push({ lang: "NLD", value: row["object_title_nl"] })
            if (row["object_title_fr"]) appellations.push({ lang: "FRA", value: row["object_title_fr"] })
            if (row["object_title_en"]) appellations.push({ lang: "ENG", value: row["object_title_en"] })

            if (appellations.length > 0) {
                const langsToReplace = ["NLD", "FRA", "ENG"]
                // remove existing appellations for these languages to avoid duplicates
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

            const hexValues = row["HEX_values"]?.[0] ?? []
            const colorNames = row["color_names"]?.[0] ?? []
            const iiifImageUri = row["iiif_image_uris"]?.[0] ?? null

            if (hexValues.length > 0 && iiifImageUri) {
                obj["crm:P65_shows_visual_item"] = {
                    "@id": `${obj["@id"]}/visual`,
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
                            "@id": `${obj["@id"]}/visual/colors/hex`,
                            "@type": "crm:E26_Physical_Feature",
                            "crm:P2_has_type": {
                                "@id": "http://vocab.getty.edu/aat/300056130",
                                "@type": "crm:E55_Type",
                                "rdfs:label": "color"
                            },
                            "rdfs:comment": "Dominant colors extracted from the digital image as HEX values",
                            "crm:P3_has_note": hexValues.map(hex => ({
                                "@value": hex,
                                "@type": "xsd:string"
                            }))
                        },
                        ...(colorNames.length > 0 ? [{
                            "@id": `${obj["@id"]}/visual/colors/css`,
                            "@type": "crm:E26_Physical_Feature",
                            "crm:P2_has_type": {
                                "@id": "http://vocab.getty.edu/aat/300056130",
                                "@type": "crm:E55_Type",
                                "rdfs:label": "color"
                            },
                            "rdfs:comment": "Dominant colors clustered to CSS named colors for indexing",
                            "crm:P3_has_note": colorNames.map(name => ({
                                "@value": name,
                                "@type": "xsd:string"
                            }))
                        }] : [])
                    ]
                }
            }

            return res.status(200).json(obj)

        } catch (error) {
            console.error('Error handling object request:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    };

    app.get(`/id/object/:ObjectPID`, objectHandler);
}