// scripts/copy-images-to-supabase.js
//
// Copies every on-display object's image from the DMG API into Supabase
// Storage, skipping any that are already there. Self-contained — no
// dependency on the rest of the app, just env vars.
//
// Run:
//   node scripts/copy-images-to-supabase.js
//   heroku run node scripts/copy-images-to-supabase.js   (avoids local proxy/TLS issues)
//
// Requires: SUPABASE_URL, SUPABASE_KEY (rename below if yours differ)
// Optional: SUPABASE_THUMB_BUCKET (defaults to "object-thumbnails")

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const BUCKET = process.env.SUPABASE_THUMB_BUCKET || 'object-thumbnails';

const DMG_OBJECTS_URL = 'https://data.designmuseumgent.be/v2/id/objects';
const ITEMS_PER_PAGE = 200;
const DELAY_MS = 150; // polite pacing between requests

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[copy-images] SUPABASE_URL / SUPABASE_KEY are not set. Aborting.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetches every on-display object, paginating until hydra:totalItems worth
// have been collected (the API may cap itemsPerPage below what's asked for).
async function fetchAllOnDisplayObjects() {
    let page = 1;
    let all = [];
    let totalItems = Infinity;

    while (all.length < totalItems && page <= 20) {
        const url = `${DMG_OBJECTS_URL}?onDisplay=true&fullRecord=true&itemsPerPage=${ITEMS_PER_PAGE}&page=${page}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`DMG API request failed: ${res.status} ${res.statusText}`);
        const json = await res.json();

        totalItems = json['hydra:totalItems'] ?? 0;
        const members = json['hydra:member'] ?? [];
        if (members.length === 0) break;

        all = all.concat(members);
        page++;
    }

    return all;
}

function extractId(member) {
    return member['@id'].split('/').pop();
}

function extractThumbnail(member) {
    return member['crm:P138i_has_representation']?.[0]?.thumbnail ?? member.image?.thumbnail ?? null;
}

function extractManifestUrl(member) {
    const subjectOf = member['crm:P129i_is_subject_of'];
    const entry = Array.isArray(subjectOf) ? subjectOf[0] : subjectOf;
    return entry?.['@id'] ?? null;
}

// Tries the direct thumbnail first, falls back to the IIIF manifest if
// that's missing or fails (mirrors the live app's fallback logic).
async function fetchImageBytes({ thumbnail, manifestUrl }) {
    if (thumbnail) {
        try {
            const res = await fetch(thumbnail);
            if (res.ok) return { buffer: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') || 'image/jpeg' };
        } catch {
            // fall through to manifest
        }
    }

    if (manifestUrl) {
        try {
            const res = await fetch(manifestUrl);
            if (res.ok) {
                const manifest = await res.json();
                const image = manifest?.sequences?.[0]?.canvases?.[0]?.images?.[0];
                const serviceId = image?.resource?.service?.['@id'];
                const resourceId = image?.resource?.['@id'];
                const imgUrl = serviceId ? `${serviceId}/full/400,/0/default.jpg` : resourceId;

                if (imgUrl) {
                    const imgRes = await fetch(imgUrl);
                    if (imgRes.ok) {
                        return { buffer: Buffer.from(await imgRes.arrayBuffer()), contentType: imgRes.headers.get('content-type') || 'image/jpeg' };
                    }
                }
            }
        } catch {
            // give up
        }
    }

    return null;
}

async function alreadyInStorage(storagePath) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    try {
        const res = await fetch(data.publicUrl, { method: 'HEAD' });
        return res.ok;
    } catch {
        return false;
    }
}

async function main() {
    console.log('[copy-images] Fetching on-display object list...');
    const objects = await fetchAllOnDisplayObjects();
    const total = objects.length;
    console.log(`[copy-images] ${total} objects found. Bucket: "${BUCKET}"`);

    let copied = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < total; i++) {
        const member = objects[i];
        const id = extractId(member);
        const n = i + 1;
        const storagePath = `${id}.jpg`;

        try {
            if (await alreadyInStorage(storagePath)) {
                skipped++;
                console.log(`[copy-images] ${n}/${total} skip (already in Supabase) — ${id}`);
                continue;
            }

            const image = await fetchImageBytes({
                thumbnail: extractThumbnail(member),
                manifestUrl: extractManifestUrl(member),
            });

            if (!image) {
                failed++;
                console.warn(`[copy-images] ${n}/${total} FAILED (no image found) — ${id}`);
                continue;
            }

            const { error } = await supabase.storage.from(BUCKET).upload(storagePath, image.buffer, {
                contentType: image.contentType,
                cacheControl: '2592000', // 30 days
                upsert: true,
            });

            if (error) {
                failed++;
                console.error(`[copy-images] ${n}/${total} FAILED (upload error) — ${id}:`, error.message);
                continue;
            }

            copied++;
            console.log(`[copy-images] ${n}/${total} copied — ${id}`);
        } catch (err) {
            failed++;
            console.error(`[copy-images] ${n}/${total} ERROR — ${id}:`, err.message);
        }

        if (n < total) await sleep(DELAY_MS);
    }

    console.log(`[copy-images] Done. ${copied} copied, ${skipped} already there, ${failed} failed — out of ${total} total.`);
    if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
    console.error('[copy-images] Fatal error:', err);
    process.exitCode = 1;
});