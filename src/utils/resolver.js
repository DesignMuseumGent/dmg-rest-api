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
            let objectnumber = _route.split('/')[2]
            req.negotiate(req.params.format, {
                'json': function() {
                    let _jsonRoute = '/' + objectnumber + '.json';
                    result = { redirect: _jsonRoute };
                },
                'default': function() {
                    result = { redirect: '/' + objectnumber };
                }
            });

            console.log(result)

            console.log(`Generated redirect: ${result ? result.redirect : 'undefined'}`);

            return result || {
                error: "No appropriate format found."
            };
        }
    }
}