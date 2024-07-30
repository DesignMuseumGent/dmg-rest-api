import {
  fetchAllPrivateLDESrecordsObjects,
  fetchAuthentication,
} from "../utils/parsers.js";

export function requestPrivateObjects(app) {
  app.get("id/private-objects/", async (req, res) => {
    // AUTHENTICATION
    let keys = await fetchAuthentication();
    console.log(keys);
    // check if the key is correct
    let apiKey = req.query.apiKey || "none";

    if (keys.some((item) => item.key === apiKey)) {
      // request limit
      let limit = parseInt(req.query.limit) || 100; // defautlt limit = 10;
      if (limit > 1000) {
        // set limit to 1000 items per request.
        limit = 1000;
      }
      let offset = parseInt(req.query.offset) || 0; //
      let rangeStart, rangeEnd;
      console.log(offset);

      if (offset == 0) {
        rangeStart = 0;
        rangeEnd = limit;
      } else {
        rangeStart = limit;
        rangeEnd = (offset + 1) * limit;
      }

      console.log(rangeStart, rangeEnd);
      const x = await fetchAllPrivateLDESrecordsObjects(rangeStart, rangeEnd); // fetch data from supabase based on limit and range
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
