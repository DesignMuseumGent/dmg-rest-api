import { Router } from 'express';
import { requestAgent} from './entities/agent.js'
import { requestExhibition} from './entities/exhibition.js'
import { requestConcept} from './entities/concept.js'

// import v2 routes
const v2Router = Router();
const V2_BASE = "https://data.designmuseumgent.be/v2"

requestAgent(v2Router, V2_BASE)
requestExhibition(v2Router, V2_BASE)
requestConcept(v2Router, V2_BASE)

export default v2Router;