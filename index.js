import {
    fetchAllBillboards,
    fetchLDESRecordByObjectNumber,
    fetchLDESRecordByAgentID,
    fetchLDESrecordsByExhibitionID,
    fetchAllLDESrecordsObjects,
    fetchAllExhibitions
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

    const baseURI = "https://data.designmuseumgent.be/"

    // *** BILLBOARD SERIES *** //
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

    // *** OBJECTS *** //
    // todo: add context
    // todo: add cidoc
    app.get('/objects/', async(req, res)=> {
        const x = await fetchAllLDESrecordsObjects()
        let limit = parseInt(req.query.limit) || x.length; // if no limit set, return all items.
        let offset = parseInt(req.query.offset) || 0; // Default offset is 0
        const _objects = []
        console.log(x.length)
        let len = x.length

        //check if limit exceeds max.
        if(limit >= x.length) {
            limit = x.length
        }

        //check max offset.
        const maxOffset = x.length / limit
        if (offset > maxOffset) {
            offset = maxOffset
        }

        for(let i = 0; i < x.length; i++) {
            let _object = {}
            _object["@id"] = baseURI+"objects/"+x[i]["objectNumber"]
            _object["objectNumber"] = x[i]
            _objects.push(_object)
        }

        const paginatedObjects = _objects.slice(offset, offset + limit);
        res.send({paginatedObjects})
    })

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

    // *** AGENTS *** //


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

    // *** EXHIBITIONS *** //
    app.get('/exhibitions/', async(req, res)=> {
        const exh = await fetchAllExhibitions()
        let range = exh.length
        let _exhibitions = []

        for (let i = 0; i < range; i ++) {
            let _exhibition = {}
            _exhibition["@id"] = baseURI+"exhibitions/"+exh[i]["exh_PID"]
            _exhibitions.push(_exhibition)
        }
        res.send({_exhibitions})
    })

    app.get('/exhibitions/:exhibitionPID', async (req, res)=> {
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


    console.log("DONE :D :D :D :D ")
}

start();
