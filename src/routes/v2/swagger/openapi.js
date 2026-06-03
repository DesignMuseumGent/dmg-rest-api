export const swaggerDefinition = {
    openapi: '3.0.0',
    info: {
        title: 'Design Museum Gent API',
        version: '2.8.0',
        description: 'CIDOC-CRM compliant JSON-LD REST API for the Design Museum Gent collection.',
        contact: {
            name: "Olivier Van D'huynslager",
            email: 'olivier.vandhuynslager@stad.gent',
            url: 'https://data.designmuseumgent.be'
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
        { name: 'Discovery', description: 'Index endpoints for types, materials, nationalities and roles' },
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
                description: 'API key for private endpoints (preferred)'
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
            },
            onDisplay: {
                name: 'onDisplay',
                in: 'query',
                description: 'Only return objects currently on display in the collection presentation',
                schema: { type: 'boolean', default: false }
            },
            language: {
                name: 'language',
                in: 'query',
                description: 'Filter by available translation. Only return records that have content in the specified language. Supported: NLD, FRA, ENG.',
                schema: { type: 'string', example: 'FRA' }
            },

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
            IndexEntry: {
                type: 'object',
                properties: {
                    '@type': { type: 'string' },
                    'rdfs:label': { type: 'string' },
                    'object_count': { type: 'integer' },
                    'filter': { type: 'string', format: 'uri' }
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
                description: 'Returns a Hydra paginated collection of objects. Supports full records, image filter, color filter, type filter, material filter, agent filter, full text search, incremental harvesting and collection presentation filter. Pagination links are also exposed via RFC 8288 Link headers.',
                parameters: [
                    { $ref: '#/components/parameters/page' },
                    { $ref: '#/components/parameters/itemsPerPage' },
                    { $ref: '#/components/parameters/fullRecord' },
                    { $ref: '#/components/parameters/modifiedSince' },
                    { $ref: '#/components/parameters/searchQuery' },
                    { $ref: '#/components/parameters/onDisplay' },
                    { $ref: '#/components/parameters/language' },
                    {
                        name: 'hasImages',
                        in: 'query',
                        description: 'Only return objects with a IIIF manifest',
                        schema: { type: 'boolean', default: false }
                    },
                    {
                        name: 'hasParts',
                        in: 'query',
                        description: 'Only return koepelrecords — objects that have physical components',
                        schema: { type: 'boolean', default: false }
                    },
                    {
                        name: 'isPartOf',
                        in: 'query',
                        description: 'Only return components — objects that belong to a parent koepelrecord',
                        schema: { type: 'boolean', default: false }
                    },
                    {
                        name: 'hasColors',
                        in: 'query',
                        description: 'Only return objects that have been processed by the color tagger. Separate from ?colors=true which includes color data in the response.',
                        schema: { type: 'boolean', default: false }
                    },
                    {
                        name: 'colors',
                        in: 'query',
                        description: 'Include color data in full records. Requires fullRecord=true.',
                        schema: { type: 'boolean', default: false }
                    },
                    {
                        name: 'color',
                        in: 'query',
                        description: 'Filter by base color. Comma-separated for multiple (AND). Available: red, orange, yellow, green, blue, purple, pink, brown, grey, black, white. Use /v2/id/colors to discover statistics.',
                        schema: { type: 'string', example: 'pink,grey' }
                    },
                    {
                        name: 'cssColor',
                        in: 'query',
                        description: 'Filter by CSS color name. Comma-separated for multiple (AND). Use /v2/id/colors to discover available values.',
                        schema: { type: 'string', example: 'Old rose' }
                    },
                    {
                        name: 'type',
                        in: 'query',
                        description: 'Filter by object type label. Comma-separated for multiple (AND). Use /v2/id/types to discover available values.',
                        schema: { type: 'string', example: 'vaas' }
                    },
                    {
                        name: 'material',
                        in: 'query',
                        description: 'Filter by material label. Comma-separated for multiple (AND). Use /v2/id/materials to discover available values.',
                        schema: { type: 'string', example: 'glas (materiaal)' }
                    },
                    {
                        name: 'agent',
                        in: 'query',
                        description: 'Filter by agent PID or full URI. Returns all objects where the agent appears as designer (crm:P94i_was_created_by) or producer (crm:P108i_was_produced_by). Accepts DMG-A-00162 or full URI.',
                        schema: { type: 'string', example: 'DMG-A-00162' }
                    },
                    {
                        name: 'date',
                        in: 'query',
                        description: 'Filter by production date range using EDTF interval notation (YYYY/YYYY). Returns objects whose production period overlaps with the given range. Use dateFrom and dateTo separately for more control.',
                        schema: { type: 'string', example: '1950/1969' }
                    },
                    {
                        name: 'dateFrom',
                        in: 'query',
                        description: 'Only return objects produced from this year onwards.',
                        schema: { type: 'integer', example: 1950 }
                    },
                    {
                        name: 'dateTo',
                        in: 'query',
                        description: 'Only return objects produced up to and including this year.',
                        schema: { type: 'integer', example: 1969 }
                    },
                    {
                        name: 'concept',
                        in: 'query',
                        description: 'Filter by thesaurus concept PID or full URI. Matches objects where the concept appears as object type, material, technique or sub-collection. Accepts 530000049 or full URI.',
                        schema: { type: 'string', example: '530000049' }
                    },
                    {
                        name: 'conceptSearch',
                        in: 'query',
                        description: 'Filter by concept label. Searches the thesaurus for matching concepts and returns objects tagged with any of them. Accepts partial labels ("stoel", "computer"). Use ?concept= for exact URI matching.',
                        schema: { type: 'string', example: 'stoel' }
                    }
                ],
                responses: {
                    200: {
                        description: 'Successful response',
                        headers: {
                            'Link': { schema: { type: 'string' }, description: 'RFC 8288 pagination links (first, last, next, prev)' }
                        },
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
                description: 'Returns a single object as CIDOC-CRM compliant JSON-LD. Handles resolver redirects (301) and permanently removed objects (410). Includes ETag and Last-Modified headers for cache validation.',
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
                    200: {
                        description: 'Object found',
                        headers: {
                            'ETag': { schema: { type: 'string' }, description: 'Cache validation token' },
                            'Last-Modified': { schema: { type: 'string' }, description: 'Timestamp of last harvest' },
                            'Cache-Control': { schema: { type: 'string' }, description: 'Cache duration' }
                        },
                        content: { 'application/ld+json': { schema: { type: 'object' } } }
                    },
                    301: { description: 'Object has been merged — follow Location header' },
                    404: { description: 'Object not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                    410: { description: 'Object permanently removed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                    500: { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
                }
            },
            head: {
                tags: ['Objects'],
                summary: 'Check if an object exists',
                description: 'Lightweight existence check without fetching the full payload. Returns the same status codes as GET but with no response body. Includes ETag and Last-Modified headers for cache validation.',
                parameters: [
                    {
                        name: 'ObjectPID',
                        in: 'path',
                        required: true,
                        schema: { type: 'string', example: '1987-1105' }
                    }
                ],
                responses: {
                    200: {
                        description: 'Object exists',
                        headers: {
                            'ETag': { schema: { type: 'string' }, description: 'Cache validation token' },
                            'Last-Modified': { schema: { type: 'string' }, description: 'Timestamp of last harvest' }
                        }
                    },
                    301: { description: 'Object has been merged — follow Location header' },
                    404: { description: 'Object not found' },
                    410: { description: 'Object permanently removed' }
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
                description: 'Returns a Hydra paginated collection of agents (persons and organisations). Supports full text search, nationality filter, role filter, and Wikipedia biography filters.',
                parameters: [
                    { $ref: '#/components/parameters/page' },
                    { $ref: '#/components/parameters/itemsPerPage' },
                    { $ref: '#/components/parameters/fullRecord' },
                    { $ref: '#/components/parameters/modifiedSince' },
                    { $ref: '#/components/parameters/searchQuery' },
                    {
                        name: 'nationality',
                        in: 'query',
                        description: 'Filter by nationality (Dutch country name). Comma-separated for multiple (AND). Use /v2/id/nationalities to discover available values.',
                        schema: { type: 'string', example: 'België' }
                    },
                    {
                        name: 'role',
                        in: 'query',
                        description: 'Filter by role in the collection. Use /v2/id/roles to discover available values.',
                        schema: { type: 'string', example: 'designer' }
                    },
                    {
                        name: 'hasBio',
                        in: 'query',
                        description: 'Only return agents that have at least one Wikipedia biography in any language.',
                        schema: { type: 'boolean', default: false }
                    },
                    {
                        name: 'language',
                        in: 'query',
                        description: 'Filter by available Wikipedia biography language. Only return agents that have a biography in the specified language. Supported: NLD, FRA, ENG.',
                        schema: { type: 'string', example: 'FRA' }
                    }
                ],
                responses: {
                    200: {
                        description: 'Successful response',
                        headers: {
                            'Link': { schema: { type: 'string' }, description: 'RFC 8288 pagination links' }
                        },
                        content: { 'application/ld+json': { schema: { $ref: '#/components/schemas/HydraCollection' } } }
                    },
                    400: { description: 'Invalid modifiedSince format' },
                    500: { description: 'Server error' }
                }
            }
        },

        '/id/agent/{agentPID}': {
            get: {
                tags: ['Agents'],
                summary: 'Single agent record',
                description: 'Returns a single agent as CIDOC-CRM compliant JSON-LD, enriched with Wikipedia biographies, thumbnail image and exhibition participation.',
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
                    200: {
                        description: 'Agent found',
                        headers: {
                            'ETag': { schema: { type: 'string' }, description: 'Cache validation token' },
                            'Last-Modified': { schema: { type: 'string' }, description: 'Timestamp of last harvest' },
                            'Cache-Control': { schema: { type: 'string' }, description: 'Cache duration' }
                        },
                        content: { 'application/ld+json': { schema: { type: 'object' } } }
                    },
                    404: { description: 'Agent not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                    500: { description: 'Server error' }
                }
            },
            head: {
                tags: ['Agents'],
                summary: 'Check if an agent exists',
                description: 'Lightweight existence check without fetching the full payload. Includes ETag and Last-Modified headers for cache validation.',
                parameters: [
                    {
                        name: 'agentPID',
                        in: 'path',
                        required: true,
                        schema: { type: 'string', example: 'DMG-A-00162' }
                    }
                ],
                responses: {
                    200: {
                        description: 'Agent exists',
                        headers: {
                            'Last-Modified': { schema: { type: 'string' } },
                            'ETag': { schema: { type: 'string' } }
                        }
                    },
                    404: { description: 'Agent not found' },
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
                    { $ref: '#/components/parameters/modifiedSince' },
                    { $ref: '#/components/parameters/language' }
                ],
                responses: {
                    200: {
                        description: 'Successful response',
                        headers: {
                            'Link': { schema: { type: 'string' }, description: 'RFC 8288 pagination links' }
                        },
                        content: { 'application/ld+json': { schema: { $ref: '#/components/schemas/HydraCollection' } } }
                    },
                    500: { description: 'Server error' }
                }
            }
        },

        '/id/exhibition/{exhibitionPID}': {
            get: {
                tags: ['Exhibitions'],
                summary: 'Single exhibition record',
                description: 'Returns a single exhibition as CIDOC-CRM compliant JSON-LD with multilingual titles, descriptions, time span, object links and media.',
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
                    200: {
                        description: 'Exhibition found',
                        headers: {
                            'ETag': { schema: { type: 'string' }, description: 'Cache validation token' },
                            'Last-Modified': { schema: { type: 'string' }, description: 'Timestamp of last harvest' },
                            'Cache-Control': { schema: { type: 'string' }, description: 'Cache duration' }
                        },
                        content: { 'application/ld+json': { schema: { type: 'object' } } }
                    },
                    404: { description: 'Exhibition not found' },
                    500: { description: 'Server error' }
                }
            },
            head: {
                tags: ['Exhibitions'],
                summary: 'Check if an exhibition exists',
                description: 'Lightweight existence check without fetching the full payload. Includes ETag and Last-Modified headers for cache validation.',
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
                    200: {
                        description: 'Exhibition exists',
                        headers: {
                            'Last-Modified': { schema: { type: 'string' }, description: 'Timestamp of last harvest' },
                            'ETag': { schema: { type: 'string' }, description: 'Cache validation token' },
                            'Cache-Control': { schema: { type: 'string' }, description: 'Cache duration' }
                        }
                    },
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
                    { $ref: '#/components/parameters/searchQuery' },
                    { $ref: '#/components/parameters/language' }
                ],
                responses: {
                    200: {
                        description: 'Successful response',
                        headers: {
                            'Link': { schema: { type: 'string' }, description: 'RFC 8288 pagination links' }
                        },
                        content: { 'application/ld+json': { schema: { $ref: '#/components/schemas/HydraCollection' } } }
                    },
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
                    200: {
                        description: 'Concept found',
                        headers: {
                            'ETag': { schema: { type: 'string' }, description: 'Cache validation token' },
                            'Last-Modified': { schema: { type: 'string' }, description: 'Timestamp of last harvest' },
                            'Cache-Control': { schema: { type: 'string' }, description: 'Cache duration' }
                        },
                        content: { 'application/ld+json': { schema: { type: 'object' } } }
                    },
                    404: { description: 'Concept not found' },
                    500: { description: 'Server error' }
                }
            },
            head: {
                tags: ['Concepts'],
                summary: 'Check if a concept exists',
                description: 'Lightweight existence check without fetching the full payload. Includes ETag and Last-Modified headers for cache validation.',
                parameters: [
                    {
                        name: 'ConceptPID',
                        in: 'path',
                        required: true,
                        schema: { type: 'string', example: '530000049' }
                    }
                ],
                responses: {
                    200: {
                        description: 'Concept exists',
                        headers: {
                            'Last-Modified': { schema: { type: 'string' } },
                            'ETag': { schema: { type: 'string' } }
                        }
                    },
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
                description: 'Returns all available base colors and CSS color names with weighted distribution statistics across the full collection. Supports ?onDisplay=true to filter to collection presentation objects only.',
                parameters: [
                    { $ref: '#/components/parameters/onDisplay' }
                ],
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
        // DISCOVERY
        // -----------------------------------------------------------------------

        '/id/types': {
            get: {
                tags: ['Discovery'],
                summary: 'Object type index',
                description: 'Returns all object types present in the collection with object counts and a ready-to-use filter URL. Supports ?onDisplay=true.',
                parameters: [
                    { $ref: '#/components/parameters/onDisplay' }
                ],
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
                                                    'rdfs:label': { type: 'string', example: 'vaas' },
                                                    'object_count': { type: 'integer', example: 843 },
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
        },

        '/id/materials': {
            get: {
                tags: ['Discovery'],
                summary: 'Material index',
                description: 'Returns all materials present in the collection with object counts and a ready-to-use filter URL. Supports ?onDisplay=true.',
                parameters: [
                    { $ref: '#/components/parameters/onDisplay' }
                ],
                responses: {
                    200: {
                        description: 'Material index',
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
                                                    '@type': { type: 'string', example: 'crm:E57_Material' },
                                                    'rdfs:label': { type: 'string', example: 'glas (materiaal)' },
                                                    'object_count': { type: 'integer', example: 1243 },
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
        },

        '/id/nationalities': {
            get: {
                tags: ['Discovery'],
                summary: 'Nationality index',
                description: 'Returns all nationalities present in the agent records with agent counts and a ready-to-use filter URL.',
                responses: {
                    200: {
                        description: 'Nationality index',
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
                                                    '@type': { type: 'string', example: 'crm:E55_Type' },
                                                    'rdfs:label': { type: 'string', example: 'België' },
                                                    'agent_count': { type: 'integer', example: 312 },
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
        },

        '/id/roles': {
            get: {
                tags: ['Discovery'],
                summary: 'Agent role index',
                description: 'Returns all roles agents play in the collection (designer, producer) with agent counts and a ready-to-use filter URL.',
                responses: {
                    200: {
                        description: 'Role index',
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
                                                    '@type': { type: 'string', example: 'crm:E55_Type' },
                                                    'rdfs:label': { type: 'string', example: 'designer' },
                                                    'agent_count': { type: 'integer', example: 1243 },
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
        },

        // -----------------------------------------------------------------------
        // PRIVATE
        // -----------------------------------------------------------------------

        '/id/private/objects': {
            get: {
                tags: ['Private'],
                summary: 'Authenticated private objects stream',
                description: 'Returns the full private collection stream. Requires a valid API key passed as ?apiKey= query parameter or x-api-key header. Supports all the same filters as the public objects endpoint.',
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
                    { $ref: '#/components/parameters/onDisplay' },
                    { $ref: '#/components/parameters/language' },
                    { name: 'hasImages',  in: 'query', schema: { type: 'boolean', default: false } },
                    { name: 'hasColors',  in: 'query', schema: { type: 'boolean', default: false } },
                    { name: 'colors',     in: 'query', schema: { type: 'boolean', default: false } },
                    { name: 'color',      in: 'query', schema: { type: 'string', example: 'pink' } },
                    { name: 'cssColor',   in: 'query', schema: { type: 'string', example: 'Old rose' } },
                    { name: 'type',       in: 'query', schema: { type: 'string', example: 'vaas' } },
                    { name: 'material',   in: 'query', schema: { type: 'string', example: 'glas (materiaal)' } },
                    { name: 'hasParts',   in: 'query', schema: { type: 'boolean', default: false } },
                    { name: 'isPartOf',   in: 'query', schema: { type: 'boolean', default: false } },
                    { name: 'agent',      in: 'query', description: 'Filter by agent PID or full URI.', schema: { type: 'string', example: 'DMG-A-00162' } }
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
        }
    }
}