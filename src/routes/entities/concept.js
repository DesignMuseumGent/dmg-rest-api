import {fetchAllConcepts, fetchConcept} from "../../utils/parsers.js";

export function requestConcept(app, BASE_URI) {
    const conceptHandler = async(req, res) => {

        // set Headers
        res.setHeader('Content-type', 'application/ld+json');
        res.setHeader('Content-Dispositon', 'inline');

        // await data from GET request DB
        let _id = "https://stad.gent/id/concept/"+req.params.id
        const x = await fetchConcept(_id);

        // iterate over concepts
        // todo add limit, range and offset

        if (x){
            res.send(x[0]["LDES_raw"]["object"])
        }

        if (!x) {
            res.status(422).json({
                error: "there is no concept in our catalogue with that id"
            })
        }
    }

    app.get("/v1/id/concept/:id", conceptHandler)
    app.get("/v1/id/ark:/29417/concept/:id", conceptHandler)
}

