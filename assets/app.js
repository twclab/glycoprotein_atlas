(() => {
  "use strict";

  const ORGANS = ["brain", "spleen", "liver", "kidney", "plasma", "myelin_male", "myelin_female"];
  const ORGAN_LABELS = { brain: "Brain", spleen: "Spleen", liver: "Liver", kidney: "Kidney", plasma: "Plasma", myelin_male: "Myelin · Male", myelin_female: "Myelin · Female" };
  const AGE_BINS = ["Y", "MA", "O"];
  const AGE_BIN_LABELS = { Y: "Y", MA: "MA", O: "O" };
  const PAGE_TITLES = {
    overview: "Overview",
    methods: "Methods",
    learning: "Learning",
    publications: "Publications",
    "raw-data": "Raw data",
    contact: "Contact",
    tvd: "Age comparisons",
  };
  const { CLASS_ORDER, CLASS_LABELS, CLASS_COLORS, ORGAN_COLORS, DIVERSITY_LABEL } = window.ATLAS_THEME;
  const EXPLORER_BUILD = "2026-09-30-review-r20";
  const chooseCatPhoto = (paths) => paths[Math.floor(Math.random() * paths.length)];
  const catPhotos = {
    composition: chooseCatPhoto(["assets/cat-test.jpg", "assets/cats/IMG_7679.JPG"]),
    diversity: chooseCatPhoto(["assets/cats/IMG_9252.JPG", "assets/cats/IMG_9155.JPG"]),
    pairwise: chooseCatPhoto(["assets/cats/IMG_6851.JPG", "assets/cats/IMG_6042.JPG", "assets/cats/IMG_4574.JPG"]),
    exact: chooseCatPhoto(["assets/cats/IMG_7303.JPG", "assets/cats/IMG_6522.JPG"]),
  };
  const catFigure = (src, caption, extraClass = "") => `<figure class="cat-easter-egg ${extraClass}"><img src="${src}" alt="Cat photo" loading="lazy"><figcaption>${caption}</figcaption></figure>`;
  const classPaint = (name) => name === "fucosylated_and_sialylated"
    ? `repeating-linear-gradient(135deg, ${CLASS_COLORS.fucosylated} 0 4px, ${CLASS_COLORS.sialylated} 4px 8px)`
    : CLASS_COLORS[name] || "#7a8d89";
  const orderedClasses = (names) => CLASS_ORDER.filter((name) => names.includes(name));

  const state = {
    searchIndex: [],
    sequenceLengths: {},
    byProtein: new Map(),
    currentProtein: null,
    activeOrgan: "brain",
    selectedSites: {},
    ageMode: "age_bins",
    pairOrganA: null,
    pairOrganB: null,
    pairMode: "between_organs",
    pairSiteOrgan: null,
    pairSiteA: null,
    pairSiteB: null,
    pairSharedSite: null,
    diversityMetric: "effective",
    diversityGrouping: "sample",
    tvdManifest: null,
  };

  const dom = {
    home: document.querySelector(".home-view"),
    explore: document.querySelector(".explore-view"),
    pages: [...document.querySelectorAll("[data-page]")],
    dashboard: document.querySelector("[data-dashboard]"),
    loading: document.querySelector("[data-loading]"),
    segmentOverlay: document.querySelector("[data-segment-overlay]"),
    segmentFooter: document.querySelector("[data-segment-footer]"),
    proteomicsOnlyLinks: document.querySelector("[data-proteomics-only-links]"),
    segmentConfidenceNote: document.querySelector("[data-segment-confidence-note]"),
    segmentMethodNote: document.querySelector("[data-segment-method-note]"),
    segmentLegend: document.querySelector("[data-segment-legend]"),
    organSelect: document.querySelector("[data-organ-select]"),
    siteSelect: document.querySelector("[data-global-site-select]"),
    siteMetrics: document.querySelector("[data-site-metrics]"),
    classChart: document.querySelector("[data-class-chart]"),
    classLegend: document.querySelector("[data-class-legend]"),
    proteinChart: document.querySelector("[data-protein-chart]"),
    proteinLegend: document.querySelector("[data-protein-legend]"),
    shannonChart: document.querySelector("[data-shannon-chart]"),
    shannonLegend: document.querySelector("[data-shannon-legend]"),
    exactGrid: document.querySelector("[data-exact-grid]"),
    exactOrganSelect: document.querySelector("[data-exact-organ-select]"),
    exactSiteSelect: document.querySelector("[data-exact-site-select]"),
    pairwiseList: document.querySelector("[data-pairwise-list]"),
    tooltip: document.querySelector(".tooltip[role='tooltip']"),
    live: document.querySelector("[data-live-region]"),
    tvdPlot: document.querySelector("[data-tvd-plot]"),
    tvdDataset: document.querySelector("[data-tvd-dataset]"),
    tvdComparison: document.querySelector("[data-tvd-comparison]"),
    tvdSearch: document.querySelector("[data-tvd-search]"),
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    dom.home.dataset.shape = ["circle", "square", "diamond", "triangle"][Math.floor(Math.random() * 4)];
    bindNavigation();
    bindControls();
    bindTooltip();
    let resizeFrame;
    window.addEventListener("resize", () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        if (state.currentProtein && !dom.explore.hidden) {
          fitSegmentLegend();
          renderDetailCharts();
        }
      });
    });
    const initialProteinId = proteinFromHash();
    if (initialProteinId) showProteinLoading();
    else await routeFromLocation();
    try {
      const [manifest, searchIndex, sequenceMetadata] = await Promise.all([
        fetchJSON("data/manifest.json"),
        fetchJSON("data/search-index.json"),
        fetchJSON("data/sequence-lengths.json"),
      ]);
      state.searchIndex = searchIndex;
      state.sequenceLengths = sequenceMetadata.lengths;
      state.byProtein = new Map(searchIndex.map((row) => [row.protein_id, row]));
      document.querySelectorAll("[data-stat='proteins']").forEach((node) => { node.textContent = formatNumber(manifest.n_proteins); });
      bindSearch();
      if (initialProteinId && state.byProtein.has(initialProteinId)) {
        await openProtein(state.byProtein.get(initialProteinId), false);
      } else if (initialProteinId) {
        dom.loading.innerHTML = `<p>This protein is not present in the current atlas release. Please choose another result.</p>`;
        announce("Protein is not present in this atlas release.");
      }
    } catch (error) {
      console.error(error);
      dom.loading.innerHTML = `<p>Atlas data could not be loaded. Serve this directory over HTTP and try again.</p>`;
      announce("Atlas data could not be loaded.");
    }
  }

  function bindNavigation() {
    document.querySelectorAll("[data-home-link]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        showHome();
      });
    });
    document.querySelectorAll("[data-page-link]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        showPage(link.dataset.pageLink);
      });
    });
    document.querySelectorAll("[data-explore-link]").forEach((link) => {
      link.addEventListener("click", async (event) => {
        event.preventDefault();
        const example = findExact("Ace") || state.searchIndex[0];
        if (example) await openProtein(example);
        else showExplore(true);
      });
    });
    document.querySelectorAll("[data-favorite]").forEach((button) => {
      button.addEventListener("click", async () => {
        const result = findExact(button.dataset.favorite);
        if (result) await openProtein(result);
      });
    });
    window.addEventListener("popstate", routeFromLocation);
  }

  function bindSearch() {
    document.querySelectorAll("[data-search-input]").forEach((input) => {
      input.addEventListener("input", () => updateSearchResults(input));
      input.addEventListener("focus", () => updateSearchResults(input));
      input.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeSearchResults(input);
        if (event.key === "ArrowDown") {
          const first = resultsForInput(input).querySelector("button");
          if (first) { event.preventDefault(); first.focus(); }
        }
      });
    });
    document.querySelectorAll("[data-search-form]").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const input = form.querySelector("[data-search-input]");
        const result = search(input.value, 1)[0];
        if (result) await openProtein(result);
      });
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest("[data-search-form]")) {
        document.querySelectorAll("[data-search-results]").forEach((node) => { node.hidden = true; });
      }
    });
  }

  function updateSearchResults(input) {
    const container = resultsForInput(input);
    const query = input.value.trim();
    if (!query) {
      container.hidden = true;
      return;
    }
    const matches = search(query, Infinity);
    if (!matches.length) {
      container.innerHTML = `<p class="search-empty">No protein or UniProt match</p>`;
      container.hidden = false;
      return;
    }
    container.innerHTML = matches.map((row) => `
      <button type="button" class="search-result" role="option" data-result-id="${escapeHTML(row.protein_id)}">
        <strong>${escapeHTML(row.gene || row.protein_id)}</strong>
        <span>${escapeHTML(row.description || "No description")}</span>
        <small>${escapeHTML(row.protein_id)}<br>${row.n_glycosites} site${row.n_glycosites === 1 ? "" : "s"} · ${row.n_proteome_organs} organ${row.n_proteome_organs === 1 ? "" : "s"}</small>
      </button>`).join("");
    container.querySelectorAll("[data-result-id]").forEach((button) => {
      button.addEventListener("click", async () => openProtein(state.byProtein.get(button.dataset.resultId)));
      button.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); button.nextElementSibling?.focus(); }
        if (event.key === "ArrowUp") { event.preventDefault(); (button.previousElementSibling || input).focus(); }
      });
    });
    container.hidden = false;
  }

  function search(query, limit = 10) {
    const q = normalize(query);
    if (!q) return [];
    const commonNames = { ire1: "ern1", "ire1α": "ern1", bip: "hspa5", grp78: "hspa5" };
    const expanded = commonNames[q] || q;
    return state.searchIndex
      .map((row) => ({ row, score: matchScore(row, expanded) }))
      .filter(({ score }) => Number.isFinite(score))
      .sort((a, b) => a.score - b.score || normalize(a.row.gene).localeCompare(normalize(b.row.gene)) || a.row.protein_id.localeCompare(b.row.protein_id))
      .slice(0, limit)
      .map(({ row }) => row);
  }

  function matchScore(row, q) {
    const gene = normalize(row.gene);
    const protein = normalize(row.protein_id);
    const description = normalize(row.description);
    const aliases = normalize(row.aliases || "");
    if (gene === q || protein === q) return 0;
    if (gene.startsWith(q)) return 1;
    if (protein.startsWith(q)) return 2;
    if (gene.includes(q)) return 3;
    if (protein.includes(q)) return 4;
    if (aliases.split(/[,;| ]+/).includes(q)) return 2;
    if (aliases.includes(q)) return 5;
    if (description.includes(q)) return 6;
    return Infinity;
  }

  function findExact(value) {
    const q = normalize(value);
    const commonNames = { ire1: "ern1", "ire1α": "ern1", bip: "hspa5", grp78: "hspa5" };
    const target = commonNames[q] || q;
    return state.searchIndex.find((row) => normalize(row.gene) === target || normalize(row.protein_id) === target);
  }

  async function openProtein(indexRow, updateHistory = true) {
    if (!indexRow) return;
    showProteinLoading(indexRow.gene || indexRow.protein_id);
    closeAllSearchResults();
    document.querySelectorAll("[data-search-input]").forEach((input) => { input.value = indexRow.gene || indexRow.protein_id; });
    try {
      const shard = await fetchJSON(`data/shards/${indexRow.shard}.json`);
      const protein = shard[indexRow.protein_id];
      if (!protein) throw new Error(`Protein ${indexRow.protein_id} is absent from shard ${indexRow.shard}`);
      state.currentProtein = protein;
      state.selectedSites = {};
      state.pairOrganA = null;
      state.pairOrganB = null;
      state.pairSiteA = null;
      state.pairSiteB = null;
      state.pairSiteOrgan = null;
      state.pairSharedSite = null;
      ORGANS.forEach((organ) => {
        const sites = protein.organs[organ]?.glycosites || [];
        state.selectedSites[organ] = (sites.find((site) => site.comparison_eligible) || sites[0] || {}).id || null;
      });
      state.activeOrgan = ORGANS.find((organ) => protein.organs[organ]?.glycosites?.length) || ORGANS.find((organ) => protein.organs[organ]?.proteome) || "brain";
      setSiteDefaults(selectedSite(state.activeOrgan));
      dom.loading.hidden = true;
      dom.dashboard.hidden = false;
      renderProtein();
      if (updateHistory) history.pushState({}, "", `#explore/${encodeURIComponent(protein.protein_id)}`);
      document.title = `${protein.gene || protein.protein_id} · The Glycoprotein Atlas`;
      announce(`Loaded ${protein.gene || protein.protein_id}.`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error(error);
      dom.loading.innerHTML = `<p>Could not load this protein. Please choose another result.</p>`;
      announce("Protein data could not be loaded.");
    }
  }

  function renderProtein() {
    const protein = state.currentProtein;
    document.querySelector("[data-gene]").textContent = protein.gene || protein.protein_id;
    document.querySelector("[data-protein-id]").textContent = protein.protein_id;
    document.querySelector("[data-description]").textContent = protein.description || "No protein description available.";
    renderSegmentOverlay();
    renderDetail();
    requestAnimationFrame(fitSegmentLegend);
  }

  function observedSites() {
    const byId = new Map();
    ORGANS.forEach((organ) => {
      (state.currentProtein.organs[organ]?.glycosites || []).forEach((site) => {
        const existing = byId.get(site.id) || {
          id: site.id,
          label: site.label,
          position: site.position,
          observations: [],
        };
        existing.observations.push({ organ, site });
        byId.set(site.id, existing);
      });
    });
    return [...byId.values()].sort((a, b) => (a.position ?? 999999) - (b.position ?? 999999));
  }

  function renderSegmentOverlay() {
    const sites = observedSites();
    const glycoOrgans = ORGANS.filter((organ) => state.currentProtein.organs[organ]?.glycosites?.length);
    const positioned = sites.filter((site) => Number.isFinite(site.position));
    const maxPosition = Math.max(1, ...positioned.map((site) => site.position));
    const canonicalLength = state.sequenceLengths[state.currentProtein.protein_id];
    // A source-coordinate mismatch must not place a measured site beyond the bar.
    const knownLength = canonicalLength >= maxPosition ? canonicalLength : null;
    const displayLength = knownLength || Math.max(50, Math.ceil(maxPosition * 1.08 / 50) * 50);
    const canvasWidth = Math.max(900, sites.length * 78 + 250);
    const positionLefts = sites.map((site, index) => {
      if (!Number.isFinite(site.position)) return sites.length === 1 ? 50 : 2 + (index / (sites.length - 1)) * 96;
      return 2 + ((site.position - 1) / Math.max(1, displayLength - 1)) * 96;
    });
    const profileLefts = sites.map((_site, index) => sites.length === 1 ? 50 : 3 + (index / (sites.length - 1)) * 94);
    const positionLeftFor = (_site, index) => positionLefts[index];
    const profileLeftFor = (_site, index) => profileLefts[index];
    const markerHTML = sites.map((site, index) => {
      const first = site.observations.find(({ site: row }) => row.comparison_eligible) || site.observations[0];
      const anyHigh = site.observations.some(({ site: row }) => row.comparison_eligible);
      const label = site.position ? `N${site.position}` : site.label;
      return `<button type="button" class="segment-position-marker ${anyHigh ? "" : "low"}" style="left:${positionLeftFor(site, index)}%" data-overlay-marker-site="${escapeHTML(site.id)}" data-overlay-marker-organ="${escapeHTML(first.organ)}" data-tooltip="${escapeHTML(`${label}${anyHigh ? "" : " *"} · exact residue position`)}"><span class="sr-only">${escapeHTML(`${label}${anyHigh ? "" : ", low confidence"}`)}</span></button>`;
    }).join("");
    const profileGuides = sites.map((site, index) => {
      const first = site.observations.find(({ site: row }) => row.comparison_eligible) || site.observations[0];
      const anyHigh = site.observations.some(({ site: row }) => row.comparison_eligible);
      const label = site.position ? `N${site.position}` : site.label;
      return `<button type="button" class="profile-site-label ${anyHigh ? "" : "low"}" style="left:${profileLeftFor(site, index)}%" data-overlay-marker-site="${escapeHTML(site.id)}" data-overlay-marker-organ="${escapeHTML(first.organ)}">${escapeHTML(label)}${anyHigh ? "" : "*"}</button>`;
    }).join("");
    const leaderLines = sites.map((site, index) => `<path d="M${positionLeftFor(site, index) * 10},0 L${profileLeftFor(site, index) * 10},25"/>`).join("");
    const rowsHTML = glycoOrgans.map((organ) => {
      const organSites = new Map((state.currentProtein.organs[organ]?.glycosites || []).map((site) => [site.id, site]));
      const tiles = sites.map((summary, index) => {
        const site = organSites.get(summary.id);
        const left = profileLeftFor(summary, index);
        if (!site) {
          return `<span class="composition-tile uncovered" style="left:${left}%" data-tooltip="${escapeHTML(`${summary.position ? `N${summary.position}` : summary.label} not detected in the ${ORGAN_LABELS[organ]}`)}" aria-label="${escapeHTML(`${organ}, ${summary.label}: not detected`)}"></span>`;
        }
        const compositionVector = pooledClassVector(site);
        const rows = orderedClasses([...compositionVector.keys()]).map((name) => ({ name, percent: compositionVector.get(name) }));
        const segments = rows.filter((row) => row.percent > 0).map((row) => `<i style="width:${Math.max(0, Math.min(100, row.percent))}%;background:${classPaint(row.name)}"></i>`).join("");
        const selected = state.activeOrgan === organ && selectedSite(organ)?.id === site.id;
        return `<button type="button" class="composition-tile ${site.total_psm >= 5 ? "" : "low"} ${rows.length ? "" : "no-composition"} ${selected ? "selected" : ""}" style="left:${left}%" data-overlay-site="${escapeHTML(site.id)}" data-overlay-organ="${organ}" data-tooltip="Site composition">${segments}<span class="sr-only">${escapeHTML(`${organ} ${site.label}${site.total_psm >= 5 ? "" : ", low confidence"}`)}</span></button>`;
      }).join("");
      return `<div class="segment-organ-row"><strong style="color:${ORGAN_COLORS[organ]}">${ORGAN_LABELS[organ]}</strong><div class="segment-space">${tiles}</div></div>`;
    }).join("");
    dom.segmentOverlay.innerHTML = `
      <div class="segment-canvas ${sites.length ? "" : "no-sites"}" style="min-width:${canvasWidth}px">
        <div class="segment-axis-row"><span class="segment-axis-start">1</span><div class="segment-space"><span class="protein-line"></span>${markerHTML}</div><span class="segment-axis-end">${knownLength || sites.length ? formatNumber(displayLength) : "?"}</span></div>
        <div class="segment-profile-guide-row"><span></span><div class="segment-profile-guide"><svg viewBox="0 0 1000 49" preserveAspectRatio="none" aria-hidden="true">${leaderLines}</svg>${profileGuides}</div><span></span></div>
        <div class="segment-organ-rows">${rowsHTML}</div>${sites.length ? "" : '<p class="empty-note">No glycosites detected.</p>'}
      </div>`;
    dom.segmentOverlay.querySelectorAll("[data-overlay-marker-site]").forEach((button) => {
      button.addEventListener("click", () => {
        selectSiteEverywhere(button.dataset.overlayMarkerOrgan, button.dataset.overlayMarkerSite);
      });
    });
    dom.segmentOverlay.querySelectorAll("[data-overlay-site]").forEach((button) => {
      button.addEventListener("click", () => {
        selectSiteEverywhere(button.dataset.overlayOrgan, button.dataset.overlaySite);
      });
    });
    const proteomicsOnlyOrgans = ORGANS.filter((organ) =>
      !state.currentProtein.organs[organ]?.glycosites?.length &&
      state.currentProtein.organs[organ]?.proteome?.scaled_intensity?.some((row) => Number.isFinite(row.mean)));
    dom.proteomicsOnlyLinks.hidden = !proteomicsOnlyOrgans.length;
    dom.proteomicsOnlyLinks.innerHTML = proteomicsOnlyOrgans.length
      ? `<span>Protein abundance also available (no glycosites):</span>${proteomicsOnlyOrgans.map((organ) => `<button type="button" data-proteomics-only-organ="${organ}" ${state.activeOrgan === organ ? 'aria-current="true"' : ""}>${ORGAN_LABELS[organ]}</button>`).join("")}`
      : "";
    dom.proteomicsOnlyLinks.querySelectorAll("[data-proteomics-only-organ]").forEach((button) => {
      button.addEventListener("click", () => {
        selectSiteEverywhere(button.dataset.proteomicsOnlyOrgan, null);
        dom.proteinChart.closest(".chart-panel").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    dom.segmentConfidenceNote.hidden = !glycoOrgans.some((organ) =>
      state.currentProtein.organs[organ].glycosites.some((site) => site.total_psm < 5));
    dom.segmentMethodNote.hidden = !sites.length;
    dom.segmentFooter.hidden = !proteomicsOnlyOrgans.length && !sites.length;
    dom.segmentLegend.innerHTML = `<strong>Glycan Types</strong> ` + CLASS_ORDER.map((name) => `<span class="legend-item"><i class="legend-swatch" style="background:${classPaint(name)}"></i>${escapeHTML(CLASS_LABELS[name] || name)}</span>`).join("");
  }

  function fitSegmentLegend() {
    const legend = dom.segmentLegend;
    const uniprot = document.querySelector("[data-protein-id]");
    if (legend && uniprot) legend.style.setProperty("--legend-font-size", getComputedStyle(uniprot).fontSize);
  }

  function bindControls() {
    document.querySelectorAll("[data-age-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        state.ageMode = button.dataset.ageMode;
        document.querySelectorAll("[data-age-mode]").forEach((node) => node.classList.toggle("active", node === button));
        renderDetailCharts();
      });
    });
    dom.organSelect.addEventListener("change", () => {
      selectSiteEverywhere(dom.organSelect.value, state.selectedSites[dom.organSelect.value]);
    });
    dom.siteSelect.addEventListener("change", () => {
      selectSiteEverywhere(state.activeOrgan, dom.siteSelect.value);
    });
    dom.exactOrganSelect.addEventListener("change", () => {
      const organ = dom.exactOrganSelect.value;
      const sites = exactSites(organ);
      const site = sites.find((row) => row.id === state.selectedSites[organ]) || sites[0];
      selectSiteEverywhere(organ, site?.id);
    });
    dom.exactSiteSelect.addEventListener("change", () => {
      selectSiteEverywhere(state.activeOrgan, dom.exactSiteSelect.value);
    });
    document.querySelectorAll("[data-diversity-metric]").forEach((button) => button.addEventListener("click", () => {
      state.diversityMetric = button.dataset.diversityMetric;
      document.querySelectorAll("[data-diversity-metric]").forEach((node) => node.classList.toggle("active", node === button));
      renderShannonChart(selectedSite(state.activeOrgan));
    }));
    document.querySelectorAll("[data-diversity-grouping]").forEach((button) => button.addEventListener("click", () => {
      state.diversityGrouping = button.dataset.diversityGrouping;
      document.querySelectorAll("[data-diversity-grouping]").forEach((node) => node.classList.toggle("active", node === button));
      renderShannonChart(selectedSite(state.activeOrgan));
    }));
  }

  function selectSiteEverywhere(organ, siteId) {
    state.activeOrgan = organ;
    state.selectedSites[organ] = siteId || null;
    const site = selectedSite(organ);
    setSiteDefaults(site);
    state.pairOrganA = organ;
    state.pairSiteOrgan = organ;
    state.pairSiteA = site?.id || null;
    state.pairSharedSite = site?.id || null;
    renderSegmentOverlay();
    renderDetail();
  }

  function setSiteDefaults(site) {
    if (!site) return;
    const moderateOrLower = (site.site_psm_depth_tier ?? 0) <= 4;
    state.ageMode = moderateOrLower ? "age_bins" : "ages";
    state.diversityMetric = "effective";
    state.diversityGrouping = moderateOrLower ? "pooled" : "sample";
    document.querySelectorAll("[data-age-mode]").forEach((button) => button.classList.toggle("active", button.dataset.ageMode === state.ageMode));
    document.querySelectorAll("[data-diversity-metric]").forEach((button) => button.classList.toggle("active", button.dataset.diversityMetric === state.diversityMetric));
    document.querySelectorAll("[data-diversity-grouping]").forEach((button) => button.classList.toggle("active", button.dataset.diversityGrouping === state.diversityGrouping));
  }

  function renderDetail() {
    const organ = state.activeOrgan;
    const site = selectedSite(organ);
    document.querySelector("[data-detail-site]").textContent = site ? (site.position ? `${state.currentProtein.gene} N${site.position}` : site.label) : "None";
    const note = document.querySelector("[data-confidence-note]");
    note.classList.toggle("low", Boolean(site && site.total_psm < 5));
    note.textContent = !site ? `${state.currentProtein.protein_id} · glycan data were not detected for the selected organ.` : "";
    renderSiteControls(site);
    renderSiteMetrics(site);
    renderDetailCharts();
    renderPairwise(site);
  }

  function renderSiteControls(site) {
    const glycoOrgans = ORGANS.filter((organ) => state.currentProtein.organs[organ]?.glycosites?.length);
    const availableOrgans = ORGANS.filter((organ) => state.currentProtein.organs[organ]?.glycosites?.length || state.currentProtein.organs[organ]?.proteome);
    if (!availableOrgans.includes(state.activeOrgan)) state.activeOrgan = availableOrgans[0] || "brain";
    dom.organSelect.innerHTML = availableOrgans.map((organ) => `<option value="${organ}" ${organ === state.activeOrgan ? "selected" : ""}>${ORGAN_LABELS[organ]}</option>`).join("");
    dom.organSelect.disabled = availableOrgans.length < 2;
    const sites = state.currentProtein.organs[state.activeOrgan]?.glycosites || [];
    dom.siteSelect.innerHTML = sites.length
      ? sites.map((row) => `<option value="${escapeHTML(row.id)}" ${site?.id === row.id ? "selected" : ""}>${escapeHTML(row.position ? `N${row.position}` : row.label)}${row.total_psm >= 5 ? "" : " *"}</option>`).join("")
      : `<option value="">No glycosites</option>`;
    dom.siteSelect.disabled = !sites.length;
  }

  function renderSiteMetrics(site) {
    if (!site) {
      dom.siteMetrics.innerHTML = `<p class="proteomics-only-note"><strong>Proteomics-only record.</strong> No N-glycosite data detected or passing quality filters.</p>`;
      return;
    }
    const pooled = site.shannon?.pooled_all || {};
    const detected = pooled.n_samples_detected;
    const possible = pooled.n_samples_possible;
    const dominant = site.dominant_class || [...pooledClassVector(site)].sort((a, b) => b[1] - a[1]).map(([name, percent]) => ({ name, percent }))[0];
    const dominantText = dominant ? `${CLASS_LABELS[dominant.name] || dominant.name} ${dominant.percent.toFixed(1)}%` : "—";
    const tier = site.site_psm_depth_tier ?? 0;
    const tierLabel = tier === 0 ? "Insufficient" : tier === 1 ? "Low" : tier <= 4 ? "Moderate" : tier <= 6 ? "High" : "Ultra high";
    const metrics = [
      ["Detected samples", `${formatNumber(detected)}/${formatNumber(possible)}`],
      ["Site evidence", `${formatNumber(site.total_psm)} total PSMs · ${detected ? formatNumber(Math.round(site.total_psm / detected)) : "—"} average per detected sample`],
      ["Site confidence", `${tier}/7 · ${tierLabel}`],
      ["Observed glycans", formatNumber(pooled.observed_glycans)],
      ["Observed glycan types", formatNumber(pooled.observed_glycan_types)],
      ["Weighted glycan types", Number.isFinite(pooled.effective_glycan_types) ? pooled.effective_glycan_types.toFixed(2) : "—"],
      ["Dominant glycan type", dominantText],
      ["Glycosite heterogeneity score (Shannon H)", Number.isFinite(pooled.glycan_type_shannon_h) ? pooled.glycan_type_shannon_h.toFixed(3) : "—"],
    ];
    dom.siteMetrics.innerHTML = metrics.map(([label, value]) => `<div><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`).join("");
  }

  function renderDetailCharts() {
    const site = selectedSite(state.activeOrgan);
    renderExactControls(site);
    document.querySelector("[data-diversity-title]").textContent = "N-glycosite heterogeneity with age";
    renderProteinChart();
    if (!site) {
      const isCat = normalize(state.currentProtein.gene) === "cat";
      if (isCat) {
        chartGeometry(dom.classChart);
        chartGeometry(dom.shannonChart);
      } else {
        dom.classChart.style.height = "";
        dom.shannonChart.style.height = "";
      }
      dom.classChart.classList.toggle("cat-chart", isCat);
      dom.shannonChart.classList.toggle("cat-chart", isCat);
      dom.classChart.innerHTML = isCat
        ? catFigure(catPhotos.composition, "No N-glycosite composition is available for this protein. Here is a cat instead")
        : `<p class="empty-note">No N-glycosite composition is available for this protein.</p>`;
      dom.classLegend.innerHTML = "";
      dom.shannonChart.innerHTML = isCat
        ? catFigure(catPhotos.diversity, "No site-resolved Shannon diversity is available for this protein. Here is another cat instead")
        : `<p class="empty-note">No site-resolved Shannon diversity is available for this protein.</p>`;
      dom.shannonLegend.innerHTML = "";
      dom.exactGrid.innerHTML = isCat
        ? catFigure(catPhotos.exact, "No exact glycans available. Cats are available though.", "cat-support-photo")
        : `<p class="empty-note">No exact glycans available.</p>`;
      return;
    }
    dom.classChart.classList.remove("cat-chart");
    dom.shannonChart.classList.remove("cat-chart");
    renderClassChart(site);
    renderShannonChart(site);
    renderExactGrid(site);
  }

  function renderExactControls(site) {
    const availableOrgans = ORGANS.filter((organ) => exactSites(organ).length);
    const currentOrganAvailable = availableOrgans.includes(state.activeOrgan);
    dom.exactOrganSelect.innerHTML = `${currentOrganAvailable ? "" : '<option value="" selected disabled>Select organ</option>'}${availableOrgans.map((organ) => `<option value="${organ}" ${organ === state.activeOrgan ? "selected" : ""}>${ORGAN_LABELS[organ]}</option>`).join("")}`;
    dom.exactOrganSelect.disabled = !availableOrgans.length || (availableOrgans.length === 1 && currentOrganAvailable);
    const sites = exactSites(state.activeOrgan);
    const currentSiteAvailable = sites.some((row) => row.id === site?.id);
    dom.exactSiteSelect.innerHTML = sites.length
      ? `${currentSiteAvailable ? "" : '<option value="" selected disabled>Select glycosite</option>'}${sites.map((row) => `<option value="${escapeHTML(row.id)}" ${site?.id === row.id ? "selected" : ""}>${escapeHTML(row.position ? `N${row.position}` : row.label)}${row.total_psm >= 5 ? "" : " *"}</option>`).join("")}`
      : `<option value="">No exact glycans</option>`;
    dom.exactSiteSelect.disabled = !sites.length;
  }

  function exactSites(organ) {
    return (state.currentProtein?.organs[organ]?.glycosites || []).filter((site) =>
      Object.values(site.exact_compositions?.ages || {}).some((rows) => rows?.length));
  }

  function chartGeometry(container) {
    const w = Math.max(280, container.clientWidth);
    const left = 66, right = 20, top = 16, bottom = 54;
    const plotW = Math.max(50, w - left - right);
    // Fixed aspect ratio for every site and metric; only panel width sets physical plot height.
    const plotH = Math.round(plotW * 2);
    const h = top + plotH + bottom;
    container.style.height = `${h}px`;
    return { w, h, left, right, top, plotW, plotH };
  }

  function ageTick(label, x, y) {
    return `<text class="age-tick" x="${x}" y="${y}" text-anchor="middle">${escapeHTML(label)}</text>`;
  }

  function ageMonth(value) {
    const parts = String(value).split("-").map(Number);
    return parts.every(Number.isFinite) ? parts.reduce((sum, n) => sum + n, 0) / parts.length : NaN;
  }

  function ageAxis(mode, left, top, plotW, plotH, keys) {
    const x = (index) => left + (mode === "ages" ? ageMonth(keys[index]) / 30 : keys.length === 1 ? .5 : index / (keys.length - 1)) * plotW;
    const bottom = top + plotH;
    if (mode !== "ages") return { x, ticks: keys.map((key, i) => `<line class="tick-mark" x1="${x(i)}" y1="${bottom}" x2="${x(i)}" y2="${bottom + 5}"/>${ageTick(key, x(i), bottom + 23)}`).join("") };
    const ticks = [0, 5, 10, 15, 20, 25, 30].map((month) => {
      const px = left + month / 30 * plotW;
      return `<line class="tick-mark" x1="${px}" y1="${bottom}" x2="${px}" y2="${bottom + (month % 10 ? 5 : 8)}"/>${month % 10 ? "" : ageTick(String(month), px, bottom + 25)}`;
    }).join("");
    return { x, ticks };
  }

  function ageSpec(site, mode = state.ageMode) {
    const available = Object.keys(site?.glycan_classes?.ages || {});
    const keys = mode === "age_bins" ? AGE_BINS.filter((key) => site?.glycan_classes?.age_bins?.[key]) : available.sort((a, b) => Number.parseFloat(a) - Number.parseFloat(b));
    return { keys, labels: keys.map((key) => mode === "age_bins" ? AGE_BIN_LABELS[key] : `${key} months`), numeric: mode === "ages" && keys.every((key) => Number.isFinite(ageMonth(key))) };
  }

  function niceCeiling(value, cap = Infinity) {
    const step = value <= 20 ? 5 : value <= 100 ? 10 : value <= 500 ? 50 : 100;
    return Math.min(cap, Math.max(step, Math.ceil(value / step) * step));
  }

  function axisTicks(max, step) {
    const values = [];
    for (let tick = 0; tick <= max + step / 100; tick += step) values.push(tick);
    return values;
  }

  function legendMark(color, combined = false) {
    if (combined) return `<svg class="legend-mark" viewBox="0 0 28 12" aria-hidden="true"><line x1="1" y1="6" x2="14" y2="6" stroke="#CD4D2C" stroke-width="2"/><line x1="14" y1="6" x2="27" y2="6" stroke="#A34599" stroke-width="2"/><circle cx="14" cy="6" r="4.5" fill="#CD4D2C"/><path d="M14 1.5 A4.5 4.5 0 0 1 14 10.5 Z" fill="#A34599"/></svg>`;
    return `<svg class="legend-mark" viewBox="0 0 28 12" aria-hidden="true"><line x1="1" y1="6" x2="27" y2="6" stroke="${color}" stroke-width="2"/><circle cx="14" cy="6" r="4.5" fill="${color}"/></svg>`;
  }

  function renderClassChart(site) {
    const values = site.glycan_classes?.[state.ageMode] || {};
    const { keys, labels, numeric } = ageSpec(site);
    const classes = CLASS_ORDER.filter((name) => keys.some((key) => (values[key] || []).some((row) => row.name === name && row.percent > 0)));
    if (!classes.length) {
      dom.classChart.innerHTML = `<p class="empty-note">No N-glycosite composition is available for this site and grouping.</p>`;
      dom.classLegend.innerHTML = "";
      return;
    }
    const { w, h, left, right, top, plotW, plotH } = chartGeometry(dom.classChart);
    const { x, ticks: xTicks } = ageAxis(state.ageMode, left, top, plotW, plotH, keys);
    const upperBounds = keys.flatMap((key) => (values[key] || []).filter((row) => Number.isFinite(row.percent)).map((row) => row.percent + (row.sem || 0)));
    const observed = Math.max(1, ...upperBounds);
    const max = [10, 20, 30, 40, 50, 60, 75, 80, 100].find((ceiling) => ceiling >= observed) || 100;
    const majorStep = max === 75 ? 25 : max >= 60 ? 20 : 10;
    const y = (value) => top + plotH - (value / max) * plotH;
    const grid = axisTicks(max, majorStep / 2).map((tick) => {
      const y = top + plotH - (tick / max) * plotH;
      const labeled = tick % majorStep === 0;
      return `<line class="tick-mark" x1="${left - (labeled ? 4 : 2.5)}" y1="${y}" x2="${left}" y2="${y}"/>${labeled ? `<text x="${left - 8}" y="${y + 3}" text-anchor="end">${tick}</text>` : ""}`;
    }).join("");
    const series = classes.map((name) => {
      const points = keys.map((key, index) => {
        const row = (values[key] || []).find((candidate) => candidate.name === name);
        return Number.isFinite(row?.percent) ? { index, percent: row.percent, sem: row.sem, n: row.n } : null;
      }).filter(Boolean);
      const pointString = points.map((point) => `${x(point.index)},${y(point.percent)}`).join(" ");
      const errorBars = points.map((point) => {
        if (!Number.isFinite(point.sem)) return "";
        const upper = y(point.percent + point.sem);
        const lower = y(Math.max(0, point.percent - point.sem));
        const px = x(point.index);
        return `<path class="class-error-bar" d="M${px},${upper}V${lower}M${px - 3.5},${upper}H${px + 3.5}M${px - 3.5},${lower}H${px + 3.5}" stroke="${CLASS_COLORS[name]}" stroke-width="1.1" opacity=".86"/>`;
      }).join("");
      const marks = points.map((point) => {
        const uncertainty = Number.isFinite(point.sem) ? ` ± ${point.sem.toFixed(1)}% SEM` : "";
        const sampleSize = Number.isFinite(point.n) ? ` · n=${point.n}` : "";
        return `<circle cx="${x(point.index)}" cy="${y(point.percent)}" r="3.5" fill="${name === "fucosylated_and_sialylated" ? "url(#dual-glycan)" : CLASS_COLORS[name]}" data-tooltip="${escapeHTML(`${labels[point.index]} · ${CLASS_LABELS[name]} ${point.percent.toFixed(1)}%${uncertainty}${sampleSize}`)}"></circle>`;
      }).join("");
      const line = name === "fucosylated_and_sialylated"
        ? `<polyline points="${pointString}" fill="none" stroke="#CD4D2C" stroke-width="2.2" stroke-dasharray="4 4"/><polyline points="${pointString}" fill="none" stroke="#A34599" stroke-width="2.2" stroke-dasharray="4 4" stroke-dashoffset="4"/>`
        : `<polyline points="${pointString}" fill="none" stroke="${CLASS_COLORS[name]}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
      return `${line}${errorBars}${marks}`;
    }).join("");
    dom.classChart.innerHTML = `<svg viewBox="0 0 ${w} ${h}" data-plot-width="${plotW}" data-plot-height="${plotH}" data-y-max="${max}" role="img" aria-label="Mean glycan type composition ± SEM across age groups"><defs><linearGradient id="dual-glycan"><stop offset="50%" stop-color="#CD4D2C"/><stop offset="50%" stop-color="#A34599"/></linearGradient></defs><text class="axis-label" transform="translate(13 ${top + plotH / 2}) rotate(-90)" text-anchor="middle">Percent abundance</text>${grid}<line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${top + plotH}"/><line class="axis" x1="${left}" y1="${top + plotH}" x2="${w - right}" y2="${top + plotH}"/>${series}${xTicks}<text class="axis-label" x="${left + plotW / 2}" y="${h - 4}" text-anchor="middle">${numeric ? "Age (months)" : "Age groups"}</text></svg>`;
    dom.classLegend.innerHTML = classes.map((name) => `<span class="legend-item">${legendMark(CLASS_COLORS[name], name === "fucosylated_and_sialylated")}${escapeHTML(CLASS_LABELS[name] || name)}</span>`).join("");
  }

  function renderProteinChart() {
    const series = [{ organ: state.activeOrgan, rows: state.currentProtein.organs[state.activeOrgan]?.proteome?.scaled_intensity || [] }]
      .filter(({ rows }) => rows.some((row) => Number.isFinite(row.mean)));
    if (!series.length) {
      dom.proteinChart.innerHTML = `<p class="empty-note">Normalized protein abundance is not available for this protein.</p>`;
      dom.proteinLegend.innerHTML = "";
      return;
    }
    const values = series.flatMap(({ rows }) => rows.filter((row) => Number.isFinite(row.mean)).flatMap((row) => [row.mean - (row.sem || 0), row.mean + (row.sem || 0)]));
    const rawMin = Math.min(...values), rawMax = Math.max(...values);
    const min = rawMin >= 0 ? 0 : Math.floor(rawMin * 2) / 2;
    const max = Math.ceil((rawMax + .05) * 2) / 2;
    const range = Math.max(.01, max - min);
    const { w, h, left, right, top, plotW, plotH } = chartGeometry(dom.proteinChart);
    const x = (age) => left + (ageMonth(age) / 30) * plotW;
    const y = (value) => top + ((max - value) / range) * plotH;
    const ticks = axisTicks(max, max <= 2 ? .5 : 1).filter((tick) => tick >= min);
    const grid = ticks.map((tick) => `<line class="tick-mark" x1="${left - 4}" y1="${y(tick)}" x2="${left}" y2="${y(tick)}"/><text x="${left - 8}" y="${y(tick) + 3}" text-anchor="end">${tick.toFixed(tick % 1 ? 1 : 0)}</text>`).join("");
    const paths = series.map(({ organ, rows }) => {
      const valid = rows.filter((row) => Number.isFinite(row.mean));
      const points = valid.map((row) => `${x(row.age)},${y(row.mean)}`).join(" ");
      const marks = valid.map((row) => {
        const px = x(row.age), py = y(row.mean), sem = row.sem || 0;
        const y1 = y(Math.min(max, row.mean + sem)), y2 = y(Math.max(min, row.mean - sem));
        return `<path d="M${px},${y1}V${y2}M${px - 3.5},${y1}H${px + 3.5}M${px - 3.5},${y2}H${px + 3.5}" stroke="${ORGAN_COLORS[organ]}" stroke-width="1.1" opacity=".86"/><circle cx="${px}" cy="${py}" r="3.5" fill="${ORGAN_COLORS[organ]}" data-tooltip="${escapeHTML(`${ORGAN_LABELS[organ]} · ${row.age} months · mean ${row.mean.toFixed(3)} ± ${sem.toFixed(3)} SEM · n=${row.n}${row.n <= 2 ? " *" : ""}`)}"></circle>`;
      }).join("");
      return `<polyline points="${points}" fill="none" stroke="${ORGAN_COLORS[organ]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${marks}`;
    }).join("");
    const xTicks = ageAxis("ages", left, top, plotW, plotH, []).ticks;
    dom.proteinChart.innerHTML = `<svg viewBox="0 0 ${w} ${h}" data-plot-width="${plotW}" data-plot-height="${plotH}" data-y-max="${max}" role="img" aria-label="Scaled protein abundance by age, mean ± SEM"><text class="axis-label" transform="translate(13 ${top + plotH / 2}) rotate(-90)" text-anchor="middle">Scaled protein abundance</text>${grid}<line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${top + plotH}"/><line class="axis" x1="${left}" y1="${top + plotH}" x2="${w - right}" y2="${top + plotH}"/>${paths}${xTicks}<text class="axis-label" x="${left + plotW / 2}" y="${h - 4}" text-anchor="middle">Age (months)</text></svg>`;
    dom.proteinLegend.innerHTML = series.map(({ organ, rows }) => {
      const low = rows.some((row) => Number.isFinite(row.mean) && row.n > 0 && row.n <= 2);
      return `<span class="protein-legend-entry"><span class="legend-item">${legendMark(ORGAN_COLORS[organ])}${ORGAN_LABELS[organ]}${low ? '<span class="low-replicate-star">*</span>' : ""}</span>${low ? '<span class="legend-note">* low confidence data – insufficient replicate numbers</span>' : ""}</span>`;
    }).join("");
  }

  function renderShannonChart(site) {
    if (!site) return;
    const { keys, labels, numeric } = ageSpec(site);
    const rows = new Map((site.shannon?.[state.ageMode] || []).map((row) => [String(row.key), row]));
    const pooled = state.diversityGrouping === "pooled";
    const effective = state.diversityMetric === "effective";
    const field = pooled ? (effective ? "effective_glycan_types" : "glycan_type_shannon_h") : (effective ? "effective_classes" : "mean");
    const semField = effective ? "effective_classes_sem" : "sem";
    const valid = keys.map((key, index) => ({ index, row: rows.get(key) })).filter(({ row }) => Number.isFinite(pooled ? row?.pooled?.[field] : row?.[field]));
    if (!valid.length) {
      dom.shannonChart.innerHTML = `<p class="empty-note">No heterogeneity measurements for this site and grouping.</p>`;
      dom.shannonLegend.innerHTML = "";
      return;
    }
    const { w, h, left, right, top, plotW, plotH } = chartGeometry(dom.shannonChart);
    const value = (row) => pooled ? row.pooled[field] : row[field];
    const observedMax = Math.max(...valid.map(({ row }) => value(row) + (pooled ? 0 : row[semField] || 0)));
    const step = observedMax <= 1 ? .25 : observedMax <= 3 ? .5 : observedMax <= 10 ? 1 : observedMax <= 20 ? 2 : 5;
    const max = Math.max(step, Math.ceil(observedMax / step) * step);
    const { x, ticks: xTicks } = ageAxis(state.ageMode, left, top, plotW, plotH, keys);
    const y = (v) => top + plotH - v / max * plotH;
    const grid = axisTicks(max, step).map((tick) => `<line class="tick-mark" x1="${left - 4}" y1="${y(tick)}" x2="${left}" y2="${y(tick)}"/><text x="${left - 8}" y="${y(tick) + 3}" text-anchor="end">${tick}</text>`).join("");
    const points = valid.map(({ index, row }) => `${x(index)},${y(value(row))}`).join(" ");
    const marks = valid.map(({ index, row }) => {
      const px = x(index), py = y(value(row)), sem = pooled ? null : row[semField];
      const upper = y(Math.min(max, value(row) + (sem || 0)));
      const lower = y(Math.max(0, value(row) - (sem || 0)));
      const error = Number.isFinite(sem) ? `<path d="M${px},${upper}V${lower}M${px - 3.5},${upper}H${px + 3.5}M${px - 3.5},${lower}H${px + 3.5}" stroke="#28768a" stroke-width="1.1" opacity=".86"/>` : "";
      const tooltip = `${labels[index]} · ${pooled ? "pooled PSMs" : "mean across detected samples"} · ${effective ? "weighted glycan types" : "Shannon H"} ${value(row).toFixed(3)}${Number.isFinite(sem) ? ` ± ${sem.toFixed(3)} SEM` : ""} · ${pooled ? row.pooled.glycosite_psms + " PSMs" : "n=" + row.n}`;
      return `${error}<circle cx="${px}" cy="${py}" r="3.4" fill="#28768a" data-tooltip="${escapeHTML(tooltip)}"></circle>`;
    }).join("");
    const axisTitle = effective ? "Weighted glycan types" : "Heterogeneity score (Shannon H)";
    dom.shannonChart.innerHTML = `<svg viewBox="0 0 ${w} ${h}" data-y-max="${max}" role="img" aria-label="${axisTitle} with age"><text class="axis-label" transform="translate(13 ${top + plotH / 2}) rotate(-90)" text-anchor="middle">${axisTitle}</text>${grid}<line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${top + plotH}"/><line class="axis" x1="${left}" y1="${top + plotH}" x2="${w - right}" y2="${top + plotH}"/><polyline points="${points}" fill="none" stroke="#28768a" stroke-width="2.2"/>${marks}${xTicks}<text class="axis-label" x="${left + plotW / 2}" y="${h - 4}" text-anchor="middle">${numeric ? "Age (months)" : "Age groups"}</text></svg>`;
    dom.shannonLegend.innerHTML = "";
  }

  function renderExactGrid(site) {
    const values = site.exact_compositions?.ages;
    if (!values) {
      dom.exactGrid.innerHTML = `<p class="empty-note">Individual glycan compositions and PSM counts are unavailable for this site.</p>`;
      return;
    }
    const keys = Object.keys(values).sort((a, b) => Number.parseFloat(a) - Number.parseFloat(b));
    const byAge = keys.map((key) => new Map((values[key] || []).map((row) => [row.name, row])));
    const names = [...new Set(byAge.flatMap((rows) => [...rows.keys()]))];
    const score = (name) => Math.max(0, ...byAge.map((rows) => rows.get(name)?.pooled_percent || 0));
    names.sort((a, b) => score(b) - score(a) || a.localeCompare(b));
    if (!names.length) {
      dom.exactGrid.innerHTML = `<p class="empty-note">No exact glycans detected.</p>`;
      return;
    }
    const maxPercent = Math.max(0, ...byAge.flatMap((rows) => [...rows.values()].map((row) => row.pooled_percent || 0)));
    const scaleMax = Math.min(100, Math.max(5, Math.ceil(maxPercent / (maxPercent <= 20 ? 5 : 10)) * (maxPercent <= 20 ? 5 : 10)));
    const scale = document.querySelector("[data-exact-scale]");
    scale.innerHTML = `<span>0%</span><i></i><span>${scaleMax}%</span>`;
    scale.setAttribute("aria-label", `Percent abundance: 0 to ${scaleMax} percent`);
    const siteCoverage = new Map((site.shannon?.ages || []).map((row) => [String(row.key), row.n || 0]));
    const totalPSMs = new Map((site.shannon?.ages || []).map((row) => [String(row.key), row.pooled?.glycosite_psms]));
    const header = `<div class="exact-age-heading"><span>Age (months)</span></div><div class="exact-row exact-head"><span class="exact-name">Composition</span>${keys.map((key) => `<span class="exact-header">${escapeHTML(key)}</span>`).join("")}</div>`;
    const rows = names.map((name) => {
      const type = byAge.map((rows) => rows.get(name)?.glycan_type).find(Boolean) || "undecorated";
      const cells = byAge.map((ageRows, index) => {
        const row = ageRows.get(name);
        const detected = (siteCoverage.get(keys[index]) || 0) > 0;
        const percent = row?.pooled_percent ?? 0;
        const psm = detected ? row?.psm ?? 0 : null;
        const color = heatColor(percent / scaleMax);
        const ageText = `${keys[index]} ${keys[index] === "1" ? "month" : "months"}`;
        const tooltip = `${name} · ${CLASS_LABELS[type] || type} · ${ageText} · ${psm === null ? "Site not detected" : `${percent.toFixed(1)}% of pooled PSMs · ${formatNumber(psm)}/${formatNumber(totalPSMs.get(keys[index]))} PSMs`}`;
        return `<button type="button" class="exact-cell ${detected ? "" : "missing"}" style="background:${color}" aria-label="${escapeHTML(tooltip)}" data-tooltip="${escapeHTML(tooltip)}"><span class="exact-value" style="color:${percent / scaleMax > .72 ? "#182020" : "#fff"}">${detected ? `${percent.toFixed(1)}%` : "—"}</span></button>`;
      }).join("");
      const shortName = name.replace(/HexNAc\((\d+)\)/g, "N$1 ").replace(/Hex\((\d+)\)/g, "H$1 ").replace(/Fuc\((\d+)\)/g, "F$1 ").replace(/NeuAc\((\d+)\)/g, "A$1 ").replace(/NeuGc\((\d+)\)/g, "G$1 ").replace(/Phospho\((\d+)\)/g, "P$1 ").trim();
      return `<div class="exact-row"><span class="exact-name" title="${escapeHTML(name)}"><i class="legend-swatch" style="background:${classPaint(type)}"></i>${escapeHTML(shortName)}</span>${cells}</div>`;
    }).join("");
    dom.exactGrid.innerHTML = header + rows;
    dom.exactGrid.style.setProperty("--exact-columns", keys.length);
    dom.exactGrid.classList.toggle("show-values", dom.exactGrid.querySelector(".exact-cell").clientWidth >= 48);
  }

  function heatColor(fraction) {
    const stops = ["#0d0887", "#7e03a8", "#cc4778", "#f89540", "#f0f921"];
    const scaled = Math.max(0, Math.min(1, fraction)) * (stops.length - 1);
    const index = Math.min(stops.length - 2, Math.floor(scaled));
    const t = scaled - index;
    const channel = (hex, offset) => Number.parseInt(hex.slice(offset, offset + 2), 16);
    const mix = (offset) => Math.round(channel(stops[index], offset) * (1 - t) + channel(stops[index + 1], offset) * t);
    return `rgb(${mix(1)},${mix(3)},${mix(5)})`;
  }

  function renderPairwise(site) {
    if (!site) {
      const noGlycosites = !observedSites().length;
      dom.pairwiseList.innerHTML = noGlycosites && normalize(state.currentProtein.gene) === "cat"
        ? catFigure(catPhotos.pairwise, "No glycosites to compare. Cats on the other hand...", "cat-support-photo")
        : `<p class="empty-note">${noGlycosites ? "No glycosites to compare." : "Select a glycosite to compare."}</p>`;
      return;
    }
    const siteFor = (organ, id) => (state.currentProtein.organs[organ]?.glycosites || []).find((row) => row.id === id);
    const eligible = (row) => row?.total_psm >= 5 && row.glycan_classes?.pooled?.length;
    const eligibleSites = (organ) => (state.currentProtein.organs[organ]?.glycosites || []).filter(eligible);
    const sharedSites = observedSites().filter((row) => row.observations.filter(({ site: observation }) => eligible(observation)).length >= 2);
    const siteOrgans = ORGANS.filter((organ) => eligibleSites(organ).length >= 2);
    const sameOrgan = state.pairMode === "between_sites";
    const modeControl = `<label>Compare<select data-pair-mode><option value="between_organs" ${sameOrgan ? "" : "selected"}>Same glycosite across datasets</option><option value="between_sites" ${sameOrgan ? "selected" : ""}>Two glycosites in one dataset</option></select></label>`;
    const bindMode = () => dom.pairwiseList.querySelector("[data-pair-mode]")?.addEventListener("change", (event) => {
      state.pairMode = event.target.value;
      state.pairSiteB = null;
      state.pairOrganB = null;
      renderPairwise(site);
    });
    if (!eligible(site) || (sameOrgan ? !siteOrgans.includes(state.activeOrgan) : !sharedSites.some((row) => row.id === site.id))) {
      dom.pairwiseList.innerHTML = `<div class="pairwise-controls"><div class="pairwise-top-row">${modeControl}</div></div><p class="empty-note">No eligible ${sameOrgan ? "second glycosite in this dataset" : "second dataset for this glycosite"} meets the 5-PSM comparison threshold.</p>`;
      bindMode();
      return;
    }
    state.pairSiteOrgan = state.activeOrgan;
    state.pairSiteA = site.id;
    const sameOrganSites = eligibleSites(state.pairSiteOrgan);
    if (!sameOrganSites.some((row) => row.id === state.pairSiteB && row.id !== state.pairSiteA)) state.pairSiteB = sameOrganSites.find((row) => row.id !== state.pairSiteA)?.id;
    state.pairSharedSite = site.id;
    const crossOrgans = ORGANS.filter((organ) => eligible(siteFor(organ, state.pairSharedSite)));
    state.pairOrganA = state.activeOrgan;
    if (!crossOrgans.includes(state.pairOrganB) || state.pairOrganB === state.pairOrganA) state.pairOrganB = crossOrgans.find((organ) => organ !== state.pairOrganA);
    const a = sameOrgan ? siteFor(state.pairSiteOrgan, state.pairSiteA) : siteFor(state.pairOrganA, state.pairSharedSite);
    const b = sameOrgan ? siteFor(state.pairSiteOrgan, state.pairSiteB) : siteFor(state.pairOrganB, state.pairSharedSite);
    const organOptions = (selected, other) => crossOrgans.filter((organ) => organ !== other).map((organ) => `<option value="${organ}" ${organ === selected ? "selected" : ""}>${ORGAN_LABELS[organ]}</option>`).join("");
    const siteOptions = (selected, other) => sameOrganSites.filter((row) => row.id !== other).map((row) => `<option value="${escapeHTML(row.id)}" ${row.id === selected ? "selected" : ""}>${escapeHTML(row.label)}</option>`).join("");
    const sharedSiteOptions = sharedSites.map((row) => `<option value="${escapeHTML(row.id)}" ${row.id === state.pairSharedSite ? "selected" : ""}>${escapeHTML(row.position ? `N${row.position}` : row.label)}</option>`).join("");
    const secondTopControl = sameOrgan
      ? `<label>Dataset<select data-pair-dataset>${siteOrgans.map((organ) => `<option value="${organ}" ${organ === state.pairSiteOrgan ? "selected" : ""}>${ORGAN_LABELS[organ]}</option>`).join("")}</select></label>`
      : `<label>Glycosite<select data-pair-shared-site>${sharedSiteOptions}</select></label>`;
    const bottomControls = sameOrgan
      ? `<label>Glycosite A<select data-pair-site-a>${siteOptions(state.pairSiteA, state.pairSiteB)}</select></label><label>Glycosite B<select data-pair-site-b>${siteOptions(state.pairSiteB, state.pairSiteA)}</select></label>`
      : `<label>Dataset A<select data-pair-organ-a>${organOptions(state.pairOrganA, state.pairOrganB)}</select></label><label>Dataset B<select data-pair-organ-b>${organOptions(state.pairOrganB, state.pairOrganA)}</select></label>`;
    const selector = `<div class="pairwise-controls"><div class="pairwise-top-row">${modeControl}${secondTopControl}</div><div class="pair-selectors">${bottomControls}</div></div>`;
    if (!a || !b) {
      dom.pairwiseList.innerHTML = `${selector}<p class="empty-note">No second ${sameOrgan ? "site" : "dataset"} is available for this comparison.</p>`;
    } else if (a.total_psm < 5 || b.total_psm < 5) {
      dom.pairwiseList.innerHTML = `${selector}<p class="empty-note">Pairwise comparison is unavailable when either glycosite has fewer than 5 PSMs. Its individual data remain available above and in the heatmap.</p>`;
    } else {
      const vectorA = pooledClassVector(a), vectorB = pooledClassVector(b);
      const gene = state.currentProtein.gene || state.currentProtein.protein_id;
      const labelA = `${sameOrgan ? "Glycosite A" : "Dataset A"} · ${ORGAN_LABELS[sameOrgan ? state.pairSiteOrgan : state.pairOrganA]} | ${gene} N${a.position}`;
      const labelB = `${sameOrgan ? "Glycosite B" : "Dataset B"} · ${ORGAN_LABELS[sameOrgan ? state.pairSiteOrgan : state.pairOrganB]} | ${gene} N${b.position}`;
      const classNames = orderedClasses([...new Set([...vectorA.keys(), ...vectorB.keys()])]);
      const totalVariation = classNames.reduce((sum, name) => sum + Math.abs((vectorA.get(name) || 0) - (vectorB.get(name) || 0)), 0) / 2;
      const bar = (vector, label) => `<div class="comparison-profile"><strong>${escapeHTML(label)}</strong><div class="composition-bar">${classNames.map((name) => `<i style="width:${vector.get(name) || 0}%;background:${classPaint(name)}"></i>`).join("")}</div></div>`;
      const statsA = a.shannon?.pooled_all || {}, statsB = b.shannon?.pooled_all || {};
      const fmt = (value, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : "—";
      const dominant = (row) => row.dominant_class ? `${CLASS_LABELS[row.dominant_class.name]} ${fmt(row.dominant_class.percent, 1)}%` : "—";
      const metric = (label, value) => `<div class="comparison-metric"><span>${label}</span><strong>${escapeHTML(value)}</strong></div>`;
      const profile = (row, stats, vector, label) => `<div class="comparison-column">${bar(vector, label)}<div class="comparison-site-metrics">${metric("Total PSMs", formatNumber(row.total_psm))}${metric("Detected samples", `${formatNumber(stats.n_samples_detected)}/${formatNumber(stats.n_samples_possible)}`)}${metric("Glycosite heterogeneity score (Shannon H)", fmt(stats.glycan_type_shannon_h))}${metric("Observed glycan types", formatNumber(stats.observed_glycan_types))}${metric("Weighted glycan types", fmt(stats.effective_glycan_types))}${metric("Dominant glycan type", dominant(row))}</div></div>`;
      const tableRows = classNames.map((name) => {
        const valueA = vectorA.get(name) || 0, valueB = vectorB.get(name) || 0;
        return `<tr><th><i class="legend-swatch" style="background:${classPaint(name)}"></i>${escapeHTML(CLASS_LABELS[name] || name)}</th><td>${fmt(valueA, 1)}%</td><td>${fmt(valueB, 1)}%</td><td>${valueB - valueA >= 0 ? "+" : ""}${fmt(valueB - valueA, 1)} pp</td></tr>`;
      }).join("");
      dom.pairwiseList.innerHTML = `${selector}<div class="comparison-columns">${profile(a, statsA, vectorA, labelA)}${profile(b, statsB, vectorB, labelB)}</div><div class="comparison-distance">${metric("Composition percent difference (TVD)", `${fmt(totalVariation, 1)}%`)}<div class="distance-track"><i style="width:${Math.min(100, totalVariation)}%"></i></div></div><div class="comparison-table-wrap"><table><thead><tr><th>Glycan type</th><th>${sameOrgan ? "Glycosite A" : "Dataset A"}</th><th>${sameOrgan ? "Glycosite B" : "Dataset B"}</th><th>${sameOrgan ? "Glycosite B − A" : "Dataset B − A"}</th></tr></thead><tbody>${tableRows}</tbody></table></div>`;
    }
    bindMode();
    dom.pairwiseList.querySelector("[data-pair-shared-site]")?.addEventListener("change", (event) => {
      const id = event.target.value;
      const organ = eligible(siteFor(state.pairOrganA, id)) ? state.pairOrganA : ORGANS.find((candidate) => eligible(siteFor(candidate, id)));
      if (organ) selectSiteEverywhere(organ, id);
    });
    dom.pairwiseList.querySelector("[data-pair-organ-a]")?.addEventListener("change", (event) => { selectSiteEverywhere(event.target.value, state.pairSharedSite); });
    dom.pairwiseList.querySelector("[data-pair-organ-b]")?.addEventListener("change", (event) => { state.pairOrganB = event.target.value; renderPairwise(site); });
    dom.pairwiseList.querySelector("[data-pair-dataset]")?.addEventListener("change", (event) => {
      const organ = event.target.value;
      const selected = eligible(siteFor(organ, state.selectedSites[organ])) ? state.selectedSites[organ] : eligibleSites(organ)[0]?.id;
      state.pairSiteB = null;
      selectSiteEverywhere(organ, selected);
    });
    dom.pairwiseList.querySelector("[data-pair-site-a]")?.addEventListener("change", (event) => { selectSiteEverywhere(state.pairSiteOrgan, event.target.value); });
    dom.pairwiseList.querySelector("[data-pair-site-b]")?.addEventListener("change", (event) => { state.pairSiteB = event.target.value; renderPairwise(site); });
  }

  function pooledClassVector(site) {
    return new Map((site?.glycan_classes?.pooled || []).map((row) => [row.name, row.percent]));
  }

  async function loadTVD() {
    if (!state.tvdManifest) {
      state.tvdManifest = await fetchJSON("data/tvd/index.json");
      const comparisons = state.tvdManifest.comparisons.filter((row) => row.family === "age_bins");
      state.tvdManifest.comparisons = comparisons;
      const datasets = [...new Set(comparisons.map((row) => row.dataset))];
      dom.tvdDataset.innerHTML = datasets.map((dataset) => `<option value="${dataset}">${ORGAN_LABELS[dataset.replace(/^atlas_/, "")] || dataset}</option>`).join("");
      [dom.tvdDataset, dom.tvdComparison].forEach((select) => select.addEventListener("change", updateTVDControls));
      dom.tvdSearch.addEventListener("input", renderTVDPlot);
      document.querySelectorAll("[data-tvd-zoom]").forEach((button) => button.addEventListener("click", () => {
        state.tvdZoom = button.dataset.tvdZoom === "reset" ? 1 : Math.max(1, Math.min(8, (state.tvdZoom || 1) * Number(button.dataset.tvdZoom)));
        renderTVDPlot();
      }));
    }
    dom.tvdDataset.value = "atlas_brain";
    updateTVDControls(null, "O_vs_Y");
  }

  async function updateTVDControls(event, preferredComparison) {
    const comparisons = state.tvdManifest.comparisons.filter((row) => row.dataset === dom.tvdDataset.value);
    const available = comparisons;
    const requested = typeof preferredComparison === "string" ? preferredComparison : dom.tvdComparison.value;
    const selected = available.some((row) => row.comparison === requested) ? requested : available[0]?.comparison;
    dom.tvdComparison.innerHTML = available.map((row) => `<option value="${escapeHTML(row.comparison)}" ${row.comparison === selected ? "selected" : ""}>${escapeHTML(row.comparison.replaceAll("_", " "))} (${formatNumber(row.n)} sites)</option>`).join("");
    const record = available.find((row) => row.comparison === selected);
    if (!record) return;
    dom.tvdPlot.innerHTML = `<p class="empty-note">Loading ${formatNumber(record.n)} tested sites…</p>`;
    state.tvdRows = await fetchJSON(`data/tvd/${record.file}`);
    state.tvdZoom = event?.target === dom.tvdComparison ? state.tvdZoom || 1 : 1;
    renderTVDPlot();
  }

  function renderTVDPlot() {
    if (!state.tvdRows) return;
    const query = normalize(dom.tvdSearch.value);
    const matches = (row) => {
      const gene = state.byProtein.get(row.protein_id)?.gene || "";
      return !query || normalize(`${row.protein_id} ${row.glycosite} ${gene}`).includes(query);
    };
    const w = Math.max(640, dom.tvdPlot.clientWidth), h = 520, left = 92, right = 30, top = 24, bottom = 75;
    const width = w - left - right, height = h - top - bottom;
    const zoom = state.tvdZoom || 1;
    const maxX = Math.max(5, Math.ceil(Math.max(0, ...state.tvdRows.map((row) => row.percent_difference)) / 5) * 5) / zoom;
    const maxY = Math.max(2, Math.ceil(Math.max(0, ...state.tvdRows.map((row) => row.neg_log10_p_value)))) / zoom;
    const x = (value) => left + value / maxX * width;
    const y = (value) => top + height - value / maxY * height;
    const visible = state.tvdRows.filter((row) => row.percent_difference <= maxX && row.neg_log10_p_value <= maxY);
    const groupNames = { Y: "Young", MA: "Middle-aged", O: "Old" };
    const [groupA, groupB] = dom.tvdComparison.value.split("_vs_");
    const dot = (row, highlighted) => {
      const gene = state.byProtein.get(row.protein_id)?.gene || row.protein_id;
      const title = `${gene} · ${row.position ? `N${row.position}` : row.glycosite}`;
      const sampleRows = [
        { group: groupA, n: row.n_a, psm: row.psm_a },
        { group: groupB, n: row.n_b, psm: row.psm_b },
      ].sort((a, b) => AGE_BINS.indexOf(a.group) - AGE_BINS.indexOf(b.group));
      const sampleAttributes = sampleRows.map((sample, index) => `data-tvd-sample-label${index}="Detected ${escapeHTML(groupNames[sample.group] || sample.group)} Samples" data-tvd-sample-value${index}="${formatNumber(sample.n)} (${formatNumber(sample.psm)} total PSMs)"`).join(" ");
      return `<circle class="${highlighted ? "search-hit" : ""}" cx="${x(row.percent_difference)}" cy="${y(row.neg_log10_p_value)}" r="${highlighted ? 6.5 : 5}" fill="${highlighted ? "#224B96" : row.p_value < .05 ? "#CD4D2C" : "#78909b"}" fill-opacity="${highlighted ? 1 : .72}" data-tvd-protein="${escapeHTML(row.protein_id)}" data-tvd-site="${escapeHTML(row.site_key)}" data-tvd-dataset="${dom.tvdDataset.value.replace(/^atlas_/, "")}" data-tvd-tooltip data-tvd-title="${escapeHTML(title)}" data-tvd-difference="${row.percent_difference.toFixed(1)}%" data-tvd-p="${Number(row.p_value).toExponential(2)}" ${sampleAttributes} data-tooltip="${escapeHTML(title)}" tabindex="0" role="button"></circle>`;
    };
    const dots = visible.filter((row) => !query || !matches(row)).map((row) => dot(row, false)).join("")
      + (query ? visible.filter(matches).map((row) => dot(row, true)).join("") : "");
    const axisMarks = (max, major, coordinate, horizontal) => axisTicks(max, major / 2).map((tick) => {
      const labeled = Math.abs(tick / major - Math.round(tick / major)) < 1e-6;
      const position = coordinate(tick);
      return horizontal
        ? `<line class="tick-mark" x1="${position}" y1="${top + height}" x2="${position}" y2="${top + height + (labeled ? 8 : 5)}"/>${labeled ? `<text x="${position}" y="${top + height + 29}" text-anchor="middle">${tick}</text>` : ""}`
        : `<line class="tick-mark" x1="${left - (labeled ? 8 : 5)}" y1="${position}" x2="${left}" y2="${position}"/>${labeled ? `<text x="${left - 14}" y="${position + 6}" text-anchor="end">${tick}</text>` : ""}`;
    }).join("");
    const xTicks = axisMarks(maxX, maxX <= 20 ? 5 : 10, x, true);
    const yTicks = axisMarks(maxY, maxY <= 6 ? 1 : 2, y, false);
    const matchCount = state.tvdRows.filter(matches).length;
    const count = query ? `${formatNumber(matchCount)} matching site${matchCount === 1 ? "" : "s"}` : `${formatNumber(state.tvdRows.length)} tested sites`;
    dom.tvdPlot.innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Glycan type composition percent difference versus negative log10 p value"><line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${top + height}"/><line class="axis" x1="${left}" y1="${top + height}" x2="${left + width}" y2="${top + height}"/><line class="tvd-threshold" x1="${left}" y1="${y(-Math.log10(.05))}" x2="${left + width}" y2="${y(-Math.log10(.05))}"/>${dots}${xTicks}${yTicks}<text class="axis-label" x="${left + width / 2}" y="${h - 8}" text-anchor="middle">Glycan type composition percent difference</text><text class="axis-label" transform="translate(24 ${top + height / 2}) rotate(-90)" text-anchor="middle">−log₁₀(p value)</text></svg><p class="tvd-count">${count} · click a point to open its glycosite.</p>`;
    dom.tvdPlot.querySelectorAll("[data-tvd-protein]").forEach((dot) => {
      const open = async () => {
        const row = state.byProtein.get(dot.dataset.tvdProtein);
        if (!row) return;
        await openProtein(row);
        selectSiteEverywhere(dot.dataset.tvdDataset, dot.dataset.tvdSite);
        const panel = document.querySelector("[data-class-chart]")?.closest(".chart-panel");
        if (panel) {
          const headerHeight = document.querySelector(".explore-topbar")?.getBoundingClientRect().height || 0;
          const bounds = panel.getBoundingClientRect();
          const visibleHeight = window.innerHeight - headerHeight;
          const targetTop = headerHeight + Math.max(16, (visibleHeight - bounds.height) / 2);
          window.scrollTo({ top: window.scrollY + bounds.top - targetTop, behavior: "smooth" });
        }
      };
      dot.addEventListener("click", open);
      dot.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
    });
  }

  function selectedSite(organ) {
    const sites = state.currentProtein?.organs?.[organ]?.glycosites || [];
    return sites.find((site) => site.id === state.selectedSites[organ]) || sites[0] || null;
  }

  function renderTooltip(target) {
    dom.tooltip.replaceChildren();
    const tvd = target.hasAttribute("data-tvd-tooltip");
    dom.tooltip.classList.toggle("tvd-tooltip", tvd);
    if (tvd) {
      const header = document.createElement("strong");
      header.className = "tooltip-header";
      header.textContent = target.dataset.tvdTitle;
      dom.tooltip.append(header);
      [["Composition difference", target.dataset.tvdDifference], ["Raw p value", target.dataset.tvdP], [target.dataset.tvdSampleLabel0, target.dataset.tvdSampleValue0], [target.dataset.tvdSampleLabel1, target.dataset.tvdSampleValue1]].forEach(([label, value]) => {
        const row = document.createElement("div");
        row.className = "tooltip-tvd-row";
        const name = document.createElement("span");
        name.textContent = label;
        const measure = document.createElement("strong");
        measure.textContent = value;
        row.append(name, measure);
        dom.tooltip.append(row);
      });
      return;
    }
    const organ = target.dataset.overlayOrgan;
    const site = state.currentProtein?.organs[organ]?.glycosites?.find((row) => row.id === target.dataset.overlaySite);
    if (!site) {
      dom.tooltip.textContent = target.dataset.tooltip;
      return;
    }
    const header = document.createElement("strong");
    header.className = "tooltip-header";
    header.textContent = `${organ[0].toUpperCase()}${organ.slice(1)} · ${site.position ? `N${site.position}` : site.label}${site.comparison_eligible ? "" : " *"}`;
    const evidence = document.createElement("div");
    evidence.className = "tooltip-psm";
    evidence.textContent = `PSM ${formatNumber(site.total_psm)}`;
    dom.tooltip.append(header, evidence);
    const vector = pooledClassVector(site);
    orderedClasses([...vector.keys()]).forEach((name) => {
      const row = document.createElement("div");
      row.className = "tooltip-class";
      const swatch = document.createElement("i");
      swatch.className = "legend-swatch";
      swatch.style.background = classPaint(name);
      const label = document.createElement("span");
      label.textContent = CLASS_LABELS[name];
      const percent = document.createElement("strong");
      percent.textContent = `${vector.get(name).toFixed(1)}%`;
      row.append(swatch, label, percent);
      dom.tooltip.append(row);
    });
    if (site.total_psm < 5) {
      const warning = document.createElement("div");
      warning.className = "tooltip-warning";
      warning.textContent = "* Low-confidence site (<5 PSMs)";
      dom.tooltip.append(warning);
    }
  }

  function bindTooltip() {
    let activeTarget = null;
    const show = (target) => {
      activeTarget = target;
      renderTooltip(target);
      dom.tooltip.hidden = false;
      positionTooltip(target);
    };
    document.addEventListener("pointerover", (event) => {
      const target = event.target.closest("[data-tooltip]");
      if (target && target !== activeTarget) show(target);
    });
    document.addEventListener("pointerout", (event) => {
      if (activeTarget && event.target.closest("[data-tooltip]") === activeTarget && !activeTarget.contains(event.relatedTarget)) {
        dom.tooltip.hidden = true;
        activeTarget = null;
      }
    });
    document.addEventListener("focusin", (event) => {
      const target = event.target.closest("[data-tooltip]");
      if (target) show(target);
    });
    document.addEventListener("focusout", () => { dom.tooltip.hidden = true; activeTarget = null; });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") { dom.tooltip.hidden = true; activeTarget = null; } });
  }

  function positionTooltip(target) {
    const box = target.getBoundingClientRect();
    const x = Math.max(8, Math.min(window.innerWidth - dom.tooltip.offsetWidth - 8, box.left + (box.width - dom.tooltip.offsetWidth) / 2));
    const above = box.top - dom.tooltip.offsetHeight - 12;
    const y = Math.max(8, Math.min(window.innerHeight - dom.tooltip.offsetHeight - 8, above >= 8 ? above : box.bottom + 12));
    dom.tooltip.style.left = `${x}px`;
    dom.tooltip.style.top = `${y}px`;
  }

  function showProteinLoading(label = "protein") {
    showExplore(false);
    dom.dashboard.hidden = true;
    dom.loading.hidden = false;
    dom.loading.innerHTML = `<span class="loader" aria-hidden="true"></span><p>Loading ${escapeHTML(label)}…</p>`;
  }

  function showExplore(updateHistory = false) {
    document.body.classList.add("exploring");
    document.body.classList.remove("contenting");
    dom.home.hidden = true;
    dom.explore.hidden = false;
    dom.pages.forEach((page) => { page.hidden = true; });
    document.title = "Explore · The Glycoprotein Atlas";
    updateNavigation("explore");
    if (updateHistory) history.pushState({}, "", `${location.pathname}#explore`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showHome(updateHistory = true) {
    document.body.classList.remove("exploring");
    document.body.classList.remove("contenting");
    dom.home.hidden = false;
    dom.explore.hidden = true;
    dom.pages.forEach((page) => { page.hidden = true; });
    document.title = "The Glycoprotein Atlas";
    updateNavigation(null);
    if (updateHistory) history.pushState({}, "", `${location.pathname}#home`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showPage(pageName, updateHistory = true) {
    const page = dom.pages.find((node) => node.dataset.page === pageName);
    if (!page) return showHome(updateHistory);
    document.body.classList.remove("exploring");
    document.body.classList.add("contenting");
    dom.home.hidden = true;
    dom.explore.hidden = true;
    dom.pages.forEach((node) => { node.hidden = node !== page; });
    document.title = `${PAGE_TITLES[pageName]} · The Glycoprotein Atlas`;
    updateNavigation(pageName);
    closeAllSearchResults();
    if (updateHistory) history.pushState({}, "", `${location.pathname}#${pageName}`);
    if (pageName === "tvd") loadTVD().catch((error) => {
      console.error(error);
      dom.tvdPlot.innerHTML = `<p class="empty-note">Age-comparison data could not be loaded.</p>`;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function routeFromLocation() {
    const proteinId = proteinFromHash();
    if (proteinId) {
      const result = state.byProtein.get(proteinId);
      if (result) await openProtein(result, false);
      else showExplore(false);
      return;
    }
    const route = location.hash.replace(/^#/, "");
    if (route === "explore") return showExplore(false);
    if (Object.hasOwn(PAGE_TITLES, route)) return showPage(route, false);
    showHome(false);
  }

  function updateNavigation(activePage) {
    document.querySelectorAll(".main-nav a").forEach((link) => {
      const linkPage = link.dataset.pageLink || (link.hasAttribute("data-explore-link") ? "explore" : null);
      if (linkPage === activePage) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function proteinFromHash() {
    const match = location.hash.match(/^#explore\/([^/?]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function resultsForInput(input) {
    return input.closest("[data-search-form]").querySelector("[data-search-results]");
  }

  function closeSearchResults(input) { resultsForInput(input).hidden = true; }
  function closeAllSearchResults() { document.querySelectorAll("[data-search-results]").forEach((node) => { node.hidden = true; }); }
  function announce(message) { dom.live.textContent = message; }
  function normalize(value) { return String(value || "").trim().toLowerCase(); }
  function formatNumber(value) { return value == null || !Number.isFinite(Number(value)) ? "—" : Number(value).toLocaleString("en-US", { maximumFractionDigits: 1 }); }
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  }
  async function fetchJSON(path) {
    const separator = path.includes("?") ? "&" : "?";
    const response = await fetch(`${path}${separator}build=${EXPLORER_BUILD}`);
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.json();
  }
})();
