// routes/sprites.js — public sprite endpoints for dmg-rest-api
//
// The set query is the important one. A per-object route is obvious, but what a
// game developer actually needs is "give me 16 sprites for a room" — that turns
// the collection into a level generator rather than an asset dump.

import express from 'express';

const router = express.Router();

const MAX_LIMIT = 64;
const SIZES = [16, 32, 48, 64];

// STATUS = 'HEALTHY' is a hard SQL-side filter with no opt-out, same as
// everywhere else on the public API. Unreviewed sprites are never served.
const PUBLIC = (q) => q.eq('status', 'HEALTHY');

function shape(row, req) {
    const base = `${req.protocol}://${req.get('host')}`;
    return {
        '@id': `${base}/v2/id/sprite/${encodeURIComponent(row.object_ref)}/${row.size}`,
        object: `${base}/v2/id/object/${encodeURIComponent(row.object_ref)}`,
        size: [row.size, row.size],
        palette: row.palette,
        grid: row.grid,
        png: `${base}/v2/sprite/${encodeURIComponent(row.object_ref)}/${row.size}.png`,
        colors: row.n_colors,
    };
}

// Deterministic shuffle so ?seed= reproduces the same room every time — a game
// needs a level it can regenerate, not a fresh random one on each reload.
function seededShuffle(arr, seed) {
    let s = 0;
    for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
        s = (s * 1664525 + 1013904223) >>> 0;
        const j = s % (i + 1);
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/**
 * GET /v2/sprites?size=32&limit=16&seed=abc&type=stoel&color=brown
 * The room-generator endpoint.
 */
router.get('/sprites', async (req, res, next) => {
    try {
        const size = SIZES.includes(Number(req.query.size)) ? Number(req.query.size) : 32;
        const limit = Math.min(Number(req.query.limit) || 16, MAX_LIMIT);
        const { seed, type, color } = req.query;

        let q = req.supabase
            .from('dmg_sprites')
            .select('object_ref,size,palette,grid,n_colors,dmg_objects_LDES!inner(objectName,colors)')
            .eq('size', size);
        q = PUBLIC(q);

        if (type) q = q.ilike('dmg_objects_LDES.objectName', `%${type}%`);
        if (color) q = q.ilike('dmg_objects_LDES.colors::text', `%${color}%`);

        // Overfetch, then shuffle — gives variety without an expensive random sort.
        const { data, error } = await q.limit(limit * 8);
        if (error) throw error;

        const picked = (seed ? seededShuffle(data, seed) : data.sort(() => Math.random() - 0.5))
            .slice(0, limit);

        res.json({
            '@context': 'https://data.designmuseumgent.be/v2/context.jsonld',
            type: 'SpriteSet',
            size, seed: seed ?? null,
            total: picked.length,
            sprites: picked.map((r) => shape(r, req)),
            license: 'See per-object rights statement on the linked object resource.',
        });
    } catch (err) { next(err); }
});

/** GET /v2/id/sprite/:objectNumber/:size — single sprite as data */
router.get('/id/sprite/:objectNumber/:size', async (req, res, next) => {
    try {
        const size = Number(req.params.size);
        if (!SIZES.includes(size)) return res.status(400).json({ error: 'bad size' });

        let q = req.supabase.from('dmg_sprites')
            .select('object_ref,size,palette,grid,n_colors')
            .eq('object_ref', req.params.objectNumber).eq('size', size);
        const { data, error } = await PUBLIC(q).limit(1);
        if (error) throw error;
        if (!data.length) return res.status(404).json({ error: 'no sprite for this object' });

        res.json(shape(data[0], req));
    } catch (err) { next(err); }
});

/**
 * GET /v2/sprite/:objectNumber/:size.png?scale=8
 * Rendered from the stored grid, not from Storage — so a palette correction
 * takes effect immediately without regenerating any asset.
 */
router.get('/sprite/:objectNumber/:sizePng', async (req, res, next) => {
    try {
        const size = Number(String(req.params.sizePng).replace(/\.png$/, ''));
        if (!SIZES.includes(size)) return res.status(400).json({ error: 'bad size' });
        const scale = Math.min(Math.max(Number(req.query.scale) || 1, 1), 16);

        let q = req.supabase.from('dmg_sprites')
            .select('palette,grid,size')
            .eq('object_ref', req.params.objectNumber).eq('size', size);
        const { data, error } = await PUBLIC(q).limit(1);
        if (error) throw error;
        if (!data.length) return res.status(404).end();

        const { PNG } = await import('pngjs');
        const { palette, grid } = data[0];
        const png = new PNG({ width: size * scale, height: size * scale });

        const rgb = palette.map((c) => (c === 'transparent' ? null : [
            parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16),
        ]));

        for (let y = 0; y < size * scale; y++) {
            for (let x = 0; x < size * scale; x++) {
                const v = parseInt(grid[Math.floor(y / scale) * size + Math.floor(x / scale)], 16);
                const i = (y * size * scale + x) << 2;
                const c = rgb[v];
                if (c) { png.data[i] = c[0]; png.data[i + 1] = c[1]; png.data[i + 2] = c[2]; png.data[i + 3] = 255; }
                else { png.data[i + 3] = 0; }
            }
        }

        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'public, max-age=86400');
        PNG.sync.write(png).pipe ? res.end(PNG.sync.write(png)) : res.end(PNG.sync.write(png));
    } catch (err) { next(err); }
});

export default router;