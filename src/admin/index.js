import { Router } from 'express'
import { supabase } from '../../supabaseClient.js'

// ---------------------------------------------------------------------------
// AGENT RELATION TYPES
// ---------------------------------------------------------------------------

const AGENT_RELATIONS = [
    { value: 'parent_of',    label: 'is parent of',      inverse: 'child_of',     inverseLabel: 'is child of' },
    { value: 'child_of',     label: 'is child of',       inverse: 'parent_of',    inverseLabel: 'is parent of' },
    { value: 'spouse_of',    label: 'is spouse of',      inverse: 'spouse_of',    inverseLabel: 'is spouse of' },
    { value: 'sibling_of',   label: 'is sibling of',     inverse: 'sibling_of',   inverseLabel: 'is sibling of' },
    { value: 'employer_of',  label: 'is employer of',    inverse: 'employee_of',  inverseLabel: 'is employee of' },
    { value: 'employee_of',  label: 'is employee of',    inverse: 'employer_of',  inverseLabel: 'is employer of' },
    { value: 'mentor_of',    label: 'is mentor of',      inverse: 'student_of',   inverseLabel: 'is student of' },
    { value: 'student_of',   label: 'is student of',     inverse: 'mentor_of',    inverseLabel: 'is mentor of' },
    { value: 'collaborator', label: 'collaborates with', inverse: 'collaborator', inverseLabel: 'collaborates with' },
    { value: 'member_of',    label: 'is member of',      inverse: 'has_member',   inverseLabel: 'has member' },
    { value: 'has_member',   label: 'has member',        inverse: 'member_of',    inverseLabel: 'is member of' },
    { value: 'founded',      label: 'founded',           inverse: 'founded_by',   inverseLabel: 'was founded by' },
    { value: 'founded_by',   label: 'was founded by',    inverse: 'founded',      inverseLabel: 'founded' },
]

const RELATION_MAP = {}
AGENT_RELATIONS.forEach(r => { RELATION_MAP[r.value] = r.label })

// ---------------------------------------------------------------------------
// SETUP
// ---------------------------------------------------------------------------

