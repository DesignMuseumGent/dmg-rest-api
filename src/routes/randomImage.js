import fetch from 'node-fetch';
import {
  fetchAllImages,
  parseBoolean,
  fetchPublicDomainImages,
} from "../utils/parsers.js";

export function requestRandomImage(app) {
  app.get("/id/image", async (req, res) => {
    let limit = parseInt(req.query.limit) || 10;
    const pd = parseBoolean(req.query.pd) || true;
    const color = req.query.color || "all";
    const openFlag = parseBoolean(req.query.open) || false
    const size = req.query.size || "medium"

    let imageData;

    if (openFlag) {
      console.log("let's take a look - opening the image in your browser")
      limit = 1;
    }

    // await data from GET request (supabase)
    if (pd) {
      imageData = await fetchPublicDomainImages();
    } else {
      imageData = await fetchAllImages();
    }

    const objects = []; // init objects

    if (limit > 100) {
      res.status(422).json({
        error:
          "to reduce the stress on our servers, the maximum limit per request is set to 100, please try again lowering the limit",
      });
    }

    // fetch all objects, and populate bucket to randomize
    imageData.forEach(image => {
      const randomImage = {
        resource: image.PURL,
        object_number: image.object_number,
        license: image.license,
        attribution: image.attribution,
        color_names: image.color_names,
      };
      objects.push(randomImage);
    });

    // filter on color.
    const colorFilter = color !== "all" ? objects.filter(obj =>
        // implement fuzzy search
            obj.color_names && obj.color_names.some(colorName =>
                colorName.toLowerCase().includes(color.toLowerCase())
            )
    ) : objects;

    // Select random images
    const selection = [];
    for (let i = 0; i < limit && i < colorFilter.length; i++) {
      const index = Math.floor(Math.random() * colorFilter.length);
      selection.push(colorFilter[index]);
    }

    const sizes = {
      "original": "full",
      "large": "1800,",
      "medium": "1080,",
      "small": "750,"
    }

    // Fetch the first image data if openFlag is true and there is at least one image selected
    if (openFlag && selection.length > 0) {
      try {
        const selectedImage = selection[0];
        const resizedImageUrl = selectedImage.resource.replace(/\/full\/[\w-]+/, `/full/${sizes[size]}`);
        const response = await fetch(resizedImageUrl);
        const imageBuffer = await response.buffer(); // get image data as buffer
        // You can now use this buffer to send the image to the client, save it, etc.
        // For example, to send the image to the client:
        // Log some metadata to the server console
        console.log(`Displaying image: ${selectedImage.resource}`);
        console.log(`Image metadata: Object Number - ${selectedImage.object_number}, License - ${selectedImage.license}, Attribution - ${selectedImage.attribution}`);


        res.setHeader('Content-Type', 'image/jpeg'); // set the content-type to the correct image type
        res.send(imageBuffer);
      } catch (error) {
        console.error('Error fetching the image:', error);
        res.status(500).json({ error: 'Error fetching the image' });
      }
    } else {
      res.send(selection); // send the selected images' metadata if not fetching the image data
    }
  });
}
