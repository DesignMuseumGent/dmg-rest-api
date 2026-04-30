export function requestDCAT(app, BASE_URI) {
    const dcatHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json');
        res.setHeader('Content-Disposition', 'inline');

        const dcat = {
            "@context": {
                "dcat": "http://www.w3.org/ns/dcat#",
                "dct": "http://purl.org/dc/terms/",
                "foaf": "http://xmlns.com/foaf/0.1/",
                "owl": "https://www.w3.org/2002/07/owl#",
                "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
                "xsd": "http://www.w3.org/2001/XMLSchema#",
                "hydra": "http://www.w3.org/ns/hydra/core#",
                "crm": "http://www.cidoc-crm.org/cidoc-crm/"
            },
            "@id": `${BASE_URI}`,
            "@type": "dcat:Catalog",
            "dct:title": [
                { "@value": "Design Museum Gent — Collectie API v2", "@language": "nl" },
                { "@value": "Design Museum Gent — Collection API v2", "@language": "en" },
                { "@value": "Design Museum Gent — API Collection v2", "@language": "fr" }
            ],
            "dct:description": [
                { "@value": "CIDOC-CRM conforme JSON-LD API die toegang biedt tot de collectie van Design Museum Gent, inclusief objecten, agenten, tentoonstellingen en thesaurustermen.", "@language": "nl" },
                { "@value": "CIDOC-CRM compliant JSON-LD API providing access to the collection of Design Museum Gent, including objects, agents, exhibitions and thesaurus concepts.", "@language": "en" },
                { "@value": "API JSON-LD conforme au CIDOC-CRM donnant accès à la collection du Design Museum Gent, incluant objets, agents, expositions et termes du thésaurus.", "@language": "fr" }
            ],
            "dct:publisher": {
                "@id": "http://www.wikidata.org/entity/Q1809071",
                "@type": "foaf:Organization",
                "foaf:name": "Design Museum Gent",
                "foaf:homepage": { "@id": "https://www.designmuseumgent.be" }
            },
            "dct:license": {
                "@id": "https://creativecommons.org/licenses/by/4.0/"
            },
            "dct:language": [
                { "@id": "http://publications.europa.eu/resource/authority/language/NLD" },
                { "@id": "http://publications.europa.eu/resource/authority/language/ENG" },
                { "@id": "http://publications.europa.eu/resource/authority/language/FRA" }
            ],
            "dct:conformsTo": {
                "@id": "http://www.cidoc-crm.org/cidoc-crm/",
                "rdfs:label": "CIDOC-CRM"
            },
            "foaf:homepage": { "@id": "https://data.designmuseumgent.be" },
            "dcat:dataset": [
                {
                    "@id": `${BASE_URI}/id/objects`,
                    "@type": "dcat:Dataset",
                    "dct:title": [
                        { "@value": "Objecten", "@language": "nl" },
                        { "@value": "Objects", "@language": "en" },
                        { "@value": "Objets", "@language": "fr" }
                    ],
                    "dct:description": [
                        { "@value": "Alle gepubliceerde objecten uit de collectie van Design Museum Gent.", "@language": "nl" },
                        { "@value": "All published objects from the Design Museum Gent collection.", "@language": "en" },
                        { "@value": "Tous les objets publiés de la collection du Design Museum Gent.", "@language": "fr" }
                    ],
                    "dct:type": {
                        "@id": "http://www.cidoc-crm.org/cidoc-crm/E22_Human-Made_Object"
                    },
                    "dcat:distribution": [
                        {
                            "@type": "dcat:Distribution",
                            "dct:format": "application/ld+json",
                            "dcat:accessURL": { "@id": `${BASE_URI}/id/objects` },
                            "dcat:mediaType": "application/ld+json",
                            "rdfs:label": "Paginated JSON-LD collection"
                        }
                    ],
                    "dcat:endpointURL": { "@id": `${BASE_URI}/id/objects` },
                    "dcat:endpointDescription": { "@id": "https://data.designmuseumgent.be/v2/objects" }
                },
                {
                    "@id": `${BASE_URI}/id/agents`,
                    "@type": "dcat:Dataset",
                    "dct:title": [
                        { "@value": "Agenten", "@language": "nl" },
                        { "@value": "Agents", "@language": "en" },
                        { "@value": "Agents", "@language": "fr" }
                    ],
                    "dct:description": [
                        { "@value": "Alle agenten (personen en organisaties) gerelateerd aan de collectie van Design Museum Gent.", "@language": "nl" },
                        { "@value": "All agents (persons and organisations) related to the Design Museum Gent collection.", "@language": "en" },
                        { "@value": "Tous les agents (personnes et organisations) liés à la collection du Design Museum Gent.", "@language": "fr" }
                    ],
                    "dct:type": {
                        "@id": "http://www.cidoc-crm.org/cidoc-crm/E39_Actor"
                    },
                    "dcat:distribution": [
                        {
                            "@type": "dcat:Distribution",
                            "dct:format": "application/ld+json",
                            "dcat:accessURL": { "@id": `${BASE_URI}/id/agents` },
                            "dcat:mediaType": "application/ld+json",
                            "rdfs:label": "Paginated JSON-LD collection"
                        }
                    ],
                    "dcat:endpointURL": { "@id": `${BASE_URI}/id/agents` },
                    "dcat:endpointDescription": { "@id": "https://data.designmuseumgent.be/v2/agents" }
                },
                {
                    "@id": `${BASE_URI}/id/exhibitions`,
                    "@type": "dcat:Dataset",
                    "dct:title": [
                        { "@value": "Tentoonstellingen", "@language": "nl" },
                        { "@value": "Exhibitions", "@language": "en" },
                        { "@value": "Expositions", "@language": "fr" }
                    ],
                    "dct:description": [
                        { "@value": "Alle tentoonstellingen uit het archief van Design Museum Gent, met links naar getoonde collectieobjecten.", "@language": "nl" },
                        { "@value": "All exhibitions from the Design Museum Gent archive, with links to collection objects shown.", "@language": "en" },
                        { "@value": "Toutes les expositions des archives du Design Museum Gent, avec des liens vers les objets de la collection présentés.", "@language": "fr" }
                    ],
                    "dct:type": {
                        "@id": "http://www.cidoc-crm.org/cidoc-crm/E7_Activity"
                    },
                    "dcat:distribution": [
                        {
                            "@type": "dcat:Distribution",
                            "dct:format": "application/ld+json",
                            "dcat:accessURL": { "@id": `${BASE_URI}/id/exhibitions` },
                            "dcat:mediaType": "application/ld+json",
                            "rdfs:label": "Paginated JSON-LD collection"
                        }
                    ],
                    "dcat:endpointURL": { "@id": `${BASE_URI}/id/exhibitions` },
                    "dcat:endpointDescription": { "@id": "https://data.designmuseumgent.be/v2/exhibitions" }
                },
                {
                    "@id": `${BASE_URI}/id/concepts`,
                    "@type": "dcat:Dataset",
                    "dct:title": [
                        { "@value": "Thesaurus", "@language": "nl" },
                        { "@value": "Thesaurus", "@language": "en" },
                        { "@value": "Thésaurus", "@language": "fr" }
                    ],
                    "dct:description": [
                        { "@value": "Thesaurus met termen gebruikt voor de beschrijving van objecten in de collectie van Design Museum Gent, inclusief materialen, technieken en objecttypes.", "@language": "nl" },
                        { "@value": "Thesaurus of terms used to describe objects in the Design Museum Gent collection, including materials, techniques and object types.", "@language": "en" },
                        { "@value": "Thésaurus des termes utilisés pour décrire les objets de la collection du Design Museum Gent, incluant matériaux, techniques et types d'objets.", "@language": "fr" }
                    ],
                    "dct:type": {
                        "@id": "http://www.cidoc-crm.org/cidoc-crm/E55_Type"
                    },
                    "dcat:distribution": [
                        {
                            "@type": "dcat:Distribution",
                            "dct:format": "application/ld+json",
                            "dcat:accessURL": { "@id": `${BASE_URI}/id/concepts` },
                            "dcat:mediaType": "application/ld+json",
                            "rdfs:label": "Paginated JSON-LD collection"
                        }
                    ],
                    "dcat:endpointURL": { "@id": `${BASE_URI}/id/concepts` },
                    "dcat:endpointDescription": { "@id": "https://data.designmuseumgent.be/v2/concepts" }
                }
            ]
        }

        return res.status(200).json(dcat)
    }

    app.get('/', dcatHandler)
    app.get('/dcat', dcatHandler)
}