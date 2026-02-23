/**
 * Takes a flat list of novel/manuscript documents and 
 * groups them (e.g., by series or status).
 */
export function groupNovels(novels) {
    return novels.reduce((groups, novel) => {
        const series = novel.series_name || "Standalone Manuscripts";
        
        if (!groups[series]) {
            groups[series] = [];
        }
        groups[series].push(novel);
        return groups;
    }, {});
}