import {fetchExhibitionById} from "../../../utils/parsers.js";


export function requestExhibition(app, BASE_URI){
    const exhibitionHandler = async(req, res) => {
        res.setHeader('Content-type', 'application/ld+json');
        res.setHeader('Content-Dispositon', 'inline');

        try {
            const record = await fetchExhibitionById(req.params.exhibitionPID)
            const exh = record[0]["json_ld_v2"]

            // add INTERNAL PID

            if (record[0]["exh_PID"]) {
                const pid = record[0]["exh_PID"]
                exh["@id"] = `${BASE_URI}id/exhibition/${pid}`

                // add as E42_Identifier
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

                // append to existing P1_is_identified_by or create it
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
            if (record[0]["title_NL"]) appellations.push({ lang: "NLD", value: record[0]["title_NL"] })
            if (record[0]["title_FR"]) appellations.push({ lang: "FRA", value: record[0]["title_FR"] })
            if (record[0]["title_EN"]) appellations.push({ lang: "ENG", value: record[0]["title_EN"] })

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
            if (record[0]["text_NL"]) descriptions.push({ lang: "NLD", value: record[0]["text_NL"] })
            if (record[0]["text_FR"]) descriptions.push({ lang: "FRA", value: record[0]["text_FR"] })
            if (record[0]["text_EN"]) descriptions.push({ lang: "ENG", value: record[0]["text_EN"] })

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


            return res.status(200).json(exh)

        } catch (e) {
            console.log(e)
            res.status(500).send({error: "Error fetching exhibition data"})
        }
    }

    app.get('/id/exhibition/:exhibitionPID', exhibitionHandler)

}