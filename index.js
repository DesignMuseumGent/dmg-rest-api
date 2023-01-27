import {supabase} from "./supabaseClient.js";
import {fetchAllBillboards} from "./src/utils/parsers.js";
import express from "express";
const app = express();
const PORT = 1992;

app.listen(
    PORT,
    console.log("it's alive")
)

const billboards = await fetchAllBillboards()

app.get('/exhibitions/billboardseries', (req, res) => {
    res.send(
        {
            billboards
        }
    );
})