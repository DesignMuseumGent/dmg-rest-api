import { fetchPaginatedAgents } from "../../utils/parsers.js";

const COMMON_CONTEXT = [
    "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/persoon-basis.jsonld",
    "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/cultureel-erfgoed-object-ap.jsonld",
    "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/cultureel-erfgoed-event-ap.jsonld",
];

export function requestAgents(app, BASE_URI) {
    app.get("/v1/id/agents/", async (req, res) => {
        try {
            // Step 1: Set headers
            res.setHeader("Content-type", "application/ld+json");
            res.setHeader("Content-Disposition", "inline");

            // Step 2: Extract query parameters
            let { pageNumber = 1, itemsPerPage = 20, fullRecord = true } = req.query;
            pageNumber = Math.max(Number(pageNumber), 1); // Ensure positive page number
            itemsPerPage = Math.max(Number(itemsPerPage), 1); // Ensure positive items per page
            fullRecord = fullRecord === "true"; // Convert string to boolean

            const from = (pageNumber - 1) * itemsPerPage;
            const to = pageNumber * itemsPerPage - 1;

            // Step 3: Fetch paginated data from the database
            const { data: agentsData, total } = await fetchPaginatedAgents(from, to);

            if (!agentsData || agentsData.length === 0) {
                return res.status(404).json({ error: "No agents found for the requested page." });
            }

            // Step 4: Prepare data structure (enrich fullRecord with wikipedia_bios notes)
            const filteredAgentsData = fullRecord
                ? agentsData.map((agent) => {
                    const obj = agent?.LDES_raw?.object ? { ...agent.LDES_raw.object } : {};

                    // Parse wikipedia_bios into crm:P3_has_note entries (same logic as single agent endpoint)
                    let biosRaw = agent.wikipedia_bios;
                    const notes = [];

                    const pushIfValid = (val, lang, src) => {
                        if (!val || typeof val !== 'string') return;
                        const entry = { "@value": val };
                        if (lang && typeof lang === 'string') entry["@language"] = lang;
                        if (src && typeof src === 'string') entry["dcterms:source"] = src;

                        // Automatically add CC BY-SA 4.0 if the source is Wikipedia
                        if (src && src.includes('wikipedia.org')) {
                            entry["dcterms:license"] = "https://creativecommons.org/licenses/by-sa/4.0/";
                        }

                        notes.push(entry);
                    };

                    try {
                        if (typeof biosRaw === 'string') {
                            const trimmed = biosRaw.trim();
                            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                                try { biosRaw = JSON.parse(trimmed); } catch {}
                            }
                        }

                        if (Array.isArray(biosRaw)) {
                            for (const b of biosRaw) {
                                if (!b || typeof b !== 'object') continue;
                                if (b['@value']) {
                                    pushIfValid(b['@value'], b['@language'], b['dcterms:source'] || b['source'] || b['url']);
                                } else if (b.value || b.text || b.bio || b.snippet) {
                                    pushIfValid(b.value || b.text || b.bio || b.snippet, b.language || b.lang, b['dcterms:source'] || b.source || b.url);
                                } else if (typeof b.string === 'string') {
                                    pushIfValid(b.string, b.language || b.lang, b.source || b.url);
                                }
                            }
                        } else if (biosRaw && typeof biosRaw === 'object') {
                            for (const [lang, v] of Object.entries(biosRaw)) {
                                if (typeof v === 'string') {
                                    pushIfValid(v, lang);
                                } else if (v && typeof v === 'object') {
                                    const text = v.value || v.text || v.bio || v.snippet || v['@value'];
                                    const language = lang || v.language || v.lang || v['@language'];
                                    const src = v['dcterms:source'] || v.source || v.url;
                                    pushIfValid(text, language, src);
                                }
                            }
                        } else if (typeof biosRaw === 'string') {
                            pushIfValid(biosRaw);
                        }
                    } catch (e) {
                        console.error('Error parsing wikipedia_bios for agent list:', e);
                    }

                    if (notes.length > 0) {
                        const existing = Array.isArray(obj['crm:P3_has_note']) ? obj['crm:P3_has_note'] : [];
                        obj['crm:P3_has_note'] = [...existing, ...notes];
                    }

                    return obj;
                })
                : agentsData.map((agent) => ({
                    "@context": COMMON_CONTEXT,
                    "@id": `${BASE_URI}id/agent/${agent.agent_ID}`,
                    "@type": "Persoon",
                    "Persoon.identificator": [
                        {
                            "@type": "Identificator",
                            "Identificator.identificator": {
                                "@value": agent.agent_ID,
                            },
                        },
                    ],
                }));

            // Step 5: Compute pagination metadata
            const totalPages = Math.ceil(total / itemsPerPage);

            // Step 6: Build the response
            // Build hydra navigation URLs that preserve current filters
            const qsBase = new URLSearchParams();
            qsBase.set("itemsPerPage", String(itemsPerPage));
            qsBase.set("fullRecord", String(fullRecord));
            const urlForPage = (p) => {
                const qs = new URLSearchParams(qsBase);
                qs.set("pageNumber", String(p));
                return `${BASE_URI}id/agents?${qs.toString()}`;
            };

            res.status(200).json({
                "@context": [
                    ...COMMON_CONTEXT,
                    { hydra: "http://www.w3.org/ns/hydra/context.jsonld" },
                ],
                "@type": "GecureerdeCollectie",
                "@id": `${BASE_URI}id/agents`,
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
                "GecureerdeCollectie.bestaatUit": filteredAgentsData,
            });
        } catch (error) {
            console.error("Error in requestAgents:", error);
            res.status(500).json({ error: "Internal server error." });
        }
    });
}