// color API

import {fetchAllLDESrecordsObjects} from "../utils/parsers.js";
import {colors_dict} from "../utils/colors_dict.js";

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
                }
            });
        })
    }
}

export function requestByColor(app, BASE_URI) {

    app.get('/v1/colors/', (req, res) => {
        res.status(200).send(colors_dict)
    })

    app.get('/v1/color-api/:color', async (req, res) => {

        const objects = await fetchAllLDESrecordsObjects();
        const filteredObjects = [];
        const targetColor = req.params.color.toLowerCase();
        const fuzzy = req.query.fuzzy || true;

        // pagination
        let { pageNumber = 1, itemsPerPage =  20 } = req.query;
        pageNumber = parseInt(pageNumber)
        itemsPerPage = parseInt(itemsPerPage)

        let matchingObjects = [] // first extract the color matching

        for (let object of objects) {
            const colors = object.color_names || [];

            // use Array.prototype.some to stop iterating when match is found.
            const isMatchedColor = colors.some(color=>{
                if (Array.isArray(color)) {
                    return color.some(item => {
                        let lowerItem = item.toLowerCase();
                        let lowerTarget = targetColor.toLowerCase();
                        return fuzzy ? lowerItem.includes(lowerTarget) : lowerItem === lowerTarget;
                    });
                }
                return targetColor === color.toLowerCase();
            })

            if (isMatchedColor) {
                if(req.query.image) {
                    let potentialObject = addImageUri(matchingObjects, object, BASE_URI);
                    if(potentialObject !== undefined) {
                        matchingObjects.push(potentialObject);
                    }
                } else {
                    if(object["LDES_raw"] !== undefined) {
                        matchingObjects.push(object["LDES_raw"]);
                    }
                }
            }
        }

        // apply pagination on matching objects and store result in filteredObjects
        let startIndex = (pageNumber - 1) * itemsPerPage;
        if (startIndex < matchingObjects.length) {
            filteredObjects.push(...matchingObjects.slice(startIndex, startIndex + itemsPerPage));
        }

        // return totalpages.
        let totalPages = Math.ceil(matchingObjects.length / itemsPerPage);
        const firstPage = 1;
        const lastPage = totalPages;
        const previousPage = pageNumber > firstPage ? pageNumber - 1 : null;
        const nextPage = pageNumber < lastPage ? pageNumber + 1 : null;

        res.status(200).send({
            "@context": [
                "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-event/erkendestandaard/2021-04-22/context/cultureel-erfgoed-event-ap.jsonld",
                "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-object/erkendestandaard/2021-04-22/context/cultureel-erfgoed-object-ap.jsonld",
                {
                    "cidoc": "http://www.cidoc-crm.org/cidco-crm/",
                    "hydra": "http://www.w3.org/ns/hydra/context.jsonld"
                }
            ],
            "@type": "GecureerdeCollectie",
            "@id": `${BASE_URI}color-api/${targetColor}?image=true`,
            "hydra:totalItems": matchingObjects.length,
            "hydra:view": {
                "@id": `${BASE_URI}color-api/${targetColor}?image=true&pageNumber=${pageNumber}`,
                "@type": "PartialColletionView",
                "hydra:first": `${BASE_URI}color-api/${targetColor}?image=true&pageNumber=1`,
                "hydra:previous": previousPage? `${BASE_URI}color-api/${targetColor}?image=true&pageNumber=${previousPage}` : null,
                "hydra:next": nextPage? `${BASE_URI}color-api/${targetColor}?image=true&pageNumber=${nextPage}` : null,
                "hydra:last": `${BASE_URI}color-api/${targetColor}?image=true&pageNumber=${totalPages}`,
            },
            "GecureerdeCollectie.curator": "Olivier Van D'huynslager",
            "hydra:description": "curated API that allows agents to query objects from the collection of Design Museum Gent based various color systems.",
            "GecureerdeCollectie.bestaatUit": filteredObjects,
        });
    })
}
