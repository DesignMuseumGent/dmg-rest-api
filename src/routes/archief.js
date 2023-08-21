// API generator for Archives of Design Museum Gent
import {fetchArchiveByObjectNumber} from "../utils/parsers.js";

export function requestArchive(app) {
    app.get('/id/archive/:objectNumber', async(req, res)=> {
        console.log(req.params.objectNumber)
        const object = await fetchArchiveByObjectNumber(req.params.objectNumber);
        res.send(object[0]["LDES_raw"])
    })
}