import { supabase } from '../../../../supabaseClient.js';
import { buildLinkHeader } from "../../../utils/linkHeader.js"

export function requestExhibitions(app, BASE_URI) {
    const exhibitionsHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json');
        res.setHeader('Content-Disposition', 'inline');

        try {
            const page          = parseInt(req.query.page) || 1
            const itemsPerPage  = Math.min(parseInt(req.query.itemsPerPage) || 10, 100)
            const fullRecord    = req.query.fullRecord === 'true'
            const modifiedSince = req.query.modifiedSince ?? null
            const offset        = (page - 1) * itemsPerPage
            const languageFilter = req.query.language?.toUpperCase().trim() || null
            const searchQuery   = req.query.q?.trim() || null
            const colMap = { NLD: 'title_NL', FRA: 'title_FR', ENG: 'title_EN' }
            const col = colMap[languageFilter]

            if (modifiedSince && isNaN(new Date(modifiedSince).getTime())) {
                return res.status(400).json({ error: 'Invalid modifiedSince format. Use YYYY-MM-DD.' })
            }

            const selectFields = fullRecord
                ? 'id, json_ld_v2, exh_PID, title_NL, title_FR, title_EN, text_NL, text_FR, text_EN'
                : 'id, exh_PID, title_NL'

            const applyFilters = (query) => {
                query = query.not('exh_PID', 'is', null)
                if (modifiedSince) query = query.gte('generated_at_time', new Date(modifiedSince).toISOString())
                if (searchQuery)   query = query.or(`title_NL.ilike.%${searchQuery}%,title_FR.ilike.%${searchQuery}%,title_EN.ilike.%${searchQuery}%,exh_PID.ilike.%${searchQuery}%`)
                if (languageFilter && col) {
                    query = query.not(col, 'is', null)
                    query = query.neq(col, 'unknown')
                }
                return query
            }

            // ── count query ──────────────────────────────────────────
            const { count, error: countError } = await applyFilters(
                supabase
                    .from('dmg_tentoonstelling_LDES')
                    .select('id', { count: 'exact', head: true })
            )

            if (countError) {
                console.error('Count error:', JSON.stringify(countError, null, 2))
                return res.status(500).json({ error: 'Error fetching exhibitions' })
            }

            // ── data query ───────────────────────────────────────────
            const { data, error } = await applyFilters(
                supabase
                    .from('dmg_tentoonstelling_LDES')
                    .select(selectFields)
                    .order('exh_PID', { ascending: true })
                    .range(offset, offset + itemsPerPage - 1)
            )

            if (error) {
                console.error('Fetch error:', JSON.stringify(error, null, 2))
                return res.status(500).json({ error: 'Error fetching exhibitions' })
            }

            if (!data) {
                return res.status(404).json({ error: 'No exhibitions found' })
            }

            // ── images + media + publications — full record only ─────
            let posterMap       = {}
            let viewsMap        = {}
            let mediaMap        = {}
            let publicationsMap = {}

            if (fullRecord && data.length > 0) {
                const SUPABASE_URL = process.env.SUPABASE_URL
                const pids = data.map(r => r.exh_PID).filter(Boolean)
                const pidSet = new Set(pids)

                const [
                    { data: posterFiles },
                    viewsResults,
                    { data: allMedia },
                    { data: allPublications }
                ] = await Promise.all([
                    supabase.storage.from('posters').list('', { limit: 1000 }),
                    Promise.all(
                        pids.map(pid =>
                            supabase.storage
                                .from('exhibition_views')
                                .list(pid, { limit: 100, sortBy: { column: 'name', order: 'asc' } })
                                .then(res => ({ pid, files: res.data || [] }))
                        )
                    ),
                    supabase
                        .from('dmg_exhibitions_media')
                        .select('exh_PID, url, title, date, type')
                        .in('exh_PID', pids),
                    supabase
                        .from('dmg_exhibitions_publications')
                        .select('exh_PID, title, url, year')
                        .in('exh_PID', pids)
                ])

                for (const file of (posterFiles || [])) {
                    const pid = file.name.replace(/\.[^.]+$/, '')
                    if (pidSet.has(pid)) {
                        const { data: urlData } = supabase.storage
                            .from('posters')
                            .getPublicUrl(file.name)
                        if (urlData?.publicUrl) posterMap[pid] = urlData.publicUrl
                    }
                }

                const viewsBucketRoot = `${SUPABASE_URL}/storage/v1/object/public/exhibition_views`
                for (const { pid, files } of viewsResults) {
                    const filtered = files.filter(f => f.name && !f.name.startsWith('.'))
                    viewsMap[pid] = filtered.map(f => {
                        const node = {
                            "@id":   `${viewsBucketRoot}/${pid}/${f.name}`,
                            "@type": "crm:E36_Visual_Item",
                            "crm:P2_has_type": {
                                "@id":        "http://vocab.getty.edu/aat/300210730",
                                "@type":      "crm:E55_Type",
                                "rdfs:label": "exhibition view"
                            },
                            "rdfs:label": f.name.replace(/\.[^.]+$/, '')
                        }

                        const dimensions = []
                        if (f.metadata?.width) {
                            dimensions.push({
                                "@type": "crm:E54_Dimension",
                                "crm:P2_has_type": { "@id": "http://vocab.getty.edu/aat/300055647", "rdfs:label": "width" },
                                "crm:P90_has_value": f.metadata.width,
                                "crm:P91_has_unit": { "rdfs:label": "px" }
                            })
                        }
                        if (f.metadata?.height) {
                            dimensions.push({
                                "@type": "crm:E54_Dimension",
                                "crm:P2_has_type": { "@id": "http://vocab.getty.edu/aat/300055644", "rdfs:label": "height" },
                                "crm:P90_has_value": f.metadata.height,
                                "crm:P91_has_unit": { "rdfs:label": "px" }
                            })
                        }
                        if (dimensions.length > 0) node["crm:P43_has_dimension"] = dimensions

                        return node
                    })
                }

                // build mediaMap and publicationsMap keyed by exh_PID
                for (const m of (allMedia || [])) {
                    if (!mediaMap[m.exh_PID]) mediaMap[m.exh_PID] = []
                    mediaMap[m.exh_PID].push(m)
                }
                for (const p of (allPublications || [])) {
                    if (!publicationsMap[p.exh_PID]) publicationsMap[p.exh_PID] = []
                    publicationsMap[p.exh_PID].push(p)
                }
            }

            const totalPages   = Math.ceil(count / itemsPerPage)
            const collectionId = `${BASE_URI}id/exhibitions`

            const buildParams = (p) => {
                const params = new URLSearchParams({
                    page: p,
                    itemsPerPage,
                    ...(fullRecord     && { fullRecord: 'true' }),
                    ...(modifiedSince  && { modifiedSince }),
                    ...(languageFilter && { language: languageFilter }),
                    ...(searchQuery    && { q: searchQuery })
                })
                return `${collectionId}?${params.toString()}`
            }

            const hydraView = {
                "@id": buildParams(page),
                "@type": "hydra:PartialCollectionView",
                "hydra:first": buildParams(1),
                "hydra:last": buildParams(totalPages)
            }

            if (page > 1)          hydraView["hydra:previous"] = buildParams(page - 1)
            if (page < totalPages) hydraView["hydra:next"]     = buildParams(page + 1)

            const members = (data || []).map(row => {
                if (!fullRecord) {
                    return {
                        "@id": row["exh_PID"]
                            ? `${BASE_URI}id/exhibition/${row["exh_PID"]}`
                            : `${BASE_URI}id/exhibition/${row.id}`,
                        "@type": "crm:E7_Activity",
                        "rdfs:label": row["title_NL"] ?? row.id
                    }
                }

                const exh = row["json_ld_v2"] ?? {}

                if (row["exh_PID"]) {
                    const pid = row["exh_PID"]
                    exh["@id"] = `${BASE_URI}id/exhibition/${pid}`

                    const identifier = {
                        "@id":   `${BASE_URI}id/exhibition/${pid}/identifier/intern`,
                        "@type": "crm:E42_Identifier",
                        "rdfs:label": pid,
                        "crm:P2_has_type": {
                            "@id":        "https://data.designmuseumgent.be/v2/id/type/intern-referentienummer",
                            "@type":      "crm:E55_Type",
                            "rdfs:label": "Intern referentienummer"
                        }
                    }

                    if (Array.isArray(exh["crm:P1_is_identified_by"])) {
                        exh["crm:P1_is_identified_by"].push(identifier)
                    } else {
                        exh["crm:P1_is_identified_by"] = [identifier]
                    }

                    // ── poster ───────────────────────────────────────────────
                    if (posterMap[pid]) {
                        exh["crm:P65_shows_visual_item"] = {
                            "@id":   posterMap[pid],
                            "@type": "crm:E36_Visual_Item",
                            "crm:P2_has_type": {
                                "@id":        "http://vocab.getty.edu/aat/300027221",
                                "@type":      "crm:E55_Type",
                                "rdfs:label": "poster"
                            }
                        }
                    }

                    // ── installation views ───────────────────────────────────
                    exh["crm:P138i_has_representation"] = viewsMap[pid] ?? []

                    // ── media + publications → crm:P129i_is_subject_of ───────
                    // Mirrors requestExhibition.js: merge with any existing nodes
                    // from json_ld_v2 (e.g. IIIF manifest), then append media and
                    // publications from the join tables.
                    const subjectOfNodes = []

                    if (exh["crm:P129i_is_subject_of"]) {
                        const existing = exh["crm:P129i_is_subject_of"]
                        subjectOfNodes.push(...(Array.isArray(existing) ? existing : [existing]))
                    }

                    for (const m of (mediaMap[pid] || [])) {
                        subjectOfNodes.push({
                            "@id":   m.url,
                            "@type": "crm:E73_Information_Object",
                            "crm:P2_has_type": {
                                "@id": m.type === 'AUDIO'
                                    ? "http://vocab.getty.edu/aat/300312042"
                                    : "http://vocab.getty.edu/aat/300263419",
                                "@type":      "crm:E55_Type",
                                "rdfs:label": m.type === 'AUDIO' ? "audio" : "video"
                            },
                            ...(m.title && {
                                "crm:P102_has_title": { "@type": "crm:E35_Title", "rdfs:label": m.title }
                            }),
                            ...(m.date && {
                                "crm:P4_has_time-span": {
                                    "@type":      "crm:E52_Time-Span",
                                    "rdfs:label": m.date,
                                    "crm:P82a_begin_of_the_begin": { "@type": "xsd:gYear", "@value": m.date },
                                    "crm:P82b_end_of_the_end":     { "@type": "xsd:gYear", "@value": m.date }
                                }
                            })
                        })
                    }

                    for (const p of (publicationsMap[pid] || [])) {
                        subjectOfNodes.push({
                            ...(p.url && { "@id": p.url }),
                            "@type": "crm:E73_Information_Object",
                            "crm:P2_has_type": {
                                "@id":        "http://vocab.getty.edu/aat/300048715",
                                "@type":      "crm:E55_Type",
                                "rdfs:label": "publication"
                            },
                            ...(p.title && {
                                "crm:P102_has_title": { "@type": "crm:E35_Title", "rdfs:label": p.title }
                            }),
                            ...(p.year && {
                                "crm:P4_has_time-span": {
                                    "@type":      "crm:E52_Time-Span",
                                    "rdfs:label": p.year,
                                    "crm:P82a_begin_of_the_begin": { "@value": p.year, "@type": "xsd:gYear" }
                                }
                            })
                        })
                    }

                    if (subjectOfNodes.length > 0) {
                        exh["crm:P129i_is_subject_of"] = subjectOfNodes.length === 1
                            ? subjectOfNodes[0]
                            : subjectOfNodes
                    }
                }

                const langsToAdd = ["NLD", "FRA", "ENG"]
                if (Array.isArray(exh["crm:P1_is_identified_by"])) {
                    exh["crm:P1_is_identified_by"] = exh["crm:P1_is_identified_by"].filter(node => {
                        const langId = node["crm:P72_has_language"]?.["@id"] ?? ""
                        return !langsToAdd.some(lang => langId.endsWith(lang) || langId.endsWith(lang.toLowerCase()))
                    })
                }

                const appellations = []
                if (row["title_NL"]) appellations.push({ lang: "NLD", value: row["title_NL"] })
                if (row["title_FR"]) appellations.push({ lang: "FRA", value: row["title_FR"] })
                if (row["title_EN"]) appellations.push({ lang: "ENG", value: row["title_EN"] })

                if (appellations.length > 0) {
                    exh["crm:P1_is_identified_by"] = [
                        ...(Array.isArray(exh["crm:P1_is_identified_by"]) ? exh["crm:P1_is_identified_by"] : []),
                        ...appellations.map(a => ({
                            "@type": "crm:E41_Appellation",
                            "rdfs:label": a.value,
                            "crm:P72_has_language": {
                                "@id": `http://publications.europa.eu/resource/authority/language/${a.lang}`
                            }
                        }))
                    ]
                }

                const descriptions = []
                if (row["text_NL"]) descriptions.push({ lang: "NLD", value: row["text_NL"] })
                if (row["text_FR"]) descriptions.push({ lang: "FRA", value: row["text_FR"] })
                if (row["text_EN"]) descriptions.push({ lang: "ENG", value: row["text_EN"] })

                if (descriptions.length > 0) {
                    exh["crm:P67i_is_referred_to_by"] = [
                        ...(Array.isArray(exh["crm:P67i_is_referred_to_by"]) ? exh["crm:P67i_is_referred_to_by"] : []),
                        ...descriptions.map(d => ({
                            "@type": "crm:E33_Linguistic_Object",
                            "crm:P2_has_type": {
                                "@id":        "http://vocab.getty.edu/aat/300080091",
                                "@type":      "crm:E55_Type",
                                "rdfs:label": "description"
                            },
                            "rdfs:label": d.value,
                            "crm:P72_has_language": {
                                "@id": `http://publications.europa.eu/resource/authority/language/${d.lang}`
                            }
                        }))
                    ]
                }

                return exh
            })

            const response = {
                "@context": {
                    "crm":   "http://www.cidoc-crm.org/cidoc-crm/",
                    "rdfs":  "http://www.w3.org/2000/01/rdf-schema#",
                    "hydra": "http://www.w3.org/ns/hydra/core#",
                    "owl":   "https://www.w3.org/2002/07/owl#"
                },
                "@id": collectionId,
                "@type": "hydra:Collection",
                "hydra:totalItems": count,
                "hydra:view": hydraView,
                "hydra:member": members
            }

            const linkHeader = buildLinkHeader(hydraView)
            if (linkHeader) res.setHeader('Link', linkHeader)

            return res.status(200).json(response)

        } catch (error) {
            console.error('Error handling exhibitions request:', error)
            return res.status(500).json({ error: 'Internal Server Error' })
        }
    }

    app.get('/id/exhibitions', exhibitionsHandler)
}