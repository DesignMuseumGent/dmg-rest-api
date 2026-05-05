import { Router } from 'express';
import { requestAgent} from './entities/agent.js'
import { requestExhibition} from './entities/exhibition.js'
import { requestConcept} from './entities/concept.js'
import { requestObject} from './entities/object.js'
import {requestAgents} from "./collections/agents.js";
import {requestObjects} from "./collections/objects.js";
import {requestConcepts} from "./collections/concepts.js";
import {requestExhibitions} from "./collections/exhibitions.js";
import {requestDCAT} from "../v2/dcat.js";
import { requestColors } from "./colors.js";

// import v2 routes
const v2Router = Router();
const V2_BASE = "https://data.designmuseumgent.be/v2"

// helpers
requestColors(v2Router, V2_BASE);

// DCAT
requestDCAT(v2Router, V2_BASE)

// single entitites
requestAgent(v2Router, V2_BASE);
requestExhibition(v2Router, V2_BASE);
requestConcept(v2Router, V2_BASE);
requestObject(v2Router, V2_BASE);

// collections
requestAgents(v2Router, V2_BASE);
requestObjects(v2Router, V2_BASE);
requestConcepts(v2Router, V2_BASE);
requestExhibitions(v2Router, V2_BASE);

export default v2Router;