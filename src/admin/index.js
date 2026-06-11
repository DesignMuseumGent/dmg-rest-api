import { Router } from 'express'
import { supabase } from '../../supabaseClient.js'

// ---------------------------------------------------------------------------
// AGENT RELATION TYPES
// ---------------------------------------------------------------------------

const AGENT_RELATIONS = [
    // family
    { value: 'parent_of',    label: 'is parent of',     inverse: 'child_of',     inverseLabel: 'is child of' },
    { value: 'child_of',     label: 'is child of',      inverse: 'parent_of',    inverseLabel: 'is parent of' },
    { value: 'spouse_of',    label: 'is spouse of',     inverse: 'spouse_of',    inverseLabel: 'is spouse of' },
    { value: 'sibling_of',   label: 'is sibling of',    inverse: 'sibling_of',   inverseLabel: 'is sibling of' },
    // professional
    { value: 'employer_of',  label: 'is employer of',   inverse: 'employee_of',  inverseLabel: 'is employee of' },
    { value: 'employee_of',  label: 'is employee of',   inverse: 'employer_of',  inverseLabel: 'is employer of' },
    { value: 'mentor_of',    label: 'is mentor of',     inverse: 'student_of',   inverseLabel: 'is student of' },
    { value: 'student_of',   label: 'is student of',    inverse: 'mentor_of',    inverseLabel: 'is mentor of' },
    { value: 'collaborator', label: 'collaborates with', inverse: 'collaborator', inverseLabel: 'collaborates with' },
    // organisational
    { value: 'member_of',    label: 'is member of',     inverse: 'has_member',   inverseLabel: 'has member' },
    { value: 'has_member',   label: 'has member',       inverse: 'member_of',    inverseLabel: 'is member of' },
    { value: 'founded',      label: 'founded',          inverse: 'founded_by',   inverseLabel: 'was founded by' },
    { value: 'founded_by',   label: 'was founded by',   inverse: 'founded',      inverseLabel: 'founded' },
]

const RELATION_MAP = {}
AGENT_RELATIONS.forEach(r => { RELATION_MAP[r.value] = r.label })

// ---------------------------------------------------------------------------
// SETUP
// ---------------------------------------------------------------------------

