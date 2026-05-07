import express from "express";
import YAML from "yamljs";
import swaggerUI from "swagger-ui-express";
import cors from "cors";
import helmet from "helmet";
import v1Router from "./src/routes/v1/index.js";
import v2Router from "./src/routes/v2/index.js";

const app = express();

// behind proxies (e.g., Heroku) so rate limiting and IP work correctly
app.set('trust proxy', 1);

// security headers
app.disable('x-powered-by');
app.use(helmet());

// ---------------------------------------------------------------------------
// CORS — global baseline
// ---------------------------------------------------------------------------

const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
app.use(cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    methods: ['GET', 'HEAD', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'x-api-key'],
    credentials: false,
    optionsSuccessStatus: 204
}))

// ---------------------------------------------------------------------------
// STATIC
// ---------------------------------------------------------------------------

app.use(express.static('public'))

// ---------------------------------------------------------------------------
// ROUTES — each router handles its own rate limiting
// ---------------------------------------------------------------------------

app.use('/v1', v1Router)
app.use('/v2', v2Router)

export default app;