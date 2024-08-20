import {fetchLDESRecordByObjectNumber} from "../../utils/parsers.js";
import {resolver} from "../../utils/resolver.js";

// constants
const ERROR_410 = "the object is permanently removed from our collection";
const ERROR_422 = "Oops. the syntax of your request is correct, but data on this object has either not yet been published or we are working on repairing this link."
const DEFAULT_LIMIT = 10;

export function requestObject(app, BASE_URI) {

    const objectHandler = async(req, res) => {
        // 1. resolve to special pages
        if (req.params.objectNumber === "removed") {
            return res.status(410).json({
                410: ERROR_410,
            });
        }

        // 2. fetch information
        // await data from GET request (supabase)
        const x = await fetchLDESRecordByObjectNumber(req.params.objectNumber);
        const _redirect =
            "https://data.collectie.gent/entity/dmg:" + req.params.objectNumber;
        let _error = "";
        let _manifest = false;
        let _open = false;
        let result_cidoc;

        // define path to resolve to
        if (x[0]["RESOLVES_TO"]) {
            let _route = x[0]["RESOLVES_TO"];
            let _PURL = x[0]["PURI"];

            console.log(`Before resolver, _route: ${_route}, _PURL: ${_PURL}`);


            // resolver
            let resolverResult = resolver("v1",_PURL, _route, res, req);
           // Validate the resolverResult
            if (resolverResult) {
                console.log(`After resolver, resolverResult: ${JSON.stringify(resolverResult)}`);

                if (resolverResult.continue) {
                    result_cidoc = x;
                } else if (resolverResult.error) {
                    return res.status(422).json({"error": resolverResult.error});
                } else if (resolverResult.redirect) {
                    console.log(resolverResult.redirect)
                    return res.redirect(resolverResult.redirect);
                }
            } else {
                // Handle the situation where resolverResult is null or undefined
                return res.status(500).json({"error": "Internal Server Error: Resolver result is undefined."});
            }
        }


        function parseBoolean(string) {
            return string === "true"
                ? true
                : string === "false"
                    ? false
                    : undefined;
        }

        // if asked for image, only return manifest link.
        try {
            _manifest = parseBoolean(req.query.manifest) || false;
            _open = parseBoolean(req.query.open) || false;
        } catch (e) {
            console.log(e);
        }

        try {
            // redefine - @id to use URIs and PIDs defined by the museum
            result_cidoc[0]["LDES_raw"]["object"]["@id"] =
                BASE_URI + "id/object/" +
                req.params.objectNumber;
            // assign foaf:pages
            result_cidoc[0]["LDES_raw"]["object"]["foaf:homepage"] =
                BASE_URI + "id/object/" +
                req.params.objectNumber;
        } catch (error) {
            _error = error;
        }

        // error handling.
        try {
            if (result_cidoc.length !== 0) {
                req.negotiate(req.params.format, {
                    json: function () {
                        // if manifest only send manifest;
                        if (_manifest && !_open) {
                            let _man = result_cidoc["object"];
                            res.send(
                                result_cidoc[0]["LDES_raw"]["object"][
                                    "http://www.cidoc-crm.org/cidoc-crm/P129i_is_subject_of"
                                    ]["@id"],
                            );
                        } else if (_manifest && _open) {
                            res.redirect(
                                result_cidoc[0]["LDES_raw"]["object"][
                                    "https://www.cidoc-crm.org/cidoc-crm/P129i_is_subject_of"
                                    ]["@id"],
                            );
                        } else {
                            // if format .json redirect to machine-readable page.
                            // res.set('Content-Type', 'application/json+ld;charset=utf-8')
                            res.send(result_cidoc[0]["LDES_raw"]["object"]);
                        }
                        //todo: add route to page when not published yet. -- this object has not been published yet.
                    },
                    html: function () {
                        // if format .html redirect to human-readable page
                        res.redirect(_redirect);
                    },
                    default: function () {
                        res.redirect(result_cidoc[0]["LDES_raw"]["object"]);
                    },
                });
            } else {
                // string is correct / but object can't be found.
                res.status(422).json({
                    error:
                    ERROR_422,
                });
            }
        } catch (e) {
            res.status(503).send(e);
        }
    }
    app.get("/v1/id/object/:objectNumber.:format?",  objectHandler);
    app.get("/v1/id/ark:/29417/object/:objectNumber.:format?",  objectHandler);
}