export function setupAdmin(app) {

    const adminRouter = Router()

    // ---------------------------------------------------------------------------
    // AUTH MIDDLEWARE
    // ---------------------------------------------------------------------------

    const requireAuth = (req, res, next) => {
        if (req.session?.user) return next()
        return res.redirect('/admin/login')
    }

    // ---------------------------------------------------------------------------
    // LOGIN
    // ---------------------------------------------------------------------------

    adminRouter.get('/login', (req, res) => {
        if (req.session?.user) return res.redirect('/admin')
        res.send(loginPage(req.query.error))
    })

    adminRouter.post('/login', async (req, res) => {
        const { email, password } = req.body
        if (!email || !password) return res.redirect('/admin/login?error=missing')

        const { data: user, error } = await supabase
            .from('dmg_admin_users')
            .select('id, email, password, name, can_delete')
            .eq('email', email.toLowerCase().trim())
            .eq('password', password)
            .maybeSingle()

        if (error || !user) return res.redirect('/admin/login?error=invalid')

        await supabase
            .from('dmg_admin_users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', user.id)

        req.session.user = {
            id: user.id,
            email: user.email,
            name: user.name,
            canDelete: user.can_delete
        }

        return res.redirect('/admin')
    })

    adminRouter.get('/logout', (req, res) => {
        req.session.destroy()
        return res.redirect('/admin/login')
    })

    // ---------------------------------------------------------------------------
    // DASHBOARD
    // ---------------------------------------------------------------------------

    adminRouter.get('/', requireAuth, async (req, res) => {
        const [
            { count: mediaCount },
            { count: projectsCount },
            { count: exhibitionsMediaCount },
            { count: publicationsCount },
            { count: translationsCount },
            { count: relationsCount }
        ] = await Promise.all([
            supabase.from('dmg_objects_media').select('*', { count: 'exact', head: true }),
            supabase.from('dmg_objects_projects').select('*', { count: 'exact', head: true }),
            supabase.from('dmg_exhibitions_media').select('*', { count: 'exact', head: true }),
            supabase.from('dmg_exhibitions_publications').select('*', { count: 'exact', head: true }),
            supabase.from('dmg_tentoonstelling_LDES').select('*', { count: 'exact', head: true }).not('title_FR', 'is', null),
            supabase.from('dmg_agent_relations').select('*', { count: 'exact', head: true })
        ])
        res.send(dashboardPage(req.session.user, { mediaCount, projectsCount, exhibitionsMediaCount, publicationsCount, translationsCount, relationsCount }))
    })

    // ---------------------------------------------------------------------------
    // OBJECT MEDIA
    // ---------------------------------------------------------------------------

    adminRouter.get('/media', requireAuth, async (req, res) => {
        const search = req.query.q?.trim() || null
        let query = supabase
            .from('dmg_objects_media')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200)
        if (search) query = query.ilike('objectNumber', `%${search}%`)
        const { data, error } = await query
        res.send(mediaPage(data || [], error?.message, req.query.success, search, req.session.user))
    })

    adminRouter.post('/media/add', requireAuth, async (req, res) => {
        const { objectNumber, title, url, type, date } = req.body
        if (!objectNumber || !url || !type) return res.redirect('/admin/media?error=missing+required+fields')

        const { data: obj } = await supabase
            .from('dmg_objects_LDES')
            .select('objectNumber')
            .eq('objectNumber', objectNumber)
            .maybeSingle()
        if (!obj) return res.redirect('/admin/media?error=object+not+found')

        const { error } = await supabase.from('dmg_objects_media').insert({ objectNumber, title, url, type, date })
        if (error) return res.redirect('/admin/media?error=' + encodeURIComponent(error.message))
        return res.redirect('/admin/media?success=1')
    })

    adminRouter.post('/media/delete/:id', requireAuth, async (req, res) => {
        if (!req.session.user.canDelete) return res.status(403).send('Not authorised to delete')
        await supabase.from('dmg_objects_media').delete().eq('id', req.params.id)
        return res.redirect('/admin/media')
    })

    // ---------------------------------------------------------------------------
    // PROJECTS
    // ---------------------------------------------------------------------------

    adminRouter.get('/projects', requireAuth, async (req, res) => {
        const search = req.query.q?.trim() || null
        let query = supabase
            .from('dmg_objects_projects')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200)
        if (search) query = query.ilike('objectNumber', `%${search}%`)
        const { data, error } = await query
        res.send(projectsPage(data || [], error?.message, req.query.success, search, req.session.user))
    })

    adminRouter.post('/projects/add', requireAuth, async (req, res) => {
        const { objectNumber, title, url, date } = req.body
        if (!objectNumber || !title) return res.redirect('/admin/projects?error=missing+required+fields')

        const { data: obj } = await supabase
            .from('dmg_objects_LDES')
            .select('objectNumber')
            .eq('objectNumber', objectNumber)
            .maybeSingle()
        if (!obj) return res.redirect('/admin/projects?error=object+not+found')

        const { error } = await supabase.from('dmg_objects_projects').insert({ objectNumber, title, url, date })
        if (error) return res.redirect('/admin/projects?error=' + encodeURIComponent(error.message))
        return res.redirect('/admin/projects?success=1')
    })

    adminRouter.post('/projects/delete/:id', requireAuth, async (req, res) => {
        if (!req.session.user.canDelete) return res.status(403).send('Not authorised to delete')
        await supabase.from('dmg_objects_projects').delete().eq('id', req.params.id)
        return res.redirect('/admin/projects')
    })

    // ---------------------------------------------------------------------------
    // EXHIBITION AUTOCOMPLETE API
    // ---------------------------------------------------------------------------

    adminRouter.get('/api/exhibitions', requireAuth, async (req, res) => {
        const q = req.query.q?.trim()
        if (!q || q.length < 2) return res.json([])
        const { data } = await supabase
            .from('dmg_tentoonstelling_LDES')
            .select('exh_PID, title_NL, title_EN')
            .or(`title_NL.ilike.%${q}%,title_EN.ilike.%${q}%,exh_PID.ilike.%${q}%`)
            .limit(10)
        res.json((data || []).map(r => ({
            pid: r.exh_PID,
            label: r.title_NL || r.title_EN || r.exh_PID
        })))
    })

    adminRouter.get('/api/exhibition-translations', requireAuth, async (req, res) => {
        const pid = req.query.pid?.trim()
        if (!pid) return res.json({})

        const { data } = await supabase
            .from('dmg_tentoonstelling_LDES')
            .select('title_NL, title_FR, title_EN, text_NL, text_FR, text_EN, curator, json_ld_v2')
            .eq('exh_PID', pid)
            .maybeSingle()

        if (!data) return res.json({})

        const harvestedTitle = data.json_ld_v2?.['rdfs:label'] ?? null
        const { json_ld_v2, ...rest } = data
        res.json({ ...rest, harvestedTitle })
    })

    adminRouter.get('/api/exhibition-assets', requireAuth, async (req, res) => {
        const pids = req.query.pids?.split(',').filter(Boolean) || []
        if (!pids.length) return res.json({})

        const results = {}

        const { data: posterFiles } = await supabase.storage
            .from('posters')
            .list('', { limit: 1000 })

        const posterSet = new Set(
            (posterFiles || []).map(f => f.name.replace(/\.[^.]+$/, ''))
        )

        await Promise.all(pids.map(async (pid) => {
            const viewsResult = await supabase.storage
                .from('exhibition_views')
                .list(pid, { limit: 100 })

            results[pid] = {
                hasPoster: posterSet.has(pid),
                viewCount: (viewsResult.data || []).filter(f => f.name && !f.name.startsWith('.')).length
            }
        }))

        res.json(results)
    })

    // ---------------------------------------------------------------------------
    // AGENT AUTOCOMPLETE API
    // ---------------------------------------------------------------------------

    adminRouter.get('/api/agents', requireAuth, async (req, res) => {
        const q = req.query.q?.trim()
        if (!q || q.length < 2) return res.json([])
        const { data } = await supabase
            .from('dmg_personen_LDES')
            .select('agent_ID, json_ld_v2')
            .textSearch('search_vector', q, { type: 'websearch', config: 'simple' })
            .limit(10)
        res.json((data || []).map(r => ({
            id:    r.agent_ID,
            label: r.json_ld_v2?.['rdfs:label'] ?? r.agent_ID
        })))
    })

    // ---------------------------------------------------------------------------
    // EXHIBITION MEDIA
    // ---------------------------------------------------------------------------

    adminRouter.get('/exhibitions', requireAuth, async (req, res) => {
        const search = req.query.q?.trim() || null
        let query = supabase
            .from('dmg_exhibitions_media')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200)
        if (search) query = query.ilike('exh_PID', `%${search}%`)
        const { data, error } = await query
        res.send(exhibitionsPage(data || [], error?.message, req.query.success, search, req.session.user))
    })

    adminRouter.post('/exhibitions/add', requireAuth, async (req, res) => {
        const { exh_PID, title, url, date } = req.body
        if (!exh_PID || !url) return res.redirect('/admin/exhibitions?error=missing+required+fields')

        const { data: exh } = await supabase
            .from('dmg_tentoonstelling_LDES')
            .select('exh_PID')
            .eq('exh_PID', exh_PID)
            .maybeSingle()
        if (!exh) return res.redirect('/admin/exhibitions?error=exhibition+not+found')

        const { error } = await supabase
            .from('dmg_exhibitions_media')
            .insert({ exh_PID, title, url, date, type: 'VIDEO' })
        if (error) return res.redirect('/admin/exhibitions?error=' + encodeURIComponent(error.message))
        return res.redirect('/admin/exhibitions?success=1')
    })

    adminRouter.post('/exhibitions/delete/:id', requireAuth, async (req, res) => {
        if (!req.session.user.canDelete) return res.status(403).send('Not authorised to delete')
        await supabase.from('dmg_exhibitions_media').delete().eq('id', req.params.id)
        return res.redirect('/admin/exhibitions')
    })

    // ---------------------------------------------------------------------------
    // EXHIBITION PUBLICATIONS
    // ---------------------------------------------------------------------------

    adminRouter.get('/publications', requireAuth, async (req, res) => {
        const search = req.query.q?.trim() || null
        let query = supabase
            .from('dmg_exhibitions_publications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200)
        if (search) query = query.ilike('exh_PID', `%${search}%`)
        const { data, error } = await query
        res.send(publicationsPage(data || [], error?.message, req.query.success, search, req.session.user))
    })

    adminRouter.post('/publications/add', requireAuth, async (req, res) => {
        const { exh_PID, title, url, year } = req.body
        if (!exh_PID || !title) return res.redirect('/admin/publications?error=missing+required+fields')

        const { data: exh } = await supabase
            .from('dmg_tentoonstelling_LDES')
            .select('exh_PID')
            .eq('exh_PID', exh_PID)
            .maybeSingle()
        if (!exh) return res.redirect('/admin/publications?error=exhibition+not+found')

        const { error } = await supabase
            .from('dmg_exhibitions_publications')
            .insert({ exh_PID, title, url: url || null, year: year || null })
        if (error) return res.redirect('/admin/publications?error=' + encodeURIComponent(error.message))
        return res.redirect('/admin/publications?success=1')
    })

    adminRouter.post('/publications/delete/:id', requireAuth, async (req, res) => {
        if (!req.session.user.canDelete) return res.status(403).send('Not authorised to delete')
        await supabase.from('dmg_exhibitions_publications').delete().eq('id', req.params.id)
        return res.redirect('/admin/publications')
    })

    // ---------------------------------------------------------------------------
    // EXHIBITION TRANSLATIONS
    // ---------------------------------------------------------------------------

    adminRouter.get('/translations', requireAuth, async (req, res) => {
        const search = req.query.q?.trim() || null

        let query = supabase
            .from('dmg_tentoonstelling_LDES')
            .select('id, exh_PID, title_NL, title_FR, title_EN, text_NL, text_FR, text_EN, curator, dmg_exhibitions_media(type), dmg_exhibitions_publications(id)')
            .not('exh_PID', 'is', null)
            .order('exh_PID', { ascending: true })
            .limit(1000)

        if (search) query = query.ilike('exh_PID', `%${search}%`)

        const { data, error } = await query
        res.send(translationsPage(data || [], error?.message, req.query.success, req.query.error, search, req.session.user))
    })

    adminRouter.post('/translations/save', requireAuth, async (req, res) => {
        const { exh_PID, title_NL, title_FR, title_EN, text_NL, text_FR, text_EN, curator } = req.body

        if (!exh_PID) return res.redirect('/admin/translations?error=missing+exhibition')

        const { data: exh } = await supabase
            .from('dmg_tentoonstelling_LDES')
            .select('id')
            .eq('exh_PID', exh_PID)
            .maybeSingle()
        if (!exh) return res.redirect('/admin/translations?error=exhibition+not+found')

        const payload = {}
        if (title_NL?.trim()) payload.title_NL = title_NL.trim()
        if (title_FR?.trim()) payload.title_FR = title_FR.trim()
        if (title_EN?.trim()) payload.title_EN = title_EN.trim()
        if (text_NL?.trim())  payload.text_NL  = text_NL.trim()
        if (text_FR?.trim())  payload.text_FR  = text_FR.trim()
        if (text_EN?.trim())  payload.text_EN  = text_EN.trim()
        if (curator?.trim())  payload.curator  = curator.trim()

        if (Object.keys(payload).length === 0) {
            return res.redirect('/admin/translations?error=no+content+provided')
        }

        const { error } = await supabase
            .from('dmg_tentoonstelling_LDES')
            .update(payload)
            .eq('exh_PID', exh_PID)

        if (error) return res.redirect('/admin/translations?error=' + encodeURIComponent(error.message))
        return res.redirect('/admin/translations?success=1')
    })

    // ---------------------------------------------------------------------------
    // AGENT RELATIONS
    // ---------------------------------------------------------------------------

    adminRouter.get('/relations', requireAuth, async (req, res) => {
        const search = req.query.q?.trim() || null

        const [{ data, error }, { data: statsData }] = await Promise.all([
            (() => {
                let query = supabase
                    .from('dmg_agent_relations')
                    .select('id, agent_id_a, relation, agent_id_b, created_at')
                    .order('agent_id_a', { ascending: true })
                    .order('relation',   { ascending: true })
                    .limit(500)
                if (search) query = query.or(`agent_id_a.ilike.%${search}%,agent_id_b.ilike.%${search}%`)
                return query
            })(),
            supabase
                .from('dmg_agent_relations')
                .select('relation')
        ])

        const rows = data || []

        // build relation type stats from full unfiltered set
        const stats = {}
        for (const r of (statsData || [])) {
            stats[r.relation] = (stats[r.relation] ?? 0) + 1
        }

        // enrich with agent labels
        if (rows.length > 0) {
            const ids = [...new Set(rows.flatMap(r => [r.agent_id_a, r.agent_id_b]))]
            const { data: agents } = await supabase
                .from('dmg_personen_LDES')
                .select('agent_ID, json_ld_v2')
                .in('agent_ID', ids)

            const labelMap = {}
            for (const a of (agents || [])) {
                labelMap[a.agent_ID] = a.json_ld_v2?.['rdfs:label'] ?? a.agent_ID
            }
            for (const r of rows) {
                r.label_a = labelMap[r.agent_id_a] ?? r.agent_id_a
                r.label_b = labelMap[r.agent_id_b] ?? r.agent_id_b
            }
        }

        // group by agent_id_a
        const grouped = []
        const seen = {}
        for (const r of rows) {
            if (!seen[r.agent_id_a]) {
                seen[r.agent_id_a] = { agent_id: r.agent_id_a, label: r.label_a, relations: [] }
                grouped.push(seen[r.agent_id_a])
            }
            seen[r.agent_id_a].relations.push({
                id:         r.id,
                relation:   r.relation,
                agent_id_b: r.agent_id_b,
                label_b:    r.label_b
            })
        }

        res.send(relationsPage(grouped, rows.length, stats, error?.message, req.query.success, req.query.error, search, req.session.user))
    })

    adminRouter.post('/relations/add', requireAuth, async (req, res) => {
        const { agent_id_a, relation, agent_id_b } = req.body

        if (!agent_id_a || !relation || !agent_id_b) {
            return res.redirect('/admin/relations?error=missing+required+fields')
        }
        if (agent_id_a === agent_id_b) {
            return res.redirect('/admin/relations?error=agent+cannot+relate+to+itself')
        }

        const [{ data: agentA }, { data: agentB }] = await Promise.all([
            supabase.from('dmg_personen_LDES').select('agent_ID').eq('agent_ID', agent_id_a).maybeSingle(),
            supabase.from('dmg_personen_LDES').select('agent_ID').eq('agent_ID', agent_id_b).maybeSingle()
        ])
        if (!agentA) return res.redirect('/admin/relations?error=agent+A+not+found')
        if (!agentB) return res.redirect('/admin/relations?error=agent+B+not+found')

        const relDef = AGENT_RELATIONS.find(r => r.value === relation)
        if (!relDef) return res.redirect('/admin/relations?error=invalid+relation+type')

        const rows = [{ agent_id_a, relation, agent_id_b }]
        if (relDef.inverse !== relation || agent_id_a !== agent_id_b) {
            rows.push({ agent_id_a: agent_id_b, relation: relDef.inverse, agent_id_b: agent_id_a })
        }

        const { error } = await supabase
            .from('dmg_agent_relations')
            .upsert(rows, { onConflict: 'agent_id_a,relation,agent_id_b', ignoreDuplicates: true })

        if (error) return res.redirect('/admin/relations?error=' + encodeURIComponent(error.message))
        return res.redirect('/admin/relations?success=1')
    })

    adminRouter.post('/relations/delete/:id', requireAuth, async (req, res) => {
        if (!req.session.user.canDelete) return res.status(403).send('Not authorised to delete')

        const { data: rel } = await supabase
            .from('dmg_agent_relations')
            .select('agent_id_a, relation, agent_id_b')
            .eq('id', req.params.id)
            .maybeSingle()

        if (rel) {
            const relDef = AGENT_RELATIONS.find(r => r.value === rel.relation)
            await supabase.from('dmg_agent_relations').delete().eq('id', req.params.id)
            if (relDef) {
                await supabase.from('dmg_agent_relations')
                    .delete()
                    .eq('agent_id_a', rel.agent_id_b)
                    .eq('relation',   relDef.inverse)
                    .eq('agent_id_b', rel.agent_id_a)
            }
        }

        return res.redirect('/admin/relations')
    })

    app.use('/admin', adminRouter)
}

