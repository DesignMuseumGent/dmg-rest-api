import {fetchAllBillboards, fetchBillboardByYear, fetchLDESRecordByObjectNumber, fetchLDESRecordByAgentID} from "./src/utils/parsers.js";
import express from "express";
import * as cron from 'node-cron';

cron.schedule("30 09 * * *", start);

async function start(){

    const app = express();
    app.use(express.static("public"))

    app.listen(
        process.env.PORT || 1992,
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

    app.get('/agents/:agentPID', async(req, res) => {
        const x = await fetchLDESRecordByAgentID(req.params.agentPID);
        const result_cidoc = x[0]["LDES_raw"];
        res.send({result_cidoc})
    })


    app.get('/objects/:objectNumber', async (req, res) => {

        const x = await fetchLDESRecordByObjectNumber(req.params.objectNumber)

        const result_cidoc = x[0]["LDES_raw"];
        const result_oslo = x[0]["OSLO"];

        const type = req.params.ikwil;
        console.log(req.params.ikwil);

        if(type === "OSLO") {
            res.send(
                {result_oslo}
            )
        }

        else if(type === "CIDOC") {
            res.send(
                {result_cidoc}
            )
        }

        else {
            res.send(
                {result_cidoc}
            )
        }


    })
    console.log("DONE :D :D :D :D ")
}

start();
