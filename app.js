// import dependencies
import express from "express";
import YAML from "yamljs";
import swaggerUI from "swagger-ui-express";
import cors from "cors";;

// import routes (API contructors)
import { requestObjects, requestObject } from "./src/routes/objects.js";
import { requestDCAT } from "./src/routes/dcat.js";
import { requestAllBillboards } from "./src/routes/billboards.js";
import { requestAgents } from "./src/routes/agents.js";
import {
  requestExhibition,
  requestExhibitions,
} from "./src/routes/exhibitions.js";
import { requestTexts } from "./src/routes/texts.js";
import { requestArchive } from "./src/routes/archief.js";
import { requestPrivateObjects } from "./src/routes/private_stream.js";
import {Dump} from "./src/routes/data-dump.js";
import {requestConcepts} from "./src/routes/concepts.js";
import {requestConcept} from "./src/routes/concept.js";
import {requestByColor} from "./src/routes/colors.js";

const BASE_URI = "https://data.designmuseumgent.be/v1/";

// setup accept-headers
const app = express();

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

// ROUTE to COLOR-API
requestByColor(app, BASE_URI);

// ROUTE to PRIVATE objects
requestPrivateObjects(app, BASE_URI);

// ROUTES to exhibition data
requestAllBillboards(app, BASE_URI); // request all billboards. (endpoint)
requestExhibition(app, BASE_URI); // request all exhibitions
requestExhibitions(app, BASE_URI); // request single exhibition

// ROUTES to agent (authority list) data
requestAgents(app, BASE_URI);

// ROUTE to concepts (thesaurus)
requestConcepts(app, BASE_URI)
requestConcept(app, BASE_URI);

// ROUTES to archive (posters)
requestArchive(app, BASE_URI);

// ROUTES to texts that are related to the collection of Design Museum Gent
requestTexts(app, BASE_URI);

// ROUTE to DUMP
Dump(app, BASE_URI);

export default app;