// ---------------------------------------------------------------------------
// FONT & STYLES
// ---------------------------------------------------------------------------

const F    = `'Museum', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`
const MONO = `'Courier New', Courier, monospace`

const fontFace = `<style>
    @font-face { font-family:'Museum'; src:url('/fonts/Museum-Light.otf') format('opentype'); font-weight:300; font-style:normal; font-display:swap; }
    @font-face { font-family:'Museum'; src:url('/fonts/Museum-Regular.otf') format('opentype'); font-weight:400; font-style:normal; font-display:swap; }
    @font-face { font-family:'Museum'; src:url('/fonts/Museum-Medium.otf') format('opentype'); font-weight:500; font-style:normal; font-display:swap; }
    @font-face { font-family:'Museum'; src:url('/fonts/Museum-Bold.otf') format('opentype'); font-weight:700; font-style:normal; font-display:swap; }
</style>`

const css = `
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:${F}; background:#f5f5f5; color:#333; }
a { font-family:${F}; }

header { background:#1a1a1a; color:white; padding:1rem 2rem; display:flex; justify-content:space-between; align-items:center; }
header a { color:#ccc; text-decoration:none; font-size:0.875rem; }
header a:hover { color:white; }
.header-right { display:flex; align-items:center; gap:1rem; }
.header-user { color:#888; font-size:0.875rem; }
.badge { display:inline-block; padding:0.15rem 0.5rem; border-radius:4px; font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin-left:0.5rem; }
.badge-admin { background:#2d3748; color:#a0aec0; }
.badge-viewer { background:#2d3748; color:#718096; }

nav { background:#2a2a2a; padding:0.75rem 2rem; display:flex; gap:1.5rem; flex-wrap:wrap; align-items:center; }
nav a { color:#aaa; text-decoration:none; font-size:0.875rem; }
nav a:hover, nav a.active { color:white; }
.nav-sep { color:#444; font-size:0.75rem; }

main { max-width:1100px; margin:2rem auto; padding:0 2rem; }
h1 { font-size:1.5rem; font-weight:700; margin-bottom:1.5rem; }
h2 { font-size:1rem; font-weight:500; margin-bottom:1rem; color:#555; }
h3 { font-size:0.8125rem; font-weight:700; color:#333; text-transform:uppercase; letter-spacing:0.06em; }

.card { background:white; border-radius:8px; padding:1.5rem; margin-bottom:1.5rem; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
.card-link { text-decoration:none; display:block; }
.card-link .card { cursor:pointer; transition:box-shadow 0.15s; }
.card-link .card:hover { box-shadow:0 4px 12px rgba(0,0,0,0.12); }
.card-link p { color:#888; font-size:0.875rem; margin-top:0.375rem; }
.card-stat { font-size:2rem; font-weight:700; color:#1a1a1a; margin:0.375rem 0 0; line-height:1; }

.dashboard-section { margin-bottom:2rem; }
.dashboard-section-title { font-size:0.75rem; font-weight:600; color:#bbb; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:0.75rem; padding-bottom:0.5rem; border-bottom:1px solid #eee; }
.dashboard-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(200px,1fr)); gap:1rem; }

.form-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
.form-group { display:flex; flex-direction:column; gap:0.375rem; }
.form-group.full { grid-column:1/-1; }
label { font-size:0.75rem; font-weight:500; color:#555; text-transform:uppercase; letter-spacing:0.06em; }
input, select, textarea { padding:0.5rem 0.75rem; border:1px solid #ddd; border-radius:6px; font-size:0.9375rem; width:100%; font-family:${F}; background:white; }
textarea { resize:vertical; line-height:1.6; }
input:focus, select:focus, textarea:focus { outline:none; border-color:#555; box-shadow:0 0 0 3px rgba(0,0,0,0.06); }

.btn { padding:0.5rem 1.25rem; border:none; border-radius:6px; font-size:0.9375rem; cursor:pointer; font-weight:500; font-family:${F}; }
.btn-primary { background:#1a1a1a; color:white; }
.btn-primary:hover { background:#333; }
.btn-sm { padding:0.25rem 0.625rem; font-size:0.8125rem; }
.btn-ghost { background:none; border:1px solid #ddd; color:#999; }
.btn-ghost:hover { border-color:#e53e3e; color:#e53e3e; }

.search-bar { display:flex; gap:0.75rem; align-items:flex-end; margin-bottom:1.25rem; }
.search-bar .form-group { flex:1; margin:0; }
.search-bar .btn { flex-shrink:0; height:38px; }
.search-clear { font-size:0.8125rem; color:#999; text-decoration:none; align-self:center; }
.search-clear:hover { color:#333; }

table { width:100%; border-collapse:collapse; font-size:0.9375rem; }
th { text-align:left; padding:0.625rem 0.75rem; font-size:0.75rem; color:#888; border-bottom:2px solid #eee; text-transform:uppercase; letter-spacing:0.06em; font-weight:500; }
td { padding:0.75rem; border-bottom:1px solid #f0f0f0; vertical-align:middle; }
tr:last-child td { border-bottom:none; }

.tag { display:inline-block; padding:0.2rem 0.5rem; border-radius:4px; font-size:0.75rem; font-weight:700; }
.tag-video    { background:#ebf4ff; color:#2b6cb0; }
.tag-audio    { background:#f0fff4; color:#276749; }
.tag-pub      { background:#faf5ff; color:#6b46c1; }
.tag-views    { background:#fef3c7; color:#92400e; }
.tag-relation { background:#e6f3ff; color:#1a5276; }
.alert { padding:0.75rem 1rem; border-radius:6px; margin-bottom:1rem; font-size:0.9375rem; }
.alert-success { background:#f0fff4; color:#276749; border:1px solid #c6f6d5; }
.alert-error   { background:#fff5f5; color:#c53030; border:1px solid #fed7d7; }
.mono { font-family:${MONO}; font-size:0.875rem; color:#666; }
.link { color:#4a90d9; font-size:0.875rem; }
.empty { color:#aaa; font-style:italic; padding:2rem; text-align:center; }
.count { font-size:0.875rem; color:#888; margin-bottom:0.75rem; }
.no-perm { color:#ddd; font-size:0.8125rem; }
.perm-note { font-size:0.8125rem; color:#aaa; margin-top:0.75rem; }
.check-yes { color:#276749; }
.check-no  { color:#ddd; }

.section-divider { display:flex; align-items:center; gap:0.75rem; margin:1.5rem 0 1rem; }
.section-divider h3 { white-space:nowrap; }
.section-divider::after { content:''; flex:1; border-top:1px solid #eee; }

.reference-box { background:#f8f8f8; border:1px solid #eee; border-radius:6px; padding:0.75rem 1rem; margin-top:0.75rem; display:none; }
.reference-label { font-size:0.75rem; font-weight:500; color:#aaa; text-transform:uppercase; letter-spacing:0.06em; display:block; margin-bottom:0.25rem; }
.reference-value { color:#333; font-size:0.9375rem; }

.ac-wrap { position:relative; }
.ac-dropdown { display:none; position:absolute; top:100%; left:0; right:0; background:white; border:1px solid #ddd; border-top:none; border-radius:0 0 6px 6px; box-shadow:0 4px 12px rgba(0,0,0,0.1); z-index:100; max-height:240px; overflow-y:auto; }
.ac-item { padding:0.625rem 0.875rem; cursor:pointer; font-size:0.9375rem; border-bottom:1px solid #f5f5f5; }
.ac-item:hover { background:#f5f5f5; }
.ac-item:last-child { border-bottom:none; }
.ac-item-pid { font-size:0.8125rem; color:#aaa; margin-left:0.5rem; font-family:${MONO}; }
.ac-selected { display:none; margin-top:0.375rem; align-items:center; gap:0.5rem; }
.ac-selected-label { font-size:0.875rem; color:#333; font-weight:500; }
.ac-selected-pid { font-size:0.8125rem; color:#aaa; font-family:${MONO}; }
.ac-clear { font-size:0.8125rem; color:#999; text-decoration:none; margin-left:0.25rem; }
.ac-clear:hover { color:#c53030; }

.relations-grouped { display:flex; flex-direction:column; gap:0; }
.relation-group { border:1px solid #eee; border-radius:6px; margin-bottom:0.75rem; overflow:hidden; }
.relation-group-header { display:flex; justify-content:space-between; align-items:center; padding:0.75rem 1rem; background:#fafafa; border-bottom:1px solid #eee; }
.relation-group-name { font-weight:500; font-size:0.9375rem; margin-right:0.625rem; }
.relation-group-pid { font-size:0.8125rem; color:#aaa; }
.relation-group-count { font-size:0.8125rem; color:#aaa; white-space:nowrap; }
.relation-group-table { width:100%; border-collapse:collapse; }
.relation-group-table td { padding:0.625rem 1rem; border-bottom:1px solid #f5f5f5; vertical-align:middle; }
.relation-group-table tr:last-child td { border-bottom:none; }
.relation-group-table tr:hover td { background:#fafafa; }
.relation-stats { display:flex; gap:1.5rem; flex-wrap:wrap; margin-bottom:1.25rem; padding:1rem; background:#fafafa; border:1px solid #eee; border-radius:6px; }
.relation-stat-group { display:flex; flex-direction:column; gap:0.25rem; min-width:120px; }
.relation-stat-group-title { font-size:0.6875rem; font-weight:600; color:#bbb; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:0.25rem; }
.relation-stat-item { display:flex; justify-content:space-between; align-items:center; gap:1rem; }
.relation-stat-label { font-size:0.8125rem; color:#555; }
.relation-stat-count { font-size:0.8125rem; font-weight:600; color:#1a1a1a; font-family:${MONO}; }
`

