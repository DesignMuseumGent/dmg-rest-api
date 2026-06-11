import { fetchByAgentID } from "../../../utils/parsers.js";
import { supabase } from '../../../../supabaseClient.js';
import { applyBiosToObj, cidocType, parseBios } from '../../../utils/agentHelpers.js'

// ---------------------------------------------------------------------------
// SHARED HELPERS
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// SINGLE AGENT
// ---------------------------------------------------------------------------

export function requestAgent(app, BASE_URI) {
    const agentHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json')
        res.setHeader('Content-Disposition', 'inline')

        try {
            const record = await fetchByAgentID(req.params.agentPID)
            if (!record || record.length === 0) {
                return res.status(404).json({ error: 'Agent not found' })
            }

            const row = record[0] ?? {}
            const obj = row["json_ld_v2"] ?? {}

            if (row["generated_at_time"]) {
                const lastModified = new Date(row["generated_at_time"]).toUTCString()
                res.setHeader('Last-Modified', lastModified)
                res.setHeader('ETag', `"${req.params.agentPID}-${new Date(row["generated_at_time"]).getTime()}"`)
                res.setHeader('Cache-Control', 'public, max-age=3600')
            }

            applyBiosToObj(obj, row)

            return res.status(200).json(obj)

        } catch (error) {
            console.error(error)
            return res.status(500).json({ error: 'Error fetching agent data' })
        }
    }

    const headHandler = async (req, res) => {
        res.setHeader('Content-Type', 'application/ld+json')
        try {
            const { data, error } = await supabase
                .from('dmg_personen_LDES')
                .select('"agent_ID", generated_at_time')
                .eq('agent_ID', req.params.agentPID)
                .maybeSingle()

            if (error) return res.status(500).end()
            if (!data)  return res.status(404).end()

            if (data['generated_at_time']) {
                const lastModified = new Date(data['generated_at_time']).toUTCString()
                res.setHeader('Last-Modified', lastModified)
                res.setHeader('ETag', `"${req.params.agentPID}-${new Date(data['generated_at_time']).getTime()}"`)
                res.setHeader('Cache-Control', 'public, max-age=3600')
            }

            return res.status(200).end()
        } catch (error) {
            console.error('Error handling HEAD request:', error)
            return res.status(500).end()
        }
    }

    app.get('/id/agent/:agentPID', agentHandler)
    app.get('/id/ark:/29417/agent/:agentPID', agentHandler)
    app.head('/id/agent/:agentPID', headHandler)
    app.head('/id/ark:/29417/agent/:agentPID', headHandler)
}