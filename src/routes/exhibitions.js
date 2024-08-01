import {fetchAllExhibitions, fetchLDESrecordsByExhibitionID} from "../utils/parsers.js";

const parseIdentification = title => ({
    "@type": "cidoc:E33_E41_Linguistic_Appelation",
    "inhoud": {
        "@value": title,
        "@language": "nl"
    }
})

const parseExhibition = (exh, BASE_URI) => {

    // todo add top level (DCAT info)
    let _title = "title unknown";

    try{
        if(exh["LDES_raw"]["object"]["cidoc:P1_is_identified_by"]["inhoud"]["@value"]){
            _title = exh["LDES_raw"]["object"]["cidoc:P1_is_identified_by"]["inhoud"]["@value"];
        }
    } catch (e) {
        console.log(e)
    }


    /*
    if(["LDES_raw"]["object"]["cidoc:P1_is_identified_by"]["inhoud"]["@value"]){
        _title = ["LDES_raw"]["object"]["cidoc:P1_is_identified_by"]["inhoud"]["@value"];
    }
    */


    return {
        "@id": BASE_URI+"id/exhibition/"+exh["exh_PID"],
        "@type": "Activiteit",
        "cidoc:P1_is_identified_by": parseIdentification(_title)
    }
};


export function requestExhibitions(app, BASE_URI) {
    app.get('/v1/id/exhibitions', async(req, res)=> {
        const exhibitions = await fetchAllExhibitions()
        const _exhibitions = exhibitions.map(exh =>
            parseExhibition(exh, BASE_URI)
        )
        res.send({
            "@context": [
                "https://data.vlaanderen.be/doc/applicatieprofiel/DCAT-AP-VL/erkendestandaard/2022-04-21/context/DCAT-AP-VL-20.jsonld",
                "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-event/erkendestandaard/2021-04-22/context/cultureel-erfgoed-event-ap.jsonld",
                "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-object/erkendestandaard/2021-04-22/context/cultureel-erfgoed-object-ap.jsonld"
            ],
            "@type": "GecureerdeCollectie",
            "@id": "https://data.designmuseumgent.be/v1/id/exhibitions",
            "GecureerdeCollectie.bestaatUit": [
                _exhibitions
            ]
        });
    });
}

export function requestExhibition(app, BASE_URI) {

    // handler for both routes.
    const exhibitionHandler = async(req, res) => {
        try {
            const x = await fetchLDESrecordsByExhibitionID(req.params.exhibitionPID)
            res.send({result_cidoc: x[0]["LDES_raw"]})
        } catch (e) {
            console.log(e)
            res.status(500).send({error: "Error fetching exhibition data"})
        }
    }

    app.get('/v1/id/exhibition/:exhibitionPID', exhibitionHandler) // Flemish URI standard
    app.get('/v1/id/ark:/29417/exhibition/:exhibitionPID', exhibitionHandler) // EU? URI standard (ARK)

}


