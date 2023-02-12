import {supabase} from "./supabaseClient.js";
import {fetchAllBillboards, fetchBillboardByYear, fetchLDESRecordByObjectNumber} from "./src/utils/parsers.js";
import express from "express";

const app = express();
app.use(express.static("public"))

app.listen(
    process.env.PORT || 3000,
    console.log("it's alive")
)

const billboard = await fetchAllBillboards()

// retrieve all billboards;
app.get('/exhibitions/billboardseries/', (req, res) => {
    const billboards = [];
    for (let x=0; x < billboard.length; x++) {
        if (billboard[x]){
            console.log(billboard[x]);
            billboards.push(billboard[x]);
        }
    }

    res.send(
        {
            billboards
        }
    );
})

app.get('/objects/:objectNumber', async (req, res) => {

    // 2005-0014_2-3

    const x = await fetchLDESRecordByObjectNumber(req.params.objectNumber)
    const result = x[0]["LDES_raw"];

    res.send(
        {result}
    )
})