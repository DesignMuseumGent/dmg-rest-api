import { supabase } from '../../../../supabaseClient.js';
import { applyImagesToObject } from '../../../utils/iiif_images.js'; // adjust path if your layout differs

export function requestColors(app, BASE_URI) {
    const colorsHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json');
        res.setHeader('Content-Disposition', 'inline');

        const onDisplay = req.query.onDisplay === 'true';

        try {
            const [
                { data: baseData, error: baseError },
                { data: cssData, error: cssError },
                { data: swatchData, error: swatchError },
            ] = await Promise.all([
                supabase.rpc('get_base_color_stats', { only_on_display: onDisplay }),
                supabase.rpc('get_css_color_stats', { only_on_display: onDisplay }),
                supabase.rpc('get_color_swatches', { only_on_display: onDisplay }),
            ]);

            if (baseError) {
                console.error('Base color stats error:', baseError.message);
                return res.status(500).json({ error: 'Error fetching base color stats' });
            }

            if (cssError) {
                console.error('CSS color stats error:', cssError.message);
                return res.status(500).json({ error: 'Error fetching CSS color stats' });
            }

            // Swatches are supplementary: if the RPC is missing or fails, the
            // endpoint still serves the same statistics it always has, with
            // hex omitted rather than 500-ing. Deliberately not fatal.
            if (swatchError) {
                console.error('Color swatch error (non-fatal, serving without hex):', swatchError.message);
            }

            // scope|color -> [{ label, hex, object_count, weight }], rank-ordered.
            const swatchIndex = new Map();
            for (const row of swatchData || []) {
                if (!row?.hex) continue;
                const key = `${row.scope}|${row.color}`;
                if (!swatchIndex.has(key)) swatchIndex.set(key, []);
                swatchIndex.get(key).push({
                    ...(row.sublabel ? { label: row.sublabel } : {}),
                    hex: row.hex,
                    object_count: parseInt(row.object_count),
                    weight: parseFloat(row.weight),
                    _rank: parseInt(row.swatch_rank),
                });
            }
            for (const list of swatchIndex.values()) {
                list.sort((a, b) => a._rank - b._rank);
                for (const s of list) delete s._rank;
            }
            const swatchesFor = (scope, color) => swatchIndex.get(`${scope}|${color}`) ?? [];

            const response = {
                '@context': {
                    crm: 'http://www.cidoc-crm.org/cidoc-crm/',
                    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
                    hydra: 'http://www.w3.org/ns/hydra/core#',
                },
                '@id': `${BASE_URI}id/colors`,
                '@type': 'hydra:Collection',
                'rdfs:label': 'Color index',
                'rdfs:comment': 'Color distribution across the Design Museum Gent collection with weighted statistics',
                base_colors: (baseData || []).map((row) => {
                    // A base bucket spans many distinct tones, so a single hex
                    // would misrepresent it. `swatches` carries the constituent
                    // css tones; `hex` is the heaviest of them, for clients that
                    // only want one square of colour.
                    const swatches = swatchesFor('base', row.color);
                    return {
                        value: row.color,
                        hex: swatches[0]?.hex ?? null,
                        swatches,
                        object_count: parseInt(row.object_count),
                        collection_share_pct: parseFloat(row.collection_share_pct),
                        avg_dominance_pct: parseFloat(row.avg_dominance_pct),
                        filter: `${BASE_URI}id/objects?color=${row.color}${onDisplay ? '&onDisplay=true' : ''}`,
                        dominant: `${BASE_URI}id/colors/dominant?color=${encodeURIComponent(row.color)}${onDisplay ? '&onDisplay=true' : ''}`,
                    };
                }),
                css_colors: (cssData || []).map((row) => ({
                    value: row.color,
                    // Weighted centroid of every occurrence of this tone; the
                    // names are Wikipedia/xkcd colour names, not CSS keywords,
                    // so the hex has to come from the data.
                    hex: swatchesFor('css', row.color)[0]?.hex ?? null,
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
                },
                '@id': `${BASE_URI}id/colors/dominant?${filterParam}&limit=${limit}`,
                '@type': 'hydra:Collection',
                'rdfs:label': `Objects most dominant in ${colorLabel}`,
                'hydra:totalItems': (data || []).length,
                'hydra:member': (data || []).map((row) => {
                    const member = {
                        '@id': `${BASE_URI}/id/object/${row.objectNumber}`,
                        '@type': 'crm:E22_Human-Made_Object',
                        'rdfs:label': row.object_title_nl,
                        dominance_pct: parseFloat(row.dominance_pct),
                    };

                    // This object's own hex for the queried colour — the actual
                    // measured tone, not a collection-wide centroid. Only emitted
                    // if the dominance RPC returns it, so this is a no-op until
                    // get_objects_by_*_dominance selects a hex column.
                    if (row.dominant_hex) {
                        member.hex = row.dominant_hex;
                    }

                    // Direct image links — same shape as /id/object/:ObjectPID.
                    // Adds crm:P138i_has_representation (the canonical CIDOC
                    // property) plus a convenience `image` key for clients
                    // that just want a thumbnail.
                    applyImagesToObject(member, row);

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