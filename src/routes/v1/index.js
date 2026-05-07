import { Router } from 'express'
import { publicLimiter } from '../../utils/limiters.js'

import { requestObjects } from "./collections/objects.js";
import { requestObject } from "./entities/object.js";
import { requestDCAT } from "./dcat.js";
import { requestAllBillboards } from "./curated/billboards.js";
import { requestAgents } from "./collections/agents.js";
import { requestExhibitions } from "./collections/exhibitions.js";
import { requestExhibition } from "./entities/exhibition.js";
import { requestTexts } from "./collections/texts.js";
import { requestArchive } from "./entities/archief.js";
import { requestAllArchive } from "./collections/archief.js";
import { requestPrivateObjects } from "./collections/private_stream.js";
import { Dump } from "./collections/data-dump.js";
import { requestConcepts } from "./collections/concepts.js";
import { requestConcept } from "./entities/concept.js";
import { requestByColor } from "./curated/colors.js";
import { requestAgent } from "./entities/agent.js";
import { requestEasyObjects } from "./collections/easy.js";
import { requestLostInDiffusion } from "./curated/lost-in-diffusion.js";
import { patternAPI } from "./curated/patterns.js";

const v1Router = Router()
const V1_BASE = "https://data.designmuseumgent.be/v1"

// ---------------------------------------------------------------------------
// RATE LIMITING
// ---------------------------------------------------------------------------

v1Router.use(publicLimiter)

// ---------------------------------------------------------------------------
// DEPRECATION HEADERS
// ---------------------------------------------------------------------------

v1Router.use((req, res, next) => {
    res.setHeader('Deprecation', 'true')
    res.setHeader('Sunset', 'Wed, 31 Dec 2026 23:59:59 GMT')
    res.setHeader('Link', '<https://data.designmuseumgent.be/v2/>; rel="successor-version"')
    next()
})

// ---------------------------------------------------------------------------
// ROUTES
// ---------------------------------------------------------------------------

requestObjects(v1Router, V1_BASE)
requestObject(v1Router, V1_BASE)

requestAgents(v1Router, V1_BASE)
requestAgent(v1Router, V1_BASE)

requestExhibitions(v1Router, V1_BASE)
requestExhibition(v1Router, V1_BASE)

requestArchive(v1Router, V1_BASE)
requestAllArchive(v1Router, V1_BASE)

requestConcepts(v1Router, V1_BASE)
requestConcept(v1Router, V1_BASE)

requestPrivateObjects(v1Router, V1_BASE)
requestEasyObjects(v1Router, V1_BASE)
requestLostInDiffusion(v1Router, V1_BASE)
requestByColor(v1Router, V1_BASE)
requestTexts(v1Router, V1_BASE)
Dump(v1Router, V1_BASE)
patternAPI(v1Router, V1_BASE)
requestAllBillboards(v1Router, V1_BASE)

export default v1Router