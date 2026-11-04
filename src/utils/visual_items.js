// Shared by routes/object (single) and routes/objects (list, ?fullRecord=true).
// Keep colour / visual-item logic HERE ONLY — two diverging copies caused:
//   - every visual item pointing at the first image's URI
//   - crm:P65_shows_visual_item being an object for one image, an array for several

// Drop repeated nodes (by @id) while keeping order. Nodes without an @id are kept.
export function dedupeById(nodes) {
    const seen = new Set()
    return nodes.filter(n => {
        const id = n?.["@id"]
        if (!id) return true
        if (seen.has(id)) return false
        seen.add(id)
        return true
    })
}

// Safety net for duplicates that originate upstream (json_ld_v2 / exhibition linking).
export function dedupeExhibitions(obj) {
    if (Array.isArray(obj["crm:P12i_was_present_at"])) {
        obj["crm:P12i_was_present_at"] = dedupeById(obj["crm:P12i_was_present_at"])
    }
}

const round2 = (n) => Math.round(n * 100 * 100) / 100

function percentageNode(value) {
    return {
        "crm:P43_has_dimension": {
            "@type": "crm:E54_Dimension",
            "crm:P2_has_type": {
                "@id": "http://vocab.getty.edu/aat/300417476",
                "@type": "crm:E55_Type",
                "rdfs:label": "percentage"
            },
            "crm:P90_has_value": {
                "@value": round2(value),
                "@type": "xsd:decimal"
            },
            "crm:P91_has_unit": {
                "@id": "http://vocab.getty.edu/aat/300417476",
                "rdfs:label": "%"
            }
        }
    }
}

// One crm:E36_Visual_Item per image, each with ITS OWN image URI and palette.
function buildVisualItem(objId, imageIndex, imageColors, iiifImageUri) {
    const n = imageIndex + 1
    const colors = Array.isArray(imageColors) ? imageColors : []

    const baseColorMap = {}
    for (const c of colors) {
        if (!baseColorMap[c.base]) baseColorMap[c.base] = 0
        baseColorMap[c.base] += c.percentage
    }

    return {
        "@id": `${objId}/visual/image/${n}`,
        "@type": "crm:E36_Visual_Item",
        "crm:P2_has_type": {
            "@id": "http://vocab.getty.edu/aat/300264863",
            "@type": "crm:E55_Type",
            "rdfs:label": "digital image"
        },
        ...(iiifImageUri && {
            "crm:P138i_has_representation": {
                "@id": iiifImageUri,
                "@type": "crm:E38_Image"
            }
        }),
        "crm:P56_bears_feature": [
            {
                "@id": `${objId}/visual/image/${n}/colors/hex`,
                "@type": "crm:E26_Physical_Feature",
                "crm:P2_has_type": {
                    "@id": "http://vocab.getty.edu/aat/300056130",
                    "@type": "crm:E55_Type",
                    "rdfs:label": "color"
                },
                "rdfs:comment": "Dominant colors extracted from the digital image as HEX values",
                "crm:P3_has_note": colors.map(c => ({
                    "@type": "crm:E62_String",
                    "rdf:value": c.hex,
                    "rdfs:label": c.css,
                    ...percentageNode(c.percentage)
                }))
            },
            {
                "@id": `${objId}/visual/image/${n}/colors/base`,
                "@type": "crm:E26_Physical_Feature",
                "crm:P2_has_type": {
                    "@id": "http://vocab.getty.edu/aat/300056130",
                    "@type": "crm:E55_Type",
                    "rdfs:label": "color"
                },
                "rdfs:comment": "Dominant base colors grouped and aggregated for indexing",
                "crm:P3_has_note": Object.entries(baseColorMap)
                    .sort((a, b) => b[1] - a[1])
                    .map(([base, pct]) => ({
                        "@type": "crm:E62_String",
                        "rdf:value": base,
                        ...percentageNode(pct)
                    }))
            }
        ]
    }
}

// Adds crm:P65_shows_visual_item (ALWAYS an array) to obj from row.colors.
// colors[i] and iiif_image_uris[i] are assumed to be index-aligned.
export function applyColorVisualItems(obj, row) {
    if (!Array.isArray(row?.["colors"])) return
    const iiifImageUris = row["iiif_image_uris"] ?? []

    const items = row["colors"].map((imageColors, i) =>
        buildVisualItem(obj["@id"], i, imageColors, iiifImageUris[i] ?? null)
    )

    if (items.length > 0) obj["crm:P65_shows_visual_item"] = items
}