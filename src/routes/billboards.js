// endpoint: Billboards.

export function requestAllBillboards(app, billboard) {
    app.get('/id/exhibitions/billboardseries/', (req, res) => {
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
