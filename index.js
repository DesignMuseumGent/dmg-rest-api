import {
    fetchAllBillboards,
    fetchLDESRecordByObjectNumber,
    fetchLDESRecordByAgentID,
    fetchLDESrecordsByExhibitionID,
    fetchTexts
} from "./src/utils/parsers.js";
import express from "express";
import * as cron from 'node-cron';
import YAML from "yamljs";
import swaggerUI from "swagger-ui-express";
import cors from 'cors'
import helmet from "helmet";


cron.schedule('0 0 * * 0', start); // run harvest every day at 10:00

async function start(){

    // setup accept-headers

    const app = express();
    app.use(cors())
    app.use(
        helmet({
            contentSecurityPolicy: {
                useDefaults: false,
                directives: {
                    "default-src": ["'none'"],
                    "img-src": ["'self"]
                }
            }
        })
    )

    app.use(express.static("public"))

    // swagger docs

    const swaggerDocument = YAML.load('./api.yaml')
    app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerDocument))

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

    // texts on objects from the collection.
    app.get('/texts/', async(get, res)=> {
        const _texts = await fetchTexts()
        const _range=_texts.length
        const catalouge = [];

        const _context = [
            "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/cultureel-erfgoed-event-ap.jsonld",
            "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/cultureel-erfgoed-object-ap.jsonld"
        ]

        for (let text=0; text<_range; text++) {
            let _text = {};
            let catalogueTexts = [];
            let _objectNumber = _texts[text]["object_number"]
            let _objectID = "https://data.designmuseumgent.be/objects/"+_objectNumber //todo: add resolver when the object has not been published yet.

            //nl
            if (_texts[text]["text_NL"]) {
                const _textNL = {
                    "text": _texts[text]["text_NL"],
                    "@lang": "nl"
                }
                catalogueTexts.push(_textNL);
            }

            //en
            if (_texts[text]["text_EN"]) {
                const _textEN = {
                    "text": _texts[text]["text_EN"],
                    "@lang": "en"
                }
                catalogueTexts.push(_textEN);
            }

            //fr
            if (_texts[text]["text_FR"]) {
                const _textFR = {
                    "text": _texts[text]["text_FR"],
                    "@lang": "fr"
                }
                catalogueTexts.push(_textFR);
            }

            _text["@context"] = _context
            _text["@type"] = "InformatieObject";
            _text["InformatieObject.gaatOver"] = {
                // todo: or refers to?
                "@id": _objectID,
                "@type": "MensgemaaktObject"
            };
            _text["InformatieObject.omvat"] = catalogueTexts;
            catalouge.push(_text);
        }
        res.send({catalouge})
    })

    console.log("DONE :D :D :D :D ")
}

start();
