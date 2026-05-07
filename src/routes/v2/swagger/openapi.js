export const swaggerDefinition = {
    openapi: '3.0.0',
    info: {
        title: 'Design Museum Gent API',
        version: '2.0.0',
        description: 'CIDOC-CRM compliant JSON-LD REST API for the Design Museum Gent collection.',
        contact: {
            name: "Olivier Van D'huynslager",
            email: 'olivier.vandhuynslager@stad.gent',
        },
        license: {
            name: 'MIT',
            url: 'https://opensource.org/licenses/MIT'
        }
    },
    servers: [
        {
            url: 'https://data.designmuseumgent.be/v2',
            description: 'Production'
        },
        {
            url: 'http://localhost:3000/v2',
            description: 'Local development'
        }
    ],
    tags: [
        { name: 'Objects', description: 'Collection objects' },
        { name: 'Agents', description: 'Persons and organisations' },
        { name: 'Exhibitions', description: 'Exhibition archive' },
        { name: 'Concepts', description: 'Thesaurus terms' },
        { name: 'Colors', description: 'Color index and statistics' },
        { name: 'Private', description: 'Authenticated private streams' },
        { name: 'DCAT', description: 'Data catalog' }
    ],
    components: {
        securitySchemes: {
            ApiKeyAuth: {
                type: 'apiKey',
                in: 'query',
                name: 'apiKey',
                description: 'API key for private endpoints'
            },
            ApiKeyHeader: {
                type: 'apiKey',
                in: 'header',
                name: 'x-api-key',
                description: 'API key for private endpoints (header)'
            }
        },
        parameters: {
            page: {
                name: 'page',
                in: 'query',
                description: 'Page number',
                schema: { type: 'integer', default: 1 }
            },
            itemsPerPage: {
                name: 'itemsPerPage',
                in: 'query',
                description: 'Number of items per page (max 100)',
                schema: { type: 'integer', default: 10, maximum: 100 }
            },
            fullRecord: {
                name: 'fullRecord',
                in: 'query',
                description: 'Return full CIDOC-CRM records instead of lightweight stubs',
                schema: { type: 'boolean', default: false }
            },
            modifiedSince: {
                name: 'modifiedSince',
                in: 'query',
                description: 'Only return records modified on or after this date. Format: YYYY-MM-DD',
                schema: { type: 'string', format: 'date', example: '2026-05-01' }
            },
            searchQuery: {
                name: 'q',
                in: 'query',
                description: 'Full text search. Supports phrases ("roze glas"), OR, and negation (-keramiek)',
                schema: { type: 'string', example: 'roze glas' }
            }
        },
        schemas: {
            HydraCollection: {
                type: 'object',
                properties: {
                    '@context': { type: 'object' },
                    '@id': { type: 'string', format: 'uri' },
                    '@type': { type: 'string', example: 'hydra:Collection' },
                    'hydra:totalItems': { type: 'integer' },
                    'hydra:view': {
                        type: 'object',
                        properties: {
                            '@id': { type: 'string' },
                            '@type': { type: 'string' },
                            'hydra:first': { type: 'string' },
                            'hydra:last': { type: 'string' },
                            'hydra:next': { type: 'string' },
                            'hydra:previous': { type: 'string' }
                        }
                    },
                    'hydra:member': { type: 'array', items: { type: 'object' } }
                }
            },
            ErrorResponse: {
                type: 'object',
                properties: {
                    error: { type: 'string' }
                }
            },
            LightweightObject: {
                type: 'object',
                properties: {
                    '@id': { type: 'string', format: 'uri', example: 'https://data.designmuseumgent.be/v2/id/object/1987-1105' },
                    '@type': { type: 'string', example: 'crm:E22_Human-Made_Object' },
                    'rdfs:label': { type: 'string', example: 'Beeldje van een vis in opaalglas' },
                    'crm:P129i_is_subject_of': {
                        type: 'object',
                        properties: {
                            '@id': { type: 'string', format: 'uri' },
                            '@type': { type: 'string', example: 'crm:E73_Information_Object' }
                        }
                    }
                }
            },
            LightweightAgent: {
                type: 'object',
                properties: {
                    '@id': { type: 'string', format: 'uri', example: 'https://data.designmuseumgent.be/v2/id/agent/DMG-A-00162' },
                    '@type': { type: 'string', example: 'crm:E39_Actor' },
                    'rdfs:label': { type: 'string', example: 'Memphis' }
                }
            },
            LightweightExhibition: {
                type: 'object',
                properties: {
                    '@id': { type: 'string', format: 'uri' },
                    '@type': { type: 'string', example: 'crm:E7_Activity' },
                    'rdfs:label': { type: 'string', example: 'Kleureyck. Van Eycks kleuren in design' }
                }
            },
            LightweightConcept: {
                type: 'object',
                properties: {
                    '@id': { type: 'string', format: 'uri' },
                    '@type': { type: 'string', example: 'crm:E55_Type' },
                    'rdfs:label': { type: 'string', example: 'pepervat' }
                }
            }
        }
    },
    paths: {

        // -----------------------------------------------------------------------
        // OBJECTS
        // -----------------------------------------------------------------------

        '/id/objects': {
            get: {
                tags: ['Objects'],
                summary: 'Paginated collection of all objects',
                description: 'Returns a Hydra paginated collection of objects. Supports full records, image filter, color filter, full text search and incremental harvesting.',
                parameters: [
                    { $ref: '#/components/parameters/page' },
                    { $ref: '#/components/parameters/itemsPerPage' },
                    { $ref: '#/components/parameters/fullRecord' },
                    { $ref: '#/components/parameters/modifiedSince' },
                    { $ref: '#/components/parameters/searchQuery' },
                    {
                        name: 'hasImages',
                        in: 'query',
                        description: 'Only return objects with a IIIF manifest',
                        schema: { type: 'boolean', default: false }
                    },
                    {
                        name: 'colors',
                        in: 'query',
                        description: 'Include color data in full records',
                        schema: { type: 'boolean', default: false }
                    },
                    {
                        name: 'color',
                        in: 'query',
                        description: 'Filter by base color. Comma-separated for multiple (AND). Available: red, orange, yellow, green, blue, purple, pink, brown, grey, black, white',
                        schema: { type: 'string', example: 'pink,grey' }
                    },
                    {
                        name: 'cssColor',
                        in: 'query',
                        description: 'Filter by CSS color name. Comma-separated for multiple (AND).',
                        schema: { type: 'string', example: 'Old rose' }
                    }
                ],
                responses: {
                    200: {
                        description: 'Successful response',
                        content: {
                            'application/ld+json': {
                                schema: { $ref: '#/components/schemas/HydraCollection' }
                            }
                        }
                    },
                    400: { description: 'Invalid modifiedSince format', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                    500: { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
                }
            }
        },

        '/id/object/{ObjectPID}': {
            get: {
                tags: ['Objects'],
                summary: 'Single object record',
                description: 'Returns a single object as CIDOC-CRM compliant JSON-LD. Handles resolver redirects (301) and permanently removed objects (410).',
                parameters: [
                    {
                        name: 'ObjectPID',
                        in: 'path',
                        required: true,
                        description: 'Object identifier (DMG object number)',
                        schema: { type: 'string', example: '1987-1105' }
                    },
                    {
                        name: 'colors',
                        in: 'query',
                        description: 'Include color data',
                        schema: { type: 'boolean', default: false }
                    }
                ],
                responses: {
                    200: { description: 'Object found', content: { 'application/ld+json': { schema: { type: 'object' } } } },
                    301: { description: 'Object has been merged — follow Location header' },
                    404: { description: 'Object not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                    410: { description: 'Object permanently removed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                    500: { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
                }
            }
        },

        // -----------------------------------------------------------------------
        // AGENTS
        // -----------------------------------------------------------------------

        '/id/agents': {
            get: {
                tags: ['Agents'],
                summary: 'Paginated collection of all agents',
                description: 'Returns a Hydra paginated collection of agents (persons and organisations).',
                parameters: [
                    { $ref: '#/components/parameters/page' },
                    { $ref: '#/components/parameters/itemsPerPage' },
                    { $ref: '#/components/parameters/fullRecord' },
                    { $ref: '#/components/parameters/modifiedSince' },
                    { $ref: '#/components/parameters/searchQuery' }
                ],
                responses: {
                    200: { description: 'Successful response', content: { 'application/ld+json': { schema: { $ref: '#/components/schemas/HydraCollection' } } } },
                    400: { description: 'Invalid modifiedSince format' },
                    500: { description: 'Server error' }
                }
            }
        },

        '/id/agent/{agentPID}': {
            get: {
                tags: ['Agents'],
                summary: 'Single agent record',
                description: 'Returns a single agent as CIDOC-CRM compliant JSON-LD, enriched with Wikipedia biographies and exhibition participation.',
                parameters: [
                    {
                        name: 'agentPID',
                        in: 'path',
                        required: true,
                        description: 'Agent identifier',
                        schema: { type: 'string', example: 'DMG-A-00162' }
                    }
                ],
                responses: {
                    200: { description: 'Agent found', content: { 'application/ld+json': { schema: { type: 'object' } } } },
                    404: { description: 'Agent not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                    500: { description: 'Server error' }
                }
            }
        },

        // -----------------------------------------------------------------------
        // EXHIBITIONS
        // -----------------------------------------------------------------------

        '/id/exhibitions': {
            get: {
                tags: ['Exhibitions'],
                summary: 'Paginated collection of all exhibitions',
                description: 'Returns a Hydra paginated collection of exhibitions from the Design Museum Gent archive.',
                parameters: [
                    { $ref: '#/components/parameters/page' },
                    { $ref: '#/components/parameters/itemsPerPage' },
                    { $ref: '#/components/parameters/fullRecord' },
                    { $ref: '#/components/parameters/modifiedSince' }
                ],
                responses: {
                    200: { description: 'Successful response', content: { 'application/ld+json': { schema: { $ref: '#/components/schemas/HydraCollection' } } } },
                    500: { description: 'Server error' }
                }
            }
        },

        '/id/exhibition/{exhibitionPID}': {
            get: {
                tags: ['Exhibitions'],
                summary: 'Single exhibition record',
                description: 'Returns a single exhibition as CIDOC-CRM compliant JSON-LD with multilingual titles, descriptions, time span and object links.',
                parameters: [
                    {
                        name: 'exhibitionPID',
                        in: 'path',
                        required: true,
                        description: 'Exhibition identifier',
                        schema: { type: 'string', example: 'TE_2020-001' }
                    }
                ],
                responses: {
                    200: { description: 'Exhibition found', content: { 'application/ld+json': { schema: { type: 'object' } } } },
                    404: { description: 'Exhibition not found' },
                    500: { description: 'Server error' }
                }
            }
        },

        // -----------------------------------------------------------------------
        // CONCEPTS
        // -----------------------------------------------------------------------

        '/id/concepts': {
            get: {
                tags: ['Concepts'],
                summary: 'Paginated collection of the thesaurus',
                description: 'Returns a Hydra paginated collection of thesaurus concepts used to describe objects in the collection.',
                parameters: [
                    { $ref: '#/components/parameters/page' },
                    { $ref: '#/components/parameters/itemsPerPage' },
                    { $ref: '#/components/parameters/fullRecord' },
                    { $ref: '#/components/parameters/modifiedSince' },
                    { $ref: '#/components/parameters/searchQuery' }
                ],
                responses: {
                    200: { description: 'Successful response', content: { 'application/ld+json': { schema: { $ref: '#/components/schemas/HydraCollection' } } } },
                    500: { description: 'Server error' }
                }
            }
        },

        '/id/concept/{ConceptPID}': {
            get: {
                tags: ['Concepts'],
                summary: 'Single concept record',
                description: 'Returns a single thesaurus concept as CIDOC-CRM + SKOS JSON-LD with multilingual labels, scope notes and hierarchy.',
                parameters: [
                    {
                        name: 'ConceptPID',
                        in: 'path',
                        required: true,
                        description: 'Concept identifier',
                        schema: { type: 'string', example: '530000049' }
                    }
                ],
                responses: {
                    200: { description: 'Concept found', content: { 'application/ld+json': { schema: { type: 'object' } } } },
                    404: { description: 'Concept not found' },
                    500: { description: 'Server error' }
                }
            }
        },

        // -----------------------------------------------------------------------
        // COLORS
        // -----------------------------------------------------------------------

        '/id/colors': {
            get: {
                tags: ['Colors'],
                summary: 'Color index with weighted statistics',
                description: 'Returns all available base colors and CSS color names with weighted distribution statistics across the full collection.',
                responses: {
                    200: {
                        description: 'Color index',
                        content: {
                            'application/ld+json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        'base_colors': {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    value: { type: 'string', example: 'pink' },
                                                    object_count: { type: 'integer', example: 1243 },
                                                    collection_share_pct: { type: 'number', example: 8.4 },
                                                    avg_dominance_pct: { type: 'number', example: 22.1 },
                                                    filter: { type: 'string', format: 'uri' },
                                                    dominant: { type: 'string', format: 'uri' }
                                                }
                                            }
                                        },
                                        'css_colors': {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    value: { type: 'string', example: 'Old rose' },
                                                    object_count: { type: 'integer', example: 312 },
                                                    collection_share_pct: { type: 'number', example: 0.94 },
                                                    avg_dominance_pct: { type: 'number', example: 22.1 },
                                                    filter: { type: 'string', format: 'uri' },
                                                    dominant: { type: 'string', format: 'uri' }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    500: { description: 'Server error' }
                }
            }
        },

        '/id/colors/dominant': {
            get: {
                tags: ['Colors'],
                summary: 'Objects most dominant in a specific color',
                description: 'Returns objects sorted by the dominance percentage of a specific base color or CSS color name.',
                parameters: [
                    {
                        name: 'color',
                        in: 'query',
                        description: 'Base color to rank by',
                        schema: { type: 'string', example: 'black' }
                    },
                    {
                        name: 'cssColor',
                        in: 'query',
                        description: 'CSS color name to rank by',
                        schema: { type: 'string', example: 'Old rose' }
                    },
                    {
                        name: 'limit',
                        in: 'query',
                        description: 'Number of results (max 100)',
                        schema: { type: 'integer', default: 20, maximum: 100 }
                    }
                ],
                responses: {
                    200: { description: 'Dominant objects', content: { 'application/ld+json': { schema: { $ref: '#/components/schemas/HydraCollection' } } } },
                    400: { description: 'Missing color or cssColor parameter' },
                    500: { description: 'Server error' }
                }
            }
        },

        // -----------------------------------------------------------------------
        // PRIVATE
        // -----------------------------------------------------------------------

        '/id/private/objects': {
            get: {
                tags: ['Private'],
                summary: 'Authenticated private objects stream',
                description: 'Returns the full private collection stream. Requires a valid API key. Supports all the same filters as the public objects endpoint.',
                security: [
                    { ApiKeyAuth: [] },
                    { ApiKeyHeader: [] }
                ],
                parameters: [
                    { $ref: '#/components/parameters/page' },
                    { $ref: '#/components/parameters/itemsPerPage' },
                    { $ref: '#/components/parameters/fullRecord' },
                    { $ref: '#/components/parameters/modifiedSince' },
                    { $ref: '#/components/parameters/searchQuery' },
                    {
                        name: 'hasImages',
                        in: 'query',
                        schema: { type: 'boolean', default: false }
                    },
                    {
                        name: 'colors',
                        in: 'query',
                        schema: { type: 'boolean', default: false }
                    },
                    {
                        name: 'color',
                        in: 'query',
                        schema: { type: 'string', example: 'pink' }
                    },
                    {
                        name: 'cssColor',
                        in: 'query',
                        schema: { type: 'string', example: 'Old rose' }
                    }
                ],
                responses: {
                    200: { description: 'Successful response', content: { 'application/ld+json': { schema: { $ref: '#/components/schemas/HydraCollection' } } } },
                    401: { description: 'Missing or invalid API key', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                    500: { description: 'Server error' }
                }
            }
        },

        // -----------------------------------------------------------------------
        // DCAT
        // -----------------------------------------------------------------------

        '/': {
            get: {
                tags: ['DCAT'],
                summary: 'DCAT data catalog',
                description: 'Returns a machine-readable DCAT catalog describing all available datasets.',
                responses: {
                    200: { description: 'DCAT catalog', content: { 'application/ld+json': { schema: { type: 'object' } } } }
                }
            }
        },

        '/dcat': {
            get: {
                tags: ['DCAT'],
                summary: 'DCAT data catalog (alias)',
                description: 'Alias for GET /v2/. Returns identical response.',
                responses: {
                    200: { description: 'DCAT catalog', content: { 'application/ld+json': { schema: { type: 'object' } } } }
                }
            }
        },

        '/id/types': {
            get: {
                tags: ['Objects'],
                summary: 'Object type index',
                description: 'Returns all object types present in the collection with object counts and a ready-to-use filter URL.',
                responses: {
                    200: {
                        description: 'Type index',
                        content: {
                            'application/ld+json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        'hydra:totalItems': { type: 'integer' },
                                        'hydra:member': {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    '@id': { type: 'string', format: 'uri' },
                                                    '@type': { type: 'string', example: 'crm:E55_Type' },
                                                    'rdfs:label': { type: 'string', example: 'pepervat' },
                                                    'object_count': { type: 'integer', example: 42 },
                                                    'filter': { type: 'string', format: 'uri' }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    500: { description: 'Server error' }
                }
            }
        }
    }
}