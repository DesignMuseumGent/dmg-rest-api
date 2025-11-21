import {fetchLDESRecordByAgentID} from "../../utils/parsers.js";
import console from "node:console";

export function requestAgent(app, BASE_URI) {
    const agentHandler = async(req, res) => {
        res.setHeader('Content-type', 'application/ld+json');
        res.setHeader('Content-Dispositon', 'inline');

        try {
            console.log(req.params.agentPID);
            const rows = await fetchLDESRecordByAgentID(req.params.agentPID);
            if (!rows || rows.length === 0) {
                return res.status(404).send('Agent not found');
            }

            const row = rows[0] || {};
            const obj = (row["LDES_raw"] && row["LDES_raw"]["object"]) ? row["LDES_raw"]["object"] : {};

            // Normalize wikipedia bios into crm:P3_has_note if present
            let biosRaw = row["wikipedia_bios"];
            const notes = [];

            const pushIfValid = (val, lang, src) => {
                if (!val || typeof val !== 'string') return;
                const entry = { "@value": val };
                if (lang && typeof lang === 'string') entry["@language"] = lang;
                if (src && typeof src === 'string') entry["dcterms:source"] = src;
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
                console.error('Error parsing wikipedia_bios:', e);
            }

            if (notes.length > 0) {
                const existing = Array.isArray(obj['crm:P3_has_note']) ? obj['crm:P3_has_note'] : [];
                obj['crm:P3_has_note'] = [...existing, ...notes];
            }

            return res.status(200).json(obj);

        } catch (error) {
            console.error(error);
            return res.status(500).send('Error fetching agent data');
        }
    }

    app.get('/v1/id/agent/:agentPID', agentHandler);
    app.get('/v1/id/ark:/29417/agent/:agentPID', agentHandler);
}
