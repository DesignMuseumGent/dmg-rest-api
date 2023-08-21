import {
    fetchAllBillboards,
    fetchLDESRecordByObjectNumber,
    fetchLDESRecordByAgentID,
    fetchLDESrecordsByExhibitionID,
    fetchAllLDESrecordsObjects,
    fetchAllExhibitions,
    fetchTexts
} from "./src/utils/parsers.js";

import {requestObjects} from "./src/routes/objects.js";

import express from "express";
import negotiate from 'express-negotiate'
import YAML from "yamljs";
import swaggerUI from "swagger-ui-express";
import cors from 'cors'

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

    // function to retrieve human-made objects
    requestObjects(app);



    // *** BILLBOARD SERIES *** //
    app.get('/', (req, res) => {
        res.send(
            {
                "@context": [
                "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/DCAT-AP-VL.jsonld",
                {
                    "dcterms": "http://purl.org/dc/terms/",
                    "tree": "https://w3id.org/tree#"
                }],
                "@id": "https://data.designmuseumgent.be/",
                "@type": "Datasetcatalogus",
                "Datasetcatalogus.titel": {
                    "@value": "catalogus Design Museum Gent",
                    "@language": "nl"
                },
                "Datasetcatalogus.heeftLicentie": {
                    "@id": "https://creativecommons.org/publicdomain/zero/1.0/"
                },
                "Datasetcatalogus.heeftUitger": {
                    "@id": "https://www.wikidata.org/entity/Q1809071",
                    "Agent.naam": {
                        "@value": "Design Museum Gent",
                        "@language": "nl"
                    }
                },
                "Datasetcatalogus.heeftDataset": [
                    {
                        "@id": "https://data.designmuseumgent.be/id/objects/",
                        "@type": "Dataset",
                        "Dataset.titel": {
                            "@value": "dataset met metadata van reeds gepubliceerde items uit de collectie van het Design Museum Gent.",
                            "@langeuage": "nl"
                        }
                    },
                    {
                        "@id": "https://data.designmuseumgent.be/id/exhibitions/",
                        "@type": "Dataset",
                        "Dataset.titel": {
                            "@value": "dataset met metadata rond de tentoonstellingen gerelateerd aan gepubliceerd items uit de collectie van Design Museum Gent.",
                            "@language": "nl"
                        }
                    },
                    {
                        "@id": "https://data.designgent.be/id/agents/",
                        "@type": "Dataset",
                        "Dataset.titel": {
                            "@value": "dataset met met metadata rond personen en instellingen (agenten) gerelateerd aan gepubliceerd items uit de collectie van Design Museum Gent",
                            "@language": "nl"
                        }
                    }
                ]
            }
        )
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

    // todo: add endpoint for individual billboards and refer to HTML and MACHINE-READABLE page.

    // *** OBJECTS *** //


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
