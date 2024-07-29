import {fetchAllConcepts, fetchConcept} from "../utils/parsers.js";

export function requestConcept(app, BASE_URI) {
    app.get("/v1/id/concept/:id", async(req, res)=> {
        // await data from GET request DB
        let _id = "https://stad.gent/id/concept/"+req.params.id
        console.log(_id)
        const x = await fetchConcept(_id);

        // iterate over concepts
        // todo add limit, range and offset

        if (x){
            res.send(x[0]["LDES_raw"])
        }

        if (!x) {
            res.status(422).json({
                error: "there is no concept in our catalogue with that id"
            })
        }
    })
}