// ---------------------------------------------------------------------------
// LAYOUT
// ---------------------------------------------------------------------------

const layout = (title, content, path = '', user = null) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} — DMG Admin</title>
    ${fontFace}
    <style>${css}</style>
</head>
<body>
    <header>
        <a href="/admin" style="display:flex;align-items:center;text-decoration:none;">
            <img src="/images/dmg-logo.svg" alt="Design Museum Gent" style="height:28px;filter:invert(1);">
        </a>
        <div class="header-right">
            ${user ? `<span class="header-user">${user.name || user.email}<span class="badge ${user.canDelete ? 'badge-admin' : 'badge-viewer'}">${user.canDelete ? 'admin' : 'viewer'}</span></span>` : ''}
            <a href="/admin/logout">Sign out</a>
        </div>
    </header>
    <nav>
        <a href="/admin" ${path === '/' ? 'class="active"' : ''}>Dashboard</a>
        <span class="nav-sep">·</span>
        <a href="/admin/media" ${path === '/media' ? 'class="active"' : ''}>Object media</a>
        <a href="/admin/projects" ${path === '/projects' ? 'class="active"' : ''}>Projects</a>
        <span class="nav-sep">·</span>
        <a href="/admin/exhibitions" ${path === '/exhibitions' ? 'class="active"' : ''}>Exhibition media</a>
        <a href="/admin/publications" ${path === '/publications' ? 'class="active"' : ''}>Publications</a>
        <a href="/admin/translations" ${path === '/translations' ? 'class="active"' : ''}>Exhibition information</a>
        <span class="nav-sep">·</span>
        <a href="/admin/relations" ${path === '/relations' ? 'class="active"' : ''}>Agent relations</a>
    </nav>
    <main>${content}</main>
