import {fetchAllExhibitions, fetchLDESrecordsByExhibitionID} from "../../utils/parsers.js";

const parseIdentification = title => ({
    "@type": "cidoc:E33_E41_Linguistic_Appelation",
    "inhoud": {
        "@value": title,
        "@language": "nl"
    }
})

const parseExhibition = (exh, BASE_URI) => {
    let _title = "title unknown";

    try{
        if(exh["LDES_raw"]["object"]["cidoc:P1_is_identified_by"]["inhoud"]["@value"]){
            _title = exh["LDES_raw"]["object"]["cidoc:P1_is_identified_by"]["inhoud"]["@value"];
        }
    } catch (e) {
        console.error(e)
    }

    return {
        "@id": BASE_URI+"id/exhibition/"+exh["exh_PID"],
        "@type": "Activiteit",
        "cidoc:P1_is_identified_by": parseIdentification(_title)
    }
};

export function requestExhibitions(app, BASE_URI) {
    app.get('/v1/id/exhibitions', async(req, res)=> {
        const exhibitions = await fetchAllExhibitions()
        const filteredExhibitions = [];

        // pagination
        let { pageNumber = 1, itemsPerPage = 20 } = req.query;
        pageNumber = Number(pageNumber)
        itemsPerPage = Number(itemsPerPage)

        const totalPages = Math.ceil(exhibitions.length / itemsPerPage)

        for (let i = (pageNumber - 1) * itemsPerPage; i < pageNumber * itemsPerPage; i++) {
            if (i >= exhibitions.length) break;
            let exhibition = parseExhibition(exhibitions[i], BASE_URI)
            filteredExhibitions.push(exhibition)
        }

        res.send({
            "@context": [
                "https://data.vlaanderen.be/doc/applicatieprofiel/DCAT-AP-VL/erkendestandaard/2022-04-21/context/DCAT-AP-VL-20.jsonld",
                "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-event/erkendestandaard/2021-04-22/context/cultureel-erfgoed-event-ap.jsonld",
                "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-object/erkendestandaard/2021-04-22/context/cultureel-erfgoed-object-ap.jsonld",
                {
                    "cidoc": "https://www.cidoc-crm.org/cidco-crm/",
                    "hydra": "http://www.w3.org/ns/hydra/context.jsonld"
                }
            ],
            "@type": "GecureerdeCollectie",
            "@id": `${BASE_URI}id/exhibitions`,
            "hydra:view": {
                "@id": `${BASE_URI}id/exhibitions?pageNumber=${pageNumber}`,
                "@type": "PartialCollectionView",
                "hydra:first": `${BASE_URI}id/exhibitions?pageNumber=1`,
                "hydra:last": `${BASE_URI}id/exhibitions?pageNumber=${totalPages}`,
                "hydra:previous": pageNumber > 1 ? `${BASE_URI}id/exhibitions?pageNumber=${pageNumber - 1}` : null,
                "hydra:next": pageNumber < totalPages ? `${BASE_URI}id/exhibitions?pageNumber=${pageNumber + 1}` : null,
            },
            "GecureerdeCollectie.curator": "Design Museum Gent",
            "GecureerdeCollectie.bestaatUit": filteredExhibitions
        });
    });
}


