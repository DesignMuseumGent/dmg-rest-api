import { fetchExhibitionById } from "../../../utils/parsers.js"
import { supabase } from '../../../../supabaseClient.js'

export function requestExhibition(app, BASE_URI) {
    const exhibitionHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json')
        res.setHeader('Content-Disposition', 'inline')

        try {
            const exhibitionPID = req.params.exhibitionPID

            const [recordResult, mediaResult, publicationsResult, viewsResult] = await Promise.all([
                fetchExhibitionById(exhibitionPID),
                supabase
                    .from('dmg_exhibitions_media')
                    .select('url, title, date, type')
                    .eq('exh_PID', exhibitionPID),
                supabase
                    .from('dmg_exhibitions_publications')
                    .select('title, url, year')
                    .eq('exh_PID', exhibitionPID),
                supabase.storage
                    .from('exhibition_views')
                    .list(exhibitionPID, { limit: 100, sortBy: { column: 'name', order: 'asc' } })
            ])

            if (!recordResult || recordResult.length === 0) {
                return res.status(404).json({ error: 'Exhibition not found' })
            }

            const row          = recordResult[0]
            const exh          = row["json_ld_v2"]
            const media        = mediaResult.data || []
            const publications = publicationsResult.data || []
            const views        = (viewsResult.data || []).filter(f => f.name && !f.name.startsWith('.'))

            // resolve poster from storage bucket — try common extensions
            const SUPABASE_URL = process.env.SUPABASE_URL
            const bucketBase   = `${SUPABASE_URL}/storage/v1/object/public/posters`

            let posterUrl = null
            for (const ext of ['jpeg', 'jpg', 'png', 'webp']) {
                const candidate = `${bucketBase}/${exhibitionPID}.${ext}`
                try {
                    const check = await fetch(candidate, { method: 'HEAD' })
                    if (check.ok) {
                        posterUrl = candidate
                        break
                    }
                } catch {
                    // ignore
                }
            }

            // internal PID
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
            }

            // remove existing appellations for languages we're about to add
            const langsToAdd = ["NLD", "FRA", "ENG"]
            if (Array.isArray(exh["crm:P1_is_identified_by"])) {
                exh["crm:P1_is_identified_by"] = exh["crm:P1_is_identified_by"].filter(node => {
                    const langId = node["crm:P72_has_language"]?.["@id"] ?? ""
                    return !langsToAdd.some(lang => langId.endsWith(lang) || langId.endsWith(lang.toLowerCase()))
                })
            }

            // multilingual titles
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

            // multilingual descriptions
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

            // curator
            if (row["curator"]) {
                exh["crm:P14_carried_out_by"] = {
                    "@type": "crm:E39_Actor",
                    "rdfs:label": row["curator"]
                }
            }

            // ── poster — crm:P65_shows_visual_item, always a single object ──
            // standardised shape — identical property/type across
            // /id/exhibition/:pid and /id/exhibitions?fullRecord=true
            if (posterUrl) {
                exh["crm:P65_shows_visual_item"] = {
                    "@id":   posterUrl,
                    "@type": "crm:E36_Visual_Item",
                    "crm:P2_has_type": {
                        "@id":        "http://vocab.getty.edu/aat/300027221",
                        "@type":      "crm:E55_Type",
                        "rdfs:label": "poster"
                    }
                }
            }

            // ── installation views — crm:P138i_has_representation, always an array ──
            // standardised shape — never collapses to a single object, even with one view
            const SUPABASE_URL_VIEWS = process.env.SUPABASE_URL
            const viewsBucketBase    = `${SUPABASE_URL_VIEWS}/storage/v1/object/public/exhibition_views/${exhibitionPID}`

            exh["crm:P138i_has_representation"] = views.map((f) => {
                const node = {
                    "@id":   `${viewsBucketBase}/${f.name}`,
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

            // build crm:P129i_is_subject_of — media + publications + existing IIIF manifest
            const subjectOfNodes = []

            if (exh["crm:P129i_is_subject_of"]) {
                const existing = exh["crm:P129i_is_subject_of"]
                const existingArray = Array.isArray(existing) ? existing : [existing]
                subjectOfNodes.push(...existingArray)
            }

            for (const m of media) {
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
                        "crm:P102_has_title": {
                            "@type":      "crm:E35_Title",
                            "rdfs:label": m.title
                        }
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

            for (const p of publications) {
                subjectOfNodes.push({
                    ...(p.url && { "@id": p.url }),
                    "@type": "crm:E73_Information_Object",
                    "crm:P2_has_type": {
                        "@id":        "http://vocab.getty.edu/aat/300048715",
                        "@type":      "crm:E55_Type",
                        "rdfs:label": "publication"
                    },
                    ...(p.title && {
                        "crm:P102_has_title": {
                            "@type":      "crm:E35_Title",
                            "rdfs:label": p.title
                        }
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

            // cache headers
            if (row["generated_at_time"]) {
                const lastModified = new Date(row["generated_at_time"]).toUTCString()
                res.setHeader('Last-Modified', lastModified)
                res.setHeader('ETag', `"${exhibitionPID}-${new Date(row["generated_at_time"]).getTime()}"`)
                res.setHeader('Cache-Control', 'public, max-age=3600')
            }

            return res.status(200).json(exh)

        } catch (e) {
            console.error(e)
            return res.status(500).json({ error: 'Error fetching exhibition data' })
        }
    }

    const headHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json')
        try {
            const { data, error } = await supabase
                .from('dmg_tentoonstelling_LDES')
                .select('id, exh_PID, generated_at_time')
                .eq('exh_PID', req.params.exhibitionPID)
                .maybeSingle()

            if (error) return res.status(500).end()
            if (!data)  return res.status(404).end()

            if (data['generated_at_time']) {
                const lastModified = new Date(data['generated_at_time']).toUTCString()
                res.setHeader('Last-Modified', lastModified)
                res.setHeader('ETag', `"${req.params.exhibitionPID}-${new Date(data['generated_at_time']).getTime()}"`)
                res.setHeader('Cache-Control', 'public, max-age=3600')
            }

            return res.status(200).end()
        } catch (error) {
            console.error('Error handling HEAD request:', error)
            return res.status(500).end()
        }
    }

    app.get('/id/exhibition/:exhibitionPID', exhibitionHandler)
    app.head('/id/exhibition/:exhibitionPID', headHandler)
}