import { supabase } from '../../../../supabaseClient.js'
import { buildLinkHeader } from "../../../utils/linkHeader.js"
import { applyImagesToObject } from "../../../utils/iiif_images.js"

export function requestObjects(app, BASE_URI) {
    const objectsHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json')
        res.setHeader('Content-Disposition', 'inline')

        try {
            // ─────────────────────────────────────────────────────────────
            // PARSE PARAMETERS
            // ─────────────────────────────────────────────────────────────
            const page          = parseInt(req.query.page) || 1
            const itemsPerPage  = Math.min(parseInt(req.query.itemsPerPage) || 10, 100)
            const offset        = (page - 1) * itemsPerPage
            const fullRecord    = req.query.fullRecord === 'true'
            const showColors    = req.query.colors === 'true'
            const hasImages     = req.query.hasImages === 'true'
            const hasColors     = req.query.hasColors === 'true'
            const hasParts      = req.query.hasParts === 'true'
            const isPartOf      = req.query.isPartOf === 'true'
            const onDisplay     = req.query.onDisplay === 'true' || req.query.onDisplay === '1'
            const modifiedSince = req.query.modifiedSince ?? null
            const searchQuery   = req.query.q ?? null
            const excludeKoepels = req.query.koepels === 'exclude'

            const typeFilter = req.query.type
                ? req.query.type.split(',').map(t => t.trim())
                : null
            const materialFilter = req.query.material
                ? req.query.material.split(',').map(m => m.trim())
                : null
            const colorFilter = req.query.color
                ? req.query.color.split(',').map(c => c.trim().toLowerCase())
                : null
            const cssColorFilter = req.query.cssColor
                ? req.query.cssColor.split(',').map(c => c.trim())
                : null
            const languageFilter = req.query.language?.toUpperCase().trim() || null

            const agentFilter = req.query.agent?.trim() || null
            const agentURI = agentFilter
                ? agentFilter.startsWith('http')
                    ? agentFilter
                    : `${BASE_URI}id/agent/${agentFilter}`
                : null

            const dateParam = req.query.date ?? null
            let dateFrom = req.query.dateFrom ? parseInt(req.query.dateFrom) : null
            let dateTo   = req.query.dateTo   ? parseInt(req.query.dateTo)   : null

            if (dateParam) {
                const [from, to] = dateParam.split('/')
                dateFrom = from ? parseInt(from.replace(/[~?%]/g, '')) : null
                dateTo   = to   ? parseInt(to.replace(/[~?%]/g, ''))   : null
            }

            const conceptFilter = req.query.concept?.trim() || null
            const conceptSearch = req.query.conceptSearch?.trim() || null

            if (modifiedSince && isNaN(new Date(modifiedSince).getTime())) {
                return res.status(400).json({ error: 'Invalid modifiedSince date format. Use YYYY-MM-DD.' })
            }

            // sortBy: which column to sort on; sortOrder: asc or desc
            const SORT_FIELDS = {
                'objectNumber':        'objectNumber',
                'modified':            'generated_at_time',
                'titleNL':             'object_title_nl',
                'titleFR':             'object_title_fr',
                'titleEN':             'object_title_en',
                'dateBegin':           'production_year_begin',
                'dateEnd':             'production_year_end',
            }

            const sortByParam    = req.query.sortBy    ?? 'objectNumber'
            const sortOrderParam = req.query.sortOrder ?? 'asc'

            const sortColumn    = SORT_FIELDS[sortByParam] ?? 'objectNumber'
            const sortAscending = sortOrderParam !== 'desc'

            // ─────────────────────────────────────────────────────────────
            // BUILD PARAMS
            // ─────────────────────────────────────────────────────────────
            const collectionId = `${BASE_URI}id/objects`

            const buildParams = (p) => {
                const params = new URLSearchParams({
                    page: p,
                    itemsPerPage,
                    ...(fullRecord        && { fullRecord: 'true' }),
                    ...(showColors        && { colors: 'true' }),
                    ...(hasImages         && { hasImages: 'true' }),
                    ...(hasColors         && { hasColors: 'true' }),
                    ...(hasParts          && { hasParts: 'true' }),
                    ...(isPartOf          && { isPartOf: 'true' }),
                    ...(onDisplay         && { onDisplay: 'true' }),
                    ...(modifiedSince     && { modifiedSince }),
                    ...(searchQuery       && { q: searchQuery }),
                    ...(colorFilter       && { color: colorFilter.join(',') }),
                    ...(cssColorFilter    && { cssColor: cssColorFilter.join(',') }),
                    ...(typeFilter        && { type: typeFilter.join(',') }),
                    ...(materialFilter    && { material: materialFilter.join(',') }),
                    ...(languageFilter    && { language: languageFilter }),
                    ...(agentFilter       && { agent: agentFilter }),
                    ...(dateParam         && { date: dateParam }),
                    ...(dateFrom && !dateParam && { dateFrom }),
                    ...(dateTo   && !dateParam && { dateTo }),
                    ...(conceptFilter     && { concept: conceptFilter }),
                    ...(conceptSearch     && { conceptSearch }),
                    ...(excludeKoepels    && { koepels: 'exclude' }),
                    ...(sortByParam !== 'objectNumber' && { sortBy: sortByParam }),
                    ...(sortOrderParam !== 'asc'       && { sortOrder: sortOrderParam })
                })
                return `${collectionId}?${params.toString()}`
            }

            const emptyCollection = () => res.status(200).json({
                "@context": {
                    "crm": "http://www.cidoc-crm.org/cidoc-crm/",
                    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
                    "hydra": "http://www.w3.org/ns/hydra/core#",
                    "owl": "https://www.w3.org/2002/07/owl#"
                },
                "@id": collectionId,
                "@type": "hydra:Collection",
                "hydra:totalItems": 0,
                "hydra:view": {
                    "@id": buildParams(1),
                    "@type": "hydra:PartialCollectionView",
                    "hydra:first": buildParams(1),
                    "hydra:last": buildParams(1)
                },
                "hydra:member": []
            })

            // ─────────────────────────────────────────────────────────────
            // CONCEPT RESOLUTION
            // ─────────────────────────────────────────────────────────────
            let conceptURIs = null
            let conceptSearchURIs = null

            if (conceptFilter) {
                const conceptURI = conceptFilter.startsWith('http')
                    ? conceptFilter
                    : `${BASE_URI}id/concept/${conceptFilter}`
                const conceptId = conceptURI.split('/concept/')[1]

                const { data: expandedURIs } = await supabase
                    .rpc('get_concept_uris_with_narrower', { root_ids: [conceptId] })

                conceptURIs = expandedURIs?.length ? expandedURIs : [conceptURI]
            }

            if (conceptSearch) {
                const { data: conceptMatches } = await supabase
                    .from('dmg_thesaurus_LDES')
                    .select('id')
                    .textSearch('search_vector', conceptSearch, { type: 'websearch', config: 'simple' })
                    .limit(50)

                if (!conceptMatches?.length) return emptyCollection()

                const rootIds = conceptMatches.map(c => String(c.id))
                const { data: expandedURIs } = await supabase
                    .rpc('get_concept_uris_with_narrower', { root_ids: rootIds })

                conceptSearchURIs = expandedURIs?.length
                    ? expandedURIs
                    : conceptMatches.map(c => `https://data.designmuseumgent.be/v2/id/concept/${c.id}`)
            }

            // ─────────────────────────────────────────────────────────────
            // SELECT FIELDS
            // ─────────────────────────────────────────────────────────────
            let selectFields
            if (!fullRecord) {
                selectFields = 'objectNumber, object_title_nl, iiif_manifest, RESOLVES_TO, hasParts, isPartOf, object_types, object_materials'
            } else if (showColors) {
                selectFields = 'objectNumber, json_ld_v2, object_title_nl, object_title_fr, object_title_en, object_description_nl, object_description_fr, object_description_en, colors, HEX_values, color_names, iiif_image_uris, RESOLVES_TO, COLLECTION_PRESENTATION, isPartOf, hasParts'
            } else {
                selectFields = 'objectNumber, json_ld_v2, object_title_nl, object_title_fr, object_title_en, object_description_nl, object_description_fr, object_description_en, iiif_image_uris, RESOLVES_TO, COLLECTION_PRESENTATION, isPartOf, hasParts'
            }

            // ─────────────────────────────────────────────────────────────
            // SHARED FILTER FUNCTION
            // ─────────────────────────────────────────────────────────────
            const applyFilters = (q) => {
                q = q.eq('STATUS', 'HEALTHY')
                //q = q.eq('COLLECTION_PRESENTATION', true)
                q = q.not('RESOLVES_TO', 'like', '%REMOVED%')
                q = q.not('RESOLVES_TO', 'like', '%UNHEALTHY%')
                if (hasImages)                     q = q.not('iiif_manifest', 'is', null)
                if (hasColors)                     q = q.not('colors', 'is', null)
                if (hasParts)                      q = q.not('hasParts', 'is', null)
                if (isPartOf)                      q = q.not('isPartOf', 'is', null)
                if (modifiedSince)                 q = q.gte('generated_at_time', new Date(modifiedSince).toISOString())
                if (colorFilter?.length > 0)       q = q.contains('dominant_colors', colorFilter)
                if (cssColorFilter?.length > 0)    q = q.contains('dominant_css_colors', cssColorFilter)
                if (typeFilter?.length > 0)        q = q.contains('object_types', typeFilter)
                if (materialFilter?.length > 0)    q = q.contains('object_materials', materialFilter)
                if (excludeKoepels)                q = q.not('objectNumber', 'like', '%\\_0-%')
                if (searchQuery)                   q = q.textSearch('search_vector', searchQuery, { type: 'websearch', config: 'dutch' })
                if (languageFilter) {
                    const col = { NLD: 'object_title_nl', FRA: 'object_title_fr', ENG: 'object_title_en' }[languageFilter]
                    if (col) {
                        q = q.not(col, 'is', null)
                        q = q.neq(col, 'unknown')
                    }
                }
                if (dateFrom || dateTo) {
                    q = q.not('production_year_begin', 'is', null)
                    q = q.not('production_year_end', 'is', null)
                }
                if (dateFrom)          q = q.gte('production_year_end', dateFrom)
                if (dateTo)            q = q.lte('production_year_begin', dateTo)
                if (conceptURIs)       q = q.overlaps('concept_uris', conceptURIs)
                if (conceptSearchURIs) q = q.overlaps('concept_uris', conceptSearchURIs)
                return q
            }

            // ─────────────────────────────────────────────────────────────
            // AGENT FILTER — via RPC
            // ─────────────────────────────────────────────────────────────
            if (agentURI) {
                const { data: rpcData, error: rpcError } = await supabase
                    .rpc('get_objects_by_agent', { agent_uri: agentURI })

                if (rpcError) {
                    console.error('Agent filter RPC error:', rpcError.message)
                    return res.status(500).json({ error: 'Error fetching objects by agent' })
                }

                const allRows    = rpcData || []
                const total      = allRows.length
                const sliced     = allRows.slice(offset, offset + itemsPerPage)
                const totalPages = Math.ceil(total / itemsPerPage)

                const hydraView = {
                    "@id": buildParams(page),
                    "@type": "hydra:PartialCollectionView",
                    "hydra:first": buildParams(1),
                    "hydra:last": buildParams(totalPages)
                }
                if (page > 1)          hydraView["hydra:previous"] = buildParams(page - 1)
                if (page < totalPages) hydraView["hydra:next"]     = buildParams(page + 1)

                const members = sliced
                    .filter(row => {
                        if (!row["RESOLVES_TO"]) return true
                        const resolved = row["RESOLVES_TO"].replace("id/object/", "")
                        if (resolved.includes("REMOVED")) return false
                        return resolved === row.objectNumber
                    })
                    .map(row => buildMember(row, fullRecord, showColors, BASE_URI))

                const linkHeader = buildLinkHeader(hydraView)
                if (linkHeader) res.setHeader('Link', linkHeader)

                return res.status(200).json({
                    "@context": {
                        "crm": "http://www.cidoc-crm.org/cidoc-crm/",
                        "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
                        "hydra": "http://www.w3.org/ns/hydra/core#",
                        "owl": "https://www.w3.org/2002/07/owl#"
                    },
                    "@id": collectionId,
                    "@type": "hydra:Collection",
                    "hydra:totalItems": total,
                    "hydra:view": hydraView,
                    "hydra:member": members
                })
            }

            // ─────────────────────────────────────────────────────────────
            // NORMAL QUERY PATH
            // ─────────────────────────────────────────────────────────────
            const [{ count, error: countError }, { data, error }] = await Promise.all([
                applyFilters(
                    supabase.from('dmg_objects_LDES').select('objectNumber', { count: 'exact', head: true })
                ),
                applyFilters(
                    supabase.from('dmg_objects_LDES')
                        .select(selectFields)
                        .order(sortColumn, { ascending: sortAscending, nullsFirst: false })
                        .range(offset, offset + itemsPerPage - 1)
                )
            ])

            if (countError) {
                console.error('Count error:', JSON.stringify(countError, null, 2))
                return res.status(500).json({ error: 'Error fetching objects', details: countError.message })
            }
            if (error) {
                console.error('Fetch error:', JSON.stringify(error, null, 2))
                return res.status(500).json({ error: 'Error fetching objects', details: error.message })
            }

            const totalPages = Math.ceil(count / itemsPerPage)

            const hydraView = {
                "@id": buildParams(page),
                "@type": "hydra:PartialCollectionView",
                "hydra:first": buildParams(1),
                "hydra:last": buildParams(totalPages)
            }
            if (page > 1)          hydraView["hydra:previous"] = buildParams(page - 1)
            if (page < totalPages) hydraView["hydra:next"]     = buildParams(page + 1)

            const members = (data || [])
                .filter(row => {
                    if (!row["RESOLVES_TO"]) return true
                    const resolved = row["RESOLVES_TO"].replace("id/object/", "")
                    if (resolved.includes("REMOVED")) return false
                    return resolved === row.objectNumber
                })
                .map(row => buildMember(row, fullRecord, showColors, BASE_URI))

            const linkHeader = buildLinkHeader(hydraView)
            if (linkHeader) res.setHeader('Link', linkHeader)

            return res.status(200).json({
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
            })

        } catch (error) {
            console.error('Error handling objects request:', error)
            return res.status(500).json({ error: 'Internal Server Error' })
        }
    }

    app.get('/id/objects', objectsHandler)
}

