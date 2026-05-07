/**
 * Build a RFC 8288 compliant Link header from Hydra pagination view
 * Allows clients to paginate without parsing the JSON-LD body
 *
 * Example output:
 * Link: <https://...?page=1>; rel="first",
 *       <https://...?page=843>; rel="last",
 *       <https://...?page=2>; rel="next"
 */
export function buildLinkHeader(hydraView) {
    const links = []

    if (hydraView["hydra:first"])    links.push(`<${hydraView["hydra:first"]}>; rel="first"`)
    if (hydraView["hydra:last"])     links.push(`<${hydraView["hydra:last"]}>; rel="last"`)
    if (hydraView["hydra:previous"]) links.push(`<${hydraView["hydra:previous"]}>; rel="prev"`)
    if (hydraView["hydra:next"])     links.push(`<${hydraView["hydra:next"]}>; rel="next"`)

    return links.join(', ')
}