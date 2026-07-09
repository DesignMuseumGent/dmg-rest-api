// lib.js
//
// Shared DMG-API-fetching and thumbnail-caching logic, used by both
// index.js (the Express router) and scripts/warm-thumbnail-cache.js (the
// bulk cache warm-up script). Kept separate from index.js so the script
// doesn't have to import a file that also sets up an Express Router and
// rate limiter as a side effect.

const DMG_OBJECTS_BASE = 'https://data.designmuseumgent.be/v2/id/objects';
const DMG_OBJECT_BASE = 'https://data.designmuseumgent.be/v2/id/object';
const DMG_COLORS_URL = 'https://data.designmuseumgent.be/v2/id/colors';
const POOL_ITEMS_PER_PAGE = 200;

// Supabase Storage bucket that holds cached object thumbnails. Must exist
// already and be set to Public (create it once via the Supabase dashboard —
// Storage → New bucket); nothing in this app creates the bucket itself.
export const THUMB_BUCKET = process.env.SUPABASE_THUMB_BUCKET || 'object-thumbnails';

export function extractObject(member) {
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

export async function fetchObjectsPage(opts) {
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

export async function fetchAllPages({ onDisplayOnly, color, itemsPerPage }) {
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

export async function getPool({ mode, color }) {
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

export async function getObjectById(id) {
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

export async function getBaseColors() {
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
export async function fetchObjectImage(obj) {
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

// Checks whether the object's image already exists in Supabase Storage; if
// not, fetches it (thumbnail, falling back to the IIIF manifest) and
// uploads it there. Returns { url, alreadyCached } either way — the caller
// (route or warm-up script) decides what to log/do with alreadyCached.
// Storage is the persistent cache here — deliberately not the local
// filesystem, since Heroku's dyno filesystem is wiped on every
// restart/deploy, which would otherwise silently defeat any on-disk cache.
// `supabase` is passed in rather than imported, so this works the same way
// whether it's called from the Express router or a standalone script.
export async function getThumbnailPublicUrl(obj, supabase) {
    if (!supabase) return null;

    const storagePath = `${obj.id}.jpg`;
    const { data: publicUrlData } = supabase.storage.from(THUMB_BUCKET).getPublicUrl(storagePath);
    const publicUrl = publicUrlData.publicUrl;

    try {
        const headRes = await fetch(publicUrl, { method: 'HEAD' });
        if (headRes.ok) return { url: publicUrl, alreadyCached: true };
    } catch {
        // fall through and (re)generate
    }

    const image = await fetchObjectImage(obj);
    if (!image) return null;

    const { error } = await supabase.storage.from(THUMB_BUCKET).upload(storagePath, image.buffer, {
        contentType: image.contentType,
        cacheControl: '2592000', // 30 days, in seconds — sets the Cache-Control header Supabase serves
        upsert: true,
    });

    if (error) {
        console.error('[pick] Supabase Storage upload failed:', error);
        return null;
    }

    return { url: publicUrl, alreadyCached: false };
}