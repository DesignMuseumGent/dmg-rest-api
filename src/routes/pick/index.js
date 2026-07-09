// routes/pick.js
//
// Mount this in your existing Express app, e.g. in index.js / app.js:
//
//   import pickRouter from './routes/pick.js';
//   app.use('/pick', pickRouter);
//
// Requires the same env vars you already use for Supabase
// (adjust the two names below if yours differ) plus nothing else —
// Node 20 has native fetch.
//
// Shared fetching/caching logic lives in lib.js so it can also be reused by
// scripts/warm-thumbnail-cache.js without importing this whole router.

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { publicLimiter } from '../../utils/limiters.js'; // src/utils/limiters.js — same depth as v2Router's own import
import { getPool, getObjectById, getBaseColors, getThumbnailPublicUrl, THUMB_BUCKET } from './lib.js';

const router = express.Router();

// Reuse your existing public-tier limiter so this doesn't need its own
// rate-limit config. Not for CORS/harvester reasons like on v2Router —
// just to stop someone mashing the claim button.
router.use(publicLimiter);

// If these env vars are missing or misnamed, createClient() throws
// synchronously — and since this whole module gets imported unconditionally
// at app boot, that exception would previously crash the ENTIRE app, not
// just this route. Guard it instead: log clearly and let claim/objects
// endpoints degrade to a 503 rather than taking everything down.
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    try {
        supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    } catch (err) {
        console.error('[pick] Failed to create Supabase client — claiming will be unavailable:', err);
    }
} else {
    console.error(
        '[pick] SUPABASE_URL / SUPABASE_KEY are not set — claiming will be unavailable. ' +
        'Set these as Heroku config vars, or rename these two lines to match whatever your app already uses.',
    );
}

// GET /pick/api/thumb/:id
// Redirects to the object's image in Supabase Storage, generating and
// uploading it first if this is the first time it's been requested. After
// that first request, this route barely does anything — the browser is
// sent straight to Supabase's CDN and your server isn't in the loop at all.
router.get('/api/thumb/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const obj = await getObjectById(id);
        if (!obj) return res.status(404).end();

        const result = await getThumbnailPublicUrl(obj, supabase);
        if (!result) return res.status(502).end(); // both thumbnail and manifest failed — will retry next request

        res.redirect(302, result.url);
    } catch (err) {
        console.error('[pick] GET /api/thumb/:id failed:', err);
        res.status(502).end();
    }
});

// GET /pick/api/colors
// Base colours (grey, blue, orange, ...) for the filter dropdown.
router.get('/api/colors', async (req, res) => {
    try {
        const colors = await getBaseColors();
        res.json(colors);
    } catch (err) {
        console.error('[pick] GET /api/colors failed:', err);
        res.status(500).json({ error: 'Could not load colors.' });
    }
});

// GET /pick/api/objects?mode=onDisplay|all&color=grey
// Returns the current pool merged with live claim status. mode=all mixes in
// a random page from the whole collection alongside the on-display set,
// in one combined list — not a separate section.
router.get('/api/objects', async (req, res) => {
    if (!supabase) {
        return res.status(503).json({ error: 'Claim service is not configured.' });
    }

    try {
        const mode = req.query.mode === 'all' ? 'all' : 'onDisplay';
        const color = typeof req.query.color === 'string' && req.query.color.trim() ? req.query.color.trim() : null;

        const [objects, claimsResult] = await Promise.all([
            getPool({ mode, color }),
            supabase.from('object_claims').select('object_id, claimed_by, claimed_at'),
        ]);

        if (claimsResult.error) throw claimsResult.error;

        const claimsById = new Map(claimsResult.data.map((c) => [c.object_id, c]));

        const merged = objects.map((obj) => {
            const claim = claimsById.get(obj.id);
            // getPublicUrl is pure string-building, no network call — cheap to do
            // for every object on every request.
            const { data: publicUrlData } = supabase.storage.from(THUMB_BUCKET).getPublicUrl(`${obj.id}.jpg`);
            return {
                ...obj,
                thumbnailUrl: publicUrlData.publicUrl,
                claimed: !!claim,
                claimedBy: claim?.claimed_by ?? null,
                claimedAt: claim?.claimed_at ?? null,
            };
        });

        res.json(merged);
    } catch (err) {
        console.error('[pick] GET /api/objects failed:', err);
        res.status(500).json({ error: 'Could not load objects.' });
    }
});

// POST /pick/api/claim  { id, name }
// Atomic claim: relies on the object_id primary key to guarantee only one
// claim per object ever succeeds, even under concurrent requests.
router.post('/api/claim', async (req, res) => {
    if (!supabase) {
        return res.status(503).json({ error: 'Claim service is not configured.' });
    }

    const { id, name } = req.body ?? {};

    if (typeof id !== 'string' || !id.trim()) {
        return res.status(400).json({ error: 'Missing object id.' });
    }
    if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Please enter a name first.' });
    }

    try {
        // Make sure it's a real object in the DMG collection, not an arbitrary id
        // — checked directly against the API rather than against whatever pool
        // happens to be cached, so this stays correct across filter changes.
        const obj = await getObjectById(id);
        if (!obj) {
            return res.status(404).json({ error: 'Unknown object.' });
        }

        const { error } = await supabase
            .from('object_claims')
            .insert({ object_id: id, claimed_by: name.trim() });

        if (error) {
            if (error.code === '23505') {
                // unique_violation -> someone else got there first
                return res.status(409).json({ error: 'That object was just claimed by someone else.' });
            }
            throw error;
        }

        res.status(201).json({ ok: true, id, claimedBy: name.trim() });
    } catch (err) {
        console.error('[pick] POST /api/claim failed:', err);
        res.status(500).json({ error: 'Could not save claim.' });
    }
});

// DELETE /pick/api/claim/:id  { name }
// Releases a claim — but only if the name provided matches who claimed it.
// There's no real auth here (matches the rest of the app's "type your name"
// model), so this is a courtesy check, not a security boundary.
router.delete('/api/claim/:id', async (req, res) => {
    if (!supabase) {
        return res.status(503).json({ error: 'Claim service is not configured.' });
    }

    const { id } = req.params;
    const { name } = req.body ?? {};

    if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Missing name.' });
    }

    try {
        const { data, error } = await supabase
            .from('object_claims')
            .delete()
            .eq('object_id', id)
            .eq('claimed_by', name.trim())
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(403).json({ error: 'You can only release your own claim.' });
        }

        res.json({ ok: true, id });
    } catch (err) {
        console.error('[pick] DELETE /api/claim/:id failed:', err);
        res.status(500).json({ error: 'Could not release claim.' });
    }
});

export default router;