import {
    fetchAllConcepts,
    fetchAllExhibitions,
    fetchAuthentication,
    fetchLDESAllAgents,
    parseBoolean
} from "../../utils/parsers.js";
import {supabase} from "../../../supabaseClient.js";
export function Dump(app, BASE_URI)  {

    let types = ["concepts", "objects", "agents", "exhibitions"]

    app.get("/v1/dump/:type", async(req, res)=> {
        // await RES from DB req
        // if not existing type; return error message

        // Step 1: Authenticate the API key
        const keys = await fetchAuthentication();
        const apiKey = req.query.apiKey || "none";

        if (!keys.some((item) => item.key === apiKey)) {
            return res.status(401).json({
                error:
                    "Authentication key is missing. This stream is only available via authentication.",
            });
        }

        if (!types.includes(req.params.type)) {
            res.status(422).json({
                error: "there is data dump available for this type. Check the API documentation for available datasets."
            })
        }

        //todo: add dump for exhibitions
        if (req.params.type==="exhibitions") {
            const e = await fetchAllExhibitions();
            let dump = [];
            for (let i=0; i<e.length; i++) {
                dump.push(e[i]["LDES_raw"]["object"])
            }
            // set headers to prompt file download
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=dmg-api-exhibitions-dump.json');

            // send JSON data as downloadable file
            res.send(JSON.stringify(dump, null, 2))
        }

        if (req.params.type==="agents") {
            const x = await fetchLDESAllAgents()
            let dump = [];
            for (let i=0; i<x.length; i++) {
                dump.push(x[i]["LDES_raw"]["object"])
            }
            // set headers to prompt file download
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=dmg-api-agents-dump.json');

            // send JSON data as downloadable file
            res.send(JSON.stringify(dump, null, 2))
        }

        if (req.params.type==="concepts") {
            const x = await fetchAllConcepts()
            let dump = [];
            for (let i = 0; i < x.length; i++) {
                dump.push(x[i]["LDES_raw"]["object"])
            }
            // set headers to prompt file download
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=dmg-api-concepts-dump.json');

            // send JSON data as downloadable file
            res.send(JSON.stringify(dump, null, 2))
        }

        if (req.params.type==="objects") {

            let _private = parseBoolean(req.query.private) || false
            let apiKey = req.query.apiKey || "none";
            let auth = false // set authentication to false initialy.

            let keys = await fetchAuthentication();

            if (keys.some((item) => item.key  === apiKey)) {
                auth = true; // if key is correct set auth to true.
            }

            if (_private && auth) {
                console.log("succesfully authenticated - fetching data from private LDES")
                try {
                    // fetch data from supabase (private LDES)
                    // setup batch requests.
                    let moreRecordsAvailable = true;
                    let offset = 0;
                    const batchSize = 1000 // adjust batchsize here.
                    let dump = []

                    // dump data into JSON file
                    // Set headers to prompt file download
                    res.setHeader('Content-Type', 'application/json');
                    res.setHeader('Content-Disposition', 'attachment; filename=dmg-api-objects-dump.json');

                    // start streaming response
                    res.write('[');

                    while (moreRecordsAvailable) {
                        // fetch data from supabase in batches
                        const {data, error} = await supabase
                            .from("dmg_private_objects_LDES")
                            .select("LDES_raw")
                            .range(offset, offset + batchSize - 1)
                        if (error) throw error;

                        // check if there are no more records to check;
                        moreRecordsAvailable = data.length === batchSize;
                        offset += data.length

                        // append data to the response
                        dump = data.map(item => item["LDES_raw"]);
                        res.write(JSON.stringify(dump, null, 2).slice(1, -1)) // remove brackets

                        // add a comma
                        if (moreRecordsAvailable) {
                            res.write(',')
                        }
                    }
                    // end streaming response.
                    res.write(']')
                    res.end();

                } catch (e) {
                    console.error('Error:', e)
                    res.status(500).send('An error occurred')
                }
            }

            if (!_private) {
                try {
                    // fetch data directly from Supabase.
                    console.log("fetch and dump")

                    const {data, error} = await supabase
                        .from("dmg_objects_LDES")
                        .select("LDES_raw")
                    if (error) throw error;

                    // clean data
                    let dump = [];
                    for (let i=0; i<data.length; i++) {
                        dump.push(data[i]["LDES_raw"])
                    }

                    // dump data into JSON file
                    // Set headers to prompt file download
                    res.setHeader('Content-Type', 'application/json');
                    res.setHeader('Content-Disposition', 'attachment; filename=data.json');


                    // Send JSON data as a downloadable file
                    res.send(JSON.stringify(dump, null, 2));

                } catch (error) {
                    console.error('Error:', error)
                    res.status(500).send('An error occurred')
                }
            }


        }

    })
}