import {fetchAllArchive} from "../../utils/parsers.js";

const COMMON_CONTEXT = [
    "https://data.vlaanderen.be/doc/applicatieprofiel/generiek-basis/zonderstatus/2019-07-01/context/generiek-basis.jsonld",
    "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-object/erkendestandaard/2021-04-22/context/cultureel-erfgoed-object-ap.jsonld",
];

export function requestAllArchive(app, BASE_URI) {
    app.get('/v1/id/archives/', async(req, res)=> {
        const archiveData = await fetchAllArchive()
        const filteredData = []
        //console.log(archiveData)

        // pagination 
        let {pageNumber = 1, itemsPerPage = 20} = req.query
        pageNumber = Number(pageNumber)
        itemsPerPage = Number(itemsPerPage)

        for (let i = ( pageNumber - 1 ) * itemsPerPage; i < pageNumber * itemsPerPage;  i++) {
            const record = archiveData[i]
            let object = {
                "@context": COMMON_CONTEXT,
                "@id": `${BASE_URI}id/archive/${record["objectNumber"]}`,
                "@type": "MensgemaaktObject",
                "Object.identificator": [{
                    "@type": "Identificator",
                    "Identificator.identificator": {
                        "@value": record["objectNumber"]
                    }
                }],
                //todo: add representations
                "cidoc:P129i_is_subject_of": {
                    "@id": record["iiif_manifest"],
                    "@type": "http://www.ics.forth.gr/isl/CRMdig/D1_Digital_Object",
                    "http://purl.org/dc/terms/conformsTo": {
                        "@id": "https://iiif.io/api/presentation",
                        "@type": "cidoc:E73_Information_Object"
                    }
                },
            }
            filteredData.push(object)
        }
        
        res.status(200).json({
            "@context": [...COMMON_CONTEXT, { "hydra": "http://www.w3.org/ns/hydra/context.jsonld" }],
            "@type": "GecureerdeCollectie",
            "@id": `${BASE_URI}id/archives`,
            "hydra:totalItems": archiveData.length,
            "GecureerdeCollectie.curator": "Design Museum Gent",
            "GecureerdeCollectie.bestaatUit": filteredData
        })
    })
}