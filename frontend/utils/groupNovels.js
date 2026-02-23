/**
 * Takes a flat list of novel/manuscript documents and 
 * groups them (e.g., by series or status).
 */
export function groupNovelsBySeries(novels) {
    return novels.reduce((groups, novel) => {
        // We'll use the 'manuscript_id' to group, or a 'series' field if added later
        const series = novel.series_name || "Standalone Manuscripts";
        
        if (!groups[series]) {
            groups[series] = [];
        }
        groups[series].push(novel);
        return groups;
    }, {});
}