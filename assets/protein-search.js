(function (root) {
  "use strict";
  // Change to "previous" or "off" for a site-wide rollback of this expansion.
  const DEFAULT_ALIAS_MODE = "uniprot";
  const ALIAS_FILES = {
    previous: "data/protein-aliases.json?v=2026-10-28",
    uniprot: "data/protein-aliases-uniprot.json?v=2026-10-28-full",
  };
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
    const canonical = new Map(), alternate = new Map();
    for (const record of records) {
      for (const [lookup, names] of [[canonical, [record.gene, record.protein]], [alternate, record.aliases]]) {
        for (const name of names) {
          if (!name) continue;
          if (!lookup.has(name)) lookup.set(name, new Set());
          lookup.get(name).add(record.row.protein_id);
        }
      }
    }
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
        const id = canonical.get(q)?.values().next().value || alternate.get(q)?.values().next().value;
        return byProtein.get(id)?.row;
      },
      matchesProtein(proteinId, query, siteText = "", {includeCanonicalPrefixes = false} = {}) {
        if (!String(query || "").trim()) return true;
        const q = normalize(query), record = byProtein.get(proteinId);
        if (!q) return false;
        if (q !== lastQuery) {
          lastQuery = q;
          const exact = [...(canonical.get(q) || []), ...(alternate.get(q) || [])];
          exactProteinIds = exact.length ? new Set(exact) : null;
        }
        const canonicalPrefix = includeCanonicalPrefixes && !!record &&
          (record.gene.startsWith(q) || record.protein.startsWith(q));
        return exactProteinIds
          ? exactProteinIds.has(proteinId) || canonicalPrefix
          : (!!record && Number.isFinite(score(record, q))) || normalize(siteText).includes(q);
      },
    };
  }
  async function loadAliases(fetchJSON, mode = new URLSearchParams(root.location?.search || "").get("aliases") || DEFAULT_ALIAS_MODE) {
    if (mode !== "off" && !Object.hasOwn(ALIAS_FILES, mode)) mode = DEFAULT_ALIAS_MODE;
    if (mode === "off") return {};
    const releases = mode === "uniprot" ? ["uniprot", "previous"] : ["previous"];
    let failure;
    for (const release of releases) {
      try {
        const aliases = await fetchJSON(ALIAS_FILES[release]);
        if (release !== mode) console.warn("Expanded protein aliases are unavailable; using the previous aliases.");
        return aliases;
      } catch (error) { failure = error; }
    }
    console.warn("Protein aliases could not be loaded.", failure);
    return {};
  }
  const api = { normalize, create, loadAliases };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ATLAS_PROTEIN_SEARCH = api;
})(typeof window === "undefined" ? globalThis : window);
