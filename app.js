// import dependencies
import express from "express";
import YAML from "yamljs";
import swaggerUI from "swagger-ui-express";
import cors from "cors";
import helmet from "helmet";
import {rateLimit} from "express-rate-limit";
import v1Router from "./src/routes/v1/index.js";
import v2Router from "./src/routes/v2/index.js";

// import routes (API contructors)

const BASE_URI = "https://data.designmuseumgent.be/v1/";

// setup accept-headers
const app = express();

// behind proxies (e.g., Heroku) so rate limiting and IP work correctly
app.set('trust proxy', 1);

// security headers
app.disable('x-powered-by');
app.use(helmet());

const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // one minute
    limit: 10, // limit public requests to 10 per minute
    message: {
        status: 429,
        message: "Too many requests, please slow down."
    },
    legacyHeaders: false,
    standardHeaders: 'draft-8',
});

app.use(limiter);

// CORS: allowlist from env (comma-separated). Default to disabled if not provided.
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const corsOptions = {
    origin: allowedOrigins.length ? allowedOrigins : true, // default: allow all (backward compatible); restrict via CORS_ORIGINS
    methods: ["GET", "HEAD", "OPTIONS"],
    credentials: false,
    optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));

app.use(express.static("public"));

// swagger docs
const swaggerDocument = YAML.load("./api.yaml");
app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(swaggerDocument));

// routes
app.use("/v1", v1Router);

export default app;