// ─────────────────────────────────────────────────────────────
// MEMBER BUILDER
// ─────────────────────────────────────────────────────────────
function buildMember(row, fullRecord, showColors, BASE_URI) {
    if (!fullRecord) {
        return {
            "@id": `${BASE_URI}id/object/${row.objectNumber}`,
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

    // ── multilingual titles ──────────────────────────────────
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

    // ── multilingual descriptions ────────────────────────────
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

    // ── isPartOf — this object is a member of a koepelrecord set
    // Overwrite from computed column — single value, no rich data lost
    delete obj["crm:P46i_forms_part_of"]
    const rowIsPartOf = row["isPartOf"] ?? null

    if (rowIsPartOf) {
        obj["crm:P46i_forms_part_of"] = {
            "@id": `${BASE_URI}id/object/${rowIsPartOf}`,
            "@type": "crm:E22_Human-Made_Object"
        }
    }

    // ── hasParts — koepelrecord: this set is composed of these objects
    // Uses crm:P106_is_composed_of — distinct from crm:P46_has_component
    // crm:P46_has_component (fysiekeOnderdelen with names, materials, dimensions)
    // is left untouched from json_ld_v2
    delete obj["crm:P106_is_composed_of"]
    const rowHasParts = row["hasParts"] ?? null

    if (rowHasParts) {
        const parts = typeof rowHasParts === 'string'
            ? rowHasParts.split(',').map(p => p.trim()).filter(Boolean)
            : Array.isArray(rowHasParts) ? rowHasParts : []

        if (parts.length > 0) {
            obj["crm:P106_is_composed_of"] = parts.map(p => ({
                "@id": `${BASE_URI}id/object/${p}`,
                "@type": "crm:E22_Human-Made_Object"
            }))
        }
    }

    // ── IIIF images ──────────────────────────────────────────
    applyImagesToObject(obj, row)


    // ── color data — only when ?colors=true ─────────────────
    if (showColors) {
        const colorsData   = row["colors"] ?? null
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
}