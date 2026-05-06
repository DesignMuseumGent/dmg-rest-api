import swaggerUi from 'swagger-ui-express'
import { swaggerDefinition } from '../v2/swagger/openapi.js'
import cors from 'cors';

import { Router } from 'express';
import { requestAgent} from './entities/agent.js'
import { requestExhibition} from './entities/exhibition.js'
import { requestConcept} from './entities/concept.js'
import { requestObject} from './entities/object.js'
import { requestPrivateObjects } from "./collections/fullCollection.js";
import {requestAgents} from "./collections/agents.js";
import {requestObjects} from "./collections/objects.js";
import {requestConcepts} from "./collections/concepts.js";
import {requestExhibitions} from "./collections/exhibitions.js";
import {requestDCAT} from "../v2/dcat.js";
import { requestColors } from "./colors.js";

// import v2 routes
const v2Router = Router();
const V2_BASE = "https://data.designmuseumgent.be/v2"

// allow all origins for the API — adjust as needed
v2Router.use(cors({
    origin: '*',
    methods: ['GET', 'HEAD', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'x-api-key']
}))


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
requestPrivateObjects(v2Router, V2_BASE);

// serve swagger UI at /api-docs
v2Router.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDefinition, {
    customSiteTitle: 'Design Museum Gent API',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
        persistAuthorization: true,
        url: '/api-docs.json',          // ← use relative URL
        validatorUrl: null,             // ← disable external validator
        tryItOutEnabled: true
    }
}))

// also expose the raw OpenAPI JSON
v2Router.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.json(swaggerDefinition)
})


export default v2Router;