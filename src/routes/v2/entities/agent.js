import { fetchByAgentID } from "../../../utils/parsers.js";

export function requestAgent(app, BASE_URI) {
    const agentHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json');
        res.setHeader('Content-Disposition', 'inline');

        try {
            const record = await fetchByAgentID(req.params.agentPID);
            if (!record || record.length === 0) {
                return res.status(404).json({ error: 'Agent not found' });
            }

            const row = record[0] ?? {};
            const obj = row["json_ld_v2"] ?? {};

            if (obj["@context"]) {
                obj["@context"]["dcterms"] = "http://purl.org/dc/terms/";
            }

            // Add wikipedia bios as crm:E33_Linguistic_Object
            let biosRaw = row["wikipedia_bios"];
            const linguisticObjects = [];

            const pushBio = (text, lang, src) => {

                if (!text || typeof text !== 'string') return;
                if (text.trim().toLowerCase() === 'no data') return; // ← add this

                const entry = {
                    "@type": "crm:E33_Linguistic_Object",
                    "rdfs:label": text,
                    "crm:P2_has_type": {
                        "@id": "https://data.designmuseumgent.be/v2/id/type/biography",
                        "@type": "crm:E55_Type",
                        "rdfs:label": "Biografie"
                    }
                };

                if (lang) entry["crm:P72_has_language"] = { "rdfs:label": lang };

                if (src) {
                    entry["crm:P67_refers_to"] = { "@id": src };
                    if (src.includes("wikipedia.org")) {
                        entry["dcterms:license"] = "https://creativecommons.org/licenses/by-sa/4.0/";
                    }
                }
                linguisticObjects.push(entry);

            };

            // parse biosRaw and call pushBio
            try {
                if (typeof biosRaw === 'string') {
                    const trimmed = biosRaw.trim();
                    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                        try { biosRaw = JSON.parse(trimmed); } catch {}
                    }
                }

                if (Array.isArray(biosRaw)) {
                    for (const b of biosRaw) {
                        if (!b || typeof b !== 'object') continue;
                        const text = b['@value'] || b.value || b.text || b.bio || b.snippet;
                        const lang = b['@language'] || b.language || b.lang;
                        const src = b['dcterms:source'] || b.source || b.url;
                        pushBio(text, lang, src);
                    }
                } else if (biosRaw && typeof biosRaw === 'object') {
                    for (const [lang, v] of Object.entries(biosRaw)) {
                        if (typeof v === 'string') {
                            pushBio(v, lang);
                        } else if (v && typeof v === 'object') {
                            const text = v['@value'] || v.value || v.text || v.bio || v.snippet;
                            const src = v['dcterms:source'] || v.source || v.url;
                            pushBio(text, lang, src);
                        }
                    }
                } else if (typeof biosRaw === 'string') {
                    pushBio(biosRaw);
                }
            } catch (e) {
                console.error('Error parsing wikipedia_bios:', e);
            }

            if (linguisticObjects.length > 0) {
                obj["crm:P67i_is_referred_to_by"] = linguisticObjects;
            }

            return res.status(200).json(obj);

        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Error fetching agent data' });
        }
    }

    app.get("/id/agent/:agentPID", agentHandler);
    app.get("/id/ark:/29417/agent/:agentPID", agentHandler);
}