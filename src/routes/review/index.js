import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Served dynamically from Heroku Config Vars at request time -- never
// committed to git, never hardcoded. The anon key is safe to expose
// client-side by design; access is governed by Supabase RLS policies.
router.get("/config.js", (req, res) => {
  res.type("application/javascript");
  res.send(
    `window.SUPABASE_URL = ${JSON.stringify(process.env.SUPABASE_URL)};\n` +
    `window.SUPABASE_ANON_KEY = ${JSON.stringify(process.env.SUPABASE_KEY)};\n`
  );
});

router.use(express.static(path.join(__dirname, "public")));

export default router;
