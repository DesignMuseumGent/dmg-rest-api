import {fetchAllLostInDiffusion} from "../../utils/parsers.js";

export function requestLostInDiffusion(app, BASE_URI) {
    app.get('/v1/lost-in-diffusion/', async(req, res) => {
        // fetch data
        const diffusedObjects = await fetchAllLostInDiffusion()
        const filteredObjects = []
        let objects = []

        // pagination
        let { pageNumber = 1, itemsPerPage =  20 , type = "all"} = req.query;
        let page = Number(pageNumber)
        itemsPerPage =  Number(itemsPerPage)
        type = String(type)

        // todo: add option to filter between type - translation/genImgDesc/png



        for (let diffusedObject of diffusedObjects) {
            let diffusedObjectType;
            let output;
            switch (diffusedObject["type"]) {
                case "translation":
                    // generated translation
                    diffusedObjectType = "translation";
                    output = {
                        "@language": "en",
                        "@value": diffusedObject["output"]
                    }
                    break
                case "genImgDesc":
                    // generated text (description)
                    diffusedObjectType = "description";
                    output = {
                        "@language": "en",
                        "@value": diffusedObject["output"]
                    }
                    break
                case "png":
                    // image
                    diffusedObjectType = "image"
                    output = {
                        "cidoc:P129i_is_subject_of":
                            {
                                "@id": `https://lost-in-diffusion.s3.eu-west-3.amazonaws.com/${diffusedObject["lid-id"]}.png`,
                                "@type": "http://www.ics.forth.gr/isl/CRMdig/D1_Digital_Object"
                            }
                    }
                    break
                case "obj":
                    // 3D model
                    diffusedObjectType = "3D model"
                    output = {
                        'cidoc:P106_is_composed_of': [
                            {
                                "@type": "crm:D1_Digital_Object",
                                "schema:name": `model for 3D object ${diffusedObject["lid-id"]}`,
                                "schema:contentUrl": `https://lost-in-diffusion.s3.eu-west-3.amazonaws.com/${diffusedObject["lid-id"]}.obj`,
                                "cidoc:P2_has_type": "Point Cloud"
                            },
                            {
                                "@type": "crm:D1_Digital_Object",
                                "schema:name": `texture for 3D object ${diffusedObject["lid-id"]}`,
                                "schema:contentUrl": `https://lost-in-diffusion.s3.eu-west-3.amazonaws.com/${diffusedObject["lid-id"]}.mtl`,
                                "cidoc:P2_has_type": "Texture file"
                            }
                        ]
                    }

                default:
                    // default
                    diffusedObjectType = "unknown"
            }

            let object = {
                "@context": {
                    "prov": "http://www.w3.org/ns/prov#",
                    "schema": "http://schema.org/",
                    "dcterms": "http://purl.org/dc/terms/",
                    "cidoc": "http://www.cidoc-crm.org/cidoc-crm/",
                    "ex": "http://example.org/"
                },
                "@id": `${BASE_URI}lost-in-diffusion/entity/${diffusedObject["lid-id"]}`,
                "@type": "schema:CreativeWork",
                "schema:name": `AI Generated ${diffusedObjectType}`,
                "prov:wasDerivedFrom": `https://data.designmuseum.be/id/object/${diffusedObject["original-id"]}`,
                "prov:generatedAtTime": diffusedObject["created_at"],
                "http://www.w3.org/ns/adms#identifier": diffusedObject["lid-id"],
                output,
            }
            objects.push(object)
        }

        // apply pagination on matching objects and store result in filteredObjects
        let startIndex = (page - 1) * itemsPerPage;
        if (startIndex < diffusedObjects.length) {
            filteredObjects.push(...objects.slice(startIndex, startIndex + itemsPerPage));
        }

        // return INFO HYDRA.
        let totalPages = Math.ceil(diffusedObjects.length / itemsPerPage);
        const firstPage = 1;
        const lastPage = totalPages;
        const previousPage = page > firstPage ? page - 1 : null;
        const nextPage = page < lastPage ? page + 1 : null;



        // model data
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
            "@id": `${BASE_URI}lost-in-diffusion/`,
            "hydra:totalItems": diffusedObjects.length,
            "hydra:view": {
                "@id": `${BASE_URI}lost-in-diffusion?page=${page}`,
                "@type": "PartialCollectionView",
                "hydra:first": `${BASE_URI}lost-in-diffusion?page=1`,
                "hydra:last": `${BASE_URI}lost-in-diffusion?page=${totalPages}`,
                "hydra:previous": previousPage? `${BASE_URI}lost-in-diffusion?page=${previousPage}` : null,
                "hydra:next": nextPage? `${BASE_URI}lost-in-diffusion?page=${nextPage}` : null,
            },
            "GecureerdeCollectie.curator": "Olivier Van D'huynslager, Kasper Jordaens",
            "hydra:description": "curated API returning results from the Lost in Diffusion collection of Design Museum Gent.",
            "GecureerdeCollectie.bestaatUit": filteredObjects,
        })

    })
}