import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import fileUpload from 'express-fileupload'
import v2Router from "./src/routes/v2/index.js";
import v1Retired from './src/routes/v1/retired.js'
import rootRouter from './src/routes/root.js';
import { setupAdmin } from "./src/admin/index.js";
import reviewRouter from './src/routes/review/index.js';

const app = express();

// ---------------------------------------------------------------------------
// SECURITY / PROXY
// Must come first: trust proxy affects req.protocol and req.ip for everything
// downstream, and helmet's headers should apply to every response including
// the root landing page.
// ---------------------------------------------------------------------------

app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));

const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
app.use(cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    methods: ['GET', 'HEAD', 'OPTIONS', 'POST'],
    allowedHeaders: ['Content-Type', 'Accept', 'x-api-key'],
    credentials: false,
    optionsSuccessStatus: 204
}))

// ---------------------------------------------------------------------------
// BODY PARSING
// ---------------------------------------------------------------------------

app.use(fileUpload({
    limits: { fileSize: 20 * 1024 * 1024 },
    abortOnLimit: true,
    parseNested: true
}))

app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.use(session({
    secret: process.env.ADMIN_SESSION_SECRET || 'dmg-admin-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 8 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true
    }
}))

// ---------------------------------------------------------------------------
// ROOT — content negotiation
// Must precede express.static: otherwise public/index.html answers '/' before
// the Accept header is ever inspected, and RDF clients get HTML.
// rootRouter calls next() for HTML requests when public/index.html exists,
// so static still serves the real landing page.
// ---------------------------------------------------------------------------

app.use(rootRouter)
app.use(express.static('public'))

// ---------------------------------------------------------------------------
// ROUTES
// ---------------------------------------------------------------------------

setupAdmin(app)


app.use('/v1', v1Retired)

//app.use('/v1', v1Router)
app.use('/v2', v2Router)
// app.use('/pick', pickRouter); // no longer used
app.use('/review', reviewRouter);

export default app;