</body>
</html>`

// ---------------------------------------------------------------------------
// LOGIN PAGE
// ---------------------------------------------------------------------------

const loginPage = (error) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DMG Admin — Login</title>
    ${fontFace}
    <style>
        * { box-sizing:border-box; margin:0; padding:0; }
        body { font-family:${F}; background:#f5f5f5; display:flex; align-items:center; justify-content:center; min-height:100vh; }
        .card { background:white; padding:2.5rem; border-radius:12px; box-shadow:0 4px 24px rgba(0,0,0,0.08); width:360px; }
        .logo { margin-bottom:1.5rem; }
        .logo img { height:32px; }
        p { color:#888; font-size:0.9375rem; margin-bottom:1.5rem; }
        label { display:block; font-size:0.75rem; font-weight:500; color:#555; margin-bottom:0.375rem; text-transform:uppercase; letter-spacing:0.06em; }
        input { width:100%; padding:0.625rem 0.875rem; border:1px solid #ddd; border-radius:6px; font-size:1rem; margin-bottom:1rem; font-family:${F}; }
        input:focus { outline:none; border-color:#555; box-shadow:0 0 0 3px rgba(0,0,0,0.06); }
        button { width:100%; padding:0.75rem; background:#1a1a1a; color:white; border:none; border-radius:6px; font-size:1rem; font-weight:500; cursor:pointer; font-family:${F}; }
        button:hover { background:#333; }
        .error { background:#fff5f5; color:#c53030; padding:0.75rem; border-radius:6px; font-size:0.9375rem; margin-bottom:1rem; }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo"><img src="/images/dmg-logo.svg" alt="Design Museum Gent"></div>
        <p>Collection API — Admin</p>
        ${error === 'invalid' ? '<div class="error">Invalid email or password.</div>' : ''}
        ${error === 'missing' ? '<div class="error">Please enter your email and password.</div>' : ''}
        <form method="POST" action="/admin/login" autocomplete="off">
            <label>Email</label>
            <input type="email" name="email" autofocus required autocomplete="off">
            <label>Password</label>
            <input type="password" name="password" required autocomplete="new-password">
            <button type="submit">Sign in</button>
        </form>
    </div>
</body>
</html>`

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

const mkAlert = (type, msg) => `<div class="alert alert-${type}">${msg}</div>`

const alerts = (success, error) => [
    success ? mkAlert('success', 'Saved successfully.') : '',
    error   ? mkAlert('error', error) : ''
].join('')

const searchBar = (action, value, label, placeholder) => `
    <form method="GET" action="${action}" class="search-bar">
        <div class="form-group">
            <label>${label}</label>
            <input type="text" name="q" value="${value || ''}" placeholder="${placeholder}">
        </div>
        <button type="submit" class="btn btn-primary">Search</button>
        ${value ? `<a href="${action}" class="search-clear">Clear</a>` : ''}
    </form>`

const deleteBtn = (action, canDelete) => canDelete
    ? `<form method="POST" action="${action}" style="display:inline">
           <button type="submit" class="btn btn-sm btn-ghost" onclick="return confirm('Delete this entry?')">delete</button>
       </form>`
    : '<span class="no-perm">—</span>'

const permNote = (canDelete) => canDelete ? '' :
    '<p class="perm-note">You do not have permission to delete entries.</p>'

const resultCount = (n, search) =>
    `<p class="count">${n} ${n === 1 ? 'entry' : 'entries'}${search ? ` for "${search}"` : ''}</p>`

const sectionDivider = (title) =>
    `<div class="section-divider"><h3>${title}</h3></div>`

// exhibition autocomplete widget
const acWidget = () => `
    <div class="ac-wrap">
        <input type="text" id="ac-input" placeholder="Search by title or PID..." autocomplete="off">
        <div class="ac-dropdown" id="ac-dropdown"></div>
    </div>
    <input type="hidden" name="exh_PID" id="ac-value" required>
    <div class="ac-selected" id="ac-selected">
        <span class="ac-selected-label" id="ac-label"></span>
        <span class="ac-selected-pid" id="ac-pid"></span>
        <a href="#" class="ac-clear" id="ac-clear">&#10005; clear</a>
    </div>`

const acScript = (prefillFields = []) => {
    const prefillJs = prefillFields.length > 0 ? `
        fetch('/admin/api/exhibition-translations?pid=' + encodeURIComponent(selectedPid))
            .then(r => r.json())
            .then(d => {
                const ref = document.getElementById('harvested-title-box')
                const val = document.getElementById('harvested-title')
                if (ref && val) {
                    val.textContent   = d.harvestedTitle || '—'
                    ref.style.display = 'block'
                }
                ${prefillFields.map(f => `
                const f_${f} = document.querySelector('[name="${f}"]')
                if (f_${f} && d['${f}'] != null) f_${f}.value = d['${f}']`).join('')}
            })` : ''

    const clearJs = prefillFields.map(f => `
        const c_${f} = document.querySelector('[name="${f}"]')
        if (c_${f}) c_${f}.value = ''`).join('')

    return `<script>
(function () {
    const input    = document.getElementById('ac-input')
    const dropdown = document.getElementById('ac-dropdown')
    const hidden   = document.getElementById('ac-value')
    const selected = document.getElementById('ac-selected')
    const lbl      = document.getElementById('ac-label')
    const pid      = document.getElementById('ac-pid')
    const clear    = document.getElementById('ac-clear')
    let timer

    dropdown.addEventListener('click', (e) => {
        const item = e.target.closest('[data-pid]')
        if (!item) return
        const selectedPid   = item.dataset.pid
        hidden.value        = selectedPid
        lbl.textContent     = item.dataset.label
        pid.textContent     = selectedPid
        selected.style.display = 'flex'
        input.style.display    = 'none'
        dropdown.style.display = 'none'
        ${prefillJs}
    })

    input.addEventListener('input', () => {
        clearTimeout(timer)
        const q = input.value.trim()
        if (q.length < 2) { dropdown.style.display = 'none'; return }
        timer = setTimeout(async () => {
            const res  = await fetch('/admin/api/exhibitions?q=' + encodeURIComponent(q))
            const data = await res.json()
            if (!data.length) { dropdown.style.display = 'none'; return }
            dropdown.innerHTML = data.map(d =>
                '<div class="ac-item" data-pid="' + d.pid + '" data-label="' + d.label.replace(/"/g, '&quot;') + '">' +
                d.label + '<span class="ac-item-pid">' + d.pid + '</span></div>'
            ).join('')
            dropdown.style.display = 'block'
        }, 250)
    })

    clear.addEventListener('click', (e) => {
        e.preventDefault()
        hidden.value           = ''
        input.value            = ''
        input.style.display    = 'block'
        selected.style.display = 'none'
        dropdown.style.display = 'none'
        const ref = document.getElementById('harvested-title-box')
        if (ref) ref.style.display = 'none'
        ${clearJs}
        input.focus()
    })

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.ac-wrap')) dropdown.style.display = 'none'
    })
})()
</script>`
}

// asset checker — separate to avoid nested template literal issues
const assetCheckerScript = () => `<script>
(function () {
    const rows = document.querySelectorAll('tr[data-pid]')
    const pids = [...new Set([...rows].map(r => r.dataset.pid).filter(Boolean))]
    if (!pids.length) return

    const chunk = (arr, n) => Array.from(
        { length: Math.ceil(arr.length / n) },
        (_, i) => arr.slice(i * n, i * n + n)
    )

    chunk(pids, 20).forEach(batch => {
        fetch('/admin/api/exhibition-assets?pids=' + batch.join(','))
            .then(r => r.json())
            .then(data => {
                batch.forEach(pid => {
                    const asset = data[pid]
                    if (!asset) return
                    const posterCell = document.querySelector('.asset-poster[data-pid="' + pid + '"]')
                    const viewsCell  = document.querySelector('.asset-views[data-pid="'  + pid + '"]')
                    if (posterCell) {
                        posterCell.innerHTML = asset.hasPoster
                            ? '<span class="check-yes">&#10003;</span>'
                            : '<span class="check-no">&#8212;</span>'
                    }
                    if (viewsCell) {
                        viewsCell.innerHTML = asset.viewCount > 0
                            ? '<span class="tag tag-views">' + asset.viewCount + '</span>'
                            : '<span class="check-no">&#8212;</span>'
                    }
                })
            })
            .catch(() => {})
    })
})()
</script>`

// agent autocomplete widget — separate from exhibition widget to avoid ID conflicts
const agentAcWidget = (suffix) => `
    <div class="ac-wrap">
        <input type="text" id="ac-agent-input-${suffix}" placeholder="Search agent by name or ID..." autocomplete="off">
        <div class="ac-dropdown" id="ac-agent-dropdown-${suffix}"></div>
    </div>
    <input type="hidden" name="agent_id_${suffix}" id="ac-agent-value-${suffix}" required>
    <div class="ac-selected" id="ac-agent-selected-${suffix}">
        <span class="ac-selected-label" id="ac-agent-label-${suffix}"></span>
        <span class="ac-selected-pid" id="ac-agent-pid-${suffix}"></span>
        <a href="#" class="ac-clear" id="ac-agent-clear-${suffix}">&#10005; clear</a>
    </div>`

