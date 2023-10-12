import {fetchAllImages, parseBoolean, fetchPublicDomainImages} from "../utils/parsers.js";

export function requestRandomImage(app) {
    app.get('/id/random-image', async(req, res)=> {
        const limit = parseInt(req.query.limit) || 10
        const pd = parseBoolean(req.query.pd) || true;
        let x;

        // await data from GET request (supabase)
        if (pd) {
            x = await fetchPublicDomainImages();
        } else {
            x = await fetchAllImages()
        }

        const _objects = [] // init objects

        if (limit > 100) {
            res.status(422).json({"error":"to reduce the stress on our servers, the maximum limit per request is set to 100, please try again lowering the limit"})
        }

        // fetch all objects, and populate bucket to randomize
        for (let i = 0; i < x.length; i++) {
            let _randomImage = {}
            _randomImage["resource"] = x[i]["PURL"]
            _randomImage["object_number"] = x[i]["object_number"]
            _randomImage["license"] = x[i]["license"]
            _randomImage["attribution"] = x[i]["attribution"]
            _objects.push(_randomImage)
        }

        // create index subselection (filter in subselection)
        let _subselection = []
        for (let s=0; s< limit; s++){
            // generate numbers that range between 0, and the length of the bucket.
            let _s = Math.floor(Math.random() * x.length-1)
            _subselection.push(_s)
        }

        // populate random images
        let _selection = []
        for (let i = 0; i < limit; i++) {
            let _o = _objects[_subselection[i]]
            _selection.push(_o)

        }

        res.send(_selection)
    })
}