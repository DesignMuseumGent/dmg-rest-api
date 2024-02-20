import {fetchAuthentication, parseBoolean} from "../utils/parsers.js";
import {supabase} from "../../supabaseClient.js";
import { writeFile } from 'fs/promises';

export function dataDump(app)  {
    app.get("/objects/fetch-and-dump", async (req, res) => {

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
                res.setHeader('Content-Disposition', 'attachment; filename=data.json');

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
    })
}