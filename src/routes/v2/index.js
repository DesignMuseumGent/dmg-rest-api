import { Router } from 'express';
import { requestAgent} from './entities/agent.js'
import { requestExhibition} from './entities/exhibition.js'
import { requestConcept} from './entities/concept.js'
import { requestObject} from './entities/object.js'
import {requestAgents} from "./collections/agents.js";
import {requestObjects} from "./collections/objects.js";

// import v2 routes
const v2Router = Router();
const V2_BASE = "https://data.designmuseumgent.be/v2"

// single entitites
requestAgent(v2Router, V2_BASE);
requestExhibition(v2Router, V2_BASE);
requestConcept(v2Router, V2_BASE);
requestObject(v2Router, V2_BASE);

// collections
requestAgents(v2Router, V2_BASE);
requestObjects(v2Router, V2_BASE);

export default v2Router;