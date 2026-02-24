/**
 * Groups a flat list of manuscript documents into a nested structure:
 *   { series_name: { display_name: [draft, draft, ...] } }
 *
 * Each manuscript from the API has:
 *   _id, series_name, display_name, drafts: [{ _id, name }]
 */
export function groupNovels(novels) {
  const grouped = {};

  novels.forEach(manuscript => {
    const series = manuscript.series_name || 'Standalone';
    const book   = manuscript.display_name || manuscript.book || 'Untitled';

    if (!grouped[series])       grouped[series] = {};
    if (!grouped[series][book]) grouped[series][book] = [];

    // Each entry in the leaf array is a draft, enriched with manuscript context
    const drafts = manuscript.drafts || [];
    drafts.forEach(draft => {
      grouped[series][book].push({
        ...draft,
        display_name:  manuscript.display_name || book,
        manuscript_id: manuscript._id,
        series_name:   series,
        owner:         manuscript.owner,
        // Pass through access array if present (for isAuthor check)
        access:        manuscript.access || [],
      });
    });

    // If a manuscript has no drafts yet, still show it as a placeholder
    if (!drafts.length) {
      grouped[series][book].push({
        _id:           null,
        name:          'No drafts yet',
        display_name:  manuscript.display_name || book,
        manuscript_id: manuscript._id,
        series_name:   series,
        owner:         manuscript.owner,
        access:        manuscript.access || [],
        placeholder:   true,
      });
    }
  });

  return grouped;
}
