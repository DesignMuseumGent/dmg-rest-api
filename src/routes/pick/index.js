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

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { publicLimiter } from '../utils/limiters.js'; // adjust the relative path to match where this file lives
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THUMB_CACHE_DIR = path.join(__dirname, '.thumb-cache');
try {
    await fs.mkdir(THUMB_CACHE_DIR, { recursive: true });
} catch (err) {
    // Non-fatal: thumbnails just won't get disk-cached (each request falls
    // back to fetching live, wrapped in its own try/catch below). This must
    // never be allowed to take the whole app down over a filesystem hiccup.
    console.error('[pick] Could not create thumbnail cache dir — thumbnails will not be disk-cached:', err);
}

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
        '[pick] SUPABASE_URL / SUPABASE_SERVICE_KEY are not set — claiming will be unavailable. ' +
        'Set these as Heroku config vars, or rename these two lines to match whatever your app already uses.',
    );
}

const DMG_OBJECTS_BASE = 'https://data.designmuseumgent.be/v2/id/objects';
const DMG_OBJECT_BASE = 'https://data.designmuseumgent.be/v2/id/object';
const DMG_COLORS_URL = 'https://data.designmuseumgent.be/v2/id/colors';
const POOL_ITEMS_PER_PAGE = 200;

function extractObject(member) {
    const id = member['@id'].split('/').pop();
    const thumbnail =
        member['crm:P138i_has_representation']?.[0]?.thumbnail ??
        member.image?.thumbnail ??
        null;

    // crm:P129i_is_subject_of points at the IIIF manifest for this object.
    // It's usually a single object but be defensive in case it's an array.
    const subjectOf = member['crm:P129i_is_subject_of'];
    const manifestEntry = Array.isArray(subjectOf) ? subjectOf[0] : subjectOf;
    const manifestUrl = manifestEntry?.['@id'] ?? null;

    return {
        id,
        uri: member['@id'],
        label: member['rdfs:label'] ?? id,
        thumbnail,
        manifestUrl,
    };
}

function buildObjectsUrl({ onDisplayOnly, color, itemsPerPage, page }) {
    const params = new URLSearchParams({ fullRecord: 'true', itemsPerPage: String(itemsPerPage) });
    if (onDisplayOnly) params.set('onDisplay', 'true');
    if (color) params.set('color', color);
    if (page) params.set('page', String(page));
    return `${DMG_OBJECTS_BASE}?${params.toString()}`;
}

