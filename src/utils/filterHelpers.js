// utils/filterHelpers.js
export const applyModifiedSinceFilter = (query, modifiedSince) => {
    if (!modifiedSince) return query
    // validate the date format
    const date = new Date(modifiedSince)
    if (isNaN(date.getTime())) return query
    return query.gte('generated_at_time', date.toISOString())
}

