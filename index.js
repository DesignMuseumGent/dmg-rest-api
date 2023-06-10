import {
    fetchAllBillboards,
    fetchLDESRecordByObjectNumber,
    fetchLDESRecordByAgentID,
    fetchLDESrecordsByExhibitionID
} from "./src/utils/parsers.js";
import express from "express";
import * as cron from 'node-cron';

cron.schedule('0 0 * * 0', start); // run harvest every day at 10:00

async function start(){

    const app = express();
    app.use(express.static("public"))

    app.listen(
        process.env.PORT || 1992,
        console.log("it's alive")
    )

    app.get('/', (req, res) => {
        let dcat = {}
        //todo: publish own context file.
        let context = [
            "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/DCAT-AP-VL.jsonld",
            {
            "dcterms": "http://purl.org/dc/terms/",
            "tree": "https://w3id.org/tree#"
        }]
        dcat["@context"] = context;
        dcat["@id"] = "https://data.designmuseumgent.be/";
        dcat["@type"] = "Datasetcatalogus";
        dcat["Datasetcatalogus.titel"] = {
            "@value": "catalogus Design Museum Gent",
            "@language": "nl"
        }
        dcat["Datasetcatalogus.heeftLicentie"] ={
            "@id": "https://creativecommons.org/publicdomain/zero/1.0/"
        }

        res.send({dcat})
    })

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

    // ark
    app.get('/ark:/29417/exhibitions/billboardseries/', (req, res) => {
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

    // ark
    app.get('/ark:/29417/agents/:agentPID', async(req, res) => {
        const x = await fetchLDESRecordByAgentID(req.params.agentPID);
        const result_cidoc = x[0]["LDES_raw"];
        res.send({result_cidoc})
    })


    app.get('/exhibitions/:exhibitionPID', async (req, res)=>{
        const x = await fetchLDESrecordsByExhibitionID(req.params.exhibitionPID)
        try{
            const result_cidoc = x[0]["LDES_raw"];
            console.log(result_cidoc)
            res.send({result_cidoc})
        } catch (e) {
            console.log(e)
        }

    } )

    app.get('/ark:/29417/exhibitions/:exhibitionPID', async (req, res)=>{
        const x = await fetchLDESrecordsByExhibitionID(req.params.exhibitionPID)
        try{
            const result_cidoc = x[0]["LDES_raw"];
            console.log(result_cidoc)
            res.send({result_cidoc})
        } catch (e) {
            console.log(e)
        }

    } )

    app.get('/objects/:objectNumber' || '/ark:/29417/objects/:objectNumber', async (req, res) => {

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

    // ark
    app.get('/ark:/29417/objects/:objectNumber', async (req, res) => {

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
