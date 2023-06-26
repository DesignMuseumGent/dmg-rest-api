import {
    fetchAllBillboards,
    fetchLDESRecordByObjectNumber,
    fetchLDESRecordByAgentID,
    fetchLDESrecordsByExhibitionID,
    fetchAllLDESrecordsObjects,
    fetchAllExhibitions,
    fetchTexts
} from "./src/utils/parsers.js";
import express from "express";
import negotiate from 'express-negotiate'
import * as cron from 'node-cron';
import YAML from "yamljs";
import swaggerUI from "swagger-ui-express";
import cors from 'cors'

cron.schedule('0 0 * * 0', start); // run harvest every day at 10:00

async function start(){

    // setup accept-headers
    const app = express();
    app.use(cors())
    app.use(express.static("public"))

    // swagger docs
    const swaggerDocument = YAML.load('./api.yaml')
    app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerDocument))

    app.listen(
        process.env.PORT || 1992,
        console.log("it's alive")
    )

    const baseURI = "https://data.designmuseumgent.be/"

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
                        "@id": "https://data.designmuseumgent.be/objects/",
                        "@type": "Dataset",
                        "Dataset.titel": {
                            "@value": "dataset met metadata van reeds gepubliceerde items uit de collectie van het Design Museum Gent.",
                            "@langeuage": "nl"
                        }
                    },
                    {
                        "@id": "https://data.designmuseumgent.be/exhibitions/",
                        "@type": "Dataset",
                        "Dataset.titel": {
                            "@value": "dataset met metadata rond de tentoonstellingen gerelateerd aan gepubliceerd items uit de collectie van Design Museum Gent.",
                            "@language": "nl"
                        }
                    },
                    {
                        "@id": "https://data.designgent.be/agents/",
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
    app.get('/objects/', async(req, res)=> {
        const x = await fetchAllLDESrecordsObjects()
        let limit = parseInt(req.query.limit) || x.length; // if no limit set, return all items.
        let offset = parseInt(req.query.offset) || 0; // Default offset is 0
        const _objects = []

        //check if limit exceeds max.
        if (limit >= x.length) {
            limit = x.length
        }

        //check max offset.
        const maxOffset = x.length / limit
        if (offset > maxOffset) {
            offset = maxOffset
        }

        for(let i = 0; i < x.length; i++) {
            let _object = {}
            _object["@context"] = [
                "https://apidg.gent.be/op…erfgoed-object-ap.jsonld",
                "https://apidg.gent.be/op…xt/generiek-basis.jsonld"
            ]
            _object["@id"] = baseURI+"id/object/"+x[i]["objectNumber"] // create id (PID) for individual object
            _object["@type"] = "MensgemaaktObject"
            _object["Object.identificator"] = [
                {
                    "@type": "Identificator",
                    "Identificator.identificator": {
                        "@value": x[i]["objectNumber"]
                    }
                }
            ]
            _objects.push(_object)
        }
        const objects = _objects.slice(offset, offset + limit);
        res.send({objects})
    })

    app.get('/id/object/:objectNumber.:format?', async (req, res, next) => {
        const x = await fetchLDESRecordByObjectNumber(req.params.objectNumber)
        let _redirect = "https://data.collectie.gent/entity/dmg:" + req.params.objectNumber
        const result_cidoc = x[0]["LDES_raw"];

        // redefine - @id to use URIs and PIDs defined by the museum
        result_cidoc["object"]["@id"] = "https://data.designmuseumgent.be/id/object/" + req.params.objectNumber

        // assign foaf:pages
        result_cidoc["object"]["foaf:homepage"] = "https://data.designmuseumgent.be/object/" + req.params.objectNumber

        req.negotiate(req.params.format, {
            'json': function() {
                // if format .json redirect to machine-readable page.
                res.send(result_cidoc["object"])
            },
            'html': function() {
                // if format .html redirect to human-readable page
                res.redirect(_redirect)
            },
            'default': function() {
                //send html anyway.
                res.redirect(_redirect)
            }
        })
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
    app.get('/exhibitions', async(req, res)=> {
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

    app.get('/exhibition/:exhibitionPID', async (req, res)=> {
        const x = await fetchLDESrecordsByExhibitionID(req.params.exhibitionPID)
        try{
            const result_cidoc = x[0]["LDES_raw"];
            console.log(result_cidoc)
            res.send({result_cidoc})
        } catch (e) {
            console.log(e)
        }
    })

    app.get('/ark:/29417/exhibition/:exhibitionPID', async (req, res)=> {
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
