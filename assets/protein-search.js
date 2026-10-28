(function (root) {
  "use strict";
  const normalize = value => String(value || "").normalize("NFKC").toLowerCase()
    .replace(/α/g, "alpha").replace(/β/g, "beta").replace(/γ/g, "gamma")
    .replace(/[^\p{L}\p{N}]/gu, "");

  function create(rows, aliases = {}) {
    const records = rows.map(row => ({
      row,
      gene: normalize(row.gene),
      protein: normalize(row.protein_id),
      description: normalize(row.description),
      aliases: [...new Set([...(aliases[row.protein_id] || []), ...(Array.isArray(row.aliases) ? row.aliases : String(row.aliases || "").split(/[,;|]/))].map(normalize).filter(Boolean))],
    }));
    const byProtein = new Map(records.map(record => [record.row.protein_id, record]));
    let lastQuery, exactProteinIds;
    function score(record, query) {
      if (record.gene === query || record.protein === query) return 0;
      if (record.aliases.includes(query)) return 1;
      if (record.gene.startsWith(query)) return 2;
      if (record.protein.startsWith(query)) return 3;
      if (record.gene.includes(query)) return 4;
      if (record.protein.includes(query)) return 5;
      if (record.aliases.some(alias => alias.startsWith(query))) return 6;
      if (record.aliases.some(alias => alias.includes(query))) return 7;
      if (record.description.includes(query)) return 8;
      return Infinity;
    }
    return {
      search(query, limit = 10) {
        const q = normalize(query);
        if (!q) return [];
        return records.map(record => ({record, score: score(record, q)}))
          .filter(match => Number.isFinite(match.score))
          .sort((a, b) => a.score - b.score || a.record.gene.localeCompare(b.record.gene) || a.record.protein.localeCompare(b.record.protein))
          .slice(0, limit).map(match => match.record.row);
      },
      findExact(query) {
        const q = normalize(query);
        if (!q) return undefined;
        return records.find(record => record.gene === q || record.protein === q)?.row
          || records.find(record => record.aliases.includes(q))?.row;
      },
      matchesProtein(proteinId, query, siteText = "") {
        if (!String(query || "").trim()) return true;
        const q = normalize(query), record = byProtein.get(proteinId);
        if (!q) return false;
        if (q !== lastQuery) {
          lastQuery = q;
          const exact = records.filter(candidate => candidate.gene === q || candidate.protein === q || candidate.aliases.includes(q));
          exactProteinIds = exact.length ? new Set(exact.map(candidate => candidate.row.protein_id)) : null;
        }
        return exactProteinIds ? exactProteinIds.has(proteinId) : !!record && Number.isFinite(score(record, q)) || normalize(siteText).includes(q);
      },
    };
  }
  function loadAliases(fetchJSON) {
    return fetchJSON("data/protein-aliases.json?v=2026-10-28").catch(error => {
      console.warn("Protein aliases could not be loaded.", error);
      return {};
    });
  }
  const api = { normalize, create, loadAliases };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ATLAS_PROTEIN_SEARCH = api;
})(typeof window === "undefined" ? globalThis : window);
