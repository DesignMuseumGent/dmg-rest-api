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
import { publicLimiter } from '../../utils/limiters.js'; // adjust the relative path to match where this file lives
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THUMB_CACHE_DIR = path.join(__dirname, '.thumb-cache');
await fs.mkdir(THUMB_CACHE_DIR, { recursive: true });

const router = express.Router();

// Reuse your existing public-tier limiter so this doesn't need its own
// rate-limit config. Not for CORS/harvester reasons like on v2Router —
// just to stop someone mashing the claim button.
router.use(publicLimiter);

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY // service role key, so RLS doesn't get in the way server-side
);

const DMG_SOURCE_URL =
    'https://data.designmuseumgent.be/v2/id/objects?onDisplay=true&fullRecord=true&itemsPerPage=200';

// Simple in-memory cache for the object list itself (thumbnails/labels don't
// need to be re-fetched from the public API on every click). Claim status is
// always read fresh from Supabase, never from this cache.
let objectListCache = { data: null, fetchedAt: 0 };
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

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

async function getObjectList() {
    const isFresh = Date.now() - objectListCache.fetchedAt < CACHE_TTL_MS;
    if (objectListCache.data && isFresh) return objectListCache.data;

    const res = await fetch(DMG_SOURCE_URL);
    if (!res.ok) {
        throw new Error(`DMG API request failed: ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    const members = json['hydra:member'] ?? [];
    const objects = members.map(extractObject);

    objectListCache = { data: objects, fetchedAt: Date.now() };
    return objects;
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
        const objects = await getObjectList();
        const obj = objects.find((o) => o.id === id);
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

// GET /pick/api/objects
// Returns the object list merged with current claim status.
router.get('/api/objects', async (req, res) => {
    try {
        const [objects, claimsResult] = await Promise.all([
            getObjectList(),
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
    const { id, name } = req.body ?? {};

    if (typeof id !== 'string' || !id.trim()) {
        return res.status(400).json({ error: 'Missing object id.' });
    }
    if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Please enter a name first.' });
    }

    try {
        // Make sure it's a real object from the current list, not an arbitrary id.
        const objects = await getObjectList();
        if (!objects.some((o) => o.id === id)) {
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