const agentAcScript = () => `<script>
(function () {
    ['a', 'b'].forEach(function (suffix) {
        var input    = document.getElementById('ac-agent-input-'    + suffix)
        var dropdown = document.getElementById('ac-agent-dropdown-' + suffix)
        var hidden   = document.getElementById('ac-agent-value-'    + suffix)
        var selected = document.getElementById('ac-agent-selected-' + suffix)
        var lbl      = document.getElementById('ac-agent-label-'    + suffix)
        var pid      = document.getElementById('ac-agent-pid-'      + suffix)
        var clear    = document.getElementById('ac-agent-clear-'    + suffix)
        var timer

        dropdown.addEventListener('click', function (e) {
            var item = e.target.closest('[data-id]')
            if (!item) return
            hidden.value           = item.dataset.id
            lbl.textContent        = item.dataset.label
            pid.textContent        = item.dataset.id
            selected.style.display = 'flex'
            input.style.display    = 'none'
            dropdown.style.display = 'none'
        })

        input.addEventListener('input', function () {
            clearTimeout(timer)
            var q = input.value.trim()
            if (q.length < 2) { dropdown.style.display = 'none'; return }
            timer = setTimeout(function () {
                fetch('/admin/api/agents?q=' + encodeURIComponent(q))
                    .then(function (r) { return r.json() })
                    .then(function (data) {
                        if (!data.length) { dropdown.style.display = 'none'; return }
                        dropdown.innerHTML = data.map(function (d) {
                            return '<div class="ac-item" data-id="' + d.id + '" data-label="' +
                                d.label.replace(/"/g, '&quot;') + '">' +
                                d.label + '<span class="ac-item-pid">' + d.id + '</span></div>'
                        }).join('')
                        dropdown.style.display = 'block'
                    })
            }, 250)
        })

        clear.addEventListener('click', function (e) {
            e.preventDefault()
            hidden.value           = ''
            input.value            = ''
            input.style.display    = 'block'
            selected.style.display = 'none'
            dropdown.style.display = 'none'
            input.focus()
        })

        document.addEventListener('click', function (e) {
            if (!e.target.closest('#ac-agent-input-' + suffix) &&
                !e.target.closest('#ac-agent-dropdown-' + suffix)) {
                dropdown.style.display = 'none'
            }
        })
    })
})()
</script>`

// ---------------------------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------------------------

const dashboardPage = (user, stats) => layout('Dashboard', `
    <h1>Dashboard</h1>

    <div class="dashboard-section">
        <div class="dashboard-section-title">Objects</div>
        <div class="dashboard-grid">
            <a href="/admin/media" class="card-link">
                <div class="card">
                    <h2>Object media</h2>
                    <div class="card-stat">${stats.mediaCount ?? '—'}</div>
                    <p>Video and audio resources linked to collection objects.</p>
                </div>
            </a>
            <a href="/admin/projects" class="card-link">
                <div class="card">
                    <h2>Projects</h2>
                    <div class="card-stat">${stats.projectsCount ?? '—'}</div>
                    <p>Creative projects inspired by collection objects.</p>
                </div>
            </a>
        </div>
    </div>

    <div class="dashboard-section">
        <div class="dashboard-section-title">Exhibitions</div>
        <div class="dashboard-grid">
            <a href="/admin/exhibitions" class="card-link">
                <div class="card">
                    <h2>Exhibition media</h2>
                    <div class="card-stat">${stats.exhibitionsMediaCount ?? '—'}</div>
                    <p>Video resources linked to exhibitions.</p>
                </div>
            </a>
            <a href="/admin/publications" class="card-link">
                <div class="card">
                    <h2>Publications</h2>
                    <div class="card-stat">${stats.publicationsCount ?? '—'}</div>
                    <p>Library records and catalogues linked to exhibitions.</p>
                </div>
            </a>
            <a href="/admin/translations" class="card-link">
                <div class="card">
                    <h2>Exhibition information</h2>
                    <div class="card-stat">${stats.translationsCount ?? '—'}</div>
                    <p>Exhibitions with FR translation. Add multilingual titles, descriptions and curators.</p>
                </div>
            </a>
        </div>
    </div>

    <div class="dashboard-section">
        <div class="dashboard-section-title">Agents</div>
        <div class="dashboard-grid">
            <a href="/admin/relations" class="card-link">
                <div class="card">
                    <h2>Agent relations</h2>
                    <div class="card-stat">${stats.relationsCount ?? '—'}</div>
                    <p>Family, professional and organisational relationships between agents.</p>
                </div>
            </a>
        </div>
    </div>

    <div class="dashboard-section">
        <div class="dashboard-section-title">API</div>
        <div class="dashboard-grid">
            <a href="https://data.designmuseumgent.be" target="_blank" class="card-link">
                <div class="card">
                    <h2>Documentation ↗</h2>
                    <p>data.designmuseumgent.be</p>
                </div>
            </a>
            <a href="/api-docs" target="_blank" class="card-link">
                <div class="card">
                    <h2>Swagger UI ↗</h2>
                    <p>Interactive API explorer.</p>
                </div>
            </a>
        </div>
    </div>
`, '/', user)

// ---------------------------------------------------------------------------
// OBJECT MEDIA PAGE
// ---------------------------------------------------------------------------

const mediaPage = (rows, error, success, search, user) => layout('Object media', `
    <h1>Object media</h1>
    ${alerts(success, error)}

    <div class="card">
        <h2>Add media</h2>
        <form method="POST" action="/admin/media/add">
            <div class="form-grid">
                <div class="form-group">
                    <label>Object number *</label>
                    <input type="text" name="objectNumber" placeholder="1987-1105" required>
                </div>
                <div class="form-group">
                    <label>Type *</label>
                    <select name="type" required>
                        <option value="">— select —</option>
                        <option value="VIDEO">Video</option>
                        <option value="AUDIO">Audio</option>
                    </select>
                </div>
                <div class="form-group full">
                    <label>URL *</label>
                    <input type="url" name="url" placeholder="https://www.youtube.com/watch?v=..." required>
                </div>
                <div class="form-group">
                    <label>Title</label>
                    <input type="text" name="title" placeholder="Video title">
                </div>
                <div class="form-group">
                    <label>Year</label>
                    <input type="text" name="date" placeholder="2024" pattern="[0-9]{4}">
                </div>
            </div>
            <div style="margin-top:1rem;">
                <button type="submit" class="btn btn-primary">Add media</button>
            </div>
        </form>
    </div>

    <div class="card">
        <h2>Entries</h2>
        ${searchBar('/admin/media', search, 'Filter by object number', '1987, 0913, ...')}
        ${rows.length === 0
    ? `<p class="empty">${search ? `No media found for "${search}".` : 'No media entries yet.'}</p>`
    : `
        ${resultCount(rows.length, search)}
        <table>
            <thead><tr><th>Object</th><th>Type</th><th>Title</th><th>Year</th><th>URL</th><th></th></tr></thead>
            <tbody>
                ${rows.map(r => `
                <tr>
                    <td><span class="mono">${r.objectNumber}</span></td>
                    <td><span class="tag ${r.type === 'VIDEO' ? 'tag-video' : 'tag-audio'}">${r.type}</span></td>
                    <td>${r.title || '—'}</td>
                    <td>${r.date || '—'}</td>
                    <td><a href="${r.url}" target="_blank" class="link">↗ link</a></td>
                    <td>${deleteBtn(`/admin/media/delete/${r.id}`, user.canDelete)}</td>
                </tr>`).join('')}
            </tbody>
        </table>
        ${permNote(user.canDelete)}`}
    </div>
`, '/media', user)

// ---------------------------------------------------------------------------
// PROJECTS PAGE
// ---------------------------------------------------------------------------

