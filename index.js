import {supabase} from "./supabaseClient.js";
import {fetchAllBillboards, fetchBillboardByYear} from "./src/utils/parsers.js";
import express from "express";

const app = express();
const PORT = 1992;

app.listen(
    PORT,
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

// retrieve billboards for a specific year;