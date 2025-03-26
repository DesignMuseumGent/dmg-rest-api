// import dependencies
import express from "express";
import YAML from "yamljs";
import swaggerUI from "swagger-ui-express";
import cors from "cors";;
import {rateLimit} from "express-rate-limit";

// import routes (API contructors)
import { requestObjects } from "./src/routes/collections/objects.js";
import { requestObject } from "./src/routes/entities/object.js";
import { requestDCAT } from "./src/routes/dcat.js";
import { requestAllBillboards } from "./src/routes/curated/billboards.js";
import { requestAgents } from "./src/routes/collections/agents.js";
import { requestExhibitions } from "./src/routes/collections/exhibitions.js";
import { requestExhibition } from "./src/routes/entities/exhibition.js";
import { requestTexts } from "./src/routes/collections/texts.js";
import { requestArchive } from "./src/routes/entities/archief.js";
import { requestAllArchive } from "./src/routes/collections/archief.js";
import { requestPrivateObjects } from "./src/routes/collections/private_stream.js";
import { Dump } from "./src/routes/collections/data-dump.js";
import { requestConcepts } from "./src/routes/collections/concepts.js";
import { requestConcept } from "./src/routes/entities/concept.js";
import { requestByColor } from "./src/routes/curated/colors.js";
import {requestAgent} from "./src/routes/entities/agent.js";
import {requestEasyObjects} from "./src/routes/collections/easy.js";
import {requestLostInDiffusion} from "./src/routes/curated/lost-in-diffusion.js";
import {indexObjects} from "./src/utils/indexer.js";
import {populateSupabaseImages} from "./src/utils/parsers.js";
import {patternAPI} from "./src/routes/curated/patterns.js";

const BASE_URI = "https://data.designmuseumgent.be/v1/";

// setup accept-headers
const app = express();

const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // one minute
    limit: 10, // limit public requests to 10 per minute
    message: {
        status: 429,
        message: "Too many requests, please slow down."
    },
    legacyHeaders: false,
    standardHeaders: 'draft-8',
})

app.use(limiter);
app.use(cors());
app.use(express.static("public"));

// swagger docs
const swaggerDocument = YAML.load("./api.yaml");
app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(swaggerDocument));

// ROUTE to top level DCAT
requestDCAT(app, BASE_URI);

// ROUTES to human-made objects
requestObjects(app, BASE_URI); // request list of all published human-made objects
requestObject(app, BASE_URI); // request individual entity (human-made object) using content-negotiation.
requestEasyObjects(app, BASE_URI) // request easyobjects

// ROUTE to COLOR-API
requestByColor(app, BASE_URI);

// ROUTE to LOST-IN-DIFFUSION
requestLostInDiffusion(app, BASE_URI);

// ROUTE to PRIVATE objects
requestPrivateObjects(app, BASE_URI);

// ROUTES to exhibition data
requestAllBillboards(app, BASE_URI); // request all billboards. (endpoint)
requestExhibition(app, BASE_URI); // request all exhibitions
requestExhibitions(app, BASE_URI); // request single exhibition

// ROUTES to agent (authority list) data
requestAgents(app, BASE_URI);
requestAgent(app, BASE_URI);

// ROUTE to concepts (thesaurus)
requestConcepts(app, BASE_URI)
requestConcept(app, BASE_URI);

// ROUTES to archive (posters)
requestArchive(app, BASE_URI);
requestAllArchive(app, BASE_URI);

// ROUTES to texts that are related to the collection of Design Museum Gent
requestTexts(app, BASE_URI);

// ROUTE to PATTERN API
patternAPI(app, BASE_URI)

// ROUTE to DUMP
Dump(app, BASE_URI);

//indexObjects()
//populateSupabaseImages(app, BASE_URI);

export default app;

