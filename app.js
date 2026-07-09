import express from "express";
import YAML from "yamljs";
import swaggerUI from "swagger-ui-express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import fileUpload from 'express-fileupload'
import v1Router from "./src/routes/v1/index.js";
import v2Router from "./src/routes/v2/index.js";
import pickRouter from './src/routes/pick/index.js';
import { setupAdmin } from "./src/admin/index.js";

const app = express();

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

app.use(express.static('public'))

setupAdmin(app)

app.use('/v1', v1Router)
app.use('/v2', v2Router)
app.use('/pick', pickRouter);

export default app;