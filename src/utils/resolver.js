export function resolver(VERSION, PURL, _route, res, req) {
    console.log(`resolver PURL: ${PURL}`);
    console.log(`resolver _route: ${_route}`);

    if (_route === PURL) {
        return { continue: true };
    } else {
        if (_route === "id/object/UNHEALTHY") {
            return {
                error: "Oops. the syntax of your request is correct, but data on this object has either not yet been published or we are working on repairing this link."
            };
        } else {
            let result;
            req.negotiate(req.params.format, {
                'json': function() {
                    let trimmedRoute = _route.replace(/^\/+/, ''); // Remove leading slashes, if any.
                    let _jsonRoute = '/' + trimmedRoute + '.json';
                    result = { redirect: _jsonRoute };
                },
                'default': function() {
                    let trimmedRoute = _route.replace(/^\/+/, ''); // Remove leading slashes, if any.
                    result = { redirect: '/' + trimmedRoute };
                }
            });

            console.log(`Generated redirect: ${result ? result.redirect : 'undefined'}`);

            return result || {
                error: "No appropriate format found."
            };
        }
    }
}