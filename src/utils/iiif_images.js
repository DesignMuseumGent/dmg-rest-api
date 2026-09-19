/**
 * Shared helpers for exposing IIIF images in API responses.
 *
 * The DMG API stores images in three aligned arrays on each row:
 *   - iiif_image_uris  : string[]                full-resolution IIIF URIs
 *   - CC_Licenses      : string[] | string       rights statements per image,
 *                         OR a single status string ("PERMISSION DENIED",
 *                         "TIMEOUT", "FAILED") when validation found no
 *                         working images
 *   - attributions     : string[]                per-image attribution strings
 *
 * The arrays are index-aligned (kept that way by the Python validation
 * pipeline). When CC_Licenses is a status string, treat the row as having
 * no images.
 *
 * Response shape (used by both /id/colors/dominant and /id/object/:ObjectPID):
 *   - "crm:P138i_has_representation" : array of crm:E38_Image blocks —
 *                                       the canonical CIDOC property,
 *                                       always an array (even with 1 image),
 *                                       in canvas order.
 *   - "image"                         : the first image, repeated as a
 *                                       convenience key for clients that
 *                                       just want a thumbnail. NOT a CIDOC
 *                                       property — purely a DX shortcut.
 */

/**
 * ── THUMBNAIL SIZES DIFFER BY HOST ──────────────────────────────────────
 *
 * Requesting an unsupported size returns HTTP 400 "Invalid size requested" —
 * a broken image in every client, with no fallback. Two hosts serve this
 * collection and they do not accept the same size strings.
 *
 * beeldbank-temp.stad.gent declares "profile": "level0" in its info.json and
 * advertises five named sizes:
 *
 *     lpr 2000x1333 · scr 1200x800 · pre 810x540 · thm 200x133 · col 100x67
 *
 * Measured against that host (image 18005, 2026-09-19):
 *
 *     thm         200 OK
 *     full        200 OK
 *     max         200 OK
 *     2000,1333   200 OK   (matches the advertised lpr size exactly)
 *     400,        400      <- what this file used to send
 *     pre         400      <- advertised, but NOT accepted as a size string
 *     col         400      <- same
 *
 * So arbitrary widths are not supported there at all, and the advertised ids
 * are not uniformly usable either. `thm` is the only working small
 * derivative.
 *
 * WHEN ADDING A HOST: measure it. Do not infer from info.json — `pre` and
 * `col` above are advertised by the server itself and both fail.
 *
 *     for s in thm pre col max full '400,' '!400,400'; do
 *       printf '%-12s %s\n' "$s" \
 *         "$(curl -s -o /dev/null -w '%{http_code}' \
 *            "https://HOST/iiif/image/ID/full/$s/0/default.jpg")"
 *     done
 */
const HOST_THUMB_SIZE = {
    // Fixed named size. NOTE: 200px wide, not 400 — anything documenting the
    // thumbnail field as "400px wide" is wrong for this host.
    'beeldbank-temp.stad.gent': () => 'thm',
}

// api.collectie.gent and anything unmeasured: IIIF-standard width request.
const DEFAULT_THUMB_SIZE = (width) => `${width},`

/**
 * Build a smaller IIIF derivative URI by rewriting the size segment.
 *
 * Rewrites by PATH POSITION rather than by matching a known suffix. A IIIF
 * Image API path is
 *     /{prefix}/{identifier}/{region}/{size}/{rotation}/{quality}.{format}
 * so the size is always the third segment from the end, whatever the prefix
 * or identifier look like. The previous version matched the literal strings
 * '/full/max/0/default.jpg' and '/full/full/0/default.jpg', which silently
 * returned the original URI for any other rotation, quality or format — and
 * those pass validation, so the failure only appears in the client.
 *
 * Returns the original URI unchanged if it is not a parseable URL or does
 * not have that shape.
 */
export function iiifThumbnail(uri, width = 400) {
    if (typeof uri !== 'string') return null;

    let u;
    try {
        u = new URL(uri);
    } catch {
        return uri;
    }

    const parts = u.pathname.split('/');
    if (parts.length < 5) return uri;

    const sizeFor = HOST_THUMB_SIZE[u.hostname] || DEFAULT_THUMB_SIZE;
    parts[parts.length - 3] = sizeFor(width);   // region / SIZE / rotation / quality.fmt
    u.pathname = parts.join('/');

    return u.toString();
}

/**
 * Build a single CIDOC-CRM `crm:E38_Image` block.
 * Returns null when uri is missing.
 */
export function buildImageBlock(uri, license, attribution) {
    if (!uri) return null;
    const block = {
        '@id': uri,
        '@type': 'crm:E38_Image',
    };
    const thumb = iiifThumbnail(uri, 400);
    if (thumb && thumb !== uri) block.thumbnail = thumb;
    if (attribution) block['crm:P3_has_note'] = attribution;
    if (license && typeof license === 'string') {
        block['crm:P104_is_subject_to'] = {
            '@id': license,
            '@type': 'crm:E30_Right',
        };
    }
    return block;
}

/**
 * Given a row containing iiif_image_uris[], CC_Licenses[], attributions[],
 * return { primary, all } — the first image and the full array as
 * crm:E38_Image blocks.
 *
 * Returns { primary: null, all: [] } when the row has no validated images
 * (empty array, missing column, or CC_Licenses is a status string).
 */
export function buildImageRepresentations(row) {
    const uris = Array.isArray(row?.iiif_image_uris) ? row.iiif_image_uris : [];
    const licenses = Array.isArray(row?.CC_Licenses) ? row.CC_Licenses : [];
    const attributions = Array.isArray(row?.attributions) ? row.attributions : [];

    if (uris.length === 0) return { primary: null, all: [] };

    const all = uris
        .map((uri, i) => buildImageBlock(uri, licenses[i] ?? null, attributions[i] ?? null))
        .filter(Boolean);

    return { primary: all[0] ?? null, all };
}

/**
 * Apply the image fields to a target object in-place. Used by both endpoints
 * so the shape stays in sync.
 *
 * Writes:
 *   target["crm:P138i_has_representation"] = array of E38_Image blocks
 *   target["image"]                         = the first one (convenience)
 *
 * No-op when the row has no validated images.
 */
export function applyImagesToObject(target, row) {
    const { primary, all } = buildImageRepresentations(row);
    if (all.length > 0) {
        target['crm:P138i_has_representation'] = all;
    }
    if (primary) {
        target['image'] = primary;
    }
}