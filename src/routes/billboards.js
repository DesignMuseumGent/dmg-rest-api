// endpoint: Billboards.

import {fetchAllBillboards} from "../utils/parsers.js";

export function requestAllBillboards(app) {
    app.get('/id/exhibitions/billboardseries/', (req, res) => {
        const billboard =  fetchAllBillboards()
        console.log(billboard)
        const billboards = [];
        for (let x=0; x < billboard.length; x++) {
            if (billboard[x]){
                billboards.push(billboard[x]);
            }
        }
        res.send(
            //todo: setup top level metadata (DCAT) -  collection
            {
                billboards
            }
        );
    })
}