const projectsPage = (rows, error, success, search, user) => layout('Projects', `
    <h1>Projects</h1>
    ${alerts(success, error)}

    <div class="card">
        <h2>Add project</h2>
        <form method="POST" action="/admin/projects/add">
            <div class="form-grid">
                <div class="form-group">
                    <label>Object number *</label>
                    <input type="text" name="objectNumber" placeholder="1987-1105" required>
                </div>
                <div class="form-group">
                    <label>Year</label>
                    <input type="text" name="date" placeholder="2024" pattern="[0-9]{4}">
                </div>
                <div class="form-group full">
                    <label>Title *</label>
                    <input type="text" name="title" placeholder="Project title" required>
                </div>
                <div class="form-group full">
                    <label>URL</label>
                    <input type="url" name="url" placeholder="https://...">
                </div>
            </div>
            <div style="margin-top:1rem;">
                <button type="submit" class="btn btn-primary">Add project</button>
            </div>
        </form>
    </div>

    <div class="card">
        <h2>Entries</h2>
        ${searchBar('/admin/projects', search, 'Filter by object number', '1987, 0913, ...')}
        ${rows.length === 0
    ? `<p class="empty">${search ? `No projects found for "${search}".` : 'No project entries yet.'}</p>`
    : `
        ${resultCount(rows.length, search)}
        <table>
            <thead><tr><th>Object</th><th>Title</th><th>Year</th><th>URL</th><th></th></tr></thead>
            <tbody>
                ${rows.map(r => `
                <tr>
                    <td><span class="mono">${r.objectNumber}</span></td>
                    <td>${r.title || '—'}</td>
                    <td>${r.date || '—'}</td>
                    <td>${r.url ? `<a href="${r.url}" target="_blank" class="link">↗ link</a>` : '—'}</td>
                    <td>${deleteBtn(`/admin/projects/delete/${r.id}`, user.canDelete)}</td>
                </tr>`).join('')}
            </tbody>
        </table>
        ${permNote(user.canDelete)}`}
    </div>
`, '/projects', user)

// ---------------------------------------------------------------------------
// EXHIBITIONS MEDIA PAGE
// ---------------------------------------------------------------------------

const exhibitionsPage = (rows, error, success, search, user) => layout('Exhibition media', `
    <h1>Exhibition media</h1>
    ${alerts(success, error)}

    <div class="card">
        <h2>Add video</h2>
        <form method="POST" action="/admin/exhibitions/add">
            <div class="form-grid">
                <div class="form-group full">
                    <label>Exhibition *</label>
                    ${acWidget()}
                </div>
                <div class="form-group full">
                    <label>URL *</label>
                    <input type="url" name="url" placeholder="https://www.youtube.com/watch?v=..." required>
                </div>
                <div class="form-group">
                    <label>Title</label>
                    <input type="text" name="title" placeholder="Video title">
                </div>
                <div class="form-group">
                    <label>Year</label>
                    <input type="text" name="date" placeholder="2024" pattern="[0-9]{4}">
                </div>
            </div>
            <div style="margin-top:1rem;">
                <button type="submit" class="btn btn-primary">Add video</button>
            </div>
        </form>
    </div>

    <div class="card">
        <h2>Entries</h2>
        ${searchBar('/admin/exhibitions', search, 'Filter by exhibition PID', 'TE_2020, ...')}
        ${rows.length === 0
    ? `<p class="empty">${search ? `No entries found for "${search}".` : 'No exhibition media entries yet.'}</p>`
    : `
        ${resultCount(rows.length, search)}
        <table>
            <thead><tr><th>Exhibition</th><th>Title</th><th>Year</th><th>URL</th><th></th></tr></thead>
            <tbody>
                ${rows.map(r => `
                <tr>
                    <td><span class="mono">${r.exh_PID}</span></td>
                    <td>${r.title || '—'}</td>
                    <td>${r.date || '—'}</td>
                    <td><a href="${r.url}" target="_blank" class="link">↗ link</a></td>
                    <td>${deleteBtn(`/admin/exhibitions/delete/${r.id}`, user.canDelete)}</td>
                </tr>`).join('')}
            </tbody>
        </table>
        ${permNote(user.canDelete)}`}
    </div>

    ${acScript()}
`, '/exhibitions', user)

// ---------------------------------------------------------------------------
// PUBLICATIONS PAGE
// ---------------------------------------------------------------------------

const publicationsPage = (rows, error, success, search, user) => layout('Publications', `
    <h1>Publications</h1>
    ${alerts(success, error)}

    <div class="card">
        <h2>Add publication</h2>
        <form method="POST" action="/admin/publications/add">
            <div class="form-grid">
                <div class="form-group full">
                    <label>Exhibition *</label>
                    ${acWidget()}
                </div>
                <div class="form-group full">
                    <label>Title *</label>
                    <input type="text" name="title" placeholder="Publication title" required>
                </div>
                <div class="form-group full">
                    <label>Library URL</label>
                    <input type="url" name="url" placeholder="https://catalog.designmuseumgent.be/...">
                </div>
                <div class="form-group">
                    <label>Year</label>
                    <input type="text" name="year" placeholder="2024" pattern="[0-9]{4}">
                </div>
            </div>
            <div style="margin-top:1rem;">
                <button type="submit" class="btn btn-primary">Add publication</button>
            </div>
        </form>
    </div>

    <div class="card">
        <h2>Entries</h2>
        ${searchBar('/admin/publications', search, 'Filter by exhibition PID', 'TE_2020, ...')}
        ${rows.length === 0
    ? `<p class="empty">${search ? `No publications found for "${search}".` : 'No publications yet.'}</p>`
    : `
        ${resultCount(rows.length, search)}
        <table>
            <thead><tr><th>Exhibition</th><th>Title</th><th>Year</th><th>URL</th><th></th></tr></thead>
            <tbody>
                ${rows.map(r => `
                <tr>
                    <td><span class="mono">${r.exh_PID}</span></td>
                    <td>${r.title || '—'}</td>
                    <td>${r.year || '—'}</td>
                    <td>${r.url ? `<a href="${r.url}" target="_blank" class="link">↗ link</a>` : '—'}</td>
                    <td>${deleteBtn(`/admin/publications/delete/${r.id}`, user.canDelete)}</td>
                </tr>`).join('')}
            </tbody>
        </table>
        ${permNote(user.canDelete)}`}
    </div>

    ${acScript()}
`, '/publications', user)

// ---------------------------------------------------------------------------
// AGENT RELATIONS PAGE
// ---------------------------------------------------------------------------

