import {fetchAllLDESrecordsObjects} from "../utils/parsers.js";
import {supabase} from "../../supabaseClient.js";
import { writeFile } from 'fs/promises';

export function dataDump(app)  {
    app.get("/objects/fetch-and-dump", async (req, res) => {
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
    })
}