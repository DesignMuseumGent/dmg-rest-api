import express from "express";
import YAML from "yamljs";
import swaggerUI from "swagger-ui-express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import v1Router from "./src/routes/v1/index.js";
import v2Router from "./src/routes/v2/index.js";
import { setupAdmin } from "./src/admin/index.js";

import fileUpload from 'express-fileupload'


const app = express();

// behind proxies (e.g., Heroku) so rate limiting and IP work correctly
app.set('trust proxy', 1);

// security headers
app.disable('x-powered-by');
app.use(helmet({
    // relax CSP for admin UI — swagger and admin forms need inline styles
    contentSecurityPolicy: false
}));

// ---------------------------------------------------------------------------
// CORS — global baseline
// ---------------------------------------------------------------------------

const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
app.use(cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    methods: ['GET', 'HEAD', 'OPTIONS', 'POST'],  // ← POST needed for admin forms
    allowedHeaders: ['Content-Type', 'Accept', 'x-api-key'],
    credentials: false,
    optionsSuccessStatus: 204
}))

// ---------------------------------------------------------------------------
// BODY PARSING — needed for admin form submissions
// ---------------------------------------------------------------------------

app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// ---------------------------------------------------------------------------
// SESSION — needed for admin authentication
// ---------------------------------------------------------------------------

app.use(session({
    secret: process.env.ADMIN_SESSION_SECRET || 'dmg-admin-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true
    }
}))

// ---------------------------------------------------------------------------
// STATIC
// ---------------------------------------------------------------------------

app.use(express.static('public'))

// ---------------------------------------------------------------------------
// ADMIN UI
// ---------------------------------------------------------------------------

setupAdmin(app)

// ---------------------------------------------------------------------------
// ROUTES — each router handles its own rate limiting
// ---------------------------------------------------------------------------

app.use('/v1', v1Router)
app.use('/v2', v2Router)


app.use(fileUpload({
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    abortOnLimit: true
}))

export default app;