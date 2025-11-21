import { fetchFilteredLDESRecords } from "../../utils/parsers.js";

// context
const COMMON_CONTEXT = [
    "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-object/erkendestandaard/2021-04-22/context/cultureel-erfgoed-object-ap.jsonld",
    "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-event/erkendestandaard/2021-04-22/context/cultureel-erfgoed-event-ap.jsonld",
    "https://data.vlaanderen.be/doc/applicatieprofiel/generiek-basis/zonderstatus/2019-07-01/context/generiek-basis.jsonld",
];

// list that translate Query parameters into the URIs for the licenses. Expand here if new licenses need to be added to the list.
const CC_LICENSES = {
    "CC0": "https://creativecommons.org/publicdomain/zero/1.0/",
    "CC-BY-NC-ND": "https://creativecommons.org/licenses/by-nc-nd/4.0/",
    "CC-BY-SA": "",
    "ALL": "ALL",
    "IC": "http://rightsstatements.org/vocab/InC/1.0/",
};

export function requestObjects(app, BASE_URI) {
    app.get("/v1/id/objects/", async (req, res) => {
        try {

            // HEADERS
            // Set headers
            res.setHeader("Content-type", "application/ld+json");
            res.setHeader("Content-Disposition", "inline");

            // QUERY PARAMETERS
            // Get query parameters
            let {
                pageNumber = 1,
                itemsPerPage = 20,
                license = "ALL",
                fullRecord = true,
                category = "none",
                onDisplay = false,
                hasImages = true,
                colors= true,
            } = req.query;

            // format and constrain query parameters to prevent abuse
            pageNumber = Math.max(Number(pageNumber), 1);
            itemsPerPage = Math.min(Math.max(Number(itemsPerPage), 1), 100);

            const from = (pageNumber - 1) * itemsPerPage;
            const to = pageNumber * itemsPerPage - 1;

            // Fetch filtered and paginated records directly (from SUPABASE)
            const boolOnDisplay = onDisplay === true || onDisplay === "true";
            const boolHasImages = hasImages === true || hasImages === "true";
            const boolColors = colors === true || colors === "true";

            const { data: records, total } = await fetchFilteredLDESRecords({
                from,
                to,
                license: license !== "ALL" ? CC_LICENSES[license] : null,
                category: category !== "none" ? category : null,
                onDisplay: boolOnDisplay,
                hasImages: boolHasImages,
            });

            // return 404 if there is no data for that request.
            if (!records || records.length === 0) {
                return res.status(404).json({ error: "No data found for the requested page." });
            }

            let boolFullRecord = fullRecord === true || fullRecord === "true";
            //console.log(typeof boolFullRecord)

            // Process records into the required structure (if fullRecord is false)
            const filteredObjects = boolFullRecord
                // if fullRecord = True
                ? records.map((record) => {
                    const baseObj = record.object || {};

                    // Flatten arrays to avoid nested lists in JSON-LD
                    const flatHEX = Array.isArray(record.HEX_values)
                        ? record.HEX_values.flat()
                        : [];

                    const flatColorNames = Array.isArray(record.color_names)
                        ? record.color_names.flat()
                        : [];

                    const enriched = { ...baseObj };

                    if (boolColors) {
                        enriched["ex:colors"] = flatHEX;
                        enriched["ex:colorNames"] = flatColorNames;
                    } else {
                        enriched["ex:colors"] = [];
                        enriched["ex:colorNames"] = [];
                    }

                    enriched["ex:onDisplay"] = boolOnDisplay;

                    return enriched;
                })
                // if fullRecord = False
                : records.map((record) => {
                    const flatHEX = Array.isArray(record.HEX_values)
                        ? record.HEX_values.flat()
                        : [];

                    const flatColorNames = Array.isArray(record.color_names)
                        ? record.color_names.flat()
                        : [];

                    const obj = {
                        "@context": COMMON_CONTEXT,
                        "@id": `${BASE_URI}id/object/${record.objectNumber}`,
                        "@type": "MensgemaaktObject",
                        "Object.identificator": [
                            {
                                "@type": "Identificator",
                                "Identificator.identificator": {
                                    "@value": record.objectNumber
                                }
                            }
                        ],
                        "cidoc:P129i_is_subject_of": {
                            "@id": record.iiif_image_uris ? record.iiif_image_uris[0] : "no image",
                            "@type": "http://www.ics.forth.gr/isl/CRMdig/D1_Digital_Object"
                        },

                        "ex:onDisplay": boolOnDisplay,
                        "ex:colors": boolColors ? flatHEX : [],
                        "ex:colorNames": boolColors ? flatColorNames : []
                    };
                    return obj;
                })

            // Compute pagination metadata
            const totalPages = Math.ceil(total / itemsPerPage);

            // Build the response
            // Build hydra navigation URLs that preserve current filters
            const qsBase = new URLSearchParams();
            qsBase.set("fullRecord", String(fullRecord));
            qsBase.set("itemsPerPage", String(itemsPerPage));
            qsBase.set("license", String(license));
            qsBase.set("onDisplay", String(boolOnDisplay));
            qsBase.set("hasImages", String(boolHasImages));
            qsBase.set("colors", String(boolColors));
            const urlForPage = (p) => {
                const qs = new URLSearchParams(qsBase);
                qs.set("pageNumber", String(p));
                return `${BASE_URI}id/objects?${qs.toString()}`;
            };

            res.status(200).json({
                "@context": [
                    ...COMMON_CONTEXT,
                    {
                        hydra: "http://www.w3.org/ns/hydra/context.jsonld",
                        "ex": "http://example.org/",
                        "ex:onDisplay": { "@type": "xsd:boolean" },
                        "ex:colors": { "@container": "@list", "@type": "xsd:string" },
                        "ex:colorNames": { "@container": "@list", "@type": "xsd:string" }
                    }
                ],
                "@type": "GecureerdeCollectie",
                "@id": `${BASE_URI}id/objects?${qsBase.toString()}`,
                "hydra:totalItems": total,
                "hydra:view": {
                    "@id": urlForPage(pageNumber),
                    "@type": "PartialCollectionView",
                    "hydra:first": urlForPage(1),
                    "hydra:last": urlForPage(totalPages),
                    "hydra:previous": pageNumber > 1 ? urlForPage(pageNumber - 1) : null,
                    "hydra:next": pageNumber < totalPages ? urlForPage(pageNumber + 1) : null,
                },
                "GecureerdeCollectie.curator": "Design Museum Gent",
                "GecureerdeCollectie.bestaatUit": filteredObjects,
            });

            // error message
        } catch (err) {
            console.error("Error in requestObjects:", err);
            res.status(500).json({ error: "Internal server error. Please try again later." });
        }
    });
}