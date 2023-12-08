import {
  fetchAllPrivateLDESrecordsObjects,
  fetchAuthentication,
} from "../utils/parsers.js";

export function requestPrivateObjects(app) {
  app.get("/private-objects/", async (req, res) => {
    // AUTHENTICATION
    let keys = await fetchAuthentication();

    console.log(keys);
    // check if the key is correct
    let apiKey = req.query.apiKey || "none";

    if (keys.some((item) => item.key === apiKey)) {
      // request limit
      let limit = parseInt(req.query.limit) || 10; // defautlt limit = 10;

      const x = await fetchAllPrivateLDESrecordsObjects(limit); // fetch data from supabase
      const _objects = [];

      // loop over data and write to api
      for (let i = 0; i < limit; i++) {
        try {
          _objects.push(x[i]["LDES_raw"]);
        } catch (e) {
          console.error(e);
        }
      }
      res.send(_objects);
      return;
    }

    // else send error
    else {
      res.status(401).json({
        error:
          "authentication key is missing. this stream is only available on request.",
      });
      return;
    }
  });
}
