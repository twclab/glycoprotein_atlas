(() => {
  "use strict";

  const ORGANS = ["brain", "spleen", "liver", "kidney", "plasma", "myelin_male", "myelin_female"];
  const ORGAN_LABELS = { brain: "Brain", spleen: "Spleen", liver: "Liver", kidney: "Kidney", plasma: "Plasma", myelin_male: "Myelin · male", myelin_female: "Myelin · female" };
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
  const EXPLORER_BUILD = "2026-09-29-e330";
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
    pairSiteB: null,
    diversityMetric: "effective",
    diversityGrouping: "auto",
    tvdManifest: null,
  };

  const dom = {
    home: document.querySelector(".home-view"),
    explore: document.querySelector(".explore-view"),
    pages: [...document.querySelectorAll("[data-page]")],
    dashboard: document.querySelector("[data-dashboard]"),
    loading: document.querySelector("[data-loading]"),
    segmentOverlay: document.querySelector("[data-segment-overlay]"),
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
    pairwiseList: document.querySelector("[data-pairwise-list]"),
    tooltip: document.querySelector("[data-tooltip]"),
    live: document.querySelector("[data-live-region]"),
    tvdPlot: document.querySelector("[data-tvd-plot]"),
    tvdDataset: document.querySelector("[data-tvd-dataset]"),
    tvdFamily: document.querySelector("[data-tvd-family]"),
    tvdComparison: document.querySelector("[data-tvd-comparison]"),
    tvdSearch: document.querySelector("[data-tvd-search]"),
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindNavigation();
    bindControls();
    bindTooltip();
    let resizeFrame;
    window.addEventListener("resize", () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        if (state.currentProtein && !dom.explore.hidden) renderDetailCharts();
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
      document.querySelectorAll("[data-version]").forEach((node) => { node.textContent = manifest.data_version; });
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
    const matches = search(query, 9);
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
      ORGANS.forEach((organ) => {
        const sites = protein.organs[organ]?.glycosites || [];
        state.selectedSites[organ] = (sites.find((site) => site.comparison_eligible) || sites[0] || {}).id || null;
      });
      state.activeOrgan = ORGANS.find((organ) => protein.organs[organ]?.glycosites?.length) || ORGANS.find((organ) => protein.organs[organ]?.proteome) || "brain";
      const cat = document.querySelector("[data-cat-easter-egg]");
      cat.hidden = normalize(protein.gene) !== "cat";
      if (!cat.hidden) {
        const photo = cat.querySelector("img");
        if (!photo.src) photo.src = photo.dataset.src;
      }
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
        const organ = button.dataset.overlayMarkerOrgan;
        state.activeOrgan = organ;
        state.selectedSites[organ] = button.dataset.overlayMarkerSite;
        renderSegmentOverlay();
        renderDetail();
      });
    });
    dom.segmentOverlay.querySelectorAll("[data-overlay-site]").forEach((button) => {
      button.addEventListener("click", () => {
        const organ = button.dataset.overlayOrgan;
        state.activeOrgan = organ;
        state.selectedSites[organ] = button.dataset.overlaySite;
        renderSegmentOverlay();
        renderDetail();
      });
    });
    const classNames = [...new Set(glycoOrgans.flatMap((organ) => (state.currentProtein.organs[organ]?.glycosites || []).flatMap((site) => [...pooledClassVector(site).entries()].filter(([, percent]) => percent > 0).map(([name]) => name))))];
    dom.segmentLegend.innerHTML = `<strong>Glycan Types |</strong> ` + orderedClasses(classNames).map((name) => `<span class="legend-item"><i class="legend-swatch" style="background:${classPaint(name)}"></i>${escapeHTML(CLASS_LABELS[name] || name)}</span>`).join("");
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
      state.activeOrgan = dom.organSelect.value;
      renderSegmentOverlay();
      renderDetail();
    });
    dom.siteSelect.addEventListener("change", () => {
      state.selectedSites[state.activeOrgan] = dom.siteSelect.value || null;
      renderSegmentOverlay();
      renderDetail();
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

  function renderDetail() {
    const organ = state.activeOrgan;
    const site = selectedSite(organ);
    document.querySelector("[data-detail-site]").textContent = site ? (site.position ? `${state.currentProtein.gene} N${site.position}` : site.label) : "No glycosite selected";
    const note = document.querySelector("[data-confidence-note]");
    note.classList.toggle("low", Boolean(site && site.total_psm < 5));
    note.textContent = !site
      ? `${state.currentProtein.protein_id} · glycan data were not detected for the selected organ.`
      : `${state.currentProtein.protein_id} · ${ORGAN_LABELS[organ]}`;
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
      dom.siteMetrics.innerHTML = `<p class="proteomics-only-note"><strong>Proteomics-only record.</strong> This protein remains searchable because normalized abundance is available even though no glycosite passed into the current display payload.</p>`;
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
      ["Site evidence", `${formatNumber(site.total_psm)} total PSMs · ${detected ? (site.total_psm / detected).toFixed(1) : "—"} average per detected sample`],
      ["Evidence tier", `${tier}/7 · ${tierLabel}`],
      ["Observed glycans", formatNumber(pooled.observed_glycans)],
      ["Observed glycan types", formatNumber(pooled.observed_glycan_types)],
      ["Weighted glycan types", Number.isFinite(pooled.effective_glycan_types) ? pooled.effective_glycan_types.toFixed(2) : "—"],
      ["Dominant glycan type", dominantText],
      ["Pooled glycan-type Shannon H", Number.isFinite(pooled.glycan_type_shannon_h) ? pooled.glycan_type_shannon_h.toFixed(3) : "—"],
    ];
    dom.siteMetrics.innerHTML = metrics.map(([label, value]) => `<div><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`).join("");
  }

  function renderDetailCharts() {
    const site = selectedSite(state.activeOrgan);
    document.querySelector("[data-diversity-title]").textContent = "N-glycosite heterogeneity with age";
    renderProteinChart();
    if (!site) {
      dom.classChart.innerHTML = `<p class="empty-note">No glycan-class composition is available for this protein.</p>`;
      dom.classLegend.innerHTML = "";
      dom.shannonChart.innerHTML = `<p class="empty-note">No site-resolved Shannon diversity is available for this protein.</p>`;
      dom.shannonLegend.innerHTML = "";
      dom.exactGrid.innerHTML = `<p class="empty-note">No exact glycans available.</p>`;
      return;
    }
    renderClassChart(site);
    renderShannonChart(site);
    renderExactGrid(site);
  }

  function chartGeometry(container) {
    const w = Math.max(320, container.clientWidth);
    const left = 66, right = 20, top = 16, bottom = 54;
    const plotW = Math.max(50, w - left - right);
    const plotH = Math.max(200, Math.min(390, plotW / 1.55));
    const h = top + plotH + bottom;
    container.style.height = `${h}px`;
    return { w, h, left, right, top, plotW, plotH };
  }

  function ageTick(label, x, y, rotate) {
    return `<text class="age-tick" x="${x}" y="${y}" ${rotate ? `transform="rotate(-45 ${x} ${y})" text-anchor="end"` : 'text-anchor="middle"'}>${escapeHTML(label)}</text>`;
  }

  function ageSpec(site, mode = state.ageMode) {
    const available = Object.keys(site?.glycan_classes?.ages || {});
    const keys = mode === "age_bins" ? AGE_BINS.filter((key) => site?.glycan_classes?.age_bins?.[key]) : available.sort((a, b) => Number.parseFloat(a) - Number.parseFloat(b));
    return { keys, labels: keys.map((key) => mode === "age_bins" ? AGE_BIN_LABELS[key] : `${key}M`), numeric: mode === "ages" && keys.every((key) => Number.isFinite(Number(key))) };
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

  function renderClassChart(site) {
    const values = site.glycan_classes?.[state.ageMode] || {};
    const { keys, labels, numeric } = ageSpec(site);
    const classes = CLASS_ORDER.filter((name) => keys.some((key) => (values[key] || []).some((row) => row.name === name && row.percent > 0)));
    if (!classes.length) {
      dom.classChart.innerHTML = `<p class="empty-note">No glycan-class composition is available for this site and grouping.</p>`;
      dom.classLegend.innerHTML = "";
      return;
    }
    const { w, h, left, right, top, plotW, plotH } = chartGeometry(dom.classChart);
    const x = (index) => left + (keys.length === 1 ? plotW / 2 : numeric ? (Number(keys[index]) / 30) * plotW : (index / (keys.length - 1)) * plotW);
    const upperBounds = keys.flatMap((key) => (values[key] || []).filter((row) => Number.isFinite(row.percent)).map((row) => row.percent + (row.sem || 0)));
    const max = niceCeiling(Math.max(1, ...upperBounds), 100);
    const tickStep = max <= 20 ? 5 : max <= 100 ? 10 : 20;
    const y = (value) => top + plotH - (value / max) * plotH;
    const grid = axisTicks(max, tickStep).map((tick) => {
      const y = top + plotH - (tick / max) * plotH;
      return `<line class="tick-mark" x1="${left - 4}" y1="${y}" x2="${left}" y2="${y}"/><text x="${left - 8}" y="${y + 3}" text-anchor="end">${tick}</text>`;
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
      return `<polyline points="${pointString}" fill="none" stroke="${CLASS_COLORS[name]}" stroke-width="2.2" ${name === "fucosylated_and_sialylated" ? 'stroke-dasharray="6 4"' : ""} stroke-linejoin="round" stroke-linecap="round"/>${errorBars}${marks}`;
    }).join("");
    const xLabels = labels.map((label, index) => ageTick(label, x(index), top + plotH + 22, keys.length > 5)).join("");
    dom.classChart.innerHTML = `<svg viewBox="0 0 ${w} ${h}" data-plot-width="${plotW}" data-plot-height="${plotH}" data-y-max="${max}" role="img" aria-label="Mean glycan type composition ± SEM across age groups"><defs><linearGradient id="dual-glycan"><stop offset="50%" stop-color="#CD4D2C"/><stop offset="50%" stop-color="#A34599"/></linearGradient></defs><text class="axis-label" transform="translate(13 ${top + plotH / 2}) rotate(-90)" text-anchor="middle">Composition (%)</text>${grid}<line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${top + plotH}"/><line class="axis" x1="${left}" y1="${top + plotH}" x2="${w - right}" y2="${top + plotH}"/>${series}${xLabels}<text class="axis-label" x="${left + plotW / 2}" y="${h - 4}" text-anchor="middle">${numeric ? "Age (months)" : "Age bin"}</text></svg>`;
    dom.classLegend.innerHTML = classes.map((name) => `<span class="legend-item"><i class="legend-line ${name === "fucosylated_and_sialylated" ? "combined" : ""}" style="--legend-color:${CLASS_COLORS[name]}"></i>${escapeHTML(CLASS_LABELS[name] || name)}</span>`).join("");
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
    const x = (age) => left + (Number(age) / 30) * plotW;
    const y = (value) => top + ((max - value) / range) * plotH;
    const ticks = axisTicks(max, max <= 2 ? .5 : 1).filter((tick) => tick >= min);
    const grid = ticks.map((tick) => `<line class="tick-mark" x1="${left - 4}" y1="${y(tick)}" x2="${left}" y2="${y(tick)}"/><text x="${left - 8}" y="${y(tick) + 3}" text-anchor="end">${tick.toFixed(tick % 1 ? 1 : 0)}</text>`).join("");
    const paths = series.map(({ organ, rows }) => {
      const valid = rows.filter((row) => Number.isFinite(row.mean));
      const points = valid.map((row) => `${x(row.age)},${y(row.mean)}`).join(" ");
      const marks = valid.map((row) => {
        const px = x(row.age), py = y(row.mean), sem = row.sem || 0;
        const y1 = y(Math.min(max, row.mean + sem)), y2 = y(Math.max(min, row.mean - sem));
        return `<path d="M${px},${y1}V${y2}M${px - 3},${y1}H${px + 3}M${px - 3},${y2}H${px + 3}" stroke="${ORGAN_COLORS[organ]}" stroke-width="1"/><circle cx="${px}" cy="${py}" r="3" fill="${ORGAN_COLORS[organ]}" data-tooltip="${escapeHTML(`${ORGAN_LABELS[organ]} · ${row.age} months · mean ${row.mean.toFixed(3)} ± ${sem.toFixed(3)} SEM · n=${row.n}${row.n <= 2 ? " *" : ""}`)}"></circle>`;
      }).join("");
      return `<polyline points="${points}" fill="none" stroke="${ORGAN_COLORS[organ]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${marks}`;
    }).join("");
    const ages = [...new Set(series.flatMap(({ rows }) => rows.map((row) => Number(row.age))))].sort((a, b) => a - b);
    const xLabels = ages.map((age) => ageTick(`${age}`, x(age), top + plotH + 22, ages.length > 5)).join("");
    dom.proteinChart.innerHTML = `<svg viewBox="0 0 ${w} ${h}" data-plot-width="${plotW}" data-plot-height="${plotH}" data-y-max="${max}" role="img" aria-label="Scaled protein abundance by age, mean ± SEM"><text class="axis-label" transform="translate(13 ${top + plotH / 2}) rotate(-90)" text-anchor="middle">Scaled protein abundance</text>${grid}<line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${top + plotH}"/><line class="axis" x1="${left}" y1="${top + plotH}" x2="${w - right}" y2="${top + plotH}"/>${paths}${xLabels}<text class="axis-label" x="${left + plotW / 2}" y="${h - 4}" text-anchor="middle">Age (months)</text></svg>`;
    dom.proteinLegend.innerHTML = series.map(({ organ, rows }) => `<span class="legend-item"><i class="legend-line" style="--legend-color:${ORGAN_COLORS[organ]}"></i>${ORGAN_LABELS[organ]}${Math.max(...rows.map((row) => row.n || 0)) <= 2 ? " *" : ""}</span>`).join("") + `<span class="legend-note">Mean ± SEM; * 1–2 detected replicates</span>`;
  }

  function renderShannonChart(site) {
    if (!site) return;
    const { keys, labels, numeric } = ageSpec(site);
    const rows = new Map((site.shannon?.[state.ageMode] || []).map((row) => [String(row.key), row]));
    const pooled = state.diversityGrouping === "pooled" || (state.diversityGrouping === "auto" && (site.site_psm_depth_tier || 0) < 4);
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
    const x = (index) => left + (keys.length === 1 ? plotW / 2 : numeric ? Number(keys[index]) / 30 * plotW : index / (keys.length - 1) * plotW);
    const y = (v) => top + plotH - v / max * plotH;
    const grid = axisTicks(max, step).map((tick) => `<line class="tick-mark" x1="${left - 4}" y1="${y(tick)}" x2="${left}" y2="${y(tick)}"/><text x="${left - 8}" y="${y(tick) + 3}" text-anchor="end">${tick}</text>`).join("");
    const points = valid.map(({ index, row }) => `${x(index)},${y(value(row))}`).join(" ");
    const marks = valid.map(({ index, row }) => {
      const px = x(index), py = y(value(row)), sem = pooled ? null : row[semField];
      const error = Number.isFinite(sem) ? `<path d="M${px},${y(Math.min(max, value(row) + sem))}V${y(Math.max(0, value(row) - sem))}" stroke="#28768a"/>` : "";
      const tooltip = `${labels[index]} · ${pooled ? "pooled PSMs" : "mean across detected samples"} · ${effective ? "weighted glycan types" : "Shannon H"} ${value(row).toFixed(3)}${Number.isFinite(sem) ? ` ± ${sem.toFixed(3)} SEM` : ""} · ${pooled ? row.pooled.glycosite_psms + " PSMs" : "n=" + row.n}`;
      return `${error}<circle cx="${px}" cy="${py}" r="3.4" fill="#28768a" data-tooltip="${escapeHTML(tooltip)}"></circle>`;
    }).join("");
    const xLabels = labels.map((label, index) => ageTick(label, x(index), top + plotH + 22, keys.length > 5)).join("");
    const axisTitle = effective ? "Weighted glycan types" : "Shannon H";
    dom.shannonChart.innerHTML = `<svg viewBox="0 0 ${w} ${h}" data-y-max="${max}" role="img" aria-label="${axisTitle} with age"><text class="axis-label" transform="translate(13 ${top + plotH / 2}) rotate(-90)" text-anchor="middle">${axisTitle}</text>${grid}<line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${top + plotH}"/><line class="axis" x1="${left}" y1="${top + plotH}" x2="${w - right}" y2="${top + plotH}"/><polyline points="${points}" fill="none" stroke="#28768a" stroke-width="2.2"/>${marks}${xLabels}<text class="axis-label" x="${left + plotW / 2}" y="${h - 4}" text-anchor="middle">${numeric ? "Age (months)" : "Age bin"}</text></svg>`;
    dom.shannonLegend.innerHTML = `<span class="legend-item"><i class="legend-line" style="--legend-color:#28768a"></i>${pooled ? "Pooled PSMs (no SEM)" : "Mean across samples ± SEM"}</span>`;
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
    const score = (name) => Math.max(0, ...byAge.map((rows) => rows.get(name)?.percent || 0));
    names.sort((a, b) => score(b) - score(a) || a.localeCompare(b));
    if (!names.length) {
      dom.exactGrid.innerHTML = `<p class="empty-note">No exact glycans detected.</p>`;
      return;
    }
    const maxPercent = Math.max(0, ...byAge.flatMap((rows) => [...rows.values()].map((row) => row.percent || 0)));
    const scaleMax = Math.min(100, Math.max(5, Math.ceil(maxPercent / (maxPercent <= 20 ? 5 : 10)) * (maxPercent <= 20 ? 5 : 10)));
    const scale = document.querySelector("[data-exact-scale]");
    scale.innerHTML = `<span>0%</span><i></i><span>${scaleMax}%</span>`;
    scale.setAttribute("aria-label", `Percent abundance: 0 to ${scaleMax} percent`);
    const siteCoverage = new Map((site.shannon?.ages || []).map((row) => [String(row.key), row.n || 0]));
    const header = `<div class="exact-age-heading">Age (months)</div><div class="exact-row exact-head"><span class="exact-name">Composition</span>${keys.map((key) => `<span class="exact-header">${escapeHTML(key)}</span>`).join("")}</div>`;
    const rows = names.map((name) => {
      const type = byAge.map((rows) => rows.get(name)?.glycan_type).find(Boolean) || "undecorated";
      const cells = byAge.map((ageRows, index) => {
        const row = ageRows.get(name);
        const detected = (siteCoverage.get(keys[index]) || 0) > 0;
        const percent = row?.percent ?? 0;
        const psm = detected ? row?.psm ?? 0 : null;
        const alpha = detected ? .07 + Math.min(scaleMax, Math.max(0, percent)) / scaleMax * .9 : 0;
        const ageText = `${keys[index]} ${keys[index] === "1" ? "month" : "months"}`;
        const tooltip = `${name} · ${CLASS_LABELS[type] || type} · ${ageText} · ${psm === null ? "Site not detected" : `${percent.toFixed(1)}% mean abundance · ${formatNumber(psm)} ${psm === 1 ? "PSM" : "PSMs"}`}`;
        return `<button type="button" class="exact-cell ${detected ? "" : "missing"}" style="background:rgba(65,104,185,${alpha})" aria-label="${escapeHTML(tooltip)}" data-tooltip="${escapeHTML(tooltip)}"><span class="exact-value" style="color:${percent > scaleMax * .55 ? "#fff" : "#40516f"}">${detected ? `${percent.toFixed(1)}%` : "—"}</span></button>`;
      }).join("");
      const shortName = name.replace(/HexNAc\((\d+)\)/g, "N$1 ").replace(/Hex\((\d+)\)/g, "H$1 ").replace(/Fuc\((\d+)\)/g, "F$1 ").replace(/NeuAc\((\d+)\)/g, "A$1 ").replace(/NeuGc\((\d+)\)/g, "G$1 ").replace(/Phospho\((\d+)\)/g, "P$1 ").trim();
      return `<div class="exact-row"><span class="exact-name" title="${escapeHTML(name)}"><i class="legend-swatch" style="background:${classPaint(type)}"></i>${escapeHTML(shortName)}</span>${cells}</div>`;
    }).join("");
    dom.exactGrid.innerHTML = header + rows;
    dom.exactGrid.style.setProperty("--exact-columns", keys.length);
    dom.exactGrid.classList.toggle("show-values", dom.exactGrid.querySelector(".exact-cell").clientWidth >= 48);
  }

  function renderPairwise(site) {
    if (!site) { dom.pairwiseList.innerHTML = `<p class="empty-note">Select a glycosite to compare.</p>`; return; }
    const siteFor = (organ, id) => (state.currentProtein.organs[organ]?.glycosites || []).find((row) => row.id === id);
    const crossOrgans = ORGANS.filter((organ) => siteFor(organ, site.id)?.glycan_classes?.pooled?.length);
    const sameOrganSites = state.currentProtein.organs[state.activeOrgan]?.glycosites || [];
    state.pairOrganA = state.activeOrgan;
    state.pairOrganB = crossOrgans.includes(state.pairOrganB) && state.pairOrganB !== state.pairOrganA ? state.pairOrganB : crossOrgans.find((organ) => organ !== state.pairOrganA);
    state.pairSiteB = sameOrganSites.some((row) => row.id === state.pairSiteB && row.id !== site.id) ? state.pairSiteB : sameOrganSites.find((row) => row.id !== site.id)?.id;
    const sameOrgan = state.pairMode === "between_sites";
    const a = site;
    const b = sameOrgan ? siteFor(state.activeOrgan, state.pairSiteB) : siteFor(state.pairOrganB, site.id);
    const selector = `<div class="pairwise-controls"><label>Compare<select data-pair-mode><option value="between_organs" ${sameOrgan ? "" : "selected"}>Same site · different datasets</option><option value="between_sites" ${sameOrgan ? "selected" : ""}>Same dataset · different sites</option></select></label>${sameOrgan ? `<label>Second glycosite<select data-pair-site>${sameOrganSites.filter((row) => row.id !== site.id).map((row) => `<option value="${escapeHTML(row.id)}" ${row.id === state.pairSiteB ? "selected" : ""}>N${row.position}</option>`).join("")}</select></label>` : `<label>Second dataset<select data-pair-organ-b>${crossOrgans.filter((organ) => organ !== state.activeOrgan).map((organ) => `<option value="${organ}" ${organ === state.pairOrganB ? "selected" : ""}>${ORGAN_LABELS[organ]}</option>`).join("")}</select></label>`}</div>`;
    if (!b) {
      dom.pairwiseList.innerHTML = `${selector}<p class="empty-note">No second ${sameOrgan ? "site" : "dataset"} is available for this comparison.</p>`;
    } else {
      const vectorA = pooledClassVector(a), vectorB = pooledClassVector(b);
      const labelA = `${ORGAN_LABELS[state.activeOrgan]} | N${a.position}`;
      const labelB = sameOrgan ? `${ORGAN_LABELS[state.activeOrgan]} | N${b.position}` : `${ORGAN_LABELS[state.pairOrganB]} | N${b.position}`;
      const classNames = orderedClasses([...new Set([...vectorA.keys(), ...vectorB.keys()])]);
      const totalVariation = classNames.reduce((sum, name) => sum + Math.abs((vectorA.get(name) || 0) - (vectorB.get(name) || 0)), 0) / 2;
      const bar = (vector, label) => `<div class="comparison-profile"><strong>${escapeHTML(label)}</strong><div class="composition-bar">${classNames.map((name) => `<i style="width:${vector.get(name) || 0}%;background:${classPaint(name)}"></i>`).join("")}</div></div>`;
      const metric = (label, left, right) => `<div><span>${label}</span><strong>${left} / ${right}</strong></div>`;
      const statsA = a.shannon?.pooled_all || {}, statsB = b.shannon?.pooled_all || {};
      const fmt = (value, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : "—";
      const dominant = (row) => row.dominant_class ? `${CLASS_LABELS[row.dominant_class.name]} ${fmt(row.dominant_class.percent, 1)}%` : "—";
      const tableRows = classNames.map((name) => {
        const valueA = vectorA.get(name) || 0, valueB = vectorB.get(name) || 0;
        return `<tr><th><i class="legend-swatch" style="background:${classPaint(name)}"></i>${escapeHTML(CLASS_LABELS[name] || name)}</th><td>${fmt(valueA, 1)}%</td><td>${fmt(valueB, 1)}%</td><td>${valueB - valueA >= 0 ? "+" : ""}${fmt(valueB - valueA, 1)} pp</td></tr>`;
      }).join("");
      dom.pairwiseList.innerHTML = `${selector}<p class="pairwise-intro">All-age PSM-pooled composition. Difference is ${escapeHTML(labelB)} − ${escapeHTML(labelA)}.</p><div class="comparison-bars">${bar(vectorA, labelA)}${bar(vectorB, labelB)}</div><div class="comparison-metrics">${metric("Pooled glycan-type Shannon H", fmt(statsA.glycan_type_shannon_h), fmt(statsB.glycan_type_shannon_h))}${metric("Observed glycan types", formatNumber(statsA.observed_glycan_types), formatNumber(statsB.observed_glycan_types))}${metric("Weighted glycan types", fmt(statsA.effective_glycan_types), fmt(statsB.effective_glycan_types))}${metric("Dominant glycan type", dominant(a), dominant(b))}<div class="comparison-distance"><span>Composition percent difference (TVD)</span><strong>${fmt(totalVariation, 1)}%</strong><div class="distance-track"><i style="width:${Math.min(100, totalVariation)}%"></i></div></div></div><div class="comparison-table-wrap"><table><thead><tr><th>Glycan type</th><th>${escapeHTML(labelA)}</th><th>${escapeHTML(labelB)}</th><th>B − A</th></tr></thead><tbody>${tableRows}</tbody></table></div>`;
    }
    dom.pairwiseList.querySelector("[data-pair-mode]")?.addEventListener("change", (event) => { state.pairMode = event.target.value; renderPairwise(site); });
    dom.pairwiseList.querySelector("[data-pair-organ-b]")?.addEventListener("change", (event) => { state.pairOrganB = event.target.value; renderPairwise(site); });
    dom.pairwiseList.querySelector("[data-pair-site]")?.addEventListener("change", (event) => { state.pairSiteB = event.target.value; renderPairwise(site); });
  }

  function pooledClassVector(site) {
    return new Map((site?.glycan_classes?.pooled || []).map((row) => [row.name, row.percent]));
  }

  async function loadTVD() {
    if (!state.tvdManifest) {
      state.tvdManifest = await fetchJSON("data/tvd/index.json");
      const comparisons = state.tvdManifest.comparisons;
      const datasets = [...new Set(comparisons.map((row) => row.dataset))];
      dom.tvdDataset.innerHTML = datasets.map((dataset) => `<option value="${dataset}">${ORGAN_LABELS[dataset.replace(/^atlas_/, "")] || dataset}</option>`).join("");
      [dom.tvdDataset, dom.tvdFamily, dom.tvdComparison].forEach((select) => select.addEventListener("change", updateTVDControls));
      dom.tvdSearch.addEventListener("input", renderTVDPlot);
      document.querySelectorAll("[data-tvd-zoom]").forEach((button) => button.addEventListener("click", () => {
        state.tvdZoom = button.dataset.tvdZoom === "reset" ? 1 : Math.max(1, Math.min(8, (state.tvdZoom || 1) * Number(button.dataset.tvdZoom)));
        renderTVDPlot();
      }));
    }
    updateTVDControls();
  }

  async function updateTVDControls(event) {
    const comparisons = state.tvdManifest.comparisons.filter((row) => row.dataset === dom.tvdDataset.value);
    const families = [...new Set(comparisons.map((row) => row.family))];
    if (!families.includes(dom.tvdFamily.value)) dom.tvdFamily.value = families[0];
    dom.tvdFamily.innerHTML = families.map((family) => `<option value="${family}" ${family === dom.tvdFamily.value ? "selected" : ""}>${family === "age_bins" ? "Age bins" : "Individual ages"}</option>`).join("");
    const available = comparisons.filter((row) => row.family === dom.tvdFamily.value);
    const selected = available.some((row) => row.comparison === dom.tvdComparison.value) ? dom.tvdComparison.value : available[0]?.comparison;
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
    const rows = state.tvdRows.filter((row) => {
      const gene = state.byProtein.get(row.protein_id)?.gene || "";
      return !query || normalize(`${row.protein_id} ${row.glycosite} ${gene}`).includes(query);
    });
    const w = Math.max(640, dom.tvdPlot.clientWidth), h = 480, left = 68, right = 26, top = 25, bottom = 58;
    const width = w - left - right, height = h - top - bottom;
    const zoom = state.tvdZoom || 1;
    const maxX = Math.max(5, Math.ceil(Math.max(0, ...state.tvdRows.map((row) => row.percent_difference)) / 5) * 5) / zoom;
    const maxY = Math.max(2, Math.ceil(Math.max(0, ...state.tvdRows.map((row) => row.neg_log10_p_value)))) / zoom;
    const x = (value) => left + value / maxX * width;
    const y = (value) => top + height - value / maxY * height;
    const dots = rows.filter((row) => row.percent_difference <= maxX && row.neg_log10_p_value <= maxY).map((row) => {
      const gene = state.byProtein.get(row.protein_id)?.gene || row.protein_id;
      const tooltip = `${gene} · ${row.glycosite} · ${row.percent_difference.toFixed(1)}% difference · p=${Number(row.p_value).toExponential(2)} · n=${row.n_a}/${row.n_b} detected samples`;
      return `<circle cx="${x(row.percent_difference)}" cy="${y(row.neg_log10_p_value)}" r="5" fill="${row.p_value < .05 ? "#CD4D2C" : "#78909b"}" fill-opacity=".72" data-tvd-protein="${escapeHTML(row.protein_id)}" data-tvd-site="${escapeHTML(row.site_key)}" data-tvd-dataset="${dom.tvdDataset.value.replace(/^atlas_/, "")}" data-tooltip="${escapeHTML(tooltip)}" tabindex="0" role="button"></circle>`;
    }).join("");
    const xTicks = axisTicks(maxX, maxX <= 20 ? 5 : 10).map((tick) => `<text x="${x(tick)}" y="${top + height + 20}" text-anchor="middle">${tick}</text>`).join("");
    const yTicks = axisTicks(maxY, maxY <= 6 ? 1 : 2).map((tick) => `<text x="${left - 9}" y="${y(tick) + 4}" text-anchor="end">${tick}</text>`).join("");
    dom.tvdPlot.innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="TVD site percent difference versus negative log10 raw p value"><line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${top + height}"/><line class="axis" x1="${left}" y1="${top + height}" x2="${left + width}" y2="${top + height}"/><line class="tvd-threshold" x1="${left}" y1="${y(-Math.log10(.05))}" x2="${left + width}" y2="${y(-Math.log10(.05))}"/>${dots}${xTicks}${yTicks}<text class="axis-label" x="${left + width / 2}" y="${h - 9}" text-anchor="middle">Glycan-type composition percent difference (TVD)</text><text class="axis-label" transform="translate(18 ${top + height / 2}) rotate(-90)" text-anchor="middle">−log₁₀(raw p value)</text></svg><p class="tvd-count">${formatNumber(rows.length)} tested sites · orange: raw p &lt; 0.05 · click a point to open its glycosite.</p>`;
    dom.tvdPlot.querySelectorAll("[data-tvd-protein]").forEach((dot) => {
      const open = async () => {
        const row = state.byProtein.get(dot.dataset.tvdProtein);
        if (!row) return;
        await openProtein(row);
        state.activeOrgan = dot.dataset.tvdDataset;
        state.selectedSites[state.activeOrgan] = dot.dataset.tvdSite;
        renderSegmentOverlay();
        renderDetail();
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
  }

  function bindTooltip() {
    document.addEventListener("pointerover", (event) => {
      const target = event.target.closest("[data-tooltip]");
      if (!target) return;
      renderTooltip(target);
      dom.tooltip.hidden = false;
      positionTooltip(event);
    });
    document.addEventListener("pointermove", (event) => {
      if (!dom.tooltip.hidden) positionTooltip(event);
    });
    document.addEventListener("pointerout", (event) => {
      if (event.target.closest("[data-tooltip]")) dom.tooltip.hidden = true;
    });
    document.addEventListener("focusin", (event) => {
      const target = event.target.closest("[data-tooltip]");
      if (!target) return;
      const box = target.getBoundingClientRect();
      renderTooltip(target);
      dom.tooltip.hidden = false;
      positionTooltip({ clientX: box.left + box.width / 2, clientY: box.top });
    });
    document.addEventListener("focusout", () => { dom.tooltip.hidden = true; });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") dom.tooltip.hidden = true; });
  }

  function positionTooltip(event) {
    const x = Math.max(8, Math.min(window.innerWidth - dom.tooltip.offsetWidth - 8, event.clientX + 12));
    const preferredY = event.clientY - dom.tooltip.offsetHeight - 12;
    const y = Math.max(8, Math.min(window.innerHeight - dom.tooltip.offsetHeight - 8, preferredY >= 8 ? preferredY : event.clientY + 16));
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
