// API generator for Archives of Design Museum Gent
import {fetchArchiveByObjectNumber} from "../../utils/parsers.js";

export function requestArchive(app, BASE_URI) {
    const archiveHandler = async(req, res) => {
        const object = await fetchArchiveByObjectNumber(req.params.objectNumber);

        // construct id for isPartOf:
        const PID = req.params.objectNumber.split("_Aff")[0]
        const exh_PURI = `${BASE_URI}id/exhibition/${PID}`

        //todo: remove when in LDES.
        object[0]["LDES_raw"]["object"]["http://purl.org/dc/terms/isPartOf"]["cidoc:P16_used_specific_object"]["@id"] = exh_PUR
        res.send(object[0]["LDES_raw"])
    }
    app.get('/v1/id/archive/:objectNumber',archiveHandler)
    app.get('/v1/id/ark:/29417/archive/:objectNumber',archiveHandler)
}