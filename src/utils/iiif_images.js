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
 * Build a smaller IIIF derivative URI by rewriting the size segment.
 * `/full/full/0/default.jpg` → `/full/{width},/0/default.jpg`.
 * Returns the original URI unchanged if it doesn't match the IIIF v2 pattern.
 */
export function iiifThumbnail(uri, width = 400) {
    if (typeof uri !== 'string') return null;
    return uri.replace('/full/full/0/default.jpg', `/full/${width},/0/default.jpg`);
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