import {fetchTexts} from "../../utils/parsers.js";

const CONTEXT = [
    "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/cultureel-erfgoed-event-ap.jsonld",
    "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/cultureel-erfgoed-object-ap.jsonld"
]

const COMMON_CONTEXT = [
    "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-object/erkendestandaard/2021-04-22/context/cultureel-erfgoed-object-ap.jsonld",
    "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-event/erkendestandaard/2021-04-22/context/cultureel-erfgoed-event-ap.jsonld",
    "https://data.vlaanderen.be/doc/applicatieprofiel/generiek-basis/zonderstatus/2019-07-01/context/generiek-basis.jsonld",
];


const languages = {"NL": "nl", "EN": "en", "FR": "fr"}

export function requestTexts(app, BASE_URI) {
    app.get('/v1/id/texts/', async(req, res)=> {
        const texts = await fetchTexts() // connect with Supabase and fetch data.
        const catalogue = []; // initialize catalogue
        const filteredtexts = []

        let {pageNumber = 1, itemsPerPage = 20} = req.query
        pageNumber = Number(pageNumber)
        itemsPerPage = Number(itemsPerPage)

        for (let i=0; i < texts.length; i++) {

            let catalogueTexts = [];
            let _objectNumber = texts[i]["object_number"]
            let _objectID = BASE_URI+"id/object/"+_objectNumber //todo: add resolver when the object has not been published yet.

            for (let language in languages) {
                let text = texts[i][`text_${language}`]
                if (text) {
                    let textObject = {
                        //todo: check if there are better CIDOC properties to describe a text.
                        "text": text,
                        "@lang": languages[language]
                    }
                    catalogueTexts.push(textObject)
                }
            }

            let text = {
                "@context": CONTEXT,
                "@type": "InformatieObject",
                "InformatieObject.gaatOver": {
                    "@id": _objectID, // PURI
                    "@type": "MensgemaaktObject"
                },
                "InformatieObject.omvat": catalogueTexts
            }
            catalogue.push(text);
        }

        const totalPages = Math.ceil(texts.length / itemsPerPage);
        for(let j = (pageNumber - 1) * itemsPerPage; j < pageNumber * itemsPerPage; j++) {
            if (j >= texts.length) break;
            filteredtexts.push(catalogue[j]);
        }

        // Build hydra navigation URLs that preserve current filters
        const qsBase = new URLSearchParams();
        qsBase.set("itemsPerPage", String(itemsPerPage));
        const urlForPage = (p) => {
            const qs = new URLSearchParams(qsBase);
            qs.set("pageNumber", String(p));
            return `${BASE_URI}id/texts?${qs.toString()}`;
        };

        res.status(200).json({
            "@context": [...COMMON_CONTEXT, { "hydra": "http://www.w3.org/ns/hydra/context.jsonld" }],
            "@type": "GecureerdeCollectie",
            "@id": `${BASE_URI}id/texts/`,
            "hydra:totalItems": catalogue.length,
            "hydra:view": {
                "@id": urlForPage(pageNumber),
                "@type": "PartialCollectionView",
                "hydra:first": urlForPage(1),
                "hydra:last": urlForPage(totalPages),
                "hydra:previous": pageNumber > 1 ? urlForPage(pageNumber - 1) : null,
                "hydra:next": pageNumber < totalPages ? urlForPage(pageNumber + 1) : null,
            },
            "GecureerdeCollectie.curator": "Design Museum Gent",
            "GecureerdeCollectie.bestaatUit": catalogue
        })
    })
}
