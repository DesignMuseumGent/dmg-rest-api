import negotiate from "express-negotiate";

export function requestDCAT(app) {
  app.get("/", (req, res) => {
    res.set('Content-Type', 'application/json+ld;charset=utf-8')
    res.send({
      "@context": [
        "https://data.vlaanderen.be/doc/applicatieprofiel/DCAT-AP-VL/erkendestandaard/2022-04-21/context/DCAT-AP-VL-20.jsonld",
        {
          dcterms: "http://purl.org/dc/terms/",
          tree: "https://w3id.org/tree#",
        },
      ],
      "@id": "https://data.designmuseumgent.be/",
      "@type": "Datasetcatalogus",
      "Catalogus.titel": {
        "@value": "catalogus Design Museum Gent",
        "@language": "nl",
      },
      "Catalogus.heeftLicentie": {
        "@id": "https://creativecommons.org/publicdomain/zero/1.0/",
      },
      "Catalogus.heeftUitgever": {
        "@id": "https://www.wikidata.org/entity/Q1809071",
        "Agent.naam": [
          {
            "@value": "Design Museum Gent",
            "@language": "nl",
          },
          {
            "@value": "Design Museum Gent",
            "@language": "en",
          },
        ],
      },
      "Catalogus.contactinformatie": {
        "@type": "contactInformatie",
        "Contactinfo.eMail": "data@designmuseumgent.be",
      },
      "Catalogus.beschrijving": [
        {
          "@value":
            "data catalogus met datasets die betrekking hebben tot de collectie en programmatie van Design Museum Gent",
          "@language": "nl",
        },
        {
          "@value":
            "data catalogue containing datasets describing the collection and program of Design Museum Gent",
          "@language": "en",
        },
      ],
      "Catalogus.heeftDataset": [
        {
          "@id": "https://data.designmuseumgent.be/id/objects/",
          "@type": "Dataset",
          "Dataset.titel": [
            {
              "@value":
                "dataset met metadata van reeds gepubliceerde items uit de collectie van het Design Museum Gent.",
              "@language": "nl",
            },
            {
              "@value":
                "dataset with metadata concerning the published human-made objects of Design Museum Gent",
              "@language": "en",
            },
          ],
          "Dataset.statuut":
            "https://metadata.vlaanderen.be/id/GDI-Vlaanderen-Trefwoorden/VLOPENDATASERVICE",
        },
        {
          "@id": "https://data.designmuseumgent.be/id/exhibitions/",
          "@type": "Dataset",
          "Dataset.titel": [
            {
              "@value":
                "dataset met metadata rond de tentoonstellingen gerelateerd aan gepubliceerd items uit de collectie van Design Museum Gent.",
              "@language": "nl",
            },
            {
              "@value":
                "dataset with metadata concerning the exhibitions that are related to the collection of Design Museum Gent",
              "@language": "en",
            },
          ],
          "Dataset.statuut":
            "https://metadata.vlaanderen.be/id/GDI-Vlaanderen-Trefwoorden/VLOPENDATASERVICE",
        },
        {
          "@id": "https://data.designmuseumgent.be/id/agents/",
          "@type": "Dataset",
          "Dataset.titel": [
            {
              "@value":
                "dataset met metadata rond personen en instellingen (agenten) gerelateerd aan gepubliceerd items uit de collectie van Design Museum Gent",
              "@language": "nl",
            },
            {
              "@value":
                "dataset with metadata concerning the agents that are related to the collection of Design Museum Gent",
              "@language": "en",
            },
          ],
          "Dataset.statuut":
            "https://metadata.vlaanderen.be/id/GDI-Vlaanderen-Trefwoorden/VLOPENDATASERVICE",
        },
        {
          "@id":
            "https://data.designmuseumgent.be/id/exhibitions/billboardseries",
          "@type": "Dataset",
          "Dataset.titel": [
            {
              "@value":
                "dataset met metadata rond billboards die in samenwerking met 019 geproduceerd werden op de banner in de Drabstraat aan Design Museum Gent",
              "@language": "nl",
            },
            {
              "@value":
                "dataset with metadata concerning the billboardseries at Design Museum Gent.",
              "@language": "en",
            },
          ],
          "Dataset.statuut":
            "https://metadata.vlaanderen.be/id/GDI-Vlaanderen-Trefwoorden/VLOPENDATASERVICE",
        },
      ],
    });
  });
}
