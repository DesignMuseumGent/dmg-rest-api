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
                    "@id": `${BASE_URI}id/objects`,
                    "@type": "dcat:Dataset",
                    "dct:title": [
                        { "@value": "Objecten", "@language": "nl" },
                        { "@value": "Objects", "@language": "en" },
                        { "@value": "Objets", "@language": "fr" }
                    ],
                    "dct:description": [
                        { "@value": "Alle gepubliceerde objecten uit de collectie van Design Museum Gent. Ondersteunt filtering op type, materiaal, kleur, tentoonstellingsstatus en meer.", "@language": "nl" },
                        { "@value": "All published objects from the Design Museum Gent collection. Supports filtering by type, material, color, display status and more.", "@language": "en" },
                        { "@value": "Tous les objets publiés de la collection du Design Museum Gent. Prend en charge le filtrage par type, matériau, couleur, statut d'exposition et plus.", "@language": "fr" }
                    ],
                    "dct:type": { "@id": "http://www.cidoc-crm.org/cidoc-crm/E22_Human-Made_Object" },
                    "dcat:distribution": [
                        {
                            "@type": "dcat:Distribution",
                            "dct:format": "application/ld+json",
                            "dcat:accessURL": { "@id": `${BASE_URI}id/objects` },
                            "dcat:mediaType": "application/ld+json",
                            "rdfs:label": "Paginated JSON-LD collection"
                        }
                    ],
                    "dcat:endpointURL": { "@id": `${BASE_URI}id/objects` },
                    "dcat:endpointDescription": { "@id": "https://data.designmuseumgent.be/api-docs" }
                },
                {
                    "@id": `${BASE_URI}id/agents`,
                    "@type": "dcat:Dataset",
                    "dct:title": [
                        { "@value": "Agenten", "@language": "nl" },
                        { "@value": "Agents", "@language": "en" },
                        { "@value": "Agents", "@language": "fr" }
                    ],
                    "dct:description": [
                        { "@value": "Alle agenten (personen en organisaties) gerelateerd aan de collectie van Design Museum Gent. Verrijkt met Wikipedia-biografieën en tentoonstellingsdeelnames.", "@language": "nl" },
                        { "@value": "All agents (persons and organisations) related to the Design Museum Gent collection. Enriched with Wikipedia biographies and exhibition participation.", "@language": "en" },
                        { "@value": "Tous les agents (personnes et organisations) liés à la collection du Design Museum Gent. Enrichis avec des biographies Wikipedia et des participations aux expositions.", "@language": "fr" }
                    ],
                    "dct:type": { "@id": "http://www.cidoc-crm.org/cidoc-crm/E39_Actor" },
                    "dcat:distribution": [
                        {
                            "@type": "dcat:Distribution",
                            "dct:format": "application/ld+json",
                            "dcat:accessURL": { "@id": `${BASE_URI}id/agents` },
                            "dcat:mediaType": "application/ld+json",
                            "rdfs:label": "Paginated JSON-LD collection"
                        }
                    ],
                    "dcat:endpointURL": { "@id": `${BASE_URI}id/agents` },
                    "dcat:endpointDescription": { "@id": "https://data.designmuseumgent.be/api-docs" }
                },
                {
                    "@id": `${BASE_URI}id/exhibitions`,
                    "@type": "dcat:Dataset",
                    "dct:title": [
                        { "@value": "Tentoonstellingen", "@language": "nl" },
                        { "@value": "Exhibitions", "@language": "en" },
                        { "@value": "Expositions", "@language": "fr" }
                    ],
                    "dct:description": [
                        { "@value": "Alle tentoonstellingen uit het archief van Design Museum Gent, met meertalige titels, beschrijvingen en links naar getoonde collectieobjecten.", "@language": "nl" },
                        { "@value": "All exhibitions from the Design Museum Gent archive, with multilingual titles, descriptions and links to collection objects shown.", "@language": "en" },
                        { "@value": "Toutes les expositions des archives du Design Museum Gent, avec des titres et descriptions multilingues et des liens vers les objets présentés.", "@language": "fr" }
                    ],
                    "dct:type": { "@id": "http://www.cidoc-crm.org/cidoc-crm/E7_Activity" },
                    "dcat:distribution": [
                        {
                            "@type": "dcat:Distribution",
                            "dct:format": "application/ld+json",
                            "dcat:accessURL": { "@id": `${BASE_URI}id/exhibitions` },
                            "dcat:mediaType": "application/ld+json",
                            "rdfs:label": "Paginated JSON-LD collection"
                        }
                    ],
                    "dcat:endpointURL": { "@id": `${BASE_URI}id/exhibitions` },
                    "dcat:endpointDescription": { "@id": "https://data.designmuseumgent.be/api-docs" }
                },
                {
                    "@id": `${BASE_URI}id/concepts`,
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
                    "dct:type": { "@id": "http://www.cidoc-crm.org/cidoc-crm/E55_Type" },
                    "dcat:distribution": [
                        {
                            "@type": "dcat:Distribution",
                            "dct:format": "application/ld+json",
                            "dcat:accessURL": { "@id": `${BASE_URI}id/concepts` },
                            "dcat:mediaType": "application/ld+json",
                            "rdfs:label": "Paginated JSON-LD collection"
                        }
                    ],
                    "dcat:endpointURL": { "@id": `${BASE_URI}id/concepts` },
                    "dcat:endpointDescription": { "@id": "https://data.designmuseumgent.be/api-docs" }
                },
                {
                    "@id": `${BASE_URI}id/colors`,
                    "@type": "dcat:Dataset",
                    "dct:title": [
                        { "@value": "Kleurenindex", "@language": "nl" },
                        { "@value": "Color index", "@language": "en" },
                        { "@value": "Index des couleurs", "@language": "fr" }
                    ],
                    "dct:description": [
                        { "@value": "Kleurenstatistieken over de volledige collectie, gewogen op basis van dominantiepercentages. Inclusief basiskleurcategorieën en CSS-kleurnamen.", "@language": "nl" },
                        { "@value": "Color statistics across the full collection, weighted by dominance percentages. Includes base color categories and CSS color names.", "@language": "en" },
                        { "@value": "Statistiques de couleurs sur l'ensemble de la collection, pondérées par les pourcentages de dominance. Inclut les catégories de couleurs de base et les noms de couleurs CSS.", "@language": "fr" }
                    ],
                    "dct:type": { "@id": "http://www.cidoc-crm.org/cidoc-crm/E26_Physical_Feature" },
                    "dcat:distribution": [
                        {
                            "@type": "dcat:Distribution",
                            "dct:format": "application/ld+json",
                            "dcat:accessURL": { "@id": `${BASE_URI}id/colors` },
                            "dcat:mediaType": "application/ld+json",
                            "rdfs:label": "Color index JSON-LD"
                        }
                    ],
                    "dcat:endpointURL": { "@id": `${BASE_URI}id/colors` },
                    "dcat:endpointDescription": { "@id": "https://data.designmuseumgent.be/api-docs" }
                },
                {
                    "@id": `${BASE_URI}id/types`,
                    "@type": "dcat:Dataset",
                    "dct:title": [
                        { "@value": "Objecttypes", "@language": "nl" },
                        { "@value": "Object types", "@language": "en" },
                        { "@value": "Types d'objets", "@language": "fr" }
                    ],
                    "dct:description": [
                        { "@value": "Alle objecttypes aanwezig in de collectie met objectaantallen.", "@language": "nl" },
                        { "@value": "All object types present in the collection with object counts.", "@language": "en" },
                        { "@value": "Tous les types d'objets présents dans la collection avec le nombre d'objets.", "@language": "fr" }
                    ],
                    "dct:type": { "@id": "http://www.cidoc-crm.org/cidoc-crm/E55_Type" },
                    "dcat:distribution": [
                        {
                            "@type": "dcat:Distribution",
                            "dct:format": "application/ld+json",
                            "dcat:accessURL": { "@id": `${BASE_URI}id/types` },
                            "dcat:mediaType": "application/ld+json",
                            "rdfs:label": "Type index JSON-LD"
                        }
                    ],
                    "dcat:endpointURL": { "@id": `${BASE_URI}id/types` },
                    "dcat:endpointDescription": { "@id": "https://data.designmuseumgent.be/api-docs" }
                },
                {
                    "@id": `${BASE_URI}id/materials`,
                    "@type": "dcat:Dataset",
                    "dct:title": [
                        { "@value": "Materialen", "@language": "nl" },
                        { "@value": "Materials", "@language": "en" },
                        { "@value": "Matériaux", "@language": "fr" }
                    ],
                    "dct:description": [
                        { "@value": "Alle materialen aanwezig in de collectie met objectaantallen.", "@language": "nl" },
                        { "@value": "All materials present in the collection with object counts.", "@language": "en" },
                        { "@value": "Tous les matériaux présents dans la collection avec le nombre d'objets.", "@language": "fr" }
                    ],
                    "dct:type": { "@id": "http://www.cidoc-crm.org/cidoc-crm/E57_Material" },
                    "dcat:distribution": [
                        {
                            "@type": "dcat:Distribution",
                            "dct:format": "application/ld+json",
                            "dcat:accessURL": { "@id": `${BASE_URI}id/materials` },
                            "dcat:mediaType": "application/ld+json",
                            "rdfs:label": "Material index JSON-LD"
                        }
                    ],
                    "dcat:endpointURL": { "@id": `${BASE_URI}id/materials` },
                    "dcat:endpointDescription": { "@id": "https://data.designmuseumgent.be/api-docs" }
                },
                {
                    "@id": `${BASE_URI}id/nationalities`,
                    "@type": "dcat:Dataset",
                    "dct:title": [
                        { "@value": "Nationaliteiten", "@language": "nl" },
                        { "@value": "Nationalities", "@language": "en" },
                        { "@value": "Nationalités", "@language": "fr" }
                    ],
                    "dct:description": [
                        { "@value": "Alle nationaliteiten aanwezig in de agentrecords met agentaantallen.", "@language": "nl" },
                        { "@value": "All nationalities present in the agent records with agent counts.", "@language": "en" },
                        { "@value": "Toutes les nationalités présentes dans les enregistrements d'agents avec le nombre d'agents.", "@language": "fr" }
                    ],
                    "dct:type": { "@id": "http://www.cidoc-crm.org/cidoc-crm/E55_Type" },
                    "dcat:distribution": [
                        {
                            "@type": "dcat:Distribution",
                            "dct:format": "application/ld+json",
                            "dcat:accessURL": { "@id": `${BASE_URI}id/nationalities` },
                            "dcat:mediaType": "application/ld+json",
                            "rdfs:label": "Nationality index JSON-LD"
                        }
                    ],
                    "dcat:endpointURL": { "@id": `${BASE_URI}id/nationalities` },
                    "dcat:endpointDescription": { "@id": "https://data.designmuseumgent.be/api-docs" }
                },
                {
                    "@id": `${BASE_URI}id/roles`,
                    "@type": "dcat:Dataset",
                    "dct:title": [
                        { "@value": "Rollen", "@language": "nl" },
                        { "@value": "Roles", "@language": "en" },
                        { "@value": "Rôles", "@language": "fr" }
                    ],
                    "dct:description": [
                        { "@value": "Alle rollen die agenten spelen in de collectie van Design Museum Gent (ontwerper, producent) met agentaantallen.", "@language": "nl" },
                        { "@value": "All roles agents play in the Design Museum Gent collection (designer, producer) with agent counts.", "@language": "en" },
                        { "@value": "Tous les rôles joués par les agents dans la collection du Design Museum Gent (designer, producteur) avec le nombre d'agents.", "@language": "fr" }
                    ],
                    "dct:type": { "@id": "http://www.cidoc-crm.org/cidoc-crm/E55_Type" },
                    "dcat:distribution": [
                        {
                            "@type": "dcat:Distribution",
                            "dct:format": "application/ld+json",
                            "dcat:accessURL": { "@id": `${BASE_URI}id/roles` },
                            "dcat:mediaType": "application/ld+json",
                            "rdfs:label": "Role index JSON-LD"
                        }
                    ],
                    "dcat:endpointURL": { "@id": `${BASE_URI}id/roles` },
                    "dcat:endpointDescription": { "@id": "https://data.designmuseumgent.be/api-docs" }
                }
            ]
        }

        return res.status(200).json(dcat)
    }

    app.get('/', dcatHandler)
    app.get('/dcat', dcatHandler)
}