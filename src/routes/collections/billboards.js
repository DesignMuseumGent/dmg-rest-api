import {fetchAllBillboards} from "../../utils/parsers.js";
export function requestAllBillboards(app, BASE_URI) {
    app.get('/v1/id/exhibitions/billboardseries/', async (req, res) => {
        // ASYNC FUNCTION THAT AWAITS fetch from Supabase.
        const billboard =  await fetchAllBillboards()

        // init list to populate with all billboards
        const billboards = [];
        for (let x=0; x < billboard.length; x++) {
            //push single billboard to list.
            if (billboard[x]){
                billboards.push(billboard[x]);
            }
        }
        res.send(
            {billboards}
        );
    })
}
