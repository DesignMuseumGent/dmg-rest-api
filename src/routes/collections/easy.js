import {fetchAllEasyObjects} from "../../utils/parsers.js";

export function requestEasyObjects(app, BASE_URI){
    app.get("/v1/id/easy/", async(req,res)=>{
        const records = await fetchAllEasyObjects();
        const filteredObjects = [];
        let allMatchedRecords = []

        // pagination
        let {pageNumber = 1, itemsPerPage=20} = req.query
        pageNumber = Number(pageNumber)
        itemsPerPage = Number(itemsPerPage)

        for (let i = 0; i < records.length; i++) {
            let record = records[i]
            let object = {
                "@id": `${BASE_URI}id/object/${record["OBJECTNUMBER"]}`,
                "objectnumber": record["OBJECTNUMBER"],
                "title": record["TITLE_NL"],
                "description": record["DESCRIPTION_NL"],
                "agents": record["AGENTS"],
                "materials": record["MATERIALS"],
                "types": record["TYPES"],
                "images": record["MEDIA"],
                "licences": record["LICENSE"],
                "colors": record["COLORS"]
            }
            allMatchedRecords.push(object);
        }

        const totalPages = Math.ceil(allMatchedRecords.length / itemsPerPage);
        for(let j = (pageNumber - 1) * itemsPerPage; j < pageNumber * itemsPerPage; j++) {
          if (j >= allMatchedRecords.length) break;
          filteredObjects.push(allMatchedRecords[j]);
        }

        // Build hydra navigation URLs that preserve current filters
        const qsBase = new URLSearchParams();
        qsBase.set("itemsPerPage", String(itemsPerPage));
        const urlForPage = (p) => {
            const qs = new URLSearchParams(qsBase);
            qs.set("pageNumber", String(p));
            return `${BASE_URI}id/easy?${qs.toString()}`;
        };

        res.status(200).json({
            "@type": "GecureerdeCollectie",
            "@id": `${BASE_URI}id/easy`,
            "hydra:totalItems": records.length,
            "hydra:view": {
                "@id": urlForPage(pageNumber),
                "@type": "PartialCollectionView",
                "hydra:first": urlForPage(1),
                "hydra:last": urlForPage(totalPages),
                "hydra:previous": pageNumber > 1 ? urlForPage(pageNumber - 1) : null,
                "hydra:next": pageNumber < totalPages ? urlForPage(pageNumber + 1) : null,
              },
            "GecureerdeCollectie.curator": "Olivier Van D'huynslager",
            "GecureerdeCollectie.bestaatUit": filteredObjects
        })

    })
}