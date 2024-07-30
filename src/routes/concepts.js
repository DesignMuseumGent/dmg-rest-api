import {fetchAllConcepts} from "../utils/parsers.js";

export function requestConcepts(app, BASE_URI) {
    app.get("/v1/id/concepts/", async(req, res) => {
        //await data from GET request DB
        const concepts = await fetchAllConcepts();
        res.send(concepts);
    })

}