// color API

import {fetchAllLDESrecordsObjects} from "../../utils/parsers.js";
import {colors_dict} from "../../utils/colors_dict.js";

async function addImageUri(filteredObjects, object, BASE_URI) {
    if (object["iiif_image_uris"]) {
        for (const uri of object["iiif_image_uris"]) {
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
        }
    }
}

export function requestByColor(app, BASE_URI) {

    app.get('/v1/colors/', (req, res) => {
        res.status(200).send(colors_dict)
    })

    app.get('/v1/color-api/:color', async (req, res) => {

        const objects = await fetchAllLDESrecordsObjects();
        const targetColor = req.params.color.toLowerCase();
        const fuzzy = req.query.fuzzy !== "false";

        // pagination
        let { page = 1, itemsPerPage =  20 } = req.query;
        page = Number(page)
        itemsPerPage =  Number(itemsPerPage)


        const colorMatchingPromises = objects.map(async object => {
      const colors = object.color_names || [];
      const isMatchedColor = colors.some(color => {
        if (Array.isArray(color)) {
          return color.some(item => {
            const lowerItem = item.toLowerCase();
            const lowerTarget = targetColor.toLowerCase();
            return fuzzy ? lowerItem.includes(lowerTarget) : lowerItem === lowerTarget;
          });
        }
        return targetColor === color.toLowerCase();
      });

      if (isMatchedColor) {
        if (req.query.image) {
          await addImageUri(matchingObjects, object, BASE_URI);
        } else if (object["LDES_raw"] !== undefined) {
          return object["LDES_raw"];
        }
      }
      return null;
    });

    let matchingObjects = (await Promise.all(colorMatchingPromises)).filter(Boolean);

    // Apply pagination and store result in filteredObjects
    const startIndex = (page - 1) * itemsPerPage;
    const filteredObjects = startIndex < matchingObjects.length
      ? matchingObjects.slice(startIndex, startIndex + itemsPerPage)
      : [];

    // Return INFO HYDRA
    const totalPages = Math.ceil(matchingObjects.length / itemsPerPage);
    const firstPage = 1;
    const lastPage = totalPages;
    const previousPage = page > firstPage ? page - 1 : null;
    const nextPage = page < lastPage ? page + 1 : null;

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
                "@id": `${BASE_URI}color-api/${targetColor}?image=true&page=${page}`,
                "@type": "PartialCollectionView",
                "hydra:first": `${BASE_URI}color-api/${targetColor}?image=true&page=1`,
                "hydra:last": `${BASE_URI}color-api/${targetColor}?image=true&page=${totalPages}`,
                "hydra:previous": previousPage? `${BASE_URI}color-api/${targetColor}?image=true&page=${previousPage}` : null,
                "hydra:next": nextPage? `${BASE_URI}color-api/${targetColor}?image=true&page=${nextPage}` : null,
            },
            "GecureerdeCollectie.curator": "Olivier Van D'huynslager",
            "hydra:description": "curated API that allows agents to query objects from the collection of Design Museum Gent based various color systems.",
            "GecureerdeCollectie.bestaatUit": filteredObjects,
        });
    })
}
