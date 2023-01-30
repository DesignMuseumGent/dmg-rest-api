import {supabase} from "./supabaseClient.js";
import {fetchAllBillboards, fetchBillboardByYear} from "./src/utils/parsers.js";
import express from "express";
const app = express();
const PORT = 1992;

app.listen(
    PORT,
    console.log("it's alive")
)

const billboards = await fetchAllBillboards()

// retrieve all billboards;
app.get('/exhibitions/billboardseries/', (req, res) => {
    var _test = req.query.test;
    if (req.query.test){
        const billboards = [];
        for (let x=0; x < billboards.length; x++) {
            if (billboards[x]["GecureerdeCollectie.bestaatUit"]["MensgemaaktObject.titel"].includes(_test)){
                console.log(billboards[x]);
                billboards.push(billboards[x]);
            }
        }
    }

    res.send(
        {
            billboards
        }
    );
})

// retrieve billboards for a specific year;