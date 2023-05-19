import {supabase} from "../../supabaseClient.js";

export async function fetchAllBillboards() {
    const {data, error} = await supabase
        .from("exh_billboardseries")
        .select("OSLO", {'head':false})


    let billboards = []
    for (let x=0; x < data.length; x++) {
        billboards.push(data[x]["OSLO"])
    }
    return billboards;
}

const callApi =  setInterval(()=> {
    fetchAllBillboards();
}, 30000);

export async function fetchBillboardByYear(year) {
    const {data, error} = await supabase
        .from("exh_billboardseries")
        .select("OSLO", {'head':false})
        .like("date_start", year)
    let billboards = []
    for (let x=0; x < data.length; x++) {
        billboards.push(data[x]["OSLO"])
    }
    return billboards;
}

export async function fetchLDESRecordByObjectNumber(_On) {
    const {data, error} = await supabase
        .from("dmg_objects_LDES")
        .select('LDES_raw')
        .eq('objectNumber', _On)
    return data;
}

export async function fetchAllLDESrecordsObjects() {
    const {data, error} = await supabase
        .from("dmg_objects_LDES")
        .select('objectNumber')
    return data;
}



export async function fetchLDESrecordsByExhibitionID(ExhibitionPID) {
    const {data, error} = await supabase
        .from("dmg_tentoonstelling_LDES")
        .select("LDES_raw")
        .eq('exh_PID', ExhibitionPID)
    return data;
}

export async function fetchLDESRecordByAgentID(AgentPID) {
    const {data, error} = await supabase
        .from("dmg_personen_LDES")
        .select("LDES_raw")
        .eq('agent_ID', AgentPID)
    return data;
}

export async function fetchLDESAllAgents() {
    const {data, error} = await supabase
        .from("dmg_personen_LDES")
        .select("LDES_raw")
    return data;
}