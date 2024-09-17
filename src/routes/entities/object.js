import { fetchLDESRecordByObjectNumber } from "../../utils/parsers.js";
import { resolver } from "../../utils/resolver.js";

// constants
const ERROR_410 = "the object is permanently removed from our collection";
const ERROR_422 = "Oops. the syntax of your request is correct, but data on this object has either not yet been published or we are working on repairing this link."
const DEFAULT_LIMIT = 10;

export function requestObject(app, BASE_URI) {

    const objectHandler = async (req, res) => {

        console.log(req.query.easy)




        // 1. resolve to special pages
        if (req.params.objectNumber === "removed") {
            return res.status(410).json({
                410: ERROR_410,
            });
        }

        // 2. fetch information
        // await data from GET request (supabase)
        let x;
        try {
            x = await fetchLDESRecordByObjectNumber(req.params.objectNumber);
        } catch (err) {
            return res.status(500).json({ error: "Error fetching object data" });
        }

        const _redirect = "https://data.collectie.gent/entity/dmg:" + req.params.objectNumber;
        let _manifest = false;
        let _open = false;
        let result_cidoc;
        let _easy = false;

        if (req.query.easy) {
            console.log("——— ___ yaay ___ ———");
            console.log(x[0])
            return res.json(x[0]["EASY"]); // Return and stop further execution
        }

        // define path to resolve to
        try {
            if (x[0]["RESOLVES_TO"]) {
                const objectnumber = x[0]["RESOLVES_TO"].replace("id/object/", "");
                if (objectnumber.includes("ROOD")) {
                    console.log(objectnumber);
                    return res.status(410).json({ error: "this object has been permanently removed" }); // Stop execution
                } else {
                    const resolve = await fetchLDESRecordByObjectNumber(objectnumber);
                    return res.send(resolve[0]["LDES_raw"]["object"]); // Stop execution
                }
            }
        } catch (e) {
            return res.status(500).json({ error: "the syntax is correct, but this object is not published or doesn't exist" }); // Stop execution
        }

        function parseBoolean(string) {
            return string === "true" ? true : string === "false" ? false : undefined;
        }

        try {
            _easy = parseBoolean(req.query.easy) || false;
            console.log(_easy)
            console.log(x)
        } catch (e) {
           console.log(e)
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
                BASE_URI + "id/object/" + req.params.objectNumber;
            // assign foaf:pages
            result_cidoc[0]["LDES_raw"]["object"]["foaf:homepage"] =
                BASE_URI + "id/object/" + req.params.objectNumber;
        } catch (error) {
            return res.status(500).json({ error: "Error processing CIDOC object" }); // Stop execution
        }

        // error handling.
        try {
            if (result_cidoc.length !== 0) {
                return req.negotiate(req.params.format, {
                    json: function () {
                        // if manifest only send manifest;
                        if (_manifest && !_open) {
                            return res.send(
                                result_cidoc[0]["LDES_raw"]["object"][
                                    "http://www.cidoc-crm.org/cidoc-crm/P129i_is_subject_of"
                                ]["@id"],
                            );
                        } else if (_manifest && _open) {
                            return res.redirect(
                                result_cidoc[0]["LDES_raw"]["object"][
                                    "https://www.cidoc-crm.org/cidoc-crm/P129i_is_subject_of"
                                ]["@id"],
                            );
                        } else {
                            // if format .json redirect to machine-readable page.
                            // res.set('Content-Type', 'application/json+ld;charset=utf-8')
                            return res.send(result_cidoc[0]["LDES_raw"]["object"]);
                        }
                        //todo: add route to page when not published yet. -- this object has not been published yet.
                    },
                    html: function () {
                        return res.redirect(_redirect);
                    },
                    default: function () {
                        return res.redirect(result_cidoc[0]["LDES_raw"]["object"]);
                    },
                });
            } else {
                // string is correct / but object can't be found.
                return res.status(422).json({
                    error: ERROR_422,
                });
            }
        } catch (e) {
            return res.status(503).send(e); // Stop execution
        }
    }

    app.get("/v1/id/object/:objectNumber.:format?", objectHandler);
    app.get("/v1/id/ark:/29417/object/:objectNumber.:format?", objectHandler);
}