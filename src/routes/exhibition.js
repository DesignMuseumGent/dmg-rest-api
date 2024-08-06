import {fetchLDESrecordsByExhibitionID} from "../utils/parsers.js";

export function requestExhibition(app, BASE_URI) {

    // handler for both routes.
    const exhibitionHandler = async(req, res) => {
        try {
            const x = await fetchLDESrecordsByExhibitionID(req.params.exhibitionPID)
            res.send(x[0]["LDES_raw"])
        } catch (e) {
            console.log(e)
            res.status(500).send({error: "Error fetching exhibition data"})
        }
    }

    app.get('/v1/id/exhibition/:exhibitionPID', exhibitionHandler) // Flemish URI standard
    app.get('/v1/id/ark:/29417/exhibition/:exhibitionPID', exhibitionHandler) // EU? URI standard (ARK)

}