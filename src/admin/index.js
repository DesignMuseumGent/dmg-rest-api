import { Router } from 'express'
import { supabase } from '../../supabaseClient.js'
import session from 'express-session'

export function setupAdmin(app) {

    // session middleware — add to app before admin routes
    app.use(session({
        secret: process.env.ADMIN_SESSION_SECRET || 'dmg-admin-secret',
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 hours
    }))

    const adminRouter = Router()

    // ---------------------------------------------------------------------------
    // AUTH MIDDLEWARE
    // ---------------------------------------------------------------------------

    const requireAuth = (req, res, next) => {
        if (req.session?.authenticated) return next()
        return res.redirect('/admin/login')
    }

    // ---------------------------------------------------------------------------
    // LOGIN
    // ---------------------------------------------------------------------------

    adminRouter.get('/login', (req, res) => {
        res.send(loginPage(req.query.error))
    })

    adminRouter.post('/login', (req, res) => {
        const { password } = req.body
        if (password === process.env.ADMIN_PASSWORD) {
            req.session.authenticated = true
            return res.redirect('/admin')
        }
        return res.redirect('/admin/login?error=1')
    })

    adminRouter.get('/logout', (req, res) => {
        req.session.destroy()
        return res.redirect('/admin/login')
    })

    // ---------------------------------------------------------------------------
    // DASHBOARD
    // ---------------------------------------------------------------------------

    adminRouter.get('/', requireAuth, (req, res) => {
        res.send(dashboardPage())
    })

    // ---------------------------------------------------------------------------
    // MEDIA
    // ---------------------------------------------------------------------------

    adminRouter.get('/media', requireAuth, async (req, res) => {
        const { data, error } = await supabase
            .from('dmg_objects_media')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100)

        res.send(mediaPage(data || [], error))
    })

    adminRouter.post('/media/add', requireAuth, async (req, res) => {
        const { objectNumber, title, url, type, date } = req.body

        if (!objectNumber || !url || !type) {
            return res.redirect('/admin/media?error=missing+fields')
        }

        // verify object exists
        const { data: obj } = await supabase
            .from('dmg_objects_LDES')
            .select('objectNumber')
            .eq('objectNumber', objectNumber)
            .maybeSingle()

        if (!obj) {
            return res.redirect('/admin/media?error=object+not+found')
        }

        const { error } = await supabase
            .from('dmg_objects_media')
            .insert({ objectNumber, title, url, type, date })

        if (error) return res.redirect('/admin/media?error=' + encodeURIComponent(error.message))
        return res.redirect('/admin/media?success=1')
    })

    adminRouter.post('/media/delete/:id', requireAuth, async (req, res) => {
        await supabase.from('dmg_objects_media').delete().eq('id', req.params.id)
        return res.redirect('/admin/media')
    })

    // ---------------------------------------------------------------------------
    // PROJECTS
    // ---------------------------------------------------------------------------

    adminRouter.get('/projects', requireAuth, async (req, res) => {
        const { data, error } = await supabase
            .from('dmg_objects_projects')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100)

        res.send(projectsPage(data || [], error))
    })

    adminRouter.post('/projects/add', requireAuth, async (req, res) => {
        const { objectNumber, title, url, date } = req.body

        if (!objectNumber || !title) {
            return res.redirect('/admin/projects?error=missing+fields')
        }

        // verify object exists
        const { data: obj } = await supabase
            .from('dmg_objects_LDES')
            .select('objectNumber')
            .eq('objectNumber', objectNumber)
            .maybeSingle()

        if (!obj) {
            return res.redirect('/admin/projects?error=object+not+found')
        }

        const { error } = await supabase
            .from('dmg_objects_projects')
            .insert({ objectNumber, title, url, date })

        if (error) return res.redirect('/admin/projects?error=' + encodeURIComponent(error.message))
        return res.redirect('/admin/projects?success=1')
    })

    adminRouter.post('/projects/delete/:id', requireAuth, async (req, res) => {
        await supabase.from('dmg_objects_projects').delete().eq('id', req.params.id)
        return res.redirect('/admin/projects')
    })

    app.use('/admin', adminRouter)
}

// ---------------------------------------------------------------------------
// HTML TEMPLATES
// ---------------------------------------------------------------------------

const layout = (title, content) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} — DMG Admin</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #333; }
        header { background: #1a1a1a; color: white; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; }
        header a { color: #ccc; text-decoration: none; font-size: 0.875rem; }
        header a:hover { color: white; }
        nav { background: #2a2a2a; padding: 0.75rem 2rem; display: flex; gap: 1.5rem; }
        nav a { color: #aaa; text-decoration: none; font-size: 0.875rem; }
        nav a:hover, nav a.active { color: white; }
        main { max-width: 1000px; margin: 2rem auto; padding: 0 2rem; }
        h1 { font-size: 1.5rem; margin-bottom: 1.5rem; }
        h2 { font-size: 1.125rem; margin-bottom: 1rem; color: #555; }
        .card { background: white; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.375rem; }
        .form-group.full { grid-column: 1 / -1; }
        label { font-size: 0.8125rem; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.03em; }
        input, select { padding: 0.5rem 0.75rem; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9375rem; width: 100%; }
        input:focus, select:focus { outline: none; border-color: #666; }
        .btn { padding: 0.5rem 1.25rem; border: none; border-radius: 6px; font-size: 0.9375rem; cursor: pointer; font-weight: 500; }
        .btn-primary { background: #1a1a1a; color: white; }
        .btn-primary:hover { background: #333; }
        .btn-danger { background: none; border: 1px solid #ddd; color: #999; font-size: 0.8125rem; padding: 0.25rem 0.625rem; cursor: pointer; border-radius: 4px; }
        .btn-danger:hover { border-color: #e53e3e; color: #e53e3e; }
        table { width: 100%; border-collapse: collapse; font-size: 0.9375rem; }
        th { text-align: left; padding: 0.625rem 0.75rem; font-size: 0.8125rem; color: #888; border-bottom: 2px solid #eee; text-transform: uppercase; letter-spacing: 0.03em; }
        td { padding: 0.75rem; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
        tr:last-child td { border-bottom: none; }
        .tag { display: inline-block; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
        .tag-video { background: #ebf4ff; color: #2b6cb0; }
        .tag-audio { background: #f0fff4; color: #276749; }
        .alert { padding: 0.75rem 1rem; border-radius: 6px; margin-bottom: 1rem; font-size: 0.9375rem; }
        .alert-success { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
        .alert-error { background: #fff5f5; color: #c53030; border: 1px solid #fed7d7; }
        .object-link { font-family: monospace; font-size: 0.875rem; color: #666; }
        a.external { color: #4a90d9; font-size: 0.875rem; }
        .empty { color: #aaa; font-style: italic; padding: 2rem; text-align: center; }
    </style>
</head>
<body>
    <header>
        <strong>DMG Admin</strong>
        <a href="/admin/logout">Sign out</a>
    </header>
    <nav>
        <a href="/admin">Dashboard</a>
        <a href="/admin/media">Media</a>
        <a href="/admin/projects">Projects</a>
    </nav>
    <main>${content}</main>
</body>
</html>`

const loginPage = (error) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>DMG Admin — Login</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .login-card { background: white; padding: 2.5rem; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); width: 360px; }
        h1 { font-size: 1.375rem; margin-bottom: 0.5rem; }
        p { color: #888; font-size: 0.9375rem; margin-bottom: 1.5rem; }
        label { display: block; font-size: 0.8125rem; font-weight: 600; color: #555; margin-bottom: 0.375rem; text-transform: uppercase; letter-spacing: 0.03em; }
        input { width: 100%; padding: 0.625rem 0.875rem; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem; margin-bottom: 1rem; }
        button { width: 100%; padding: 0.75rem; background: #1a1a1a; color: white; border: none; border-radius: 6px; font-size: 1rem; font-weight: 500; cursor: pointer; }
        button:hover { background: #333; }
        .error { background: #fff5f5; color: #c53030; padding: 0.75rem; border-radius: 6px; font-size: 0.9375rem; margin-bottom: 1rem; }
    </style>
</head>
<body>
    <div class="login-card">
        <h1>DMG Admin</h1>
        <p>Design Museum Gent — Collection API</p>
        ${error ? '<div class="error">Incorrect password.</div>' : ''}
        <form method="POST" action="/admin/login">
            <label>Password</label>
            <input type="password" name="password" autofocus required>
            <button type="submit">Sign in</button>
        </form>
    </div>
</body>
</html>`

const dashboardPage = () => layout('Dashboard', `
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
`)

const mediaPage = (rows, error) => layout('Media', `
    <h1>Media</h1>

    ${error ? `<div class="alert alert-error">${error.message}</div>` : ''}

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
        <h2>Recent entries</h2>
        ${rows.length === 0 ? '<p class="empty">No media entries yet.</p>' : `
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
                        <form method="POST" action="/admin/media/delete/${r.id}" style="display:inline">
                            <button type="submit" class="btn-danger" onclick="return confirm('Delete this entry?')">delete</button>
                        </form>
                    </td>
                </tr>`).join('')}
            </tbody>
        </table>`}
    </div>
`)

const projectsPage = (rows, error) => layout('Projects', `
    <h1>Projects</h1>

    ${error ? `<div class="alert alert-error">${error.message}</div>` : ''}

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
        <h2>Recent entries</h2>
        ${rows.length === 0 ? '<p class="empty">No project entries yet.</p>' : `
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
                        <form method="POST" action="/admin/projects/delete/${r.id}" style="display:inline">
                            <button type="submit" class="btn-danger" onclick="return confirm('Delete this entry?')">delete</button>
                        </form>
                    </td>
                </tr>`).join('')}
            </tbody>
        </table>`}
    </div>
`)