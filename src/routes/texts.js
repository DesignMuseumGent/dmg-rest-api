import {fetchTexts} from "../utils/parsers.js";

export function requestTexts(app, BASE_URI) {
    app.get('/v1/id/texts/', async(get, res)=> {
        const _texts = await fetchTexts() // connect with Supabase and fetch data.
        const _range=_texts.length
        const catalogue = []; // initialize catalogue

        const _context = [
            "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/cultureel-erfgoed-event-ap.jsonld",
            "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/cultureel-erfgoed-object-ap.jsonld"
        ]

        for (let text=0; text<_range; text++) {
            let _text = {};
            let catalogueTexts = [];
            let _objectNumber = _texts[text]["object_number"]
            let _objectID = BASE_URI+"id/object/"+_objectNumber //todo: add resolver when the object has not been published yet.

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
            catalogue.push(_text);
        }
        res.send({catalogue})
    })
}
