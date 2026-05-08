import { fetchExhibitionById } from "../../../utils/parsers.js";

export function requestExhibition(app, BASE_URI) {
    const exhibitionHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json');
        res.setHeader('Content-Disposition', 'inline');

        try {
            const record = await fetchExhibitionById(req.params.exhibitionPID)

            if (!record || record.length === 0) {
                return res.status(404).json({ error: 'Exhibition not found' })
            }

            const row = record[0]
            const exh = row["json_ld_v2"]

            // add internal PID
            if (row["exh_PID"]) {
                const pid = row["exh_PID"]
                exh["@id"] = `${BASE_URI}/id/exhibition/${pid}`

                const identifier = {
                    "@id": `${BASE_URI}/id/exhibition/${pid}/identifier/intern`,
                    "@type": "crm:E42_Identifier",
                    "rdfs:label": pid,
                    "crm:P2_has_type": {
                        "@id": "https://data.designmuseumgent.be/v2/id/type/intern-referentienummer",
                        "@type": "crm:E55_Type",
                        "rdfs:label": "Intern referentienummer"
                    }
                }

                if (Array.isArray(exh["crm:P1_is_identified_by"])) {
                    exh["crm:P1_is_identified_by"].push(identifier)
                } else {
                    exh["crm:P1_is_identified_by"] = [identifier]
                }
            }

            // remove any existing appellations for languages we're about to add
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
                            "@id": "http://vocab.getty.edu/aat/300080091",
                            "@type": "crm:E55_Type",
                            "rdfs:label": "description"
                        },
                        "rdfs:label": d.value,
                        "crm:P72_has_language": {
                            "@id": `http://publications.europa.eu/resource/authority/language/${d.lang}`
                        }
                    }))
                ]
            }

            // cache headers
            if (row["generated_at_time"]) {
                const lastModified = new Date(row["generated_at_time"]).toUTCString()
                res.setHeader('Last-Modified', lastModified)
                res.setHeader('ETag', `"${req.params.exhibitionPID}-${new Date(row["generated_at_time"]).getTime()}"`)
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
            if (!data) return res.status(404).end()

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