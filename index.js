// import dependencies
import express from "express";
import YAML from "yamljs";
import swaggerUI from "swagger-ui-express";
import cors from 'cors'

// import functions to populate API.
import {
    fetchAllBillboards,
    fetchLDESRecordByAgentID,
    fetchLDESrecordsByExhibitionID,
    fetchAllExhibitions,
    fetchTexts
} from "./src/utils/parsers.js";

// import routes (API contructors)
import {requestObjects, requestObject} from "./src/routes/objects.js";
import {requestDCAT} from "./src/routes/dcat.js";
import {requestAllBillboards} from "./src/routes/billboards.js";

async function start(){

    // setup accept-headers
    const app = express();
    const port = 1999;

    app.use(cors())
    app.use(express.static("public"))

    // swagger docs
    const swaggerDocument = YAML.load('./api.yaml')
    app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerDocument))

    app.listen(
        process.env.PORT || 1992,
        console.log(`app listening on port ${port}`)
    )

    const baseURI = "https://data.designmuseumgent.be/"

    // ROUTE to top level DCAT
    requestDCAT(app);

    // ROUTES to human-made objects
    requestObjects(app); // request list of all published human-made objects
    requestObject(app); // request individual entity (human-made object) using content-negotiation.

    // ROUTES to exhibition data
    const billboard = await fetchAllBillboards() // fetch data from supabase
    requestAllBillboards(app, billboard); // request all billboards. (endpoint)

    // *** AGENTS *** //
    app.get('/id/agents/:agentPID', async(req, res) => {
        const x = await fetchLDESRecordByAgentID(req.params.agentPID);
        const result_cidoc = x[0]["LDES_raw"];
        res.send({result_cidoc})
    })

    // ark
    app.get('/id/ark:/29417/agents/:agentPID', async(req, res) => {
        const x = await fetchLDESRecordByAgentID(req.params.agentPID);
        const result_cidoc = x[0]["LDES_raw"];
        res.send({result_cidoc})
    })

    // *** EXHIBITIONS *** //
    app.get('/id/exhibitions', async(req, res)=> {
        const exh = await fetchAllExhibitions()
        let range = exh.length
        let _exhibitions = []

        for (let i = 0; i < range; i ++) {
            let _exhibition = {}
            _exhibition["@id"] = baseURI+"exhibition/"+exh[i]["exh_PID"]
            _exhibition["cidoc:P1_is_identified_by"] = {
                "@type": "cidoc:E33_E41_Linguistic_Appellation",
                "inhoud": {
                    "@value": exh[i]["LDES_raw"]["object"]["cidoc:P1_is_identified_by"]["inhoud"]["@value"],
                    "@language": "nl"
                }
            }
            _exhibitions.push(_exhibition)
        }
        res.send({_exhibitions})
    })

    app.get('/id/exhibition/:exhibitionPID', async (req, res)=> {
        const x = await fetchLDESrecordsByExhibitionID(req.params.exhibitionPID)
        try{
            console.log(x[0]["LDES_raw"])
            res.send(x[0]["LDES_raw"])
        } catch (e) {
            console.log(e)
        }
    })

    app.get('/id/ark:/29417/exhibition/:exhibitionPID', async (req, res)=> {
        const x = await fetchLDESrecordsByExhibitionID(req.params.exhibitionPID)
        try{
            const result_cidoc = x[0]["LDES_raw"];
            console.log(result_cidoc)
            res.send({result_cidoc})
        } catch (e) {
            console.log(e)
        }

    } )

    // texts on objects from the collection.
    app.get('/id/texts/', async(get, res)=> {
        const _texts = await fetchTexts()
        const _range=_texts.length
        const catalogue = [];

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
