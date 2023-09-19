// API generator for Archives of Design Museum Gent
import {fetchArchiveByObjectNumber} from "../utils/parsers.js";

export function requestArchive(app) {
    app.get('/id/archive/:objectNumber', async(req, res)=> {
        console.log(req.params.objectNumber)
        const object = await fetchArchiveByObjectNumber(req.params.objectNumber);

        // construct id for isPartOf:
        const PID = req.params.objectNumber.split("_Aff")[0]
        const exh_PURI = `https://data.designmuseumgent.be/id/exhibition/${PID}`

        //todo: remove when in LDES.
        object[0]["LDES_raw"]["object"]["http://purl.org/dc/terms/isPartOf"]["cidoc:P16_used_specific_object"]["@id"] = exh_PURI

        res.send(object[0]["LDES_raw"])
    })
}