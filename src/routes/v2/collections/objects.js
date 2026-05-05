import { supabase } from '../../../../supabaseClient.js';

export function requestObjects(app, BASE_URI) {
    const objectsHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json');
        res.setHeader('Content-Disposition', 'inline');

        try {
            const page = parseInt(req.query.page) || 1
            const itemsPerPage = Math.min(parseInt(req.query.itemsPerPage) || 10, 100)
            const fullRecord = req.query.fullRecord === 'true'
            const hasImages = req.query.hasImages === 'true'
            const showColors = req.query.colors === 'true'
            const modifiedSince = req.query.modifiedSince ?? null
            const colorFilter = req.query.color
                ? req.query.color.split(',').map(c => c.trim().toLowerCase())
                : null
            const cssColorFilter = req.query.cssColor
                ? req.query.cssColor.split(',').map(c => c.trim())
                : null
            const offset = (page - 1) * itemsPerPage
            const searchQuery = req.query.q ?? null

            if (modifiedSince && isNaN(new Date(modifiedSince).getTime())) {
                return res.status(400).json({ error: 'Invalid modifiedSince date format. Use YYYY-MM-DD.' })
            }

            // build count query
            let countQuery = supabase
                .from('dmg_objects_LDES')
                .select('objectNumber', { count: 'exact', head: true })

            if (searchQuery) {
                countQuery = countQuery.textSearch('search_vector', searchQuery, {
                    type: 'websearch',
                    config: 'dutch'
                })
            }

            if (hasImages) countQuery = countQuery.not('iiif_manifest', 'is', null)
            if (modifiedSince) countQuery = countQuery.gte('generated_at_time', new Date(modifiedSince).toISOString())
            if (colorFilter?.length > 0) countQuery = countQuery.contains('dominant_colors', colorFilter)
            if (cssColorFilter?.length > 0) countQuery = countQuery.contains('dominant_css_colors', cssColorFilter)

            // build data query
            let selectFields
            if (!fullRecord) {
                selectFields = 'objectNumber, object_title_nl, iiif_manifest, RESOLVES_TO'
            } else if (showColors) {
                selectFields = 'objectNumber, json_ld_v2, object_title_nl, object_title_fr, object_title_en, object_description_nl, object_description_fr, object_description_en, colors, HEX_values, color_names, iiif_image_uris, RESOLVES_TO'
            } else {
                selectFields = 'objectNumber, json_ld_v2, object_title_nl, object_title_fr, object_title_en, object_description_nl, object_description_fr, object_description_en, RESOLVES_TO'
            }


            let dataQuery = supabase
                .from('dmg_objects_LDES')
                .select(selectFields)
                .order('objectNumber', { ascending: true })
                .range(offset, offset + itemsPerPage - 1)

            if (hasImages) dataQuery = dataQuery.not('iiif_manifest', 'is', null)
            if (modifiedSince) dataQuery = dataQuery.gte('generated_at_time', new Date(modifiedSince).toISOString())
            if (colorFilter?.length > 0) dataQuery = dataQuery.contains('dominant_colors', colorFilter)
            if (cssColorFilter?.length > 0) dataQuery = dataQuery.contains('dominant_css_colors', cssColorFilter)
            if (searchQuery) {
                dataQuery = dataQuery.textSearch('search_vector', searchQuery, {
                    type: 'websearch',
                    config: 'dutch'
                })
            }


            const [{ count, error: countError }, { data, error }] = await Promise.all([
                countQuery,
                dataQuery
            ])

            if (countError) {
                console.error('Count error details:', JSON.stringify(countError, null, 2))
                return res.status(500).json({ error: 'Error fetching objects', details: countError.message })
            }

            if (error) {
                console.error('Fetch error details:', JSON.stringify(error, null, 2))
                return res.status(500).json({ error: 'Error fetching objects', details: error.message })
            }

            const totalPages = Math.ceil(count / itemsPerPage)
            const collectionId = `${BASE_URI}/id/objects`

            const buildParams = (p) => {
                const params = new URLSearchParams({
                    page: p,
                    itemsPerPage,
                    ...(fullRecord && { fullRecord: 'true' }),
                    ...(hasImages && { hasImages: 'true' }),
                    ...(modifiedSince && { modifiedSince }),
                    ...(showColors && { colors: 'true' }),
                    ...(colorFilter && { color: colorFilter.join(',') }),
                    ...(cssColorFilter && { cssColor: cssColorFilter.join(',') }),
                    ...(searchQuery && { q: searchQuery })
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

            const members = (data || [])
                .filter(row => {
                    if (!row["RESOLVES_TO"]) return true
                    const resolvedNumber = row["RESOLVES_TO"].replace("id/object/", "")
                    if (resolvedNumber.includes("REMOVED")) return false
                    if (resolvedNumber === row.objectNumber) return true
                    return false
                })
                .map(row => {
                    if (!fullRecord) {
                        return {
                            "@id": `${BASE_URI}/id/object/${row.objectNumber}`,
                            "@type": "crm:E22_Human-Made_Object",
                            "rdfs:label": row["object_title_nl"] ?? row.objectNumber,
                            ...(row["iiif_manifest"] && {
                                "crm:P129i_is_subject_of": {
                                    "@id": row["iiif_manifest"],
                                    "@type": "crm:E73_Information_Object"
                                }
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

            return res.status(200).json(response)

        } catch (error) {
            console.error('Error handling objects request:', error)
            return res.status(500).json({ error: 'Internal Server Error' })
        }
    }

    app.get('/id/objects', objectsHandler)
}