export function setupAdmin(app) {

    const adminRouter = Router()

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
        let query = supabase.from('dmg_objects_media').select('*').order('created_at', { ascending: false }).limit(200)
        if (search) query = query.ilike('objectNumber', `%${search}%`)
        const { data, error } = await query
        res.send(mediaPage(data || [], error?.message, req.query.success, search, req.session.user))
    })

    adminRouter.post('/media/add', requireAuth, async (req, res) => {
        const { objectNumber, title, url, type, date } = req.body
        if (!objectNumber || !url || !type) return res.redirect('/admin/media?error=missing+required+fields')
        const { data: obj } = await supabase.from('dmg_objects_LDES').select('objectNumber').eq('objectNumber', objectNumber).maybeSingle()
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
        let query = supabase.from('dmg_objects_projects').select('*').order('created_at', { ascending: false }).limit(200)
        if (search) query = query.ilike('objectNumber', `%${search}%`)
        const { data, error } = await query
        res.send(projectsPage(data || [], error?.message, req.query.success, search, req.session.user))
    })

    adminRouter.post('/projects/add', requireAuth, async (req, res) => {
        const { objectNumber, title, url, date } = req.body
        if (!objectNumber || !title) return res.redirect('/admin/projects?error=missing+required+fields')
        const { data: obj } = await supabase.from('dmg_objects_LDES').select('objectNumber').eq('objectNumber', objectNumber).maybeSingle()
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
    // EXHIBITION APIs
    // ---------------------------------------------------------------------------

    adminRouter.get('/api/exhibitions', requireAuth, async (req, res) => {
        const q = req.query.q?.trim()
        if (!q || q.length < 2) return res.json([])
        const { data } = await supabase
            .from('dmg_tentoonstelling_LDES')
            .select('exh_PID, title_NL, title_EN')
            .or(`title_NL.ilike.%${q}%,title_EN.ilike.%${q}%,exh_PID.ilike.%${q}%`)
            .limit(10)
        res.json((data || []).map(r => ({ pid: r.exh_PID, label: r.title_NL || r.title_EN || r.exh_PID })))
    })

    adminRouter.get('/api/exhibition-assets', requireAuth, async (req, res) => {
        const pids = req.query.pids?.split(',').filter(Boolean) || []
        if (!pids.length) return res.json({})
        const results = {}
        await Promise.all(pids.map(async (pid) => {
            const viewsResult = await supabase.storage.from('exhibition_views').list(pid, { limit: 100 })
            results[pid] = {
                viewCount: (viewsResult.data || []).filter(f => f.name && !f.name.startsWith('.')).length
            }
        }))
        res.json(results)
    })

    // ---------------------------------------------------------------------------
    // AGENT API
    // ---------------------------------------------------------------------------

    adminRouter.get('/api/agents', requireAuth, async (req, res) => {
        const q = req.query.q?.trim()
        if (!q || q.length < 2) return res.json([])
        const { data } = await supabase
            .from('dmg_personen_LDES')
            .select('agent_ID, json_ld_v2')
            .textSearch('search_vector', q, { type: 'websearch', config: 'simple' })
            .limit(10)
        res.json((data || []).map(r => ({ id: r.agent_ID, label: r.json_ld_v2?.['rdfs:label'] ?? r.agent_ID })))
    })

    // ---------------------------------------------------------------------------
    // EXHIBITIONS — overview
    // ---------------------------------------------------------------------------

    adminRouter.get('/exhibitions/media', requireAuth, (req, res) => res.redirect('/admin/exhibitions'))
    adminRouter.get('/publications',      requireAuth, (req, res) => res.redirect('/admin/exhibitions'))
    adminRouter.get('/translations',      requireAuth, (req, res) => res.redirect('/admin/exhibitions'))

    adminRouter.get('/exhibitions', requireAuth, async (req, res) => {
        const search = req.query.q?.trim() || null

        let query = supabase
            .from('dmg_tentoonstelling_LDES')
            .select('id, exh_PID, title_NL, title_FR, title_EN, text_NL, text_FR, text_EN, curator, dmg_exhibitions_media(*), dmg_exhibitions_publications(*)')
            .not('exh_PID', 'is', null)
            .order('exh_PID', { ascending: true })
            .limit(1000)
        if (search) query = query.or(`exh_PID.ilike.%${search}%,title_NL.ilike.%${search}%,title_EN.ilike.%${search}%`)

        const [{ data, error }, { data: posterFiles }] = await Promise.all([
            query,
            supabase.storage.from('posters').list('', { limit: 1000 })
        ])

        const posterSet = new Set((posterFiles || []).map(f => f.name.replace(/\.[^.]+$/, '')))

        res.send(exhibitionsPage(data || [], error?.message, req.query.success, req.query.error, search, posterSet, req.session.user))
    })

    // ---------------------------------------------------------------------------
    // EXHIBITIONS — detail POST routes (all redirect back to detail page)
    // ---------------------------------------------------------------------------

    adminRouter.post('/exhibitions/add', requireAuth, async (req, res) => {
        const { exh_PID, title, url, date } = req.body
        if (!exh_PID || !url) return res.redirect(`/admin/exhibitions/${exh_PID}?error=missing+required+fields`)
        const { data: exh } = await supabase.from('dmg_tentoonstelling_LDES').select('exh_PID').eq('exh_PID', exh_PID).maybeSingle()
        if (!exh) return res.redirect(`/admin/exhibitions/${exh_PID}?error=exhibition+not+found`)
        const { error } = await supabase.from('dmg_exhibitions_media').insert({ exh_PID, title, url, date, type: 'VIDEO' })
        if (error) return res.redirect(`/admin/exhibitions/${exh_PID}?error=` + encodeURIComponent(error.message))
        return res.redirect(`/admin/exhibitions/${exh_PID}?success=1`)
    })

    adminRouter.post('/exhibitions/delete/:id', requireAuth, async (req, res) => {
        if (!req.session.user.canDelete) return res.status(403).send('Not authorised to delete')
        const { exh_PID } = req.body
        await supabase.from('dmg_exhibitions_media').delete().eq('id', req.params.id)
        return res.redirect(`/admin/exhibitions/${exh_PID}`)
    })

    adminRouter.post('/publications/add', requireAuth, async (req, res) => {
        const { exh_PID, title, url, year } = req.body
        if (!exh_PID || !title) return res.redirect(`/admin/exhibitions/${exh_PID}?error=missing+required+fields`)
        const { data: exh } = await supabase.from('dmg_tentoonstelling_LDES').select('exh_PID').eq('exh_PID', exh_PID).maybeSingle()
        if (!exh) return res.redirect(`/admin/exhibitions/${exh_PID}?error=exhibition+not+found`)
        const { error } = await supabase.from('dmg_exhibitions_publications').insert({ exh_PID, title, url: url || null, year: year || null })
        if (error) return res.redirect(`/admin/exhibitions/${exh_PID}?error=` + encodeURIComponent(error.message))
        return res.redirect(`/admin/exhibitions/${exh_PID}?success=1`)
    })

    adminRouter.post('/publications/delete/:id', requireAuth, async (req, res) => {
        if (!req.session.user.canDelete) return res.status(403).send('Not authorised to delete')
        const { exh_PID } = req.body
        await supabase.from('dmg_exhibitions_publications').delete().eq('id', req.params.id)
        return res.redirect(`/admin/exhibitions/${exh_PID}`)
    })

    adminRouter.post('/translations/save', requireAuth, async (req, res) => {
        const { exh_PID, title_NL, title_FR, title_EN, text_NL, text_FR, text_EN, curator } = req.body
        if (!exh_PID) return res.redirect('/admin/exhibitions?error=missing+exhibition')
        const { data: exh } = await supabase.from('dmg_tentoonstelling_LDES').select('id').eq('exh_PID', exh_PID).maybeSingle()
        if (!exh) return res.redirect(`/admin/exhibitions/${exh_PID}?error=exhibition+not+found`)
        const payload = {}
        if (title_NL?.trim()) payload.title_NL = title_NL.trim()
        if (title_FR?.trim()) payload.title_FR = title_FR.trim()
        if (title_EN?.trim()) payload.title_EN = title_EN.trim()
        if (text_NL?.trim())  payload.text_NL  = text_NL.trim()
        if (text_FR?.trim())  payload.text_FR  = text_FR.trim()
        if (text_EN?.trim())  payload.text_EN  = text_EN.trim()
        if (curator?.trim())  payload.curator  = curator.trim()
        if (Object.keys(payload).length === 0) return res.redirect(`/admin/exhibitions/${exh_PID}?error=no+content+provided`)
        const { error } = await supabase.from('dmg_tentoonstelling_LDES').update(payload).eq('exh_PID', exh_PID)
        if (error) return res.redirect(`/admin/exhibitions/${exh_PID}?error=` + encodeURIComponent(error.message))
        return res.redirect(`/admin/exhibitions/${exh_PID}?success=1`)
    })

    // ---------------------------------------------------------------------------
    // EXHIBITIONS — image uploads
    // ---------------------------------------------------------------------------

    const getPublicUrl = (bucket, path) => {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path)
        return data?.publicUrl ?? null
    }

    adminRouter.post('/exhibitions/upload-poster', requireAuth, async (req, res) => {
        const { exh_PID } = req.body
        if (!exh_PID) return res.redirect('/admin/exhibitions?error=missing+exhibition')
        if (!req.files?.poster) return res.redirect(`/admin/exhibitions/${exh_PID}?error=no+file+selected`)
        const file = req.files.poster
        const ext  = file.name.split('.').pop().toLowerCase()
        if (!['jpg','jpeg','png','webp'].includes(ext)) return res.redirect(`/admin/exhibitions/${exh_PID}?error=invalid+file+type`)
        const path = `${exh_PID}.${ext}`
        const { data: existing } = await supabase.storage.from('posters').list('', { limit: 100 })
        const old = (existing || []).find(f => f.name.startsWith(exh_PID + '.') && f.name !== path)
        if (old) await supabase.storage.from('posters').remove([old.name])
        const { error } = await supabase.storage.from('posters').upload(path, file.data, { contentType: file.mimetype, upsert: true })
        if (error) return res.redirect(`/admin/exhibitions/${exh_PID}?error=` + encodeURIComponent(error.message))
        return res.redirect(`/admin/exhibitions/${exh_PID}?success=1`)
    })

    adminRouter.post('/exhibitions/delete-poster', requireAuth, async (req, res) => {
        if (!req.session.user.canDelete) return res.status(403).send('Not authorised to delete')
        const { exh_PID, filename } = req.body
        if (!exh_PID || !filename) return res.redirect(`/admin/exhibitions/${exh_PID}`)
        await supabase.storage.from('posters').remove([filename])
        return res.redirect(`/admin/exhibitions/${exh_PID}?success=1`)
    })

    adminRouter.post('/exhibitions/upload-view', requireAuth, async (req, res) => {
        const { exh_PID } = req.body
        if (!exh_PID) return res.redirect('/admin/exhibitions?error=missing+exhibition')
        if (!req.files?.view) return res.redirect(`/admin/exhibitions/${exh_PID}?error=no+file+selected`)

        // normalise to array — single file comes as object, multiple as array
        const files  = Array.isArray(req.files.view) ? req.files.view : [req.files.view]
        const allowed = ['jpg', 'jpeg', 'png', 'webp']
        const errors  = []

        await Promise.all(files.map(async (file) => {
            const ext = file.name.split('.').pop().toLowerCase()
            if (!allowed.includes(ext)) { errors.push(`${file.name}: invalid type`); return }
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
            const path     = `${exh_PID}/${Date.now()}-${safeName}`
            const { error } = await supabase.storage
                .from('exhibition_views')
                .upload(path, file.data, { contentType: file.mimetype, upsert: false })
            if (error) errors.push(`${file.name}: ${error.message}`)
        }))

        if (errors.length) return res.redirect(`/admin/exhibitions/${exh_PID}?error=` + encodeURIComponent(errors.join('; ')))
        return res.redirect(`/admin/exhibitions/${exh_PID}?success=1`)
    })

    adminRouter.post('/exhibitions/delete-view', requireAuth, async (req, res) => {
        if (!req.session.user.canDelete) return res.status(403).send('Not authorised to delete')
        const { exh_PID, filename } = req.body
        if (!exh_PID || !filename) return res.redirect(`/admin/exhibitions/${exh_PID}`)
        await supabase.storage.from('exhibition_views').remove([filename])
        return res.redirect(`/admin/exhibitions/${exh_PID}?success=1`)
    })

    // ---------------------------------------------------------------------------
    // EXHIBITIONS — detail page
    // ---------------------------------------------------------------------------

    adminRouter.get('/exhibitions/:pid', requireAuth, async (req, res) => {
        const exh_PID = req.params.pid

        const [
            { data: exh },
            { data: media },
            { data: pubs },
            { data: posterFiles },
            { data: viewFiles }
        ] = await Promise.all([
            supabase.from('dmg_tentoonstelling_LDES')
                .select('exh_PID, title_NL, title_FR, title_EN, text_NL, text_FR, text_EN, curator, json_ld_v2')
                .eq('exh_PID', exh_PID).maybeSingle(),
            supabase.from('dmg_exhibitions_media').select('*').eq('exh_PID', exh_PID).order('created_at', { ascending: false }),
            supabase.from('dmg_exhibitions_publications').select('*').eq('exh_PID', exh_PID).order('created_at', { ascending: false }),
            supabase.storage.from('posters').list('', { limit: 100 }),
            supabase.storage.from('exhibition_views').list(exh_PID, { limit: 100 })
        ])

        if (!exh) return res.status(404).send('Exhibition not found')

        const posterFile = (posterFiles || []).find(f => f.name.startsWith(exh_PID + '.'))
        const posterUrl  = posterFile ? getPublicUrl('posters', posterFile.name) : null

        const views = (viewFiles || [])
            .filter(f => f.name && !f.name.startsWith('.'))
            .map(f => ({
                name: f.name,
                path: `${exh_PID}/${f.name}`,
                url:  getPublicUrl('exhibition_views', `${exh_PID}/${f.name}`)
            }))

        res.send(exhibitionDetailPage(
            exh, media || [], pubs || [],
            posterFile ? { name: posterFile.name, url: posterUrl } : null,
            views,
            req.query.success, req.query.error,
            req.session.user
        ))
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
            supabase.from('dmg_agent_relations').select('relation')
        ])

        const rows = data || []
        const stats = {}
        for (const r of (statsData || [])) {
            stats[r.relation] = (stats[r.relation] ?? 0) + 1
        }

        if (rows.length > 0) {
            const ids = [...new Set(rows.flatMap(r => [r.agent_id_a, r.agent_id_b]))]
            const { data: agents } = await supabase.from('dmg_personen_LDES').select('agent_ID, json_ld_v2').in('agent_ID', ids)
            const labelMap = {}
            for (const a of (agents || [])) labelMap[a.agent_ID] = a.json_ld_v2?.['rdfs:label'] ?? a.agent_ID
            for (const r of rows) {
                r.label_a = labelMap[r.agent_id_a] ?? r.agent_id_a
                r.label_b = labelMap[r.agent_id_b] ?? r.agent_id_b
            }
        }

        const grouped = []
        const seen = {}
        for (const r of rows) {
            if (!seen[r.agent_id_a]) {
                seen[r.agent_id_a] = { agent_id: r.agent_id_a, label: r.label_a, relations: [] }
                grouped.push(seen[r.agent_id_a])
            }
            seen[r.agent_id_a].relations.push({ id: r.id, relation: r.relation, agent_id_b: r.agent_id_b, label_b: r.label_b })
        }

        res.send(relationsPage(grouped, rows.length, stats, error?.message, req.query.success, req.query.error, search, req.session.user))
    })

    adminRouter.post('/relations/add', requireAuth, async (req, res) => {
        const { agent_id_a, relation, agent_id_b } = req.body
        if (!agent_id_a || !relation || !agent_id_b) return res.redirect('/admin/relations?error=missing+required+fields')
        if (agent_id_a === agent_id_b) return res.redirect('/admin/relations?error=agent+cannot+relate+to+itself')

        const [{ data: agentA }, { data: agentB }] = await Promise.all([
            supabase.from('dmg_personen_LDES').select('agent_ID').eq('agent_ID', agent_id_a).maybeSingle(),
            supabase.from('dmg_personen_LDES').select('agent_ID').eq('agent_ID', agent_id_b).maybeSingle()
        ])
        if (!agentA) return res.redirect('/admin/relations?error=agent+A+not+found')
        if (!agentB) return res.redirect('/admin/relations?error=agent+B+not+found')

        const { data: existing } = await supabase
            .from('dmg_agent_relations').select('id')
            .eq('agent_id_a', agent_id_a).eq('relation', relation).eq('agent_id_b', agent_id_b)
            .maybeSingle()
        if (existing) return res.redirect('/admin/relations?error=' + encodeURIComponent(`Relation already exists: ${agent_id_a} ${RELATION_MAP[relation] ?? relation} ${agent_id_b}`))

        const relDef = AGENT_RELATIONS.find(r => r.value === relation)
        if (!relDef) return res.redirect('/admin/relations?error=invalid+relation+type')

        const rows = [{ agent_id_a, relation, agent_id_b }]
        if (relDef.inverse !== relation || agent_id_a !== agent_id_b) {
            rows.push({ agent_id_a: agent_id_b, relation: relDef.inverse, agent_id_b: agent_id_a })
        }

        const { error } = await supabase.from('dmg_agent_relations').upsert(rows, { onConflict: 'agent_id_a,relation,agent_id_b', ignoreDuplicates: true })
        if (error) return res.redirect('/admin/relations?error=' + encodeURIComponent(error.message))
        return res.redirect('/admin/relations?success=1')
    })

    adminRouter.post('/relations/delete/:id', requireAuth, async (req, res) => {
        if (!req.session.user.canDelete) return res.status(403).send('Not authorised to delete')
        const { data: rel } = await supabase.from('dmg_agent_relations').select('agent_id_a, relation, agent_id_b').eq('id', req.params.id).maybeSingle()
        if (rel) {
            const relDef = AGENT_RELATIONS.find(r => r.value === rel.relation)
            await supabase.from('dmg_agent_relations').delete().eq('id', req.params.id)
            if (relDef) {
                await supabase.from('dmg_agent_relations').delete()
                    .eq('agent_id_a', rel.agent_id_b).eq('relation', relDef.inverse).eq('agent_id_b', rel.agent_id_a)
            }
        }
        return res.redirect('/admin/relations')
    })

    adminRouter.get('/relations/agent/:agentId', requireAuth, async (req, res) => {
        const agentId = req.params.agentId

        const [{ data: agentData }, { data: outgoing }, { data: incoming }] = await Promise.all([
            supabase.from('dmg_personen_LDES').select('agent_ID, json_ld_v2, agent_type').eq('agent_ID', agentId).maybeSingle(),
            supabase.from('dmg_agent_relations').select('id, relation, agent_id_b').eq('agent_id_a', agentId).order('relation', { ascending: true }),
            supabase.from('dmg_agent_relations').select('id, relation, agent_id_a').eq('agent_id_b', agentId).order('relation', { ascending: true })
        ])

        if (!agentData) return res.status(404).send('Agent not found')

        const relatedIds = [...(outgoing || []).map(r => r.agent_id_b), ...(incoming || []).map(r => r.agent_id_a)]
        const uniqueIds  = [...new Set(relatedIds)]
        const labelMap   = {}

        if (uniqueIds.length > 0) {
            const { data: agents } = await supabase.from('dmg_personen_LDES').select('agent_ID, json_ld_v2').in('agent_ID', uniqueIds)
            for (const a of (agents || [])) labelMap[a.agent_ID] = a.json_ld_v2?.['rdfs:label'] ?? a.agent_ID
        }

        const enriched = {
            agent_id:   agentData.agent_ID,
            label:      agentData.json_ld_v2?.['rdfs:label'] ?? agentData.agent_ID,
            agent_type: agentData.agent_type ?? 'unknown',
            outgoing:   (outgoing || []).map(r => ({ ...r, label_b: labelMap[r.agent_id_b] ?? r.agent_id_b })),
            incoming:   (incoming || []).map(r => ({ ...r, label_a: labelMap[r.agent_id_a] ?? r.agent_id_a }))
        }

        res.send(agentRelationsPage(enriched, req.session.user))
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
.badge-admin  { background:#2d3748; color:#a0aec0; }
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
.reference-box { background:#f8f8f8; border:1px solid #eee; border-radius:6px; padding:0.75rem 1rem; margin-bottom:1rem; }
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
        <a href="/admin/exhibitions" ${path === '/exhibitions' ? 'class="active"' : ''}>Exhibitions</a>
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

const mkAlert  = (type, msg) => `<div class="alert alert-${type}">${msg}</div>`
const alerts   = (success, error) => [success ? mkAlert('success', 'Saved successfully.') : '', error ? mkAlert('error', error) : ''].join('')
const permNote = (canDelete) => canDelete ? '' : '<p class="perm-note">You do not have permission to delete entries.</p>'
const resultCount  = (n, search) => `<p class="count">${n} ${n === 1 ? 'entry' : 'entries'}${search ? ` for "${search}"` : ''}</p>`
const sectionDivider = (title) => `<div class="section-divider"><h3>${title}</h3></div>`

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
    ? `<form method="POST" action="${action}" style="display:inline"><button type="submit" class="btn btn-sm btn-ghost" onclick="return confirm('Delete this entry?')">delete</button></form>`
    : '<span class="no-perm">—</span>'

// ---------------------------------------------------------------------------
// AGENT AUTOCOMPLETE WIDGET + SCRIPT
// ---------------------------------------------------------------------------

const agentAcWidget = (suffix) => `
    <div class="ac-wrap">
        <input type="text" id="ac-agent-input-${suffix}" placeholder="Search agent by name or ID..." autocomplete="off">
        <div class="ac-dropdown" id="ac-agent-dropdown-${suffix}"></div>
    </div>
    <input type="hidden" name="agent_id_${suffix}" id="ac-agent-value-${suffix}" required>
    <div class="ac-selected" id="ac-agent-selected-${suffix}">
        <span class="ac-selected-label" id="ac-agent-label-${suffix}"></span>
        <span class="ac-selected-pid"   id="ac-agent-pid-${suffix}"></span>
        <a href="#" class="ac-clear"    id="ac-agent-clear-${suffix}">&#10005; clear</a>
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
        if (!input) return
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
                            return '<div class="ac-item" data-id="' + d.id + '" data-label="' + d.label.replace(/"/g, '&quot;') + '">' + d.label + '<span class="ac-item-pid">' + d.id + '</span></div>'
                        }).join('')
                        dropdown.style.display = 'block'
                    })
            }, 250)
        })
        clear.addEventListener('click', function (e) {
            e.preventDefault()
            hidden.value = ''; input.value = ''; input.style.display = 'block'; selected.style.display = 'none'; dropdown.style.display = 'none'
            input.focus()
        })
        document.addEventListener('click', function (e) {
            if (!e.target.closest('#ac-agent-input-' + suffix) && !e.target.closest('#ac-agent-dropdown-' + suffix)) dropdown.style.display = 'none'
        })
    })
})()
</script>`

// ---------------------------------------------------------------------------
// RELATIONS SEARCH BAR (with agent autocomplete + type filter)
// ---------------------------------------------------------------------------

const relationsSearchBar = (search, activeType) => `
    <div style="display:flex;gap:0.75rem;align-items:flex-end;margin-bottom:1.25rem;flex-wrap:wrap;">
        <div class="form-group" style="flex:1;min-width:200px;position:relative;">
            <label>Filter by agent name or ID</label>
            <input type="text" id="relations-search-input" value="${search || ''}" placeholder="Search agent..." autocomplete="off">
            <div class="ac-dropdown" id="relations-search-dropdown"></div>
        </div>
        <div class="form-group" style="min-width:180px;">
            <label>Filter by relation type</label>
            <select id="relations-type-filter" onchange="applyRelationsFilter()">
                <option value="">— all types —</option>
                <optgroup label="Family">
                    <option value="parent_of"   ${activeType === 'parent_of'    ? 'selected' : ''}>is parent of</option>
                    <option value="child_of"    ${activeType === 'child_of'     ? 'selected' : ''}>is child of</option>
                    <option value="spouse_of"   ${activeType === 'spouse_of'    ? 'selected' : ''}>is spouse of</option>
                    <option value="sibling_of"  ${activeType === 'sibling_of'   ? 'selected' : ''}>is sibling of</option>
                </optgroup>
                <optgroup label="Professional">
                    <option value="employer_of" ${activeType === 'employer_of'  ? 'selected' : ''}>is employer of</option>
                    <option value="employee_of" ${activeType === 'employee_of'  ? 'selected' : ''}>is employee of</option>
                    <option value="mentor_of"   ${activeType === 'mentor_of'    ? 'selected' : ''}>is mentor of</option>
                    <option value="student_of"  ${activeType === 'student_of'   ? 'selected' : ''}>is student of</option>
                    <option value="collaborator"${activeType === 'collaborator' ? 'selected' : ''}>collaborates with</option>
                </optgroup>
                <optgroup label="Organisational">
                    <option value="member_of"   ${activeType === 'member_of'    ? 'selected' : ''}>is member of</option>
                    <option value="has_member"  ${activeType === 'has_member'   ? 'selected' : ''}>has member</option>
                    <option value="founded"     ${activeType === 'founded'      ? 'selected' : ''}>founded</option>
                    <option value="founded_by"  ${activeType === 'founded_by'   ? 'selected' : ''}>was founded by</option>
                </optgroup>
            </select>
        </div>
        <button type="button" class="btn btn-primary" style="height:38px;flex-shrink:0;" onclick="document.getElementById('relations-search-form').submit()">Search</button>
        ${search ? `<a href="/admin/relations" class="search-clear" style="align-self:center;">Clear</a>` : ''}
    </div>
    <form method="GET" action="/admin/relations" id="relations-search-form">
        <input type="hidden" name="q" id="relations-search-value" value="${search || ''}">
    </form>
    <script>
    (function () {
        var input    = document.getElementById('relations-search-input')
        var dropdown = document.getElementById('relations-search-dropdown')
        var hidden   = document.getElementById('relations-search-value')
        var timer
        input.addEventListener('input', function () {
            clearTimeout(timer); hidden.value = input.value
            var q = input.value.trim()
            if (q.length < 2) { dropdown.style.display = 'none'; return }
            timer = setTimeout(function () {
                fetch('/admin/api/agents?q=' + encodeURIComponent(q))
                    .then(function (r) { return r.json() })
                    .then(function (data) {
                        if (!data.length) { dropdown.style.display = 'none'; return }
                        dropdown.innerHTML = data.map(function (d) {
                            return '<div class="ac-item" data-id="' + d.id + '" data-label="' + d.label.replace(/"/g, '&quot;') + '">' + d.label + '<span class="ac-item-pid">' + d.id + '</span></div>'
                        }).join('')
                        dropdown.style.display = 'block'
                    })
            }, 250)
        })
        dropdown.addEventListener('click', function (e) {
            var item = e.target.closest('[data-id]')
            if (!item) return
            input.value = item.dataset.label; hidden.value = item.dataset.id; dropdown.style.display = 'none'
            document.getElementById('relations-search-form').submit()
        })
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { dropdown.style.display = 'none'; document.getElementById('relations-search-form').submit() }
        })
        document.addEventListener('click', function (e) {
            if (!e.target.closest('#relations-search-input') && !e.target.closest('#relations-search-dropdown')) dropdown.style.display = 'none'
        })
    })()
    function applyRelationsFilter() {
        var type   = document.getElementById('relations-type-filter').value
        var groups = document.querySelectorAll('.relation-group')
        groups.forEach(function (group) {
            if (!type) {
                group.style.display = ''
                group.querySelectorAll('tr[data-relation]').forEach(function (row) { row.style.display = '' })
                return
            }
            var rows = group.querySelectorAll('tr[data-relation]'), visibleCount = 0
            rows.forEach(function (row) {
                if (row.dataset.relation === type) { row.style.display = ''; visibleCount++ }
                else row.style.display = 'none'
            })
            group.style.display = visibleCount === 0 ? 'none' : ''
            var countEl = group.querySelector('.relation-group-count')
            if (countEl) countEl.textContent = visibleCount + (visibleCount === 1 ? ' relation' : ' relations')
        })
        var visibleGroups = document.querySelectorAll('.relation-group:not([style*="display: none"])')
        var countEl = document.querySelector('.relations-total-count')
        if (countEl) {
            var totalVisible = 0
            visibleGroups.forEach(function (g) { totalVisible += g.querySelectorAll('tr[data-relation]:not([style*="display: none"])').length })
            countEl.textContent = type ? visibleGroups.length + ' agents · ' + totalVisible + ' relations' : countEl.dataset.original
        }
    }
    </script>`

// ---------------------------------------------------------------------------
// VIEW COUNT CHECKER (async, overview table only)
// ---------------------------------------------------------------------------

const viewCountCheckerScript = () => `<script>
(function () {
    var cells = document.querySelectorAll('td.asset-views[data-pid]')
    var pids  = [...new Set([...cells].map(function(c) { return c.dataset.pid }).filter(Boolean))]
    if (!pids.length) return
    var chunk = function(arr, n) { return Array.from({ length: Math.ceil(arr.length / n) }, function(_, i) { return arr.slice(i * n, i * n + n) }) }
    chunk(pids, 20).forEach(function(batch) {
        fetch('/admin/api/exhibition-assets?pids=' + batch.join(','))
            .then(function(r) { return r.json() })
            .then(function(data) {
                batch.forEach(function(pid) {
                    var asset = data[pid]; if (!asset) return
                    var cell = document.querySelector('td.asset-views[data-pid="' + pid + '"]')
                    if (cell) cell.innerHTML = asset.viewCount > 0 ? '<span class="tag tag-views">' + asset.viewCount + '</span>' : '<span class="check-no">&#8212;</span>'
                })
            }).catch(function() {})
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
            <a href="/admin/media" class="card-link"><div class="card"><h2>Object media</h2><div class="card-stat">${stats.mediaCount ?? '—'}</div><p>Video and audio resources linked to collection objects.</p></div></a>
            <a href="/admin/projects" class="card-link"><div class="card"><h2>Projects</h2><div class="card-stat">${stats.projectsCount ?? '—'}</div><p>Creative projects inspired by collection objects.</p></div></a>
        </div>
    </div>
    <div class="dashboard-section">
        <div class="dashboard-section-title">Exhibitions</div>
        <div class="dashboard-grid">
            <a href="/admin/exhibitions" class="card-link"><div class="card"><h2>Exhibitions</h2><div class="card-stat">${(stats.exhibitionsMediaCount ?? 0) + (stats.publicationsCount ?? 0)}</div><p>Media, publications and multilingual information for all exhibitions.</p></div></a>
            <a href="/admin/exhibitions" class="card-link"><div class="card"><h2>Translations</h2><div class="card-stat">${stats.translationsCount ?? '—'}</div><p>Exhibitions with FR translation.</p></div></a>
        </div>
    </div>
    <div class="dashboard-section">
        <div class="dashboard-section-title">Agents</div>
        <div class="dashboard-grid">
            <a href="/admin/relations" class="card-link"><div class="card"><h2>Agent relations</h2><div class="card-stat">${stats.relationsCount ?? '—'}</div><p>Family, professional and organisational relationships between agents.</p></div></a>
        </div>
    </div>
    <div class="dashboard-section">
        <div class="dashboard-section-title">API</div>
        <div class="dashboard-grid">
            <a href="https://data.designmuseumgent.be" target="_blank" class="card-link"><div class="card"><h2>Documentation ↗</h2><p>data.designmuseumgent.be</p></div></a>
            <a href="/api-docs" target="_blank" class="card-link"><div class="card"><h2>Swagger UI ↗</h2><p>Interactive API explorer.</p></div></a>
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
                <div class="form-group"><label>Object number *</label><input type="text" name="objectNumber" placeholder="1987-1105" required></div>
                <div class="form-group"><label>Type *</label><select name="type" required><option value="">— select —</option><option value="VIDEO">Video</option><option value="AUDIO">Audio</option></select></div>
                <div class="form-group full"><label>URL *</label><input type="url" name="url" placeholder="https://www.youtube.com/watch?v=..." required></div>
                <div class="form-group"><label>Title</label><input type="text" name="title" placeholder="Video title"></div>
                <div class="form-group"><label>Year</label><input type="text" name="date" placeholder="2024" pattern="[0-9]{4}"></div>
            </div>
            <div style="margin-top:1rem;"><button type="submit" class="btn btn-primary">Add media</button></div>
        </form>
    </div>
    <div class="card">
        <h2>Entries</h2>
        ${searchBar('/admin/media', search, 'Filter by object number', '1987, 0913, ...')}
        ${rows.length === 0
    ? `<p class="empty">${search ? `No media found for "${search}".` : 'No media entries yet.'}</p>`
    : `${resultCount(rows.length, search)}
        <table>
            <thead><tr><th>Object</th><th>Type</th><th>Title</th><th>Year</th><th>URL</th><th></th></tr></thead>
            <tbody>
                ${rows.map(r => `<tr>
                    <td><span class="mono">${r.objectNumber}</span></td>
                    <td><span class="tag ${r.type === 'VIDEO' ? 'tag-video' : 'tag-audio'}">${r.type}</span></td>
                    <td>${r.title || '—'}</td><td>${r.date || '—'}</td>
                    <td><a href="${r.url}" target="_blank" class="link">↗ link</a></td>
                    <td>${deleteBtn('/admin/media/delete/' + r.id, user.canDelete)}</td>
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
                <div class="form-group"><label>Object number *</label><input type="text" name="objectNumber" placeholder="1987-1105" required></div>
                <div class="form-group"><label>Year</label><input type="text" name="date" placeholder="2024" pattern="[0-9]{4}"></div>
                <div class="form-group full"><label>Title *</label><input type="text" name="title" placeholder="Project title" required></div>
                <div class="form-group full"><label>URL</label><input type="url" name="url" placeholder="https://..."></div>
            </div>
            <div style="margin-top:1rem;"><button type="submit" class="btn btn-primary">Add project</button></div>
        </form>
    </div>
    <div class="card">
        <h2>Entries</h2>
        ${searchBar('/admin/projects', search, 'Filter by object number', '1987, 0913, ...')}
        ${rows.length === 0
    ? `<p class="empty">${search ? `No projects found for "${search}".` : 'No project entries yet.'}</p>`
    : `${resultCount(rows.length, search)}
        <table>
            <thead><tr><th>Object</th><th>Title</th><th>Year</th><th>URL</th><th></th></tr></thead>
            <tbody>
                ${rows.map(r => `<tr>
                    <td><span class="mono">${r.objectNumber}</span></td>
                    <td>${r.title || '—'}</td><td>${r.date || '—'}</td>
                    <td>${r.url ? `<a href="${r.url}" target="_blank" class="link">↗ link</a>` : '—'}</td>
                    <td>${deleteBtn('/admin/projects/delete/' + r.id, user.canDelete)}</td>
                </tr>`).join('')}
            </tbody>
        </table>
        ${permNote(user.canDelete)}`}
    </div>
`, '/projects', user)

// ---------------------------------------------------------------------------
// EXHIBITIONS OVERVIEW PAGE
// ---------------------------------------------------------------------------

const exhibitionsPage = (rows, error, success, errorMsg, search, posterSet, user) => layout('Exhibitions', `
    <h1>Exhibitions</h1>
    ${alerts(success, errorMsg)}
    <div class="card">
        <h2>All exhibitions</h2>
        <p style="font-size:0.875rem;color:#aaa;margin-bottom:1rem;margin-top:-0.25rem;">Click any row to manage an exhibition.</p>
        ${searchBar('/admin/exhibitions', search, 'Filter by PID or title', 'TE_2020, Kleureyck, ...')}
        ${rows.length === 0
    ? `<p class="empty">${search ? `No exhibitions found for "${search}".` : 'No exhibitions found.'}</p>`
    : `${resultCount(rows.length, search)}
        <div style="overflow-x:auto;">
        <table>
            <thead><tr><th>Exhibition</th><th>NL</th><th>FR</th><th>EN</th><th>Desc</th><th>Curator</th><th>Media</th><th>Pubs</th><th>Poster</th><th>Views</th></tr></thead>
            <tbody>
                ${rows.map(r => {
        const media        = r.dmg_exhibitions_media || []
        const pubs         = r.dmg_exhibitions_publications || []
        const videos       = media.filter(m => m.type === 'VIDEO').length
        const audio        = media.filter(m => m.type === 'AUDIO').length
        const hasDesc      = r.text_NL || r.text_FR || r.text_EN
        const titleDisplay = r.title_NL || r.title_FR || r.title_EN || '—'
        const hasPoster    = posterSet.has(r.exh_PID)
        const mediaCell    = media.length === 0 ? '<span class="check-no">—</span>' : [videos > 0 ? `<span class="tag tag-video">${videos}v</span>` : '', audio > 0 ? `<span class="tag tag-audio">${audio}a</span>` : ''].filter(Boolean).join(' ')
        const pubsCell     = pubs.length > 0 ? `<span class="tag tag-pub">${pubs.length}</span>` : '<span class="check-no">—</span>'
        return `<tr data-pid="${r.exh_PID || ''}" style="cursor:pointer;" onclick="window.location='/admin/exhibitions/${r.exh_PID}'">
                        <td>
                            <span class="mono" style="font-size:0.8125rem;">${r.exh_PID || r.id}</span>
                            <div style="font-size:0.8125rem;color:#555;margin-top:0.125rem;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${titleDisplay}">${titleDisplay}</div>
                        </td>
                        <td class="${r.title_NL ? 'check-yes' : 'check-no'}" title="${r.title_NL || ''}">${r.title_NL ? '✓' : '—'}</td>
                        <td class="${r.title_FR ? 'check-yes' : 'check-no'}" title="${r.title_FR || ''}">${r.title_FR ? '✓' : '—'}</td>
                        <td class="${r.title_EN ? 'check-yes' : 'check-no'}" title="${r.title_EN || ''}">${r.title_EN ? '✓' : '—'}</td>
                        <td class="${hasDesc ? 'check-yes' : 'check-no'}">${hasDesc ? '✓' : '—'}</td>
                        <td style="font-size:0.8125rem;color:#555;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.curator || ''}">${r.curator || '—'}</td>
                        <td>${mediaCell}</td>
                        <td>${pubsCell}</td>
                        <td class="${hasPoster ? 'check-yes' : 'check-no'}">${hasPoster ? '✓' : '—'}</td>
                        <td class="asset-views" data-pid="${r.exh_PID || ''}"><span style="color:#ddd">…</span></td>
                    </tr>`
    }).join('')}
            </tbody>
        </table>
        </div>`}
    </div>
    ${viewCountCheckerScript()}
`, '/exhibitions', user)

// ---------------------------------------------------------------------------
// EXHIBITION DETAIL PAGE
// ---------------------------------------------------------------------------

const exhibitionDetailPage = (exh, media, pubs, poster, views, success, errorMsg, user) => {
    const title          = exh.title_NL || exh.title_FR || exh.title_EN || exh.exh_PID
    const harvestedTitle = exh.json_ld_v2?.['rdfs:label'] ?? null

    return layout(`${exh.exh_PID} — Exhibitions`, `
    <div style="margin-bottom:0.25rem;">
        <a href="/admin/exhibitions" style="font-size:0.875rem;color:#aaa;text-decoration:none;">← All exhibitions</a>
    </div>
    <div style="display:flex;align-items:baseline;gap:0.75rem;margin-top:1rem;margin-bottom:0.25rem;">
        <h1 style="margin-bottom:0;">${title}</h1>
    </div>
    <div style="display:flex;gap:0.75rem;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;">
        <span class="mono" style="color:#666;">${exh.exh_PID}</span>
        ${exh.curator ? `<span style="font-size:0.875rem;color:#aaa;">Curator: ${exh.curator}</span>` : ''}
    </div>

    ${alerts(success ? '1' : null, errorMsg)}

    <div style="display:grid;grid-template-columns:280px 1fr;gap:1.5rem;margin-bottom:1.5rem;align-items:start;">

        <div class="card" style="margin-bottom:0;">
            <h2>Poster</h2>
            ${poster ? `
            <img src="${poster.url}" alt="Poster" style="width:100%;border-radius:6px;border:1px solid #eee;display:block;margin-bottom:0.75rem;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
                <span class="mono" style="font-size:0.75rem;color:#aaa;overflow:hidden;text-overflow:ellipsis;">${poster.name}</span>
                ${user.canDelete ? `
                <form method="POST" action="/admin/exhibitions/delete-poster" style="display:inline;flex-shrink:0;margin-left:0.5rem;">
                    <input type="hidden" name="exh_PID" value="${exh.exh_PID}">
                    <input type="hidden" name="filename" value="${poster.name}">
                    <button type="submit" class="btn btn-sm btn-ghost" onclick="return confirm('Delete poster?')">delete</button>
                </form>` : ''}
            </div>` : `<p style="font-size:0.875rem;color:#aaa;margin-bottom:1rem;">No poster uploaded yet.</p>`}
            <form method="POST" action="/admin/exhibitions/upload-poster" enctype="multipart/form-data">
                <input type="hidden" name="exh_PID" value="${exh.exh_PID}">
                <div class="form-group" style="margin-bottom:0.75rem;">
                    <label>${poster ? 'Replace poster' : 'Upload poster'}</label>
                    <input type="file" name="poster" accept="image/jpeg,image/png,image/webp" required>
                    <span style="font-size:0.8125rem;color:#aaa;margin-top:0.25rem;">JPG, PNG or WebP.</span>
                </div>
                <button type="submit" class="btn btn-primary btn-sm">Upload</button>
            </form>
        </div>

        <div class="card" style="margin-bottom:0;">
            <h2>Exhibition information</h2>
            ${harvestedTitle ? `<div class="reference-box"><span class="reference-label">Harvested title (NL — from source system)</span><span class="reference-value">${harvestedTitle}</span></div>` : ''}
            <form method="POST" action="/admin/translations/save">
                <input type="hidden" name="exh_PID" value="${exh.exh_PID}">
                ${sectionDivider('Titles')}
                <div class="form-grid">
                    <div class="form-group"><label>Title NL</label><input type="text" name="title_NL" value="${exh.title_NL || ''}" placeholder="Nederlandstalige titel"></div>
                    <div class="form-group"><label>Title FR</label><input type="text" name="title_FR" value="${exh.title_FR || ''}" placeholder="Titre en français"></div>
                    <div class="form-group full"><label>Title EN</label><input type="text" name="title_EN" value="${exh.title_EN || ''}" placeholder="English title"></div>
                </div>
                ${sectionDivider('Descriptions')}
                <div class="form-grid">
                    <div class="form-group full"><label>Description NL</label><textarea name="text_NL" rows="3" placeholder="Nederlandstalige beschrijving">${exh.text_NL || ''}</textarea></div>
                    <div class="form-group full"><label>Description FR</label><textarea name="text_FR" rows="3" placeholder="Description en français">${exh.text_FR || ''}</textarea></div>
                    <div class="form-group full"><label>Description EN</label><textarea name="text_EN" rows="3" placeholder="English description">${exh.text_EN || ''}</textarea></div>
                </div>
                ${sectionDivider('Curator')}
                <div class="form-grid">
                    <div class="form-group full">
                        <label>Curator(s)</label>
                        <input type="text" name="curator" value="${exh.curator || ''}" placeholder="Kaat Debo, Lotte Vandermeersch">
                        <span style="font-size:0.8125rem;color:#aaa;margin-top:0.25rem;">Separate multiple curators with a comma.</span>
                    </div>
                </div>
                <div style="margin-top:1.25rem;"><button type="submit" class="btn btn-primary">Save information</button></div>
            </form>
        </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem;align-items:start;">

        <div class="card" style="margin-bottom:0;">
            <h2>Video</h2>
            ${media.length === 0
        ? `<p style="font-size:0.875rem;color:#aaa;margin-bottom:1rem;">No videos linked yet.</p>`
        : `<div style="display:flex;flex-direction:column;gap:0.5rem;margin-bottom:1rem;">
                    ${media.map(m => `
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.75rem;background:#fafafa;border:1px solid #eee;border-radius:6px;">
                        <div style="min-width:0;">
                            <a href="${m.url}" target="_blank" style="font-size:0.875rem;color:#4a90d9;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.title || m.url}</a>
                            ${m.date ? `<span style="font-size:0.8125rem;color:#aaa;">${m.date}</span>` : ''}
                        </div>
                        <form method="POST" action="/admin/exhibitions/delete/${m.id}" style="display:inline;flex-shrink:0;margin-left:0.5rem;">
                            <input type="hidden" name="exh_PID" value="${exh.exh_PID}">
                            ${user.canDelete ? `<button type="submit" class="btn btn-sm btn-ghost" onclick="return confirm('Delete this video?')">delete</button>` : '<span class="no-perm">—</span>'}
                        </form>
                    </div>`).join('')}
                </div>`}
            <form method="POST" action="/admin/exhibitions/add">
                <input type="hidden" name="exh_PID" value="${exh.exh_PID}">
                <div class="form-grid">
                    <div class="form-group full"><label>Video URL *</label><input type="url" name="url" placeholder="https://www.youtube.com/watch?v=..." required></div>
                    <div class="form-group"><label>Title</label><input type="text" name="title" placeholder="Video title"></div>
                    <div class="form-group"><label>Year</label><input type="text" name="date" placeholder="2024" pattern="[0-9]{4}"></div>
                </div>
                <div style="margin-top:0.75rem;"><button type="submit" class="btn btn-primary">Add video</button></div>
            </form>
        </div>

        <div class="card" style="margin-bottom:0;">
            <h2>Publications</h2>
            ${pubs.length === 0
        ? `<p style="font-size:0.875rem;color:#aaa;margin-bottom:1rem;">No publications linked yet.</p>`
        : `<div style="display:flex;flex-direction:column;gap:0.5rem;margin-bottom:1rem;">
                    ${pubs.map(p => `
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.75rem;background:#fafafa;border:1px solid #eee;border-radius:6px;">
                        <div style="min-width:0;">
                            <span style="font-size:0.875rem;font-weight:500;">${p.title}</span>
                            ${p.year ? `<span style="font-size:0.8125rem;color:#aaa;margin-left:0.5rem;">${p.year}</span>` : ''}
                            ${p.url ? `<a href="${p.url}" target="_blank" style="font-size:0.8125rem;color:#4a90d9;margin-left:0.5rem;">↗</a>` : ''}
                        </div>
                        <form method="POST" action="/admin/publications/delete/${p.id}" style="display:inline;flex-shrink:0;margin-left:0.5rem;">
                            <input type="hidden" name="exh_PID" value="${exh.exh_PID}">
                            ${user.canDelete ? `<button type="submit" class="btn btn-sm btn-ghost" onclick="return confirm('Delete this publication?')">delete</button>` : '<span class="no-perm">—</span>'}
                        </form>
                    </div>`).join('')}
                </div>`}
            <form method="POST" action="/admin/publications/add">
                <input type="hidden" name="exh_PID" value="${exh.exh_PID}">
                <div class="form-grid">
                    <div class="form-group full"><label>Title *</label><input type="text" name="title" placeholder="Publication title" required></div>
                    <div class="form-group full"><label>Library URL</label><input type="url" name="url" placeholder="https://catalog.designmuseumgent.be/..."></div>
                    <div class="form-group"><label>Year</label><input type="text" name="year" placeholder="2024" pattern="[0-9]{4}"></div>
                </div>
                <div style="margin-top:0.75rem;"><button type="submit" class="btn btn-primary">Add publication</button></div>
            </form>
        </div>
    </div>

    <div class="card">
        <h2>Installation views <span style="font-weight:400;color:#bbb;font-size:0.875rem;margin-left:0.375rem;">${views.length}</span></h2>
        ${views.length > 0 ? `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1rem;margin-bottom:1.5rem;">
            ${views.map(v => `
            <div style="border:1px solid #eee;border-radius:6px;overflow:hidden;">
                <a href="${v.url}" target="_blank">
                    <img src="${v.url}" alt="${v.name}" style="width:100%;height:140px;object-fit:cover;display:block;">
                </a>
                <div style="padding:0.375rem 0.5rem;display:flex;align-items:center;justify-content:space-between;background:white;">
                    <span class="mono" style="font-size:0.75rem;color:#aaa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:110px;">${v.name}</span>
                    ${user.canDelete ? `
                    <form method="POST" action="/admin/exhibitions/delete-view" style="display:inline;flex-shrink:0;">
                        <input type="hidden" name="exh_PID" value="${exh.exh_PID}">
                        <input type="hidden" name="filename" value="${v.path}">
                        <button type="submit" class="btn btn-sm btn-ghost" onclick="return confirm('Delete this view?')" style="padding:0.125rem 0.375rem;font-size:0.75rem;">✕</button>
                    </form>` : ''}
                </div>
            </div>`).join('')}
        </div>` : `<p style="font-size:0.875rem;color:#aaa;margin-bottom:1rem;">No installation views uploaded yet.</p>`}
        <form method="POST" action="/admin/exhibitions/upload-view" enctype="multipart/form-data">
            <input type="hidden" name="exh_PID" value="${exh.exh_PID}">
            <div class="form-grid">
               <div class="form-group full">
                    <label>Upload installation views</label>
                    <input type="file" name="view" accept="image/jpeg,image/png,image/webp" multiple required>
                    <span style="font-size:0.8125rem;color:#aaa;margin-top:0.25rem;">JPG, PNG or WebP. Select multiple files to upload in bulk.</span>
                </div>
            </div>
            <div style="margin-top:0.75rem;"><button type="submit" class="btn btn-primary">Upload view</button></div>
        </form>
    </div>
`, '/exhibitions', user)
}

// ---------------------------------------------------------------------------
// AGENT RELATIONS PAGE
// ---------------------------------------------------------------------------

const relationsPage = (grouped, totalRows, stats, error, success, errorMsg, search, user) => {
    const statGroups = [
        { label: 'Family',         keys: ['parent_of', 'child_of', 'spouse_of', 'sibling_of'] },
        { label: 'Professional',   keys: ['employer_of', 'employee_of', 'mentor_of', 'student_of', 'collaborator'] },
        { label: 'Organisational', keys: ['member_of', 'has_member', 'founded', 'founded_by'] }
    ]

    const originalCount = `${grouped.length} ${grouped.length === 1 ? 'agent' : 'agents'} · ${totalRows} ${totalRows === 1 ? 'relation' : 'relations'}${search ? ` matching "${search}"` : ''}`

    const statsStrip = Object.keys(stats).length === 0 ? '' : `
        <div class="relation-stats">
            ${statGroups.map(group => {
        const entries = group.keys.filter(k => stats[k]).map(k => `
                    <div class="relation-stat-item" onclick="document.getElementById('relations-type-filter').value='${k}';applyRelationsFilter()" style="cursor:pointer;" title="Filter by ${RELATION_MAP[k] ?? k}">
                        <span class="relation-stat-label">${RELATION_MAP[k] ?? k}</span>
                        <span class="relation-stat-count">${stats[k]}</span>
                    </div>`).join('')
        if (!entries) return ''
        return `<div class="relation-stat-group"><div class="relation-stat-group-title">${group.label}</div>${entries}</div>`
    }).join('')}
        </div>`

    const relationSelect = `
        <select name="relation" required>
            <option value="">— select —</option>
            <optgroup label="Family">
                <option value="parent_of">is parent of</option><option value="child_of">is child of</option>
                <option value="spouse_of">is spouse of</option><option value="sibling_of">is sibling of</option>
            </optgroup>
            <optgroup label="Professional">
                <option value="employer_of">is employer of</option><option value="employee_of">is employee of</option>
                <option value="mentor_of">is mentor of</option><option value="student_of">is student of</option>
                <option value="collaborator">collaborates with</option>
            </optgroup>
            <optgroup label="Organisational">
                <option value="member_of">is member of</option><option value="has_member">has member</option>
                <option value="founded">founded</option><option value="founded_by">was founded by</option>
            </optgroup>
        </select>`

    return layout('Agent relations', `
    <h1>Agent relations</h1>
    ${alerts(success, errorMsg)}

    <div class="card">
        <h2>Add relation</h2>
        <form method="POST" action="/admin/relations/add">
            <div class="form-grid">
                <div class="form-group full"><label>Agent A *</label>${agentAcWidget('a')}</div>
                <div class="form-group full">
                    <label>Relation *</label>
                    ${relationSelect}
                    <span style="font-size:0.8125rem;color:#aaa;margin-top:0.25rem;">The inverse relation is stored automatically.</span>
                </div>
                <div class="form-group full"><label>Agent B *</label>${agentAcWidget('b')}</div>
            </div>
            <div style="margin-top:1rem;"><button type="submit" class="btn btn-primary">Add relation</button></div>
        </form>
    </div>

    <div class="card">
        <h2>Overview</h2>
        ${statsStrip}
        ${relationsSearchBar(search)}
        ${grouped.length === 0
        ? `<p class="empty">${search ? `No relations found for "${search}".` : 'No agent relations added yet.'}</p>`
        : `
        <p class="count relations-total-count" data-original="${originalCount}">${originalCount}</p>
        <div class="relations-grouped">
            ${grouped.map(group => `
            <div class="relation-group">
                <div class="relation-group-header">
                    <div>
                        <a href="/admin/relations/agent/${group.agent_id}" style="font-weight:500;font-size:0.9375rem;color:#1a1a1a;text-decoration:none;">${group.label}</a>
                        <span class="mono relation-group-pid">${group.agent_id}</span>
                    </div>
                    <span class="relation-group-count">${group.relations.length} ${group.relations.length === 1 ? 'relation' : 'relations'}</span>
                </div>
                <table class="relation-group-table">
                    <tbody>
                        ${group.relations.map(r => `
                        <tr data-relation="${r.relation}">
                            <td style="width:10rem"><span class="tag tag-relation">${RELATION_MAP[r.relation] ?? r.relation}</span></td>
                            <td>
                                <a href="/admin/relations/agent/${r.agent_id_b}" style="font-weight:500;color:#1a1a1a;text-decoration:none;">${r.label_b}</a>
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
// AGENT DETAIL PAGE
// ---------------------------------------------------------------------------

const agentRelationsPage = (agent, user) => {
    const typeLabel = { individual: 'Person', organisation: 'Organisation', unknown: 'Unknown' }[agent.agent_type] ?? 'Unknown'
    const typeBg    = agent.agent_type === 'individual' ? '#f0fff4;color:#276749' : agent.agent_type === 'organisation' ? '#ebf4ff;color:#2b6cb0' : '#f5f5f5;color:#999'
    const typeBadge = `<span style="display:inline-block;padding:0.15rem 0.5rem;border-radius:4px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;background:${typeBg}">${typeLabel}</span>`

    const outgoingByType = {}
    for (const r of agent.outgoing) { if (!outgoingByType[r.relation]) outgoingByType[r.relation] = []; outgoingByType[r.relation].push(r) }
    const incomingByType = {}
    for (const r of agent.incoming) { if (!incomingByType[r.relation]) incomingByType[r.relation] = []; incomingByType[r.relation].push(r) }

    const renderRelationBlock = (grouped, direction) => {
        if (Object.keys(grouped).length === 0) return `<p class="empty" style="padding:1rem 0;text-align:left;font-style:italic;">No ${direction} relations.</p>`
        return Object.entries(grouped).map(([relation, rels]) => `
            <div style="margin-bottom:1rem;">
                <div style="font-size:0.75rem;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.5rem;">
                    ${RELATION_MAP[relation] ?? relation}
                    <span style="font-weight:400;color:#bbb;margin-left:0.375rem;">(${rels.length})</span>
                </div>
                <div style="display:flex;flex-direction:column;gap:0.375rem;">
                    ${rels.map(r => {
            const otherId    = direction === 'outgoing' ? r.agent_id_b : r.agent_id_a
            const otherLabel = direction === 'outgoing' ? r.label_b    : r.label_a
            return `
                        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.75rem;background:#fafafa;border:1px solid #eee;border-radius:6px;">
                            <div style="display:flex;align-items:center;gap:0.75rem;">
                                <a href="/admin/relations/agent/${otherId}" style="font-weight:500;color:#1a1a1a;text-decoration:none;">${otherLabel}</a>
                                <span class="mono" style="font-size:0.8125rem;color:#aaa;">${otherId}</span>
                            </div>
                            ${deleteBtn('/admin/relations/delete/' + r.id, user.canDelete)}
                        </div>`
        }).join('')}
                </div>
            </div>`).join('')
    }

    const relationSelect = `
        <select name="relation" required>
            <option value="">— select —</option>
            <optgroup label="Family">
                <option value="parent_of">is parent of</option><option value="child_of">is child of</option>
                <option value="spouse_of">is spouse of</option><option value="sibling_of">is sibling of</option>
            </optgroup>
            <optgroup label="Professional">
                <option value="employer_of">is employer of</option><option value="employee_of">is employee of</option>
                <option value="mentor_of">is mentor of</option><option value="student_of">is student of</option>
                <option value="collaborator">collaborates with</option>
            </optgroup>
            <optgroup label="Organisational">
                <option value="member_of">is member of</option><option value="has_member">has member</option>
                <option value="founded">founded</option><option value="founded_by">was founded by</option>
            </optgroup>
        </select>`

    return layout(`${agent.label} — Agent relations`, `
    <div style="margin-bottom:0.25rem;">
        <a href="/admin/relations" style="font-size:0.875rem;color:#aaa;text-decoration:none;">← Agent relations</a>
    </div>
    <div style="display:flex;align-items:baseline;gap:0.75rem;margin-bottom:0.5rem;margin-top:1rem;">
        <h1 style="margin-bottom:0;">${agent.label}</h1>
        ${typeBadge}
    </div>
    <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:1.5rem;">
        <span class="mono" style="font-size:0.9375rem;color:#666;">${agent.agent_id}</span>
        <a href="https://data.designmuseumgent.be/v2/id/agent/${agent.agent_id}" target="_blank" style="font-size:0.8125rem;color:#4a90d9;">↗ API</a>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem;">
        <div class="card" style="margin-bottom:0;">
            <h2>Outgoing <span style="font-weight:400;color:#bbb;font-size:0.875rem;margin-left:0.375rem;">${agent.outgoing.length}</span></h2>
            <p style="font-size:0.8125rem;color:#aaa;margin-bottom:1rem;">This agent is the subject — <em>is parent of, member of, etc.</em></p>
            ${renderRelationBlock(outgoingByType, 'outgoing')}
        </div>
        <div class="card" style="margin-bottom:0;">
            <h2>Incoming <span style="font-weight:400;color:#bbb;font-size:0.875rem;margin-left:0.375rem;">${agent.incoming.length}</span></h2>
            <p style="font-size:0.8125rem;color:#aaa;margin-bottom:1rem;">Other agents refer to this one — <em>has member, has parent, etc.</em></p>
            ${renderRelationBlock(incomingByType, 'incoming')}
        </div>
    </div>

    <div class="card">
        <h2>Add relation</h2>
        <form method="POST" action="/admin/relations/add">
            <input type="hidden" name="agent_id_a" id="ac-agent-value-a" value="${agent.agent_id}">
            <div style="margin-bottom:1rem;padding:0.5rem 0.75rem;background:#fafafa;border:1px solid #eee;border-radius:6px;display:flex;align-items:center;gap:0.625rem;">
                <span style="font-weight:500;">${agent.label}</span>
                <span class="mono" style="font-size:0.8125rem;color:#aaa;">${agent.agent_id}</span>
            </div>
            <div class="form-grid" style="margin-bottom:1rem;">
                <div class="form-group"><label>Relation *</label>${relationSelect}</div>
                <div class="form-group"><label>Agent B *</label>${agentAcWidget('b')}</div>
            </div>
            <button type="submit" class="btn btn-primary">Add relation</button>
        </form>
    </div>

    ${agentAcScript()}
`, '/relations', user)
}