const relationsPage = (grouped, totalRows, stats, error, success, errorMsg, search, user) => {
    // group stats by category for display
    const statGroups = [
        {
            label: 'Family',
            keys: ['parent_of', 'child_of', 'spouse_of', 'sibling_of']
        },
        {
            label: 'Professional',
            keys: ['employer_of', 'employee_of', 'mentor_of', 'student_of', 'collaborator']
        },
        {
            label: 'Organisational',
            keys: ['member_of', 'has_member', 'founded', 'founded_by']
        }
    ]

    const statsStrip = Object.keys(stats).length === 0 ? '' : `
        <div class="relation-stats">
            ${statGroups.map(group => {
        const entries = group.keys
            .filter(k => stats[k])
            .map(k => `
                        <div class="relation-stat-item">
                            <span class="relation-stat-label">${RELATION_MAP[k] ?? k}</span>
                            <span class="relation-stat-count">${stats[k]}</span>
                        </div>`)
            .join('')
        if (!entries) return ''
        return `
                    <div class="relation-stat-group">
                        <div class="relation-stat-group-title">${group.label}</div>
                        ${entries}
                    </div>`
    }).join('')}
        </div>`

    return layout('Agent relations', `
    <h1>Agent relations</h1>
    ${alerts(success, errorMsg)}

    <div class="card">
        <h2>Add relation</h2>
        <form method="POST" action="/admin/relations/add">
            <div class="form-grid">
                <div class="form-group full">
                    <label>Agent A *</label>
                    ${agentAcWidget('a')}
                </div>
                <div class="form-group full">
                    <label>Relation *</label>
                    <select name="relation" required>
                        <option value="">— select —</option>
                        <optgroup label="Family">
                            <option value="parent_of">is parent of</option>
                            <option value="child_of">is child of</option>
                            <option value="spouse_of">is spouse of</option>
                            <option value="sibling_of">is sibling of</option>
                        </optgroup>
                        <optgroup label="Professional">
                            <option value="employer_of">is employer of</option>
                            <option value="employee_of">is employee of</option>
                            <option value="mentor_of">is mentor of</option>
                            <option value="student_of">is student of</option>
                            <option value="collaborator">collaborates with</option>
                        </optgroup>
                        <optgroup label="Organisational">
                            <option value="member_of">is member of</option>
                            <option value="has_member">has member</option>
                            <option value="founded">founded</option>
                            <option value="founded_by">was founded by</option>
                        </optgroup>
                    </select>
                    <span style="font-size:0.8125rem;color:#aaa;margin-top:0.25rem;">The inverse relation is stored automatically.</span>
                </div>
                <div class="form-group full">
                    <label>Agent B *</label>
                    ${agentAcWidget('b')}
                </div>
            </div>
            <div style="margin-top:1rem;">
                <button type="submit" class="btn btn-primary">Add relation</button>
            </div>
        </form>
    </div>

    <div class="card">
        <h2>Overview</h2>
        ${statsStrip}
        ${searchBar('/admin/relations', search, 'Filter by agent ID or name', 'DMG-A-00162')}
        ${grouped.length === 0
        ? `<p class="empty">${search ? `No relations found for "${search}".` : 'No agent relations added yet.'}</p>`
        : `
        <p class="count">${grouped.length} ${grouped.length === 1 ? 'agent' : 'agents'} · ${totalRows} ${totalRows === 1 ? 'relation' : 'relations'}${search ? ` matching "${search}"` : ''}</p>
        <div class="relations-grouped">
            ${grouped.map(group => `
            <div class="relation-group">
                <div class="relation-group-header">
                    <div>
                        <span class="relation-group-name">${group.label}</span>
                        <span class="mono relation-group-pid">${group.agent_id}</span>
                    </div>
                    <span class="relation-group-count">${group.relations.length} ${group.relations.length === 1 ? 'relation' : 'relations'}</span>
                </div>
                <table class="relation-group-table">
                    <tbody>
                        ${group.relations.map(r => `
                        <tr>
                            <td style="width:10rem"><span class="tag tag-relation">${RELATION_MAP[r.relation] ?? r.relation}</span></td>
                            <td>
                                <span style="font-weight:500">${r.label_b}</span>
                                <span class="mono" style="font-size:0.8125rem;color:#aaa;margin-left:0.5rem">${r.agent_id_b}</span>
                            </td>
                            <td style="width:5rem;text-align:right">${deleteBtn('/admin/relations/delete/' + r.id, user.canDelete)}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`).join('')}
        </div>
        <p style="font-size:0.8125rem;color:#aaa;margin-top:0.75rem;">Deleting a relation also removes its inverse.</p>
        ${permNote(user.canDelete)}`}
    </div>

    ${agentAcScript()}
`, '/relations', user)
}
// ---------------------------------------------------------------------------
// EXHIBITION TRANSLATIONS PAGE
// ---------------------------------------------------------------------------

const translationsPage = (rows, error, success, errorMsg, search, user) => layout('Exhibition information', `
    <h1>Exhibition information</h1>
    ${alerts(success, errorMsg)}

    <div class="card">
        <h2>Add or update</h2>
        <form method="POST" action="/admin/translations/save">
            <div class="form-grid">
                <div class="form-group full">
                    <label>Exhibition *</label>
                    ${acWidget()}
                    <div class="reference-box" id="harvested-title-box">
                        <span class="reference-label">Harvested title (NL — from source system)</span>
                        <span class="reference-value" id="harvested-title"></span>
                    </div>
                </div>
            </div>

            ${sectionDivider('Titles')}
            <div class="form-grid">
                <div class="form-group">
                    <label>Title NL</label>
                    <input type="text" name="title_NL" placeholder="Nederlandstalige titel">
                </div>
                <div class="form-group">
                    <label>Title FR</label>
                    <input type="text" name="title_FR" placeholder="Titre en français">
                </div>
                <div class="form-group full">
                    <label>Title EN</label>
                    <input type="text" name="title_EN" placeholder="English title">
                </div>
            </div>

            ${sectionDivider('Descriptions')}
            <div class="form-grid">
                <div class="form-group full">
                    <label>Description NL</label>
                    <textarea name="text_NL" rows="4" placeholder="Nederlandstalige beschrijving"></textarea>
                </div>
                <div class="form-group full">
                    <label>Description FR</label>
                    <textarea name="text_FR" rows="4" placeholder="Description en français"></textarea>
                </div>
                <div class="form-group full">
                    <label>Description EN</label>
                    <textarea name="text_EN" rows="4" placeholder="English description"></textarea>
                </div>
            </div>

            ${sectionDivider('Curator')}
            <div class="form-grid">
                <div class="form-group full">
                    <label>Curator(s)</label>
                    <input type="text" name="curator" placeholder="Kaat Debo, Lotte Vandermeersch — comma-separated for multiple">
                    <span style="font-size:0.8125rem;color:#aaa;margin-top:0.25rem;">Separate multiple curators with a comma.</span>
                </div>
            </div>

            <div style="margin-top:1.5rem;">
                <button type="submit" class="btn btn-primary">Save</button>
            </div>
        </form>
    </div>

    <div class="card">
        <h2>Overview</h2>
        ${searchBar('/admin/translations', search, 'Filter by exhibition PID', 'TE_2020, ...')}
        ${rows.length === 0
    ? `<p class="empty">${search ? `No entries found for "${search}".` : 'No exhibition information added yet.'}</p>`
    : `
        ${resultCount(rows.length, search)}
        <table>
            <thead>
                <tr>
                    <th>Exhibition</th>
                    <th>Title NL</th>
                    <th>Title FR</th>
                    <th>Title EN</th>
                    <th>Desc NL</th>
                    <th>Desc FR</th>
                    <th>Desc EN</th>
                    <th>Curator</th>
                    <th>Media</th>
                    <th>Pubs</th>
                    <th>Poster</th>
                    <th>Views</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map(r => {
        const media  = r.dmg_exhibitions_media || []
        const pubs   = r.dmg_exhibitions_publications || []
        const videos = media.filter(m => m.type === 'VIDEO').length
        const audio  = media.filter(m => m.type === 'AUDIO').length
        const mediaCell = media.length === 0
            ? '<span class="check-no">—</span>'
            : [
                videos > 0 ? `<span class="tag tag-video">${videos} video</span>` : '',
                audio  > 0 ? `<span class="tag tag-audio">${audio} audio</span>`  : ''
            ].filter(Boolean).join(' ')
        const pubsCell = pubs.length > 0
            ? `<span class="tag tag-pub">${pubs.length}</span>`
            : '<span class="check-no">—</span>'
        return `
                    <tr data-pid="${r.exh_PID || ''}">
                        <td><span class="mono">${r.exh_PID || r.id}</span></td>
                        <td class="${r.title_NL ? 'check-yes' : 'check-no'}" title="${r.title_NL || ''}">${r.title_NL ? '✓' : '—'}</td>
                        <td class="${r.title_FR ? 'check-yes' : 'check-no'}" title="${r.title_FR || ''}">${r.title_FR ? '✓' : '—'}</td>
                        <td class="${r.title_EN ? 'check-yes' : 'check-no'}" title="${r.title_EN || ''}">${r.title_EN ? '✓' : '—'}</td>
                        <td class="${r.text_NL ? 'check-yes' : 'check-no'}">${r.text_NL ? '✓' : '—'}</td>
                        <td class="${r.text_FR ? 'check-yes' : 'check-no'}">${r.text_FR ? '✓' : '—'}</td>
                        <td class="${r.text_EN ? 'check-yes' : 'check-no'}">${r.text_EN ? '✓' : '—'}</td>
                        <td>${r.curator || '—'}</td>
                        <td>${mediaCell}</td>
                        <td>${pubsCell}</td>
                        <td class="asset-poster" data-pid="${r.exh_PID || ''}"><span class="check-no">…</span></td>
                        <td class="asset-views"  data-pid="${r.exh_PID || ''}"><span class="check-no">…</span></td>
                    </tr>`
    }).join('')}
            </tbody>
        </table>`}
    </div>

    ${assetCheckerScript()}
    ${acScript(['title_NL', 'title_FR', 'title_EN', 'text_NL', 'text_FR', 'text_EN', 'curator'])}
`, '/translations', user)