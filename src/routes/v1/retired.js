// src/routes/v1/retired.js
//
// v1 is retired, but its URIs were published and are in other people's code.
// Left unmounted they return 404 — "this never existed" — which is untrue and
// unhelpful. 410 Gone says the resource existed and is deliberately no longer
// served, and the Link header points at its successor.
//
// This is the same distinction the object endpoint already makes between 404
// (never here) and 410 (removed), and it is what the policy page's stable-URI
// commitment requires: a retired URI should still tell you what happened.
//
// Mount it where v1Router used to be:
//     import v1Retired from './src/routes/v1/retired.js'
//     app.use('/v1', v1Retired)

import { Router } from 'express'

const v1Retired = Router()

const SUCCESSOR = 'https://data.designmuseumgent.be/v2/'
const RETIRED_ON = '2026-07-01'   // ← set to the date v1 actually stopped serving

v1Retired.all('*', (req, res) => {
    // RFC 8594 Sunset for the date it went, and a successor-version link so a
    // client can find v2 without reading prose.
    res.setHeader('Link', `<${SUCCESSOR}>; rel="successor-version"`)
    res.setHeader('Deprecation', 'true')
    res.setHeader('Sunset', new Date(RETIRED_ON).toUTCString())
    res.setHeader('Cache-Control', 'public, max-age=86400')

    // Content-negotiated, because these URIs were consumed by machines as
    // often as by people.
    const wanted = req.accepts(['application/ld+json', 'application/json', 'text/html'])

    if (wanted === 'text/html') {
        return res.status(410).type('html').send(
            `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
            `<title>API v1 has been retired</title></head><body>` +
            `<h1>API v1 has been retired</h1>` +
            `<p>This endpoint stopped serving on ${RETIRED_ON}. ` +
            `The current API is <a href="${SUCCESSOR}">v2</a>.</p>` +
            `</body></html>`
        )
    }

    return res.status(410).json({
        status: 410,
        error: 'API v1 has been retired.',
        retired_on: RETIRED_ON,
        successor: SUCCESSOR,
        documentation: 'https://api.designmuseumgent.be/v2/',
    })
})

export default v1Retired