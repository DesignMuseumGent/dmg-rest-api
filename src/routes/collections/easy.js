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
                "title": record["TITLE"],
                "description": record["DESCRIPTIONS"],
                "agents": record["AGENTS"],
                "materials": record["MATERIALS"],
                "types": record["TYPES"],
                "images": record["MEDIA"],
                "licences": record["LICENSES"]
            }
            allMatchedRecords.push(object);
        }

        const totalPages = Math.ceil(allMatchedRecords.length / itemsPerPage);
        for(let j = (pageNumber - 1) * itemsPerPage; j < pageNumber * itemsPerPage; j++) {
          if (j >= allMatchedRecords.length) break;
          filteredObjects.push(allMatchedRecords[j]);
        }

        res.status(200).json({
            "@type": "GecureerdeCollectie",
            "@id": `${BASE_URI}id/easy`,
            "hydra:totalItems": records.length,
            "hydra:view": {
                "@id": `${BASE_URI}id/easy?pageNumber=${pageNumber}`,
                "@type": "PartialCollectionView",
                "hydra:first": `${BASE_URI}id/easy?pageNumber=1`,
                "hydra:last": `${BASE_URI}id/easy?pageNumber=${totalPages}`,
                "hydra:previous": pageNumber > 1 ? `${BASE_URI}id/easy?pageNumber=${pageNumber - 1}` : null,
                "hydra:next": pageNumber < totalPages ? `${BASE_URI}id/easy?pageNumber=${pageNumber + 1}` : null,
              },
            "GecureerdeCollectie.curator": "Olivier Van D'huynsslager",
            "GecureerdeCollectie.bestaatUit": filteredObjects
        })

    })
}