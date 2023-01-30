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