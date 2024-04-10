import open from "open";
import {
  fetchAllImages,
  parseBoolean,
  fetchPublicDomainImages,
} from "../utils/parsers.js";

export function requestRandomImage(app) {
  app.get("/id/random-image", async (req, res) => {
    let limit = parseInt(req.query.limit) || 10;
    const pd = parseBoolean(req.query.pd) || true;
    const color = req.query.color || "all";
    const openFlag = parseBoolean(req.query.open) || false

    let x;

    // if open
    // set limit to 1
    // open in browser
    if (openFlag) {
      console.log("let's take a look - opening the image in your browser")
      limit = 1;
    }


    // await data from GET request (supabase)
    if (pd) {
      x = await fetchPublicDomainImages();
    } else {
      x = await fetchAllImages();
    }

    const _objects = []; // init objects

    if (limit > 100) {
      res.status(422).json({
        error:
          "to reduce the stress on our servers, the maximum limit per request is set to 100, please try again lowering the limit",
      });
    }
    // fetch all objects, and populate bucket to randomize
    for (let i = 0; i < x.length; i++) {
      let _randomImage = {};
      _randomImage["resource"] = x[i]["PURL"];
      _randomImage["object_number"] = x[i]["object_number"];
      _randomImage["license"] = x[i]["license"];
      _randomImage["attribution"] = x[i]["attribution"];
      _randomImage["color_names"] = x[i]["color_names"];
      //_randomImage["hex_values"] = x[i]["hex_values"];

      // push new object to API
      _objects.push(_randomImage);
    }

    // filter on color.
    const colorFilter = color !== "all" ? _objects.filter(obj => obj.color_names.includes(color)) : _objects;

    // Select random images
    const selection = [];
    for (let i = 0; i < limit && i < colorFilter.length; i++) {
      const index = Math.floor(Math.random() * colorFilter.length);
      selection.push(colorFilter[index]);
    }

    // Open the first image in the browser if open flag is true
    if (openFlag && selection.length > 0) {
      await open(selection[0].resource);
    }

    res.send(selection);


  });
}
