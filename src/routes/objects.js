import {fetchAllLDESrecordsObjects, fetchLDESRecordByObjectNumber} from "../utils/parsers.js";

export function requestObjects(app) {
    app.get('/id/objects/', async(req, res)=> {
        const x = await fetchAllLDESrecordsObjects()
        let limit = parseInt(req.query.limit) || x.length; // if no limit set, return all items.
        let offset = parseInt(req.query.offset) || 0; // Default offset is 0
        const _objects = []

        //check if limit exceeds max.
        if (limit >= x.length) {
            limit = x.length
        }

        //check max offset.
        const maxOffset = x.length / limit
        if (offset > maxOffset) {
            offset = maxOffset
        }

        for(let i = 0; i < x.length; i++) {
            let _object = {}
            _object["@context"] = [
                "https://apidg.gent.be/op…erfgoed-object-ap.jsonld",
                "https://apidg.gent.be/op…xt/generiek-basis.jsonld"
            ]
            _object["@id"] = baseURI+"id/object/"+x[i]["objectNumber"] // create id (PID) for individual object
            _object["@type"] = "MensgemaaktObject"
            _object["Object.identificator"] = [
                {
                    "@type": "Identificator",
                    "Identificator.identificator": {
                        "@value": x[i]["objectNumber"]
                    }
                }
            ]
            _objects.push(_object)
        }
        const objects = _objects.slice(offset, offset + limit);
        res.send({objects})
    })

}

export function requestObject(app) {
    app.get('/id/object/:objectNumber.:format?', async (req, res, next) => {
        const x = await fetchLDESRecordByObjectNumber(req.params.objectNumber)
        let _redirect = "https://data.collectie.gent/entity/dmg:" + req.params.objectNumber
        const result_cidoc = x[0]["LDES_raw"];

        // redefine - @id to use URIs and PIDs defined by the museum
        result_cidoc["object"]["@id"] = "https://data.designmuseumgent.be/id/object/" + req.params.objectNumber

        // assign foaf:pages
        result_cidoc["object"]["foaf:homepage"] = "https://data.designmuseumgent.be/id/object/" + req.params.objectNumber

        req.negotiate(req.params.format, {
            'json': function() {
                // if format .json redirect to machine-readable page.
                res.send(result_cidoc["object"])
            },
            'html': function() {
                // if format .html redirect to human-readable page
                res.redirect(_redirect)
            },
            'default': function() {
                //send html anyway.
                res.redirect(_redirect)
            }
        })
    })
}
