import {fetchLDESrecordsByExhibitionID} from "../../../utils/parsers.js";

function makeLangArray(values) {
    return values
        .filter((item) => item.value)
        .map((item) => ({
            "@value": item.value,
            "@language": item.lang,
        }));
}

export function requestExhibition(app, BASE_URI) {

    // handler for both routes.
    const exhibitionHandler = async(req, res) => {
        try {
            const x = await fetchLDESrecordsByExhibitionID(req.params.exhibitionPID)
            // navigate to root record
            const record = x[0]
            const raw = record["LDES_raw"]["object"];

            const titles = makeLangArray([
                { value: record.title_NL, lang: "nl" },
                { value: record.title_FR, lang: "fr" },
                { value: record.title_EN, lang: "en" },
            ]);

            const descriptions = makeLangArray([
                { value: record.text_NL, lang: "nl" },
                { value: record.text_FR, lang: "fr" },
                { value: record.text_EN, lang: "en" },
            ]);

            const obj = {
                "@context": {
                    "dcterms": "http://purl.org/dc/terms/",
                    "prov": "http://www.w3.org/ns/prov#",
                    "adms": "http://www.w3.org/ns/adms#",
                    "cidoc": "http://www.cidoc-crm.org/cidoc-crm/",
                    "foaf": "http://xmlns.com/foaf/0.1/",
                    "skos": "http://www.w3.org/2004/02/skos/core#",
                    "la": "https://linked.art/ns/terms/",

                    "page": "foaf:page",
                    "isVersionOf": "dcterms:isVersionOf",
                    "identifier": "adms:identifier",
                    "generatedAtTime": "prov:generatedAtTime",
                    "type": "cidoc:P2_has_type",
                    "timeSpan": "cidoc:P4_has_time-span",
                    "tookPlaceAt": "cidoc:P7_took_place_at",
                    "title": "dcterms:title",
                    "description": "dcterms:description"
                },

                ...raw,
                "title": titles,
                "description": descriptions
            };

            res.setHeader("Content-Type", "application/ld+json; charset=utf-8");
            res.send(obj);

        } catch (e) {
            console.log(e)
            res.status(500).send({error: "Error fetching exhibition data"})
        }
    }

    app.get('/id/exhibition/:exhibitionPID', exhibitionHandler)
    app.get('/v1/id/exhibition/:exhibitionPID', exhibitionHandler) // Flemish URI standard
    app.get('/v1/id/ark:/29417/exhibition/:exhibitionPID', exhibitionHandler) // EU? URI standard (ARK)
}
