export function resolver(PURL, _route, res, req){
    // if _route is the same as PURL (healthy stream)
    if (_route === PURL) {
        return true
    }
    // if _route is not the same as PURL (unhealthy stream) - refetch _route.
    else {
        if (_route === "https://data.designmuseumgent.be/id/object/UNHEALTHY") {
            res.status(422).json({"error":"Oops. the syntax of your request is correct, but data on this object has either not yet been published or we are working on repairing this link."})
        } else {
            // check request param
            req.negotiate(req.params.format , {
                // .json
                'json': function() {
                    let _jsonRoute = _route + '.json'
                    res.redirect(_jsonRoute)
                },

                // else default to html -->
                'default': function () {
                    res.redirect(_route)
                }
            })
        }
    }

}