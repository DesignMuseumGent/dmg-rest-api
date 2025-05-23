import { supabase } from "../../supabaseClient.js";

export async function fetchAuthentication() {
  const { data } = await supabase.from("authentication").select("key");
  return data;
}

export async function fetchPatterns(collection) {
  const {data} = await supabase
      .from("dmg_patterns")
      .select("*")
      .eq("collection", collection)
  //console.log(supabase)
  //console.log(data)
  return data
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

export async function fetchPrivateObjectsWithPagination(from, to) {
  const { data, count, error } = await supabase
      .from("dmg_private_objects_LDES")
      .select("LDES_raw->object", { count: "exact" }) // Fetch only the required field and total row count
      .eq("duplicate", false) // Filter rows where 'duplicate' is FALSE
      .range(from, to); // Fetch paginated results

  if (error) {
    console.error("Error fetching data from Supabase:", error);
    return { data: [], total: 0 };
  }

  return { data, total: count };
}

export async function fetchPaginatedConcepts(from, to) {
  // Query: Adjust the table and fields as per your database schema
  const { data, error, count } = await supabase
      .from("dmg_thesaurus_LDES") // Replace with your actual table name
      .select("LDES_raw, id", { count: "exact" }) // Fetch minimal fields required
      .range(from, to); // Pagination: Fetch only required rows based on range

  if (error) {
    console.error("Error fetching paginated concepts from Supabase:", error);
    return { data: [], total: 0 };
  }

  return { data, total: count };
}

export async function fetchPaginatedExhibitions(from, to) {
  // Replace "dmg_exhibitions_LDES" with your actual table name
  const { data, error, count } = await supabase
      .from("dmg_tentoonstelling_LDES") // Main table or view for exhibitions
      .select("LDES_raw, exh_PID", { count: "exact" }) // Adjust fields as necessary
      .range(from, to); // Fetch only the required range of records

  if (error) {
    console.error(`Error fetching paginated exhibitions: ${error.message}`);
    return { data: [], total: 0 };
  }

  return { data, total: count }; // Paginated data and total count
}

export async function fetchPaginatedAgents(from, to) {
  // Query: Adjust the table and fields as per your database schema
  const { data, error, count } = await supabase
    .from("dmg_personen_LDES") // Replace with your actual table name
    .select("LDES_raw, agent_ID", { count: "exact" }) // Fetch minimal fields needed
    .range(from, to); // Pagination - fetch only the required range of rows

  if (error) {
    console.error("Error fetching paginated agents from Supabase:", error);
    return { data: [], total: 0 };
  }

  return { data, total: count };
}


export async function fetchFilteredLDESRecords({ from, to, license = null ,  category = null}) {
  let query = supabase
      .from("dmg_objects_LDES") // Replace with the actual table name
      .select("LDES_raw->object, objectNumber, CC_Licenses, iiif_image_uris, index_classification", { count: "exact" }) // Fetch only necessary fields
      .eq("STATUS", "HEALTHY")
      .neq("RESOLVES_TO", "id/object/REMOVED")
      .range(from, to);

  // Apply license filter if provided
  if (license) {
    query = query.contains("CC_Licenses", [license]); // Filter for specific licenses
  }

  console.log(category)
  if (category != null) {
    const { data, error, count } = await query;
    console.log(data.length)
    let catFilter = []
    for (let i = 0; i < data.length; i++) {
      //console.log(typeof data[i]["index_classification"])
      try {
        if (data[i]["index_classification"]) {
          let cat = data[i]["index_classification"]
          for (let j = 0; j < cat.length; j++) {
            //console.log(cat[j])
            //console.log(category)
            if(cat[j] === category){
              catFilter.push(data[i])
            }
          }
        }
      } catch (e) {
        console.log(e)
      }
    }
    //console.log(catFilter)
    return { data: catFilter, total: catFilter.length}
  }

  const { data, error, count } = await query;
  return { data, total: count };

  /*
  if (error) {
    console.error("Error fetching filtered LDES records from Supabase:", error);
    return { data: [], total: 0 };
  }
  */
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

export async function fetchColor(color) {
  const {data} = await supabase
      .from("dmg_index_colors")
      .select("*")
      .eq("color", color)
  return data;
}

export async function populateSupabaseImages() {
  // function that extracts images from other table and add to new table to improve performance of /random-image service.
  const x = await fetchAllLDESrecordsObjects();

  async function fetchImages(manifest) {
    let res = await fetch(manifest);
    return res.json();
  }

  // iterate over all object
  let len = x.length;
  for (let i = 0; i < lent; i++) {
    console.log(`* processing: ${i} / ${len}`)
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
