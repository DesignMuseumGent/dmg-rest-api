import { Router } from 'express'
import { supabase } from '../../supabaseClient.js'

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

    adminRouter.get('/', requireAuth, (req, res) => {
        res.send(dashboardPage(req.session.user))
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

        const { error } = await supabase
            .from('dmg_objects_media')
            .insert({ objectNumber, title, url, type, date })
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

        const { error } = await supabase
            .from('dmg_objects_projects')
            .insert({ objectNumber, title, url, date })
        if (error) return res.redirect('/admin/projects?error=' + encodeURIComponent(error.message))
        return res.redirect('/admin/projects?success=1')
    })

    adminRouter.post('/projects/delete/:id', requireAuth, async (req, res) => {
        if (!req.session.user.canDelete) return res.status(403).send('Not authorised to delete')
        await supabase.from('dmg_objects_projects').delete().eq('id', req.params.id)
        return res.redirect('/admin/projects')
    })

    // ---------------------------------------------------------------------------
    // EXHIBITION MEDIA
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

    app.use('/admin', adminRouter)
}

// ---------------------------------------------------------------------------
// FONT & STYLES
// ---------------------------------------------------------------------------

const F = `'Museum', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`
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

/* header */
header { background:#1a1a1a; color:white; padding:1rem 2rem; display:flex; justify-content:space-between; align-items:center; }
header a { color:#ccc; text-decoration:none; font-size:0.875rem; }
header a:hover { color:white; }
.header-right { display:flex; align-items:center; gap:1rem; }
.header-user { color:#888; font-size:0.875rem; }
.badge { display:inline-block; padding:0.15rem 0.5rem; border-radius:4px; font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin-left:0.5rem; }
.badge-admin { background:#2d3748; color:#a0aec0; }
.badge-viewer { background:#2d3748; color:#718096; }

/* nav */
nav { background:#2a2a2a; padding:0.75rem 2rem; display:flex; gap:1.5rem; }
nav a { color:#aaa; text-decoration:none; font-size:0.875rem; }
nav a:hover, nav a.active { color:white; }

/* main */
main { max-width:1000px; margin:2rem auto; padding:0 2rem; }
h1 { font-size:1.5rem; font-weight:700; margin-bottom:1.5rem; }
h2 { font-size:1rem; font-weight:500; margin-bottom:1rem; color:#555; }

/* cards */
.card { background:white; border-radius:8px; padding:1.5rem; margin-bottom:1.5rem; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
.card-link { text-decoration:none; display:block; }
.card-link .card:hover { box-shadow:0 4px 12px rgba(0,0,0,0.12); transition:box-shadow 0.15s; }
.card-link p { color:#888; font-size:0.9375rem; margin-top:0.5rem; }
.dashboard-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; }

/* forms */
.form-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
.form-group { display:flex; flex-direction:column; gap:0.375rem; }
.form-group.full { grid-column:1/-1; }
label { font-size:0.75rem; font-weight:500; color:#555; text-transform:uppercase; letter-spacing:0.06em; }
input, select { padding:0.5rem 0.75rem; border:1px solid #ddd; border-radius:6px; font-size:0.9375rem; width:100%; font-family:${F}; background:white; }
input:focus, select:focus { outline:none; border-color:#555; box-shadow:0 0 0 3px rgba(0,0,0,0.06); }

/* buttons */
.btn { padding:0.5rem 1.25rem; border:none; border-radius:6px; font-size:0.9375rem; cursor:pointer; font-weight:500; font-family:${F}; }
.btn-primary { background:#1a1a1a; color:white; }
.btn-primary:hover { background:#333; }
.btn-sm { padding:0.25rem 0.625rem; font-size:0.8125rem; }
.btn-ghost { background:none; border:1px solid #ddd; color:#999; }
.btn-ghost:hover { border-color:#e53e3e; color:#e53e3e; }

/* search bar */
.search-bar { display:flex; gap:0.75rem; align-items:flex-end; margin-bottom:1.25rem; }
.search-bar .form-group { flex:1; margin:0; }
.search-bar .btn { flex-shrink:0; height:38px; }
.search-clear { font-size:0.8125rem; color:#999; text-decoration:none; align-self:center; }
.search-clear:hover { color:#333; }

/* table */
table { width:100%; border-collapse:collapse; font-size:0.9375rem; }
th { text-align:left; padding:0.625rem 0.75rem; font-size:0.75rem; color:#888; border-bottom:2px solid #eee; text-transform:uppercase; letter-spacing:0.06em; font-weight:500; }
td { padding:0.75rem; border-bottom:1px solid #f0f0f0; vertical-align:middle; }
tr:last-child td { border-bottom:none; }

/* misc */
.tag { display:inline-block; padding:0.2rem 0.5rem; border-radius:4px; font-size:0.75rem; font-weight:700; }
.tag-video { background:#ebf4ff; color:#2b6cb0; }
.tag-audio { background:#f0fff4; color:#276749; }
.alert { padding:0.75rem 1rem; border-radius:6px; margin-bottom:1rem; font-size:0.9375rem; }
.alert-success { background:#f0fff4; color:#276749; border:1px solid #c6f6d5; }
.alert-error { background:#fff5f5; color:#c53030; border:1px solid #fed7d7; }
.mono { font-family:${MONO}; font-size:0.875rem; color:#666; }
.link { color:#4a90d9; font-size:0.875rem; }
.empty { color:#aaa; font-style:italic; padding:2rem; text-align:center; }
.count { font-size:0.875rem; color:#888; margin-bottom:0.75rem; }
.no-perm { color:#ddd; font-size:0.8125rem; }
.perm-note { font-size:0.8125rem; color:#aaa; margin-top:0.75rem; }

/* autocomplete */
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
        <a href="/admin/media" ${path === '/media' ? 'class="active"' : ''}>Object media</a>
        <a href="/admin/projects" ${path === '/projects' ? 'class="active"' : ''}>Projects</a>
        <a href="/admin/exhibitions" ${path === '/exhibitions' ? 'class="active"' : ''}>Exhibition media</a>
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

const alerts = (success, error) => `
    ${success ? '<div class="alert alert-success">Entry added successfully.</div>' : ''}
    ${error ? `<div class="alert alert-error">${error}</div>` : ''}
`

const searchBar = (action, value, label, placeholder) => `
    <form method="GET" action="${action}" class="search-bar">
        <div class="form-group">
            <label>${label}</label>
            <input type="text" name="q" value="${value || ''}" placeholder="${placeholder}">
        </div>
        <button type="submit" class="btn btn-primary">Search</button>
        ${value ? `<a href="${action}" class="search-clear">Clear</a>` : ''}
    </form>
`

const deleteBtn = (action, canDelete) => canDelete
    ? `<form method="POST" action="${action}" style="display:inline">
           <button type="submit" class="btn btn-sm btn-ghost" onclick="return confirm('Delete this entry?')">delete</button>
       </form>`
    : '<span class="no-perm">—</span>'

const permNote = (canDelete) => !canDelete
    ? '<p class="perm-note">You do not have permission to delete entries.</p>'
    : ''

const resultCount = (n, search) =>
    `<p class="count">${n} ${n === 1 ? 'entry' : 'entries'}${search ? ` for "${search}"` : ''}</p>`

// ---------------------------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------------------------

const dashboardPage = (user) => layout('Dashboard', `
    <h1>Dashboard</h1>
    <div class="dashboard-grid">
        <a href="/admin/media" class="card-link">
            <div class="card">
                <h2>Object media</h2>
                <p>Add video and audio resources linked to collection objects.</p>
            </div>
        </a>
        <a href="/admin/projects" class="card-link">
            <div class="card">
                <h2>Projects</h2>
                <p>Add creative projects inspired by or using collection objects.</p>
            </div>
        </a>
        <a href="/admin/exhibitions" class="card-link">
            <div class="card">
                <h2>Exhibition media</h2>
                <p>Add video resources linked to exhibitions.</p>
            </div>
        </a>
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
        <form method="POST" action="/admin/exhibitions/add" id="exh-form">
            <div class="form-grid">
                <div class="form-group full">
                    <label>Exhibition *</label>
                    <div class="ac-wrap">
                        <input
                            type="text"
                            id="ac-input"
                            placeholder="Search by title or PID..."
                            autocomplete="off"
                        >
                        <div class="ac-dropdown" id="ac-dropdown"></div>
                    </div>
                    <input type="hidden" name="exh_PID" id="ac-value" required>
                    <div class="ac-selected" id="ac-selected">
                        <span class="ac-selected-label" id="ac-label"></span>
                        <span class="ac-selected-pid" id="ac-pid"></span>
                        <a href="#" class="ac-clear" id="ac-clear">✕ clear</a>
                    </div>
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

    <script>
    (function () {
        const input    = document.getElementById('ac-input')
        const dropdown = document.getElementById('ac-dropdown')
        const hidden   = document.getElementById('ac-value')
        const selected = document.getElementById('ac-selected')
        const label    = document.getElementById('ac-label')
        const pid      = document.getElementById('ac-pid')
        const clear    = document.getElementById('ac-clear')

        let timer

        // delegated click — works regardless of when items are rendered
        dropdown.addEventListener('click', (e) => {
            const item = e.target.closest('[data-pid]')
            if (!item) return
            hidden.value       = item.dataset.pid
            label.textContent  = item.dataset.label
            pid.textContent    = item.dataset.pid
            selected.style.display = 'flex'
            input.style.display    = 'none'
            dropdown.style.display = 'none'
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
            input.focus()
        })

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.ac-wrap')) dropdown.style.display = 'none'
        })
    })()
    </script>
`, '/exhibitions', user)