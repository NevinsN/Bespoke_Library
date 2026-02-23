/**
 * Takes a flat list of novel/manuscript documents and 
 * groups them (e.g., by series or status).
 */
export function groupNovels(novels) {
  const grouped = {};

  novels.forEach(novel => {
    const seriesName = novel.series_name || "Misc";
    const bookName = novel.display_name || "Untitled";

    if (!grouped[seriesName]) grouped[seriesName] = {};
    if (!grouped[seriesName][bookName]) grouped[seriesName][bookName] = [];

    grouped[seriesName][bookName].push(novel);
  });

  return grouped;
}