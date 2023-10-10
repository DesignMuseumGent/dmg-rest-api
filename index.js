// import dependencies
import express from "express";
import YAML from "yamljs";
import swaggerUI from "swagger-ui-express";
import cors from 'cors'

// import functions to populate API.
import {
    fetchAllBillboards,
} from "./src/utils/parsers.js";

// import routes (API contructors)
import {requestObjects, requestObject} from "./src/routes/objects.js";
import {requestDCAT} from "./src/routes/dcat.js";
import {requestAllBillboards} from "./src/routes/billboards.js";
import {requestAgents} from "./src/routes/agents.js";
import {requestExhibition, requestExhibitions} from "./src/routes/exhibitions.js";
import {requestTexts} from "./src/routes/texts.js";
import {requestArchive} from "./src/routes/archief.js";
import {requestRandomImage} from "./src/routes/randomImage.js";

async function start(){

    // setup accept-headers
    const app = express();
    const port = 1999;

    app.use(cors())
    app.use(express.static("public"))

    // swagger docs
    const swaggerDocument = YAML.load('./api.yaml')
    app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerDocument))

    app.listen(
        process.env.PORT || 1992,
        console.log(`app listening on port ${port}`)
    )

    const baseURI = "https://data.designmuseumgent.be/"

    // ROUTE to top level DCAT
    requestDCAT(app);

    // ROUTES to human-made objects
    requestObjects(app); // request list of all published human-made objects
    requestObject(app); // request individual entity (human-made object) using content-negotiation.

    // ROUTES to exhibition data
    const billboard = await fetchAllBillboards() // fetch data from supabase
    requestAllBillboards(app); // request all billboards. (endpoint)
    requestExhibition(app); // request all exhibitions
    requestExhibitions(app); // request single exhibition

    // ROUTES to agent (authority list) data
    requestAgents(app)

    // ROUTES to archive (posters)
    requestArchive(app);

    // ROUTES to texts that are related to the collection of Design Museum Gent
    requestTexts(app)

    // ROUTE to randomimage
    requestRandomImage(app)

    console.log("DONE :D :D :D :D ")
}

start();
