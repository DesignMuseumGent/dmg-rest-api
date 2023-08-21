import {fetchAllExhibitions, fetchLDESrecordsByExhibitionID} from "../utils/parsers.js";

export function requestExhibitions(app) {
    app.get('/id/exhibitions', async(req, res)=> {
        const exh = await fetchAllExhibitions()
        let range = exh.length
        let _exhibitions = []

        for (let i = 0; i < range; i ++) {
            let _exhibition = {}
            _exhibition["@id"] = baseURI+"exhibition/"+exh[i]["exh_PID"]
            _exhibition["cidoc:P1_is_identified_by"] = {
                "@type": "cidoc:E33_E41_Linguistic_Appellation",
                "inhoud": {
                    "@value": exh[i]["LDES_raw"]["object"]["cidoc:P1_is_identified_by"]["inhoud"]["@value"],
                    "@language": "nl"
                }
            }
            _exhibitions.push(_exhibition)
        }
        res.send({_exhibitions})
    })

}

export function requestExhibition(app) {

    // FLEMISH URI STANDARD.
    app.get('/id/exhibition/:exhibitionPID', async (req, res)=> {
        const x = await fetchLDESrecordsByExhibitionID(req.params.exhibitionPID)
        try{
            res.send(x[0]["LDES_raw"])
        } catch (e) {
            console.log(e)
        }
    })

    // ARK
    app.get('/id/ark:/29417/exhibition/:exhibitionPID', async (req, res)=> {
        const x = await fetchLDESrecordsByExhibitionID(req.params.exhibitionPID)
        try{
            const result_cidoc = x[0]["LDES_raw"];
            res.send({result_cidoc})
        } catch (e) {
            console.log(e)
        }
    })
}


