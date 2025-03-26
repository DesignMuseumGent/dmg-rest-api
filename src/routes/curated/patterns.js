import {fetchPatterns} from "../../utils/parsers.js";

const COMMON_CONTEXT = [
    "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-object/erkendestandaard/2021-04-22/context/cultureel-erfgoed-object-ap.jsonld",
    "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-event/erkendestandaard/2021-04-22/context/cultureel-erfgoed-event-ap.jsonld",
    "https://data.vlaanderen.be/doc/applicatieprofiel/generiek-basis/zonderstatus/2019-07-01/context/generiek-basis.jsonld",
];

export function patternAPI(app, BASE_URI) {
    app.get("/v1/pattern-api/", async (req, res) => {

        let {
            patternCollection = "tegels" // the desired collection to fetch such as "tegels".
        } = req.query

        const patterns = await fetchPatterns(patternCollection)

        // generate linked data objects
        const objects = [] // initialize collection

        for (let o = 0; o < patterns.length; o++) {
            let record = patterns[o];
            let object = {
                "@id": `${BASE_URI}id/object/${record["objectNumber"]}`,
                "image": record["IIIF"]
            }
            objects.push(object);
        }

        // publish result as JSON-LD at /v1/pattern-api/
        res.status(200).json({
            "@context": [
                ...COMMON_CONTEXT,
                { hydra: "http://www.w3.org/ns/hydra/context.jsonld" },
            ],
            "@type": "GecureerdeCollectie",
            "@id": `${BASE_URI}pattern-api`,
            "hydra:totalItems": patterns.length,
            "GecureerdeCollectie.curator": "https://oliviervandhuynslager.net",
            "GecureerdeCollectie.bestaatUit": objects
        })
    })
}

