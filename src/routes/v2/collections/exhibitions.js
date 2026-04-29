import { supabase } from '../../../../supabaseClient.js';

export function requestExhibitions(app, BASE_URI) {
    const exhibitionsHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json');
        res.setHeader('Content-Disposition', 'inline');

        try {
            const page = parseInt(req.query.page) || 1
            const itemsPerPage = Math.min(parseInt(req.query.itemsPerPage) || 10, 100)
            const fullRecord = req.query.fullRecord === 'true'
            const offset = (page - 1) * itemsPerPage

            // count query
            const { count, error: countError } = await supabase
                .from('dmg_tentoonstelling_LDES')
                .select('id', { count: 'exact', head: true })

            if (countError) {
                console.error('Count error:', JSON.stringify(countError, null, 2))
                return res.status(500).json({ error: 'Error fetching exhibitions' })
            }

            // data query
            const selectFields = fullRecord
                ? 'id, json_ld_v2, exh_PID, title_NL, title_FR, title_EN, text_NL, text_FR, text_EN'
                : 'id, exh_PID, title_NL'

            const { data, error } = await supabase
                .from('dmg_tentoonstelling_LDES')
                .select(selectFields)
                .order('exh_PID', { ascending: true })
                .range(offset, offset + itemsPerPage - 1)

            if (error) {
                console.error('Fetch error:', JSON.stringify(error, null, 2))
                return res.status(500).json({ error: 'Error fetching exhibitions' })
            }

            const totalPages = Math.ceil(count / itemsPerPage)
            const collectionId = `${BASE_URI}id/exhibitions`

            const buildParams = (p) => {
                const params = new URLSearchParams({
                    page: p,
                    itemsPerPage,
                    ...(fullRecord && { fullRecord: 'true' })
                })
                return `${collectionId}?${params.toString()}`
            }

            const hydraView = {
                "@id": buildParams(page),
                "@type": "hydra:PartialCollectionView",
                "hydra:first": buildParams(1),
                "hydra:last": buildParams(totalPages)
            }

            if (page > 1) hydraView["hydra:previous"] = buildParams(page - 1)
            if (page < totalPages) hydraView["hydra:next"] = buildParams(page + 1)

            const members = (data || []).map(row => {
                // lightweight stub
                if (!fullRecord) {
                    return {
                        "@id": row["exh_PID"]
                            ? `${BASE_URI}id/exhibition/${row["exh_PID"]}`
                            : `${BASE_URI}id/exhibition/${row.id}`,
                        "@type": "crm:E7_Activity",
                        "rdfs:label": row["title_NL"] ?? row.id
                    }
                }

                // full record — apply same enrichment as single exhibition endpoint
                const exh = row["json_ld_v2"] ?? {}

                // set internal @id
                if (row["exh_PID"]) {
                    const pid = row["exh_PID"]
                    exh["@id"] = `${BASE_URI}id/exhibition/${pid}`

                    // add E42_Identifier
                    const identifier = {
                        "@id": `${BASE_URI}id/exhibition/${pid}/identifier/intern`,
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

                return exh
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
            console.error('Error handling exhibitions request:', error)
            return res.status(500).json({ error: 'Internal Server Error' })
        }
    }

    app.get('/id/exhibitions', exhibitionsHandler)
}