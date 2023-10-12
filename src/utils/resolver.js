export function resolver(PURL, _route, res){
    // if _route is the same as PURL (healthy stream)
    if (_route === PURL) {
        return true
    }

    // if _route is not the same as PURL (unhealthy stream) - refetch _route.
    else {
        res.redirect(_route);
    }

}