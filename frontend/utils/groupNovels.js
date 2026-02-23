/**
 * Takes a flat list of novel/manuscript documents and 
 * groups them (e.g., by series or status).
 */
export function groupNovels(novels) {
  const grouped = {};

  novels.forEach(novel => {
    const series = novel.series_name || "Untitled Series";
    const book = novel.manuscript_display_name || "Untitled Book";
    const draft = novel.draft_name || "Main";

    if (!grouped[series]) grouped[series] = {};
    if (!grouped[series][book]) grouped[series][book] = [];

    grouped[series][book].push(novel);
  });

  return grouped;
}