import { supabase } from "../../supabaseClient.js";

export async function fetchAuthentication() {
  const { data } = await supabase.from("authentication").select("key");
  return data;
}

export async function fetchAllLostInDiffusion() {
  const {data} = await supabase
      .from("dmg_lost_in_diffusion")
      .select("*")
  return data
}

export async function fetchAllArchive() {
  const {data} = await supabase
    .from("dmg_archief_LDES")
    .select("objectNumber, iiif_manifest, iiif_image")
  return data
}

export async function fetchArchiveByObjectNumber(_On) {
  const { data } = await supabase
    .from("dmg_archief_LDES")
    .select("LDES_raw")
    .eq("objectNumber", _On);
  return data;
}

export async function fetchAllBillboards() {
  const { data } = await supabase
    .from("exh_billboardseries")
    .select("OSLO", { head: false });

  let billboards = [];
  for (let x = 0; x < data.length; x++) {
    billboards.push(data[x]["OSLO"]);
  }
  return billboards;
}

export async function fetchLDESRecordByObjectNumber(_On) {
  const { data } = await supabase
    .from("dmg_objects_LDES")
    .select("*")
    .eq("objectNumber", _On);
  return data;
}

export async function fetchAllEasyObjects(){
  const {data, error} = await supabase
    .from("dmg_easy_objects")
    .select("*")
  return data;
}

export async function fetchAllPrivateLDESrecordsObjects(rangeStart, rangeEnd) {
  const { data } = await supabase
    .from("dmg_private_objects_LDES")
    .select("objectNumber, LDES_raw")
  return data;
}

export async function fetchAllLDESrecordsObjects() {
  const { data } = await supabase
    .from("dmg_objects_LDES")
    .select("*");
  return data;
}

export async function fetchAllConcepts(){
  // function that fetches all concepts stored in the supabase DB
  const { data } = await supabase
      .from("dmg_thesaurus_LDES")
      .select("*")
  return data;
}

export async function fetchConcept(id) {
  // function that fetches concept record from postgresDB
  const {data} = await supabase
      .from("dmg_thesaurus_LDES")
      .select("*")
      .eq("is_version_of", id)
  return data;
}

export async function fetchAllExhibitions() {
  const { data } = await supabase
    .from("dmg_tentoonstelling_LDES")
    .select("*");
  return data;
}

export async function fetchLDESrecordsByExhibitionID(ExhibitionPID) {
  const { data } = await supabase
    .from("dmg_tentoonstelling_LDES")
    .select("LDES_raw")
    .eq("exh_PID", ExhibitionPID);
  return data;
}

export async function fetchLDESRecordByAgentID(AgentPID) {
  const { data } = await supabase
    .from("dmg_personen_LDES")
    .select("LDES_raw")
    .eq("agent_ID", AgentPID);
  return data;
}

export async function fetchLDESAllAgents(start, end) {
  const { data } = await supabase
      .from("dmg_personen_LDES")
      .select("*")
  return data;
}

export async function fetchTexts() {
  const { data } = await supabase.from("exh_object_texts").select("*");
  return data;
}

export async function fetchAllImages() {
  const { data } = await supabase.from("dmg_images").select("*");
  return data;
}

export async function fetchPublicDomainImages() {
  const { data } = await supabase
    .from("dmg_images")
    .select("*")
    .eq("license", "https://creativecommons.org/publicdomain/zero/1.0/");
  return data;
}

export async function filterColor(color, objects) {
  // function that filters objects based on their color.
}

export async function populateSupabaseImages() {
  // function that extracts images from other table and add to new table to improve performance of /random-image service.
  const x = await fetchAllLDESrecordsObjects();

  async function fetchImages(manifest) {
    let res = await fetch(manifest);
    return res.json();
  }

  // iterate over all object
  for (let i = 0; i < x.length; i++) {
    let _manifest = await fetchImages(x[i]["iiif_manifest"]);
    let _objectNumber = x[i]["objectNumber"];
    // loop within manifest to find all images and store them seperately.
    try {
      for (let im = 0; im < _manifest["sequences"].length; im++) {
        let _canvas = _manifest["sequences"][im]["canvases"]; // top level of image metadata.
        for (let o = 0; o < _canvas.length; o++) {
          let _im = _canvas[o]["images"];
          let _attribution = _im[0]["attribution"]; // fetch attribution from within manifest
          let _imagePURL = _im[0]["resource"]["@id"]; // fetch imagePURL (link to IIIF image API) from within manifest
          let _license = _im[0]["license"];
          // add information on colors
          let _colorNames = x[i]["color_names"][im];
          let _HEX = x[i]["HEX_values"][im];

          // check if image is not yet in DB
          let { data } = await supabase
            .from("dmg_images")
            .select("*")
            .eq("PURL", _imagePURL);

          if (data == "") {
            // write metadata to DB (supabase)
            console.log(`writing metadata: ${_imagePURL}`);

            const { data } = await supabase
              .from("dmg_images")
              .insert([
                {
                  PURL: _imagePURL,
                  attribution: _attribution,
                  license: _license,
                  object_number: _objectNumber,
                  color_names: _colorNames,
                  hex_values: _HEX,
                },
              ])
              .select();
          } else {
            console.log(`${_imagePURL} is already in the DB`);
          }
        }
      }
    } catch (e) {
      console.log(`no public images for: ${_objectNumber}`);

    }
  }
}
export function parseBoolean(string) {
  return string === "true" ? true : string === "false" ? false : undefined;
}
