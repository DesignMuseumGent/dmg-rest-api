import negotiate from 'express-negotiate'

export function requestDCAT(app) {
    app.get('/', (req, res) => {
        res.send(
            {
                "@context": [
                    "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/DCAT-AP-VL.jsonld",
                    {
                        "dcterms": "http://purl.org/dc/terms/",
                        "tree": "https://w3id.org/tree#"
                    }],
                "@id": "https://data.designmuseumgent.be/",
                "@type": "Datasetcatalogus",
                "Datasetcatalogus.titel": {
                    "@value": "catalogus Design Museum Gent",
                    "@language": "nl"
                },
                "Datasetcatalogus.heeftLicentie": {
                    "@id": "https://creativecommons.org/publicdomain/zero/1.0/"
                },
                "Datasetcatalogus.heeftUitgever": {
                    "@id": "https://www.wikidata.org/entity/Q1809071",
                    "Agent.naam": {
                        "@value": "Design Museum Gent",
                        "@language": "nl"
                    }
                },
                "Datasetcatalogus.heeftDataset": [
                    {
                        "@id": "https://data.designmuseumgent.be/id/objects/",
                        "@type": "Dataset",
                        "Dataset.titel": {
                            "@value": "dataset met metadata van reeds gepubliceerde items uit de collectie van het Design Museum Gent.",
                            "@language": "nl"
                        }
                    },
                    {
                        "@id": "https://data.designmuseumgent.be/id/exhibitions/",
                        "@type": "Dataset",
                        "Dataset.titel": {
                            "@value": "dataset met metadata rond de tentoonstellingen gerelateerd aan gepubliceerd items uit de collectie van Design Museum Gent.",
                            "@language": "nl"
                        }
                    },
                    {
                        "@id": "https://data.designgent.be/id/agents/",
                        "@type": "Dataset",
                        "Dataset.titel": {
                            "@value": "dataset met metadata rond personen en instellingen (agenten) gerelateerd aan gepubliceerd items uit de collectie van Design Museum Gent",
                            "@language": "nl"
                        }
                    },
                    {
                        "@id": "https://data.designmuseum.be/id/exhibitions/billboardseries",
                        "@type": "Dataset",
                        "Dataset.titel": {
                            "@value": "dataset met metadata rond billboards die in samenwerking met 019 geproduceerd werden op de banner in de Drabstraat aan Design Museum Gent",
                            "@language": "nl"
                        }
                    }
                ]
            }
        )
    })
}