async function fetchObjectsPage(opts) {
    const res = await fetch(buildObjectsUrl(opts));
    if (!res.ok) {
        throw new Error(`DMG API request failed: ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    return {
        members: (json['hydra:member'] ?? []).map(extractObject),
        totalItems: json['hydra:totalItems'] ?? 0,
    };
}

// Fetches every page of a filter until hydra:totalItems worth of objects
// have actually been collected, instead of trusting that one request with a
// large itemsPerPage returns everything — the API may cap itemsPerPage
// below what we ask for, in which case a single request would silently
// under-report the on-display set. MAX_PAGES is just a safety bound so a
// misbehaving API can't spin this into an unbounded loop.
const MAX_PAGES = 20;

async function fetchAllPages({ onDisplayOnly, color, itemsPerPage }) {
    let page = 1;
    let all = [];
    let totalItems = Infinity;

    while (all.length < totalItems && page <= MAX_PAGES) {
        const result = await fetchObjectsPage({ onDisplayOnly, color, itemsPerPage, page });
        totalItems = result.totalItems;
        if (result.members.length === 0) break; // no more pages, even if totalItems says otherwise
        all = all.concat(result.members);
        page++;
    }

    if (all.length < totalItems) {
        console.warn(
            `[pick] fetchAllPages stopped at ${all.length}/${totalItems} objects (onDisplayOnly=${onDisplayOnly}, color=${color || 'none'}) — hit MAX_PAGES=${MAX_PAGES} or the API returned fewer members than it claimed.`,
        );
    }

    return all;
}

// One cache entry per (mode, color) combination the UI can ask for.
// mode 'onDisplay' -> just the on-display set (optionally colour-filtered).
// mode 'all' -> the on-display set PLUS one random page pulled from the
// whole (optionally colour-filtered) collection, merged into a single list —
// this is the "keep the collection together" pool, not a separate section.
// The random page is re-rolled once per cache cycle (10 min), not on every
// 5s poll, so the grid doesn't reshuffle under someone mid-click.
const poolCache = new Map();
const POOL_CACHE_TTL_MS = 10 * 60 * 1000;

async function getPool({ mode, color }) {
    const key = `${mode}:${color || ''}`;
    const cached = poolCache.get(key);
    if (cached && Date.now() - cached.fetchedAt < POOL_CACHE_TTL_MS) return cached.data;

    // Fully paginated — see fetchAllPages() for why this doesn't just take
    // whatever a single itemsPerPage=200 request happens to return.
    let merged = await fetchAllPages({
        onDisplayOnly: true,
        color,
        itemsPerPage: POOL_ITEMS_PER_PAGE,
    });

    if (mode === 'all') {
        const probe = await fetchObjectsPage({ onDisplayOnly: false, color, itemsPerPage: 1 });
        const totalPages = Math.max(1, Math.ceil(probe.totalItems / POOL_ITEMS_PER_PAGE));
        const randomPage = 1 + Math.floor(Math.random() * totalPages);
        const extra = await fetchObjectsPage({
            onDisplayOnly: false,
            color,
            itemsPerPage: POOL_ITEMS_PER_PAGE,
            page: randomPage,
        });

        const seen = new Set(merged.map((o) => o.id));
        for (const obj of extra.members) {
            if (!seen.has(obj.id)) {
                merged.push(obj);
                seen.add(obj.id);
            }
        }
    }

    poolCache.set(key, { data: merged, fetchedAt: Date.now() });
    return merged;
}

// Per-object lookup, used for claim/thumbnail validation regardless of
// whatever pool/filter combination is currently active in the UI — a claim
// stays valid even if someone flips the colour filter afterwards.
// Assumes GET /v2/id/object/:id?fullRecord=true returns the same JSON-LD
// shape as one hydra:member entry from the collection endpoint; worth a
// quick manual check against your API if this route ever 404s unexpectedly.
const objectCache = new Map();
const OBJECT_CACHE_TTL_MS = 10 * 60 * 1000;

async function getObjectById(id) {
    const cached = objectCache.get(id);
    if (cached && Date.now() - cached.fetchedAt < OBJECT_CACHE_TTL_MS) return cached.data;

    const res = await fetch(`${DMG_OBJECT_BASE}/${encodeURIComponent(id)}?fullRecord=true`);
    if (!res.ok) return null;

    const json = await res.json();
    const obj = extractObject(json);
    objectCache.set(id, { data: obj, fetchedAt: Date.now() });
    return obj;
}

// Base colours (grey, blue, orange, ...) for the filter dropdown. Barely
// changes, so cache it for an hour.
let colorListCache = { data: null, fetchedAt: 0 };
const COLOR_CACHE_TTL_MS = 60 * 60 * 1000;

async function getBaseColors() {
    const isFresh = Date.now() - colorListCache.fetchedAt < COLOR_CACHE_TTL_MS;
    if (colorListCache.data && isFresh) return colorListCache.data;

    const res = await fetch(DMG_COLORS_URL);
    if (!res.ok) {
        throw new Error(`DMG colors request failed: ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    const colors = (json.base_colors ?? []).map((c) => ({ value: c.value, count: c.object_count }));

    colorListCache = { data: colors, fetchedAt: Date.now() };
    return colors;
}

// Tries the object's direct thumbnail first; if that's missing or fails to
// load, falls back to reading the IIIF manifest and pulling an image out of
// the first canvas — either its image service (resized to a thumbnail) or,
// failing that, the raw image resource itself.
async function fetchObjectImage(obj) {
    if (obj.thumbnail) {
        try {
            const res = await fetch(obj.thumbnail);
            if (res.ok) {
                return { buffer: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') || 'image/jpeg' };
            }
        } catch {
            // fall through to manifest
        }
    }

    if (obj.manifestUrl) {
        try {
            const manifestRes = await fetch(obj.manifestUrl);
            if (manifestRes.ok) {
                const manifest = await manifestRes.json();
                const image = manifest?.sequences?.[0]?.canvases?.[0]?.images?.[0];
                const serviceId = image?.resource?.service?.['@id'];

                if (serviceId) {
                    const res = await fetch(`${serviceId}/full/400,/0/default.jpg`);
                    if (res.ok) {
                        return { buffer: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') || 'image/jpeg' };
                    }
                }

                const resourceId = image?.resource?.['@id'];
                if (resourceId) {
                    const res = await fetch(resourceId);
                    if (res.ok) {
                        return { buffer: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') || 'image/jpeg' };
                    }
                }
            }
        } catch {
            // give up, nothing more to try
        }
    }

    return null;
}

// GET /pick/api/thumb/:id
// Proxies the object's image through a local disk cache. First request for
// a given id fetches it (thumbnail, falling back to the IIIF manifest if
// the thumbnail is missing or unreachable) and saves it; every request
// after that, from any viewer, is served straight off disk with a
// long-lived Cache-Control, so the browser caches it too.
router.get('/api/thumb/:id', async (req, res) => {
    const { id } = req.params;
    const cachePath = path.join(THUMB_CACHE_DIR, `${id}.jpg`);

    try {
        const cached = await fs.readFile(cachePath);
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=2592000, immutable'); // 30 days
        return res.send(cached);
    } catch {
        // not cached yet — fall through and fetch it
    }

    try {
        const obj = await getObjectById(id);
        if (!obj) return res.status(404).end();

        const result = await fetchObjectImage(obj);
        if (!result) return res.status(502).end(); // both thumbnail and manifest failed — no cache write, will retry next time

        await fs.writeFile(cachePath, result.buffer); // best-effort; a write race just means one extra fetch

        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
        res.send(result.buffer);
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
            return {
                ...obj,
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