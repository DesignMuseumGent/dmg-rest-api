import { supabase } from '../../../../supabaseClient.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a smaller IIIF derivative URI from a full-resolution one.
 * Rewrites `/full/full/0/default.jpg` → `/full/{width},/0/default.jpg`.
 * Returns the original URI unchanged if it doesn't match the IIIF v2 pattern.
 */
function iiifThumbnail(uri, width = 400) {
    if (typeof uri !== 'string') return null;
    return uri.replace('/full/full/0/default.jpg', `/full/${width},/0/default.jpg`);
}

/**
 * Build a CIDOC-CRM `crm:E38_Image` block from a stored IIIF image URI,
 * its rights statement and its attribution.
 *
 * Shape:
 *   {
 *     "@id":  "<image URI>",
 *     "@type": "crm:E38_Image",
 *     "thumbnail": "<400px-wide IIIF derivative>",
 *     "crm:P3_has_note": "<attribution>",
 *     "crm:P104_is_subject_to": {
 *       "@id": "<rights statement URI>",
 *       "@type": "crm:E30_Right"
 *     }
 *   }
 */
function buildImageBlock(uri, license, attribution) {
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
 * Given the three aligned arrays the validator writes
 * (iiif_image_uris[], CC_Licenses[], attributions[]),
 * return { primary, all }: the first working image and the full array.
 *
 * CC_Licenses can also be a *status string* like "PERMISSION DENIED" for
 * objects where every image failed validation — we treat that as "no images".
 */
function buildImageRepresentations(row) {
    const uris = Array.isArray(row.iiif_image_uris) ? row.iiif_image_uris : [];
    const licenses = Array.isArray(row.CC_Licenses) ? row.CC_Licenses : [];
    const attributions = Array.isArray(row.attributions) ? row.attributions : [];

    if (uris.length === 0) return { primary: null, all: [] };

    const all = uris
        .map((uri, i) => buildImageBlock(uri, licenses[i] ?? null, attributions[i] ?? null))
        .filter(Boolean);

    return { primary: all[0] ?? null, all };
}


// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function requestColors(app, BASE_URI) {
    const colorsHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json');
        res.setHeader('Content-Disposition', 'inline');

        const onDisplay = req.query.onDisplay === 'true';

        try {
            const [
                { data: baseData, error: baseError },
                { data: cssData, error: cssError },
            ] = await Promise.all([
                supabase.rpc('get_base_color_stats', { only_on_display: onDisplay }),
                supabase.rpc('get_css_color_stats', { only_on_display: onDisplay }),
            ]);

            if (baseError) {
                console.error('Base color stats error:', baseError.message);
                return res.status(500).json({ error: 'Error fetching base color stats' });
            }

            if (cssError) {
                console.error('CSS color stats error:', cssError.message);
                return res.status(500).json({ error: 'Error fetching CSS color stats' });
            }

            const response = {
                '@context': {
                    crm: 'http://www.cidoc-crm.org/cidoc-crm/',
                    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
                    hydra: 'http://www.w3.org/ns/hydra/core#',
                    // Convenience aliases so clients can use short keys and still
                    // resolve to proper CIDOC predicates.
                    image: { '@id': 'crm:P138i_has_representation', '@type': '@id' },
                    images: { '@id': 'crm:P138i_has_representation', '@type': '@id', '@container': '@list' },
                    thumbnail: { '@id': 'http://iiif.io/api/presentation/2#thumbnail', '@type': '@id' },
                },
                '@id': `${BASE_URI}id/colors`,
                '@type': 'hydra:Collection',
                'rdfs:label': 'Color index',
                'rdfs:comment': 'Color distribution across the Design Museum Gent collection with weighted statistics',
                base_colors: (baseData || []).map((row) => ({
                    value: row.color,
                    object_count: parseInt(row.object_count),
                    collection_share_pct: parseFloat(row.collection_share_pct),
                    avg_dominance_pct: parseFloat(row.avg_dominance_pct),
                    filter: `${BASE_URI}id/objects?color=${row.color}${onDisplay ? '&onDisplay=true' : ''}`,
                    dominant: `${BASE_URI}id/colors/dominant?color=${encodeURIComponent(row.color)}${onDisplay ? '&onDisplay=true' : ''}`,
                })),
                css_colors: (cssData || []).map((row) => ({
                    value: row.color,
                    object_count: parseInt(row.object_count),
                    collection_share_pct: parseFloat(row.collection_share_pct),
                    avg_dominance_pct: parseFloat(row.avg_dominance_pct),
                    filter: `${BASE_URI}id/objects?cssColor=${encodeURIComponent(row.color)}${onDisplay ? '&onDisplay=true' : ''}`,
                    dominant: `${BASE_URI}id/colors/dominant?cssColor=${encodeURIComponent(row.color)}${onDisplay ? '&onDisplay=true' : ''}`,
                })),
            };

            return res.status(200).json(response);
        } catch (error) {
            console.error('Error handling colors request:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    };

    // -----------------------------------------------------------------------
    // /id/colors/dominant  — objects with the highest share of a given color
    // -----------------------------------------------------------------------
    const dominantHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json');
        res.setHeader('Content-Disposition', 'inline');

        try {
            const limit = Math.min(parseInt(req.query.limit) || 20, 100);
            const baseColor = req.query.color ?? null;
            const cssColor = req.query.cssColor ?? null;

            if (!baseColor && !cssColor) {
                return res.status(400).json({ error: 'Provide either ?color= or ?cssColor=' });
            }

            let data, error;

            if (baseColor) {
                ({ data, error } = await supabase.rpc('get_objects_by_color_dominance', {
                    target_color: baseColor,
                    result_limit: limit,
                }));
            } else {
                ({ data, error } = await supabase.rpc('get_objects_by_css_color_dominance', {
                    target_color: cssColor,
                    result_limit: limit,
                }));
            }

            if (error) {
                console.error('Dominant color error:', error.message);
                return res.status(500).json({ error: 'Error fetching dominant color objects' });
            }

            const colorLabel = baseColor ?? cssColor;
            const filterParam = baseColor
                ? `color=${encodeURIComponent(baseColor)}`
                : `cssColor=${encodeURIComponent(cssColor)}`;

            return res.status(200).json({
                '@context': {
                    crm: 'http://www.cidoc-crm.org/cidoc-crm/',
                    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
                    hydra: 'http://www.w3.org/ns/hydra/core#',
                    image: { '@id': 'crm:P138i_has_representation', '@type': '@id' },
                    images: { '@id': 'crm:P138i_has_representation', '@type': '@id', '@container': '@list' },
                    thumbnail: { '@id': 'http://iiif.io/api/presentation/2#thumbnail', '@type': '@id' },
                },
                '@id': `${BASE_URI}id/colors/dominant?${filterParam}&limit=${limit}`,
                '@type': 'hydra:Collection',
                'rdfs:label': `Objects most dominant in ${colorLabel}`,
                'hydra:totalItems': (data || []).length,
                'hydra:member': (data || []).map((row) => {
                    const { primary, all } = buildImageRepresentations(row);

                    const member = {
                        '@id': `${BASE_URI}id/object/${row.objectNumber}`,
                        '@type': 'crm:E22_Human-Made_Object',
                        'rdfs:label': row.object_title_nl,
                        dominance_pct: parseFloat(row.dominance_pct),
                    };

                    // Direct image links — primary for fast path, full list for completeness.
                    if (primary) member.image = primary;
                    if (all.length > 0) member.images = all;

                    // Keep the manifest reference as the canonical IIIF entry point.
                    if (row.iiif_manifest) {
                        member['crm:P129i_is_subject_of'] = {
                            '@id': row.iiif_manifest,
                            '@type': 'crm:E73_Information_Object',
                        };
                    }

                    return member;
                }),
            });
        } catch (error) {
            console.error('Error handling dominant color request:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    };

    app.get('/id/colors', colorsHandler);
    app.get('/id/colors/dominant', dominantHandler);
}