import {
  fetchAllLDESrecordsObjects,
  fetchLDESRecordByObjectNumber,
  parseBoolean,
} from "../utils/parsers.js";
import { resolver } from "../utils/resolver.js";
import {response} from "express";

// constants
const BASE_URI = "https://data.designmuseumgent.be/";
const ERROR_410 = "the object is permanently removed from our collection";
const ERROR_422 = "Oops. the syntax of your request is correct, but data on this object has either not yet been published or we are working on repairing this link."
const DEFAULT_LIMIT = 10;
const DEFAULT_OFFSET = 0;

export function requestObjects(app) {
  app.get("/id/objects/", async (req, res) => {
    // await data from GET request (supabase)
    const records = await fetchAllLDESrecordsObjects();

    let limit = Math.min(parseInt(req.query.limit) || records.length, records.length); // if no limit set, return all items.
    let offset = parseInt(req.query.offset) || DEFAULT_OFFSET; // Default offset is 0
    let idOnly = parseBoolean(req.query.idOnly) || false; // if not idOnly, return all items
    let collection = req.query.collection || false

    const maxOffset = Math.floor(records.length / limit)
    offset = Math.min(offset, maxOffset)

    const objects = records.map(record => {
      if (idOnly) {
        return record["objectNumber"]
      }
      if (collection && record["LDES_raw"]["object"]) {
        return record["LDES_raw"]["object"];
      }

      let object = {};
      object["@context"] = [
        "https://apidg.gent.be/op…erfgoed-object-ap.jsonld",
        "https://apidg.gent.be/op…xt/generiek-basis.jsonld",
      ]

      object["@id"] = BASE_URI + "id/object/" + record["objectNumber"]; // create id (PID) for individual object
      object["@type"] = "MensgemaaktObject";
      object["Object.identificator"] = [
        {
          "@type": "Identificator",
          "Identificator.identificator": {
            "@value": record["objectNumber"],
          },
        },
      ];
      return object;
    })

    const responseObject = objects.slice(offset, offset + limit);
    const status = responseObject.length ? 200: 204;
    res.status(status).json(responseObject)
  })
}

export function requestObject(app) {
  app.get("/id/object/:objectNumber.:format?", async (req, res, next) => {

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

      // resolver
      if (resolver(_PURL, _route, res, req)) {
        result_cidoc = x;
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
          "https://data.designmuseumgent.be/id/object/" +
          req.params.objectNumber;
      // assign foaf:pages
      result_cidoc[0]["LDES_raw"]["object"]["foaf:homepage"] =
          "https://data.designmuseumgent.be/id/object/" +
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
            //send html anyway.
            res.redirect(_redirect);
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

  });
}
