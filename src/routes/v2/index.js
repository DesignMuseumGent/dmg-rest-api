import swaggerUi from 'swagger-ui-express'
import { swaggerDefinition } from './swagger/openapi.js'
import cors from 'cors'
import { Router } from 'express'

import { requestAgent } from './entities/agent.js'
import { requestExhibition } from './entities/exhibition.js'
import { requestConcept } from './entities/concept.js'
import { requestObject } from './entities/object.js'
import { requestAgents } from './collections/agents.js'
import { requestObjects } from './collections/objects.js'
import { requestConcepts } from './collections/concepts.js'
import { requestExhibitions } from './collections/exhibitions.js'
import { requestPrivateObjects } from './collections/fullCollection.js'
import { requestColors } from './index/colors.js'
import { requestTypes } from './index/types.js'
import { requestDCAT } from './dcat.js'

import {
    publicLimiter,
    harvestLimiter,
    aggregationLimiter,
    privateLimiter
} from '../../utils/limiters.js'

const v2Router = Router()
const V2_BASE = 'https://data.designmuseumgent.be/v2/'

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

v2Router.use(cors({
    origin: '*',
    methods: ['GET', 'HEAD', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'x-api-key']
}))

// ---------------------------------------------------------------------------
// RATE LIMITING
// ---------------------------------------------------------------------------

v2Router.use('/id/object/', publicLimiter)
v2Router.use('/id/agent/', publicLimiter)
v2Router.use('/id/exhibition/', publicLimiter)
v2Router.use('/id/concept/', publicLimiter)

v2Router.use('/id/objects', harvestLimiter)
v2Router.use('/id/agents', harvestLimiter)
v2Router.use('/id/exhibitions', harvestLimiter)
v2Router.use('/id/concepts', harvestLimiter)

v2Router.use('/id/colors', aggregationLimiter)
v2Router.use('/id/types', aggregationLimiter)

v2Router.use('/id/private/', privateLimiter)

// ---------------------------------------------------------------------------
// SWAGGER
// ---------------------------------------------------------------------------

v2Router.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDefinition, {
    customSiteTitle: 'Design Museum Gent API',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
        persistAuthorization: true,
        validatorUrl: null,
        tryItOutEnabled: true
    }
}))

v2Router.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.json(swaggerDefinition)
})

// ---------------------------------------------------------------------------
// ROUTES
// ---------------------------------------------------------------------------

requestDCAT(v2Router, V2_BASE)

requestObjects(v2Router, V2_BASE)
requestObject(v2Router, V2_BASE)

requestAgents(v2Router, V2_BASE)
requestAgent(v2Router, V2_BASE)

requestExhibitions(v2Router, V2_BASE)
requestExhibition(v2Router, V2_BASE)

requestConcepts(v2Router, V2_BASE)
requestConcept(v2Router, V2_BASE)

requestColors(v2Router, V2_BASE)
requestTypes(v2Router, V2_BASE)

requestPrivateObjects(v2Router, V2_BASE)

export default v2Router