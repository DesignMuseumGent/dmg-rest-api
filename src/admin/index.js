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

        if (!email || !password) {
            return res.redirect('/admin/login?error=missing')
        }

        const { data: user, error } = await supabase
            .from('dmg_admin_users')
            .select('id, email, password, name, can_delete')
            .eq('email', email.toLowerCase().trim())
            .eq('password', password)
            .maybeSingle()

        if (error || !user) {
            return res.redirect('/admin/login?error=invalid')
        }

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
    // MEDIA
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

    app.use('/admin', adminRouter)
}

// ---------------------------------------------------------------------------
// FONT STACK — Museum with safe system fallbacks
// ---------------------------------------------------------------------------

const FONT_STACK = `'Museum', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`

const dmgFont = `
<style>
    @font-face {
        font-family: 'Museum';
        src: url('/fonts/Museum-Light.otf') format('opentype');
        font-weight: 300;
        font-style: normal;
        font-display: swap;
    }
    @font-face {
        font-family: 'Museum';
        src: url('/fonts/Museum-Regular.otf') format('opentype');
        font-weight: 400;
        font-style: normal;
        font-display: swap;
    }
    @font-face {
        font-family: 'Museum';
        src: url('/fonts/Museum-Medium.otf') format('opentype');
        font-weight: 500;
        font-style: normal;
        font-display: swap;
    }
    @font-face {
        font-family: 'Museum';
        src: url('/fonts/Museum-Bold.otf') format('opentype');
        font-weight: 700;
        font-style: normal;
        font-display: swap;
    }
</style>`

// ---------------------------------------------------------------------------
// SHARED STYLES
// ---------------------------------------------------------------------------

const styles = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: ${FONT_STACK}; background: #f5f5f5; color: #333; }
    header { background: #1a1a1a; color: white; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; }
    header a { color: #ccc; text-decoration: none; font-size: 0.875rem; font-family: ${FONT_STACK}; }
    header a:hover { color: white; }
    .header-right { display: flex; align-items: center; gap: 1rem; }
    .header-user { color: #888; font-size: 0.875rem; font-family: ${FONT_STACK}; }
    .header-badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-left: 0.5rem; font-family: ${FONT_STACK}; }
    .header-badge-admin { background: #2d3748; color: #a0aec0; }
    .header-badge-viewer { background: #2d3748; color: #718096; }
    nav { background: #2a2a2a; padding: 0.75rem 2rem; display: flex; gap: 1.5rem; }
    nav a { color: #aaa; text-decoration: none; font-size: 0.875rem; font-family: ${FONT_STACK}; }
    nav a:hover, nav a.active { color: white; }
    main { max-width: 1000px; margin: 2rem auto; padding: 0 2rem; }
    h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem; font-family: ${FONT_STACK}; }
    h2 { font-size: 1rem; font-weight: 500; margin-bottom: 1rem; color: #555; font-family: ${FONT_STACK}; }
    p { font-family: ${FONT_STACK}; }
    .card { background: white; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .form-group { display: flex; flex-direction: column; gap: 0.375rem; }
    .form-group.full { grid-column: 1 / -1; }
    label { font-size: 0.75rem; font-weight: 500; color: #555; text-transform: uppercase; letter-spacing: 0.06em; font-family: ${FONT_STACK}; }
    input, select { padding: 0.5rem 0.75rem; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9375rem; width: 100%; font-family: ${FONT_STACK}; }
    input:focus, select:focus { outline: none; border-color: #555; box-shadow: 0 0 0 3px rgba(0,0,0,0.06); }
    .btn { padding: 0.5rem 1.25rem; border: none; border-radius: 6px; font-size: 0.9375rem; cursor: pointer; font-weight: 500; font-family: ${FONT_STACK}; }
    .btn-primary { background: #1a1a1a; color: white; }
    .btn-primary:hover { background: #333; }
    .btn-danger { background: none; border: 1px solid #ddd; color: #999; font-size: 0.8125rem; padding: 0.25rem 0.625rem; cursor: pointer; border-radius: 4px; font-family: ${FONT_STACK}; }
    .btn-danger:hover { border-color: #e53e3e; color: #e53e3e; }
    .search-bar { display: flex; gap: 0.75rem; align-items: flex-end; margin-bottom: 1.25rem; }
    .search-bar .form-group { flex: 1; margin: 0; }
    .search-bar .btn { flex-shrink: 0; height: 38px; }
    .search-clear { font-size: 0.8125rem; color: #999; text-decoration: none; align-self: center; font-family: ${FONT_STACK}; }
    .search-clear:hover { color: #333; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9375rem; font-family: ${FONT_STACK}; }
    th { text-align: left; padding: 0.625rem 0.75rem; font-size: 0.75rem; color: #888; border-bottom: 2px solid #eee; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 500; font-family: ${FONT_STACK}; }
    td { padding: 0.75rem; border-bottom: 1px solid #f0f0f0; vertical-align: middle; font-family: ${FONT_STACK}; }
    tr:last-child td { border-bottom: none; }
    .tag { display: inline-block; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; font-family: ${FONT_STACK}; }
    .tag-video { background: #ebf4ff; color: #2b6cb0; }
    .tag-audio { background: #f0fff4; color: #276749; }
    .alert { padding: 0.75rem 1rem; border-radius: 6px; margin-bottom: 1rem; font-size: 0.9375rem; font-family: ${FONT_STACK}; }
    .alert-success { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    .alert-error { background: #fff5f5; color: #c53030; border: 1px solid #fed7d7; }
    .object-link { font-family: 'Courier New', monospace; font-size: 0.875rem; color: #666; }
    a.external { color: #4a90d9; font-size: 0.875rem; font-family: ${FONT_STACK}; }
    .empty { color: #aaa; font-style: italic; padding: 2rem; text-align: center; font-family: ${FONT_STACK}; }
    .results-count { font-size: 0.875rem; color: #888; margin-bottom: 0.75rem; font-family: ${FONT_STACK}; }
    .no-delete { color: #ddd; font-size: 0.8125rem; }
    .permission-note { font-size: 0.8125rem; color: #aaa; margin-top: 0.75rem; font-family: ${FONT_STACK}; }
`

// ---------------------------------------------------------------------------
// LAYOUT
// ---------------------------------------------------------------------------

const layout = (title, content, currentPath = '', user = null) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} — DMG Admin</title>
    ${dmgFont}
    <style>${styles}</style>
</head>
<body>
    <header>
        <a href="/admin" style="display: flex; align-items: center; text-decoration: none;">
            <img src="/images/dmg-logo.svg" alt="Design Museum Gent" style="height: 28px; filter: invert(1);">
        </a>
        <div class="header-right">
            ${user ? `
                <span class="header-user">
                    ${user.name || user.email}
                    <span class="header-badge ${user.canDelete ? 'header-badge-admin' : 'header-badge-viewer'}">
                        ${user.canDelete ? 'admin' : 'viewer'}
                    </span>
                </span>
            ` : ''}
            <a href="/admin/logout">Sign out</a>
        </div>
    </header>
    <nav>
        <a href="/admin" ${currentPath === '/' ? 'class="active"' : ''}>Dashboard</a>
        <a href="/admin/media" ${currentPath === '/media' ? 'class="active"' : ''}>Media</a>
        <a href="/admin/projects" ${currentPath === '/projects' ? 'class="active"' : ''}>Projects</a>
    </nav>
    <main>${content}</main>
</body>
</html>`

// ---------------------------------------------------------------------------
// LOGIN PAGE
// ---------------------------------------------------------------------------

const loginPage = (error) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>DMG Admin — Login</title>
    ${dmgFont}
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: ${FONT_STACK}; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .login-card { background: white; padding: 2.5rem; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); width: 360px; }
        .logo { margin-bottom: 1.5rem; }
        .logo img { height: 32px; }
        p { color: #888; font-size: 0.9375rem; margin-bottom: 1.5rem; font-family: ${FONT_STACK}; }
        label { display: block; font-size: 0.75rem; font-weight: 500; color: #555; margin-bottom: 0.375rem; text-transform: uppercase; letter-spacing: 0.06em; font-family: ${FONT_STACK}; }
        input { width: 100%; padding: 0.625rem 0.875rem; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem; margin-bottom: 1rem; font-family: ${FONT_STACK}; }
        input:focus { outline: none; border-color: #555; box-shadow: 0 0 0 3px rgba(0,0,0,0.06); }
        button { width: 100%; padding: 0.75rem; background: #1a1a1a; color: white; border: none; border-radius: 6px; font-size: 1rem; font-weight: 500; cursor: pointer; font-family: ${FONT_STACK}; }
        button:hover { background: #333; }
        .error { background: #fff5f5; color: #c53030; padding: 0.75rem; border-radius: 6px; font-size: 0.9375rem; margin-bottom: 1rem; font-family: ${FONT_STACK}; }
    </style>
</head>
<body>
    <div class="login-card">
        <div class="logo">
            <img src="/images/dmg-logo.svg" alt="Design Museum Gent">
        </div>
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
// DASHBOARD PAGE
// ---------------------------------------------------------------------------

const dashboardPage = (user) => layout('Dashboard', `
    <h1>Dashboard</h1>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <a href="/admin/media" style="text-decoration: none;">
            <div class="card" style="cursor: pointer;">
                <h2>Media</h2>
                <p style="color: #888; font-size: 0.9375rem; margin-top: 0.5rem;">Add video and audio resources linked to collection objects.</p>
            </div>
        </a>
        <a href="/admin/projects" style="text-decoration: none;">
            <div class="card" style="cursor: pointer;">
                <h2>Projects</h2>
                <p style="color: #888; font-size: 0.9375rem; margin-top: 0.5rem;">Add creative projects inspired by or using collection objects.</p>
            </div>
        </a>
    </div>
`, '/', user)

// ---------------------------------------------------------------------------
// MEDIA PAGE
// ---------------------------------------------------------------------------

const mediaPage = (rows, error, success, search, user) => layout('Media', `
    <h1>Media</h1>

    ${success ? '<div class="alert alert-success">Entry added successfully.</div>' : ''}
    ${error ? `<div class="alert alert-error">${error}</div>` : ''}

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
            <div style="margin-top: 1rem;">
                <button type="submit" class="btn btn-primary">Add media</button>
            </div>
        </form>
    </div>

    <div class="card">
        <h2>Entries</h2>
        <form method="GET" action="/admin/media" class="search-bar">
            <div class="form-group">
                <label>Filter by object number</label>
                <input type="text" name="q" value="${search || ''}" placeholder="1987, 0913, ...">
            </div>
            <button type="submit" class="btn btn-primary">Search</button>
            ${search ? '<a href="/admin/media" class="search-clear">Clear</a>' : ''}
        </form>

        ${rows.length === 0
    ? `<p class="empty">${search ? `No media found for "${search}".` : 'No media entries yet.'}</p>`
    : `
        <p class="results-count">${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}${search ? ` for "${search}"` : ''}</p>
        <table>
            <thead>
                <tr>
                    <th>Object</th>
                    <th>Type</th>
                    <th>Title</th>
                    <th>Year</th>
                    <th>URL</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                ${rows.map(r => `
                <tr>
                    <td><span class="object-link">${r.objectNumber}</span></td>
                    <td><span class="tag ${r.type === 'VIDEO' ? 'tag-video' : 'tag-audio'}">${r.type}</span></td>
                    <td>${r.title || '—'}</td>
                    <td>${r.date || '—'}</td>
                    <td><a href="${r.url}" target="_blank" class="external">↗ link</a></td>
                    <td>
                        ${user.canDelete ? `
                        <form method="POST" action="/admin/media/delete/${r.id}" style="display:inline">
                            <button type="submit" class="btn-danger" onclick="return confirm('Delete this entry?')">delete</button>
                        </form>` : '<span class="no-delete">—</span>'}
                    </td>
                </tr>`).join('')}
            </tbody>
        </table>
        ${!user.canDelete ? '<p class="permission-note">You do not have permission to delete entries.</p>' : ''}`}
    </div>
`, '/media', user)

// ---------------------------------------------------------------------------
// PROJECTS PAGE
// ---------------------------------------------------------------------------

const projectsPage = (rows, error, success, search, user) => layout('Projects', `
    <h1>Projects</h1>

    ${success ? '<div class="alert alert-success">Entry added successfully.</div>' : ''}
    ${error ? `<div class="alert alert-error">${error}</div>` : ''}

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
            <div style="margin-top: 1rem;">
                <button type="submit" class="btn btn-primary">Add project</button>
            </div>
        </form>
    </div>

    <div class="card">
        <h2>Entries</h2>
        <form method="GET" action="/admin/projects" class="search-bar">
            <div class="form-group">
                <label>Filter by object number</label>
                <input type="text" name="q" value="${search || ''}" placeholder="1987, 0913, ...">
            </div>
            <button type="submit" class="btn btn-primary">Search</button>
            ${search ? '<a href="/admin/projects" class="search-clear">Clear</a>' : ''}
        </form>

        ${rows.length === 0
    ? `<p class="empty">${search ? `No projects found for "${search}".` : 'No project entries yet.'}</p>`
    : `
        <p class="results-count">${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}${search ? ` for "${search}"` : ''}</p>
        <table>
            <thead>
                <tr>
                    <th>Object</th>
                    <th>Title</th>
                    <th>Year</th>
                    <th>URL</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                ${rows.map(r => `
                <tr>
                    <td><span class="object-link">${r.objectNumber}</span></td>
                    <td>${r.title || '—'}</td>
                    <td>${r.date || '—'}</td>
                    <td>${r.url ? `<a href="${r.url}" target="_blank" class="external">↗ link</a>` : '—'}</td>
                    <td>
                        ${user.canDelete ? `
                        <form method="POST" action="/admin/projects/delete/${r.id}" style="display:inline">
                            <button type="submit" class="btn-danger" onclick="return confirm('Delete this entry?')">delete</button>
                        </form>` : '<span class="no-delete">—</span>'}
                    </td>
                </tr>`).join('')}
            </tbody>
        </table>
        ${!user.canDelete ? '<p class="permission-note">You do not have permission to delete entries.</p>' : ''}`}
    </div>
`, '/projects', user)