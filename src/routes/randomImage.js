import {fetchAllImages} from "../utils/parsers.js";

export function requestRandomImage(app) {
    app.get('/id/random-image', async(req, res)=> {
        // await data from GET request (supabase)
        const x = await fetchAllImages()
        const _objects = [] // init objects
        const limit = parseInt(req.query.limit)

        if (limit > 100) {
            res.status(422).json({"error":"to reduce the stress on our servers, the maximum limit per request is set to 100, please try again lowering the limit"})
        }

        // fetch all objects, and populate bucket to randomize
        for (let i = 0; i < x.length; i++) {
            let _object = {}
            _objects.push(x[i]["PURL"])
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