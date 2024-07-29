import {fetchAllExhibitions, fetchLDESrecordsByExhibitionID} from "../utils/parsers.js";

export function requestExhibitions(app, BASE_URI) {
    app.get('/v1/id/exhibitions', async(req, res)=> {
        const exh = await fetchAllExhibitions()
        let range = exh.length
        let _exhibitions = []

        for (let i = 0; i < range; i ++) {
            let _exhibition = {}

            // generate PURI for exhibition
            _exhibition["@id"] = BASE_URI+"id/exhibition/"+exh[i]["exh_PID"]

            // parse title from LDES feed - if no title available use value "title unknown".
            let _title = "title unknown"
            try{
                _title = exh[i]["LDES_raw"]["object"]["cidoc:P1_is_identified_by"]["inhoud"]["@value"]
            } catch (e) {}

            // parse identification.
            let _identification = {
                "@type": "cidoc:E33_E41_Linguistic_Appellation",
                "inhoud": {
                    "@value": _title,
                    "@language": "nl"
                }
            }
            _exhibition["cidoc:P1_is_identified_by"] = _identification

            // push to endpoint.
            _exhibitions.push(_exhibition)
        }
        res.send({_exhibitions})
    })
}

export function requestExhibition(app, BASE_URI) {

    // FLEMISH URI STANDARD.
    app.get('/v1/id/exhibition/:exhibitionPID', async (req, res)=> {
        const x = await fetchLDESrecordsByExhibitionID(req.params.exhibitionPID)
        try{
            //res.send(x[0]["LDES_raw"])
            res.send(x[0])

        } catch (e) {
            console.log(e)
        }
    })

    // ARK
    app.get('/v1/id/ark:/29417/exhibition/:exhibitionPID', async (req, res)=> {
        const x = await fetchLDESrecordsByExhibitionID(req.params.exhibitionPID)
        try{
            const result_cidoc = x[0]["LDES_raw"];
            res.send({result_cidoc})
        } catch (e) {
            console.log(e)
        }
    })
}


