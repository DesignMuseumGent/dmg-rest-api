import {
  fetchAllLDESrecordsObjects,
  parseBoolean,
} from "../utils/parsers.js";

const DEFAULT_OFFSET = 0;

export function requestObjects(app, BASE_URI) {
  app.get("/v1/id/objects/", async (req, res) => {
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
        "https://apidg.gent.be/operfgoed-object-ap.jsonld",
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