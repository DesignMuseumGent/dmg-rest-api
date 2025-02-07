
// color API

import {fetchAllLDESrecordsObjects} from "../../utils/parsers.js";
import {colors_dict} from "../../utils/colors_dict.js";

function addImageUri(filteredObjects, object, BASE_URI) {
    if (object["iiif_image_uris"]) {
        object["iiif_image_uris"].forEach(uri => {
            filteredObjects.push({
                "@context": [
                    "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-object/erkendestandaard/2021-04-22/context/cultureel-erfgoed-object-ap.jsonld",
                    {
                        "cidoc": "http://www.cidoc-crm.org/cidco-crm/"
                    }
                ],
                "@id": uri,
                "@type": "E38_Image",
                "cidoc:P1_is_identified_by": uri,
                "cidoc:P138_represents": {
                    "@id": `${BASE_URI}id/${object["objectNumber"]}`,
                    "@type": "E22_Man-Made_Object",
                    "cidoc:P1_is_identified_by": `${BASE_URI}id/object/${object["objectNumber"]}`
                },
            });
        })
    }
}

export function requestByColor(app, BASE_URI) {
    // Returns the dictionary of available colors
    app.get("/v1/colors/", (req, res) => {
        res.status(200).send(colors_dict); // colors_dict should be predefined in your application
    });

    // Fetches objects that match a given color
    app.get("/v1/color-api/:color", async (req, res) => {
        try {
            // Step 1: Fetch all data and prepare inputs
            const objects = await fetchAllLDESrecordsObjects(); // Fetch objects from the database
            const targetColor = req.params.color.toLowerCase(); // Extract target color from the route
            const fuzzy = req.query.fuzzy === "false" ? false : true; // Enable/disable fuzzy matching

            // Pagination parameters
            let { pageNumber = 1, itemsPerPage = 20 } = req.query;
            pageNumber = Math.max(Number(pageNumber), 1); // Ensure positive page numbers
            itemsPerPage = Math.max(Number(itemsPerPage), 1); // Ensure positive items per page

            // Step 2: Filter objects based on matching colors
            const matchingObjects = objects.reduce((result, object) => {
                const colors = object.color_names || [];
                const isColorMatched = colors?.some((color) => {
                    if (Array.isArray(color)) {
                        return color.some((item) => {
                            const lowerItem = item.toLowerCase();
                            return fuzzy ? lowerItem.includes(targetColor) : lowerItem === targetColor;
                        });
                    }
                    return fuzzy ? color.toLowerCase().includes(targetColor) : color.toLowerCase() === targetColor;
                });

                if (isColorMatched) {
                    // Handle object formatting based on query
                    if (req.query.image) {
                        const objectWithImage = addImageUri(result, object, BASE_URI); // Add image if requested
                        if (objectWithImage !== undefined) result.push(objectWithImage);
                    } else {
                        if (object["LDES_raw"] !== undefined) {
                            result.push(object["LDES_raw"]["object"]);
                        }
                    }
                }
                return result;
            }, []);

            // Step 3: Apply pagination
            const totalItems = matchingObjects.length;
            const totalPages = Math.ceil(totalItems / itemsPerPage);
            const page = Math.min(pageNumber, totalPages); // Clamp page number to available pages
            const startIndex = (page - 1) * itemsPerPage;
            const paginatedObjects = totalItems
                ? matchingObjects.slice(startIndex, startIndex + itemsPerPage)
                : [];

            // Step 4: Build and return the response
            res.status(200).send({
                "@context": [
                    "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-event/erkendestandaard/2021-04-22/context/cultureel-erfgoed-event-ap.jsonld",
                    "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-object/erkendestandaard/2021-04-22/context/cultureel-erfgoed-object-ap.jsonld",
                    {
                        "cidoc": "http://www.cidoc-crm.org/cidco-crm/",
                        "hydra": "http://www.w3.org/ns/hydra/context.jsonld",
                    },
                ],
                "@type": "GecureerdeCollectie",
                "@id": `${BASE_URI}color-api/${targetColor}?image=true`,
                "hydra:totalItems": totalItems,
                "hydra:view": {
                    "@id": `${BASE_URI}color-api/${targetColor}?image=true&page=${page}`,
                    "@type": "PartialCollectionView",
                    "hydra:first": `${BASE_URI}color-api/${targetColor}?image=true&page=1`,
                    "hydra:last": `${BASE_URI}color-api/${targetColor}?image=true&page=${totalPages}`,
                    "hydra:previous": page > 1 ? `${BASE_URI}color-api/${targetColor}?image=true&page=${page - 1}` : null,
                    "hydra:next": page < totalPages ? `${BASE_URI}color-api/${targetColor}?image=true&page=${page + 1}` : null,
                },
                "GecureerdeCollectie.curator": "Olivier Van D'huynslager",
                "hydra:description": "curated API that allows agents to query objects from the collection of Design Museum Gent based on various color systems.",
                "GecureerdeCollectie.bestaatUit": paginatedObjects,
            });
        } catch (error) {
            console.error(`Error in requestByColor: ${error.message}`);
            res.status(500).json({ error: "Internal server error." });
        }
    });
}