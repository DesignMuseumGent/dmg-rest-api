import {fetchAllConcepts} from "../utils/parsers.js";

export function requestConcepts(app, BASE_URI) {
    app.get("/v1/id/concepts/", async(req, res) => {
        //await data from GET request DB
        const concepts = await fetchAllConcepts();
        const filteredConcepts = [];

        // pagination
        let { pageNumber = 1, itemsPerPage = 20 } = req.query;
        pageNumber = Number(pageNumber)
        itemsPerPage = Number(itemsPerPage)

        const totalPages = Math.ceil(concepts.length / itemsPerPage);

        for (let i = (pageNumber - 1) * itemsPerPage; i < pageNumber * itemsPerPage; i++) {
            if (i < concepts.length) {

                let concept = {
                    "@context": [
                        {
                            "skos": "http://www.w3.org/2004/02/skos/core#",
                        }
                    ],
                    "@id": `${BASE_URI}id/concept/${concepts[i].id}`,
                    "@type": "skos:concept",
                    "skos:preLabel": concepts[i]["LDES_raw"]["object"]["skos:prefLabel"]
                }

                filteredConcepts.push(concept);
            }
        }

        res.status(200).json({
            "@context": [
                "https://data.vlaanderen.be/doc/applicatieprofiel/generiek-basis/zonderstatus/2019-07-01/context/generiek-basis.jsonld",
                {
                    "hydra": "http://www.w3.org/ns/hydra/context.jsonld"
                }
            ],
            "@id": `${BASE_URI}id/concepts`,
            "hydra:totalItems": concepts.length,
            "hydra:view": {
                "@id": `${BASE_URI}id/concepts?pageNumber=${pageNumber}`,
                "@type": "PartialCollectionView",
                "hydra:first": `${BASE_URI}id/concepts?pageNumber=1&itemsPerPage=${itemsPerPage}`,
                "hydra:last": `${BASE_URI}id/concepts?pageNumber=${totalPages}&itemsPerPage=${itemsPerPage}`,
                "hydra:next": `${BASE_URI}id/concepts?pageNumber=${pageNumber + 1}&itemsPerPage=${itemsPerPage}`,
                "hydra:previous": `${BASE_URI}id/concepts?pageNumber=${pageNumber - 1}&itemsPerPage=${itemsPerPage}`,
            },
            "GecureerdeCollectie.curator": "Design Museum Gent",
            "GecureerdeCollectie.bestaatUit": filteredConcepts
        });
    })

}