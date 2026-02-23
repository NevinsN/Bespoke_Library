/**
 * Filters an array of manuscripts based on a search term.
 * Supports "Smart" matching across titles, series, and tags.
 */
export function filterManuscripts(novels, query) {
    if (!query) return novels;
    const q = query.toLowerCase().trim();

    return novels.filter(n => {
        const titleMatch = n.display_name?.toLowerCase().includes(q);
        const seriesMatch = n.series_name?.toLowerCase().includes(q);
        const tagMatch = n.tags?.some(tag => tag.toLowerCase().includes(q));
        
        return titleMatch || seriesMatch || tagMatch;
    });
}