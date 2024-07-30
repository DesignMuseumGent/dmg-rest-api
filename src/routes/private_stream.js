import {
  fetchAllPrivateLDESrecordsObjects,
  fetchAuthentication,
} from "../utils/parsers.js";

export function requestPrivateObjects(app) {
  app.get("id/private-objects/", async (req, res) => {
    // AUTHENTICATION
    let keys = await fetchAuthentication();
    // check if the key is correct
    let apiKey = req.query.apiKey || "none";

    if(!keys.some((item) => item.key === apiKey)){
      return res.status(401).json({
        error: "Authentication key is missing. this stream is only available via authentication"
      });
    }

    let limit = parseInt(req.query.limit) || 10; // default limit = 10;
    limit = Math.min(limit, 1000); // Set limit to maximum 1000 items per request

    const offset = parseInt(req.query.offset) || 0;
    const rangeStart = offset === 0 ? 0 : limit;
    const rangeEnd = (offset + 1) * limit

    const records = await fetchAllPrivateLDESrecordsObjects(rangeStart, rangeEnd)
    const objects = records.slice(0, limit).map(record=>record["LDES_raw"])

    return res.send(objects)

  });
}
