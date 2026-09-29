(() => {
  "use strict";

  const ORGANS = ["brain", "kidney", "liver", "plasma", "spleen"];
  const AGE_MONTHS = [1, 3, 6, 9, 12, 16, 19, 22, 28];
  const AGE_BINS = ["Y", "MA", "O"];
  const AGE_BIN_LABELS = { Y: "Young", MA: "Middle-aged", O: "Old" };
  const PAGE_TITLES = {
    overview: "Overview",
    methods: "Methods",
    learning: "Learning",
    publications: "Publications",
    "raw-data": "Raw data",
    contact: "Contact",
  };
  const { CLASS_ORDER, CLASS_LABELS, CLASS_COLORS, ORGAN_COLORS, DIVERSITY_LABEL } = window.ATLAS_THEME;
  const EXPLORER_BUILD = "2026-09-04b";
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
        dom.loading.innerHTML = `<p>This protein is not present in the July 30 atlas release. Please choose another result.</p>`;
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
    return state.searchIndex
      .map((row) => ({ row, score: matchScore(row, q) }))
      .filter(({ score }) => Number.isFinite(score))
      .sort((a, b) => a.score - b.score || normalize(a.row.gene).localeCompare(normalize(b.row.gene)) || a.row.protein_id.localeCompare(b.row.protein_id))
      .slice(0, limit)
      .map(({ row }) => row);
  }

  function matchScore(row, q) {
    const gene = normalize(row.gene);
    const protein = normalize(row.protein_id);
    const description = normalize(row.description);
    if (gene === q || protein === q) return 0;
    if (gene.startsWith(q)) return 1;
    if (protein.startsWith(q)) return 2;
    if (gene.includes(q)) return 3;
    if (protein.includes(q)) return 4;
    if (description.includes(q)) return 6;
    return Infinity;
  }

  function findExact(value) {
    const q = normalize(value);
    return state.searchIndex.find((row) => normalize(row.gene) === q || normalize(row.protein_id) === q);
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
          return `<span class="composition-tile uncovered" style="left:${left}%" aria-label="${escapeHTML(`${organ}, ${summary.label}: not detected`)}"></span>`;
        }
        const compositionVector = pooledClassVector(site);
        const rows = orderedClasses([...compositionVector.keys()]).map((name) => ({ name, percent: compositionVector.get(name) }));
        const segments = rows.filter((row) => row.percent > 0).map((row) => `<i style="width:${Math.max(0, Math.min(100, row.percent))}%;background:${classPaint(row.name)}"></i>`).join("");
        const selected = state.activeOrgan === organ && selectedSite(organ)?.id === site.id;
        return `<button type="button" class="composition-tile ${site.comparison_eligible ? "" : "low"} ${rows.length ? "" : "no-composition"} ${selected ? "selected" : ""}" style="left:${left}%" data-overlay-site="${escapeHTML(site.id)}" data-overlay-organ="${organ}" data-tooltip="Site composition">${segments}<span class="sr-only">${escapeHTML(`${organ} ${site.label}${site.comparison_eligible ? "" : ", low confidence"}`)}</span></button>`;
      }).join("");
      return `<div class="segment-organ-row"><strong style="color:${ORGAN_COLORS[organ]}">${organ}</strong><div class="segment-space">${tiles}</div></div>`;
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
    dom.segmentLegend.innerHTML = orderedClasses(classNames).map((name) => `<span class="legend-item"><i class="legend-swatch" style="background:${classPaint(name)}"></i>${escapeHTML(CLASS_LABELS[name] || name)}</span>`).join("");
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
  }

  function renderDetail() {
    const organ = state.activeOrgan;
    const site = selectedSite(organ);
    document.querySelector("[data-detail-site]").textContent = site ? (site.position ? `${state.currentProtein.gene} N${site.position}` : site.label) : "No glycosite selected";
    const note = document.querySelector("[data-confidence-note]");
    note.classList.toggle("low", Boolean(site && !site.comparison_eligible));
    note.textContent = !site
      ? `${state.currentProtein.protein_id} · glycan data were not detected for the selected organ.`
      : site.comparison_eligible
        ? `${state.currentProtein.protein_id} · ${organ} · high confidence · total PSM ${formatNumber(site.total_psm)}`
        : `${state.currentProtein.protein_id} · ${organ} · low confidence* · total PSM ${formatNumber(site.total_psm)} · excluded from cross-organ comparison`;
    renderSiteControls(site);
    renderSiteMetrics(site);
    renderDetailCharts();
    renderPairwise(site);
  }

  function renderSiteControls(site) {
    const glycoOrgans = ORGANS.filter((organ) => state.currentProtein.organs[organ]?.glycosites?.length);
    const availableOrgans = glycoOrgans.length ? glycoOrgans : ORGANS.filter((organ) => state.currentProtein.organs[organ]?.proteome);
    if (!availableOrgans.includes(state.activeOrgan)) state.activeOrgan = availableOrgans[0] || "brain";
    dom.organSelect.innerHTML = availableOrgans.map((organ) => `<option value="${organ}" ${organ === state.activeOrgan ? "selected" : ""}>${organ[0].toUpperCase()}${organ.slice(1)}</option>`).join("");
    dom.organSelect.disabled = availableOrgans.length < 2;
    const sites = state.currentProtein.organs[state.activeOrgan]?.glycosites || [];
    dom.siteSelect.innerHTML = sites.length
      ? sites.map((row) => `<option value="${escapeHTML(row.id)}" ${site?.id === row.id ? "selected" : ""}>${escapeHTML(row.position ? `N${row.position}` : row.label)}${row.comparison_eligible ? "" : " *"}</option>`).join("")
      : `<option value="">No glycosites</option>`;
    dom.siteSelect.disabled = !sites.length;
  }

  function renderSiteMetrics(site) {
    if (!site) {
      dom.siteMetrics.innerHTML = `<p class="proteomics-only-note"><strong>Proteomics-only record.</strong> This protein remains searchable because normalized abundance is available even though no glycosite passed into the current display payload.</p>`;
      return;
    }
    const sampleRows = (site.shannon?.ages || []).filter((row) => Number.isFinite(row.mean) && row.n > 0);
    const detected = sampleRows.reduce((total, row) => total + row.n, 0);
    const meanH = detected ? sampleRows.reduce((total, row) => total + row.mean * row.n, 0) / detected : null;
    const exactNames = new Set(Object.values(site.exact_compositions?.ages || {}).flatMap((rows) => rows.map((row) => row.name)));
    const classTotals = new Map();
    let classGroups = 0;
    Object.values(site.glycan_classes?.ages || {}).forEach((rows) => {
      if (!rows.length) return;
      classGroups += 1;
      rows.forEach((row) => classTotals.set(row.name, (classTotals.get(row.name) || 0) + row.percent));
    });
    const dominant = [...classTotals.entries()].sort((a, b) => b[1] - a[1])[0];
    const dominantText = dominant ? `${CLASS_LABELS[dominant[0]] || dominant[0]} ${(dominant[1] / Math.max(1, classGroups)).toFixed(1)}%` : "—";
    const metrics = [
      ["Detected samples", `${detected}/54`],
      [`Mean sample ${DIVERSITY_LABEL}`, meanH === null ? "—" : meanH.toFixed(3)],
      ["Effective classes", meanH === null ? "—" : Math.exp(meanH).toFixed(2)],
      ["Dominant class", dominantText],
      ["Exact glycans", site.exact_compositions ? formatNumber(exactNames.size) : "Unavailable"],
      ["Site evidence", `${formatNumber(site.total_psm)} PSM · ${site.comparison_eligible ? "high confidence" : "low confidence*"}`],
    ];
    dom.siteMetrics.innerHTML = metrics.map(([label, value]) => `<div><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`).join("");
  }

  function renderDetailCharts() {
    const site = selectedSite(state.activeOrgan);
    const modeLabel = "";
    document.querySelector("[data-diversity-title]").textContent = DIVERSITY_LABEL;
    document.querySelector("[data-glycan-mode-label]").textContent = modeLabel;
    document.querySelector("[data-shannon-mode-label]").textContent = modeLabel;
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
    const w = container.clientWidth;
    const left = 76, right = 24, top = 18, bottom = 72;
    const plotW = Math.max(50, w - left - right);
    const plotH = plotW * 2;
    const h = top + plotH + bottom;
    container.style.height = `${h}px`;
    return { w, h, left, right, top, plotW, plotH };
  }

  function ageTick(label, x, y, rotate) {
    return `<text class="age-tick" x="${x}" y="${y}" ${rotate ? `transform="rotate(-60 ${x} ${y})" text-anchor="end"` : 'text-anchor="middle"'}>${escapeHTML(label.replace("Middle-aged", "Adult"))}</text>`;
  }

  function renderClassChart(site) {
    const values = site.glycan_classes?.[state.ageMode] || {};
    const keys = state.ageMode === "age_bins" ? AGE_BINS : AGE_MONTHS.map(String);
    const labels = state.ageMode === "age_bins" ? AGE_BINS.map((key) => AGE_BIN_LABELS[key]) : AGE_MONTHS.map((age) => `${age}M`);
    const classes = CLASS_ORDER.filter((name) => keys.some((key) => (values[key] || []).some((row) => row.name === name && row.percent > 0)));
    if (!classes.length) {
      dom.classChart.innerHTML = `<p class="empty-note">No glycan-class composition is available for this site and grouping.</p>`;
      dom.classLegend.innerHTML = "";
      return;
    }
    const { w, h, left, right, top, plotW, plotH } = chartGeometry(dom.classChart);
    const x = (index) => left + (keys.length === 1 ? plotW / 2 : (index / (keys.length - 1)) * plotW);
    const upperBounds = keys.flatMap((key) => (values[key] || []).filter((row) => Number.isFinite(row.percent)).map((row) => row.percent + (row.sem || 0)));
    const max = Math.max(1, ...upperBounds) * 1.08;
    const y = (value) => top + plotH - (value / max) * plotH;
    const grid = [0, max / 2, max].map((tick) => {
      const y = top + plotH - (tick / max) * plotH;
      return `<line class="gridline" x1="${left}" y1="${y}" x2="${w - right}" y2="${y}"/><text x="${left - 8}" y="${y + 3}" text-anchor="end">${tick.toFixed(1)}</text>`;
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
        return `<circle cx="${x(point.index)}" cy="${y(point.percent)}" r="3.2" fill="${CLASS_COLORS[name]}" data-tooltip="${escapeHTML(`${labels[point.index]} · ${CLASS_LABELS[name]} ${point.percent.toFixed(1)}%${uncertainty}${sampleSize}`)}"></circle>`;
      }).join("");
      return `<polyline points="${pointString}" fill="none" stroke="${CLASS_COLORS[name]}" stroke-width="2.2" ${name === "fucosylated_and_sialylated" ? 'stroke-dasharray="6 4"' : ""} stroke-linejoin="round" stroke-linecap="round"/>${errorBars}${marks}`;
    }).join("");
    const xLabels = labels.map((label, index) => ageTick(label, x(index), top + plotH + 22, keys.length > 3)).join("");
    dom.classChart.innerHTML = `<svg viewBox="0 0 ${w} ${h}" data-plot-width="${plotW}" data-plot-height="${plotH}" data-y-max="${max}" role="img" aria-label="Mean glycan class composition across age groups"><text class="axis-label" transform="translate(13 ${top + plotH / 2}) rotate(-90)" text-anchor="middle">Composition (%)</text>${grid}<line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${top + plotH}"/><line class="axis" x1="${left}" y1="${top + plotH}" x2="${w - right}" y2="${top + plotH}"/>${series}${xLabels}</svg>`;
    dom.classLegend.innerHTML = classes.map((name) => `<span class="legend-item"><i class="legend-swatch" style="background:${classPaint(name)}"></i>${escapeHTML(CLASS_LABELS[name] || name)}</span>`).join("");
  }

  function renderProteinChart() {
    const series = ORGANS.map((organ) => ({ organ, rows: state.currentProtein.organs[organ]?.proteome?.scaled_intensity || [] }))
      .filter(({ rows }) => rows.some((row) => Number.isFinite(row.mean)));
    if (!series.length) {
      dom.proteinChart.innerHTML = `<p class="empty-note">Normalized protein abundance is not available for this protein.</p>`;
      dom.proteinLegend.innerHTML = "";
      return;
    }
    const values = series.flatMap(({ rows }) => rows.filter((row) => Number.isFinite(row.mean)).flatMap((row) => [row.mean - (row.sem || 0), row.mean + (row.sem || 0)]));
    const rawMin = Math.min(...values), rawMax = Math.max(...values);
    const min = rawMin >= 0 ? 0 : rawMin - Math.max(.02, (rawMax - rawMin) * .08);
    const max = rawMax + Math.max(.02, (rawMax - min) * .06);
    const range = Math.max(.01, max - min);
    const { w, h, left, right, top, plotW, plotH } = chartGeometry(dom.proteinChart);
    const x = (age) => left + (AGE_MONTHS.indexOf(Number(age)) / (AGE_MONTHS.length - 1)) * plotW;
    const y = (value) => top + ((max - value) / range) * plotH;
    const ticks = [min, min + range / 2, max];
    const grid = ticks.map((tick) => `<line class="gridline" x1="${left}" y1="${y(tick)}" x2="${w - right}" y2="${y(tick)}"/><text x="${left - 8}" y="${y(tick) + 3}" text-anchor="end">${tick.toFixed(2)}</text>`).join("");
    const paths = series.map(({ organ, rows }) => {
      const valid = rows.filter((row) => Number.isFinite(row.mean));
      const points = valid.map((row) => `${x(row.age)},${y(row.mean)}`).join(" ");
      const marks = valid.map((row) => {
        const px = x(row.age), py = y(row.mean), sem = row.sem || 0;
        const y1 = y(Math.min(max, row.mean + sem)), y2 = y(Math.max(min, row.mean - sem));
        return `<path d="M${px},${y1}V${y2}M${px - 3},${y1}H${px + 3}M${px - 3},${y2}H${px + 3}" stroke="${ORGAN_COLORS[organ]}" stroke-width="1"/><circle cx="${px}" cy="${py}" r="3" fill="${ORGAN_COLORS[organ]}" data-tooltip="${escapeHTML(`${organ} · ${row.age}M · ${row.mean.toFixed(3)} ± ${sem.toFixed(3)} · n=${row.n}`)}"></circle>`;
      }).join("");
      return `<polyline points="${points}" fill="none" stroke="${ORGAN_COLORS[organ]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${marks}`;
    }).join("");
    const xLabels = AGE_MONTHS.map((age) => ageTick(`${age}M`, x(age), top + plotH + 22, true)).join("");
    dom.proteinChart.innerHTML = `<svg viewBox="0 0 ${w} ${h}" data-plot-width="${plotW}" data-plot-height="${plotH}" data-y-max="${max}" role="img" aria-label="Normalized protein scaled intensity by age"><text class="axis-label" transform="translate(13 ${top + plotH / 2}) rotate(-90)" text-anchor="middle">Scaled intensity</text>${grid}<line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${top + plotH}"/><line class="axis" x1="${left}" y1="${top + plotH}" x2="${w - right}" y2="${top + plotH}"/>${paths}${xLabels}</svg>`;
    dom.proteinLegend.innerHTML = series.map(({ organ }) => `<span class="legend-item"><i class="legend-swatch" style="background:${ORGAN_COLORS[organ]}"></i>${organ[0].toUpperCase()}${organ.slice(1)}</span>`).join("");
  }

  function renderShannonChart(site) {
    const keys = state.ageMode === "age_bins" ? AGE_BINS : AGE_MONTHS.map(String);
    const labels = state.ageMode === "age_bins" ? AGE_BINS.map((key) => AGE_BIN_LABELS[key]) : AGE_MONTHS.map((age) => `${age}M`);
    const sampleRows = site.shannon?.[state.ageMode] || [];
    const sampleByKey = new Map(sampleRows.map((row) => [String(row.key), row]));
    const sampleValid = keys.map((key, index) => ({ index, row: sampleByKey.get(String(key)) })).filter(({ row }) => row && Number.isFinite(row.mean));
    if (!sampleValid.length) {
      dom.shannonChart.innerHTML = `<p class="empty-note">Shannon diversity is unavailable for this site and grouping.</p>`;
      dom.shannonLegend.innerHTML = "";
      return;
    }
    const { w, h, left, right, top, plotW, plotH } = chartGeometry(dom.shannonChart);
    const max = Math.max(1, ...sampleValid.map(({ row }) => row.mean + (row.sem || 0))) * 1.08;
    const x = (index) => left + (keys.length === 1 ? plotW / 2 : (index / (keys.length - 1)) * plotW);
    const y = (value) => top + plotH - (value / max) * plotH;
    const samplePoints = sampleValid.map(({ index, row }) => `${x(index)},${y(row.mean)}`).join(" ");
    const grid = [0, .5, 1].map((fraction) => {
      const value = fraction * max;
      const py = y(value);
      return `<line class="gridline" x1="${left}" y1="${py}" x2="${w - right}" y2="${py}"/><text x="${left - 8}" y="${py + 3}" text-anchor="end">${value.toFixed(2)}</text>`;
    }).join("");
    const sampleMarks = sampleValid.map(({ index, row }) => {
      const px = x(index), py = y(row.mean), sem = row.sem || 0;
      const error = sem ? `<path d="M${px},${y(Math.min(max, row.mean + sem))}V${y(Math.max(0, row.mean - sem))}M${px - 3},${y(Math.min(max, row.mean + sem))}H${px + 3}M${px - 3},${y(Math.max(0, row.mean - sem))}H${px + 3}" stroke="#28768a" stroke-width="1"/>` : "";
      return `${error}<circle cx="${px}" cy="${py}" r="3.2" fill="#28768a" data-tooltip="${escapeHTML(`${row.label}: mean sample ${DIVERSITY_LABEL} ${row.mean.toFixed(3)} ± ${sem.toFixed(3)} · effective classes ${row.effective_classes?.toFixed(2) ?? "—"} · n=${row.n}`)}"></circle>`;
    }).join("");
    const xLabels = labels.map((label, index) => ageTick(label, x(index), top + plotH + 22, keys.length > 3)).join("");
    dom.shannonChart.innerHTML = `<svg viewBox="0 0 ${w} ${h}" data-plot-width="${plotW}" data-plot-height="${plotH}" data-y-max="${max}" role="img" aria-label="${DIVERSITY_LABEL}, mean ± SEM"><text class="axis-label" transform="translate(13 ${top + plotH / 2}) rotate(-90)" text-anchor="middle">${escapeHTML(DIVERSITY_LABEL)}</text>${grid}<line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${top + plotH}"/><line class="axis" x1="${left}" y1="${top + plotH}" x2="${w - right}" y2="${top + plotH}"/><polyline points="${samplePoints}" fill="none" stroke="#28768a" stroke-width="2.2" stroke-linejoin="round"/>${sampleMarks}${xLabels}</svg>`;
    dom.shannonLegend.innerHTML = `<span class="legend-item"><i class="legend-swatch" style="background:#28768a"></i>Mean sample ${escapeHTML(DIVERSITY_LABEL)} ± SEM</span>`;
  }

  function renderExactGrid(site) {
    const values = site.exact_compositions?.ages;
    if (!values) {
      dom.exactGrid.innerHTML = `<p class="empty-note">Individual glycan compositions and PSM counts are unavailable for this site.</p>`;
      return;
    }
    const keys = AGE_MONTHS.map(String);
    const byAge = keys.map((key) => new Map((values[key] || []).map((row) => [row.name, row])));
    const names = [...new Set(byAge.flatMap((rows) => [...rows.keys()]))];
    const score = (name) => Math.max(0, ...byAge.map((rows) => rows.get(name)?.percent || 0));
    names.sort((a, b) => score(b) - score(a) || a.localeCompare(b));
    if (!names.length) {
      dom.exactGrid.innerHTML = `<p class="empty-note">No exact glycans detected.</p>`;
      return;
    }
    const header = `<div class="exact-row exact-head"><span class="exact-name">Composition</span>${AGE_MONTHS.map((age) => `<span class="exact-header">${age}M</span>`).join("")}</div>`;
    const rows = names.map((name) => {
      const cells = byAge.map((ageRows, index) => {
        const row = ageRows.get(name);
        const detected = ageRows.size > 0;
        const percent = row?.percent ?? 0;
        const psm = detected ? row?.psm ?? 0 : null;
        const alpha = detected ? .05 + Math.min(100, Math.max(0, percent)) / 100 * .9 : 0;
        const tooltip = `${name} · ${AGE_MONTHS[index]}M · ${psm === null ? "Not detected" : `PSM ${formatNumber(psm)}`}`;
        return `<button type="button" class="exact-cell ${detected ? "" : "missing"}" style="background:rgba(8,127,120,${alpha})" aria-label="${escapeHTML(tooltip)}" data-tooltip="${escapeHTML(tooltip)}"><span class="exact-value" style="color:${percent > 45 ? "#d6dddc" : "#687977"}">${detected ? `${percent.toFixed(1)}%` : "—"}</span></button>`;
      }).join("");
      const shortName = name.replace(/HexNAc\((\d+)\)/g, "N$1 ").replace(/Hex\((\d+)\)/g, "H$1 ").replace(/Fuc\((\d+)\)/g, "F$1 ").replace(/NeuAc\((\d+)\)/g, "A$1 ").replace(/NeuGc\((\d+)\)/g, "G$1 ").replace(/Phospho\((\d+)\)/g, "P$1 ").trim();
      return `<div class="exact-row"><span class="exact-name" title="${escapeHTML(name)}">${escapeHTML(shortName)}</span>${cells}</div>`;
    }).join("");
    dom.exactGrid.innerHTML = header + rows;
    dom.exactGrid.classList.toggle("show-values", dom.exactGrid.querySelector(".exact-cell").clientWidth >= 48);
  }

  function renderPairwise(site) {
    const rows = site ? (state.currentProtein.pairwise || []).filter((row) => row.site_id === site.id) : [];
    const eligibleOrgans = ORGANS.filter((organ) => (state.currentProtein.organs[organ]?.glycosites || []).some((row) => row.id === site?.id && row.comparison_eligible));
    if (!site || !site.comparison_eligible || eligibleOrgans.length < 2 || !rows.length) {
      const reason = site && !site.comparison_eligible
        ? "This low-confidence site remains visible in the atlas but is intentionally excluded from cross-organ comparison."
        : "No second confidence-qualified organ is available for this glycosite.";
      dom.pairwiseList.innerHTML = `<p class="pairwise-intro">Choose one covered site and two covered organs to compare their all-age glycan-class profiles.</p><p class="empty-note">${reason}</p>`;
      return;
    }
    const defaultRow = rows.slice().sort((a, b) => b.total_variation_pct - a.total_variation_pct)[0];
    const preferredA = eligibleOrgans.includes(state.activeOrgan) ? state.activeOrgan : defaultRow.organ_a;
    state.pairOrganA = eligibleOrgans.includes(state.pairOrganA) ? state.pairOrganA : preferredA;
    const defaultB = defaultRow.organ_a === state.pairOrganA ? defaultRow.organ_b : defaultRow.organ_a;
    state.pairOrganB = eligibleOrgans.includes(state.pairOrganB) && state.pairOrganB !== state.pairOrganA
      ? state.pairOrganB
      : (eligibleOrgans.includes(defaultB) && defaultB !== state.pairOrganA ? defaultB : eligibleOrgans.find((organ) => organ !== state.pairOrganA));
    const pairRow = rows.find((row) => [row.organ_a, row.organ_b].includes(state.pairOrganA) && [row.organ_a, row.organ_b].includes(state.pairOrganB));
    const siteFor = (organ) => (state.currentProtein.organs[organ]?.glycosites || []).find((row) => row.id === site.id);
    const vectorA = pooledClassVector(siteFor(state.pairOrganA));
    const vectorB = pooledClassVector(siteFor(state.pairOrganB));
    const classNames = orderedClasses([...new Set([...vectorA.keys(), ...vectorB.keys()])]);
    const statsA = compositionStats(vectorA);
    const statsB = compositionStats(vectorB);
    const vectorBar = (vector, organ) => `<div class="comparison-profile"><strong>${organ[0].toUpperCase()}${organ.slice(1)}</strong><div class="composition-bar">${classNames.map((name) => `<i style="width:${vector.get(name) || 0}%;background:${classPaint(name)}"></i>`).join("")}</div><p>${classNames.filter((name) => (vector.get(name) || 0) >= .1).map((name) => `${CLASS_LABELS[name] || name} ${(vector.get(name) || 0).toFixed(1)}%`).join(" · ")}</p></div>`;
    const organOptions = (selected) => eligibleOrgans.map((organ) => `<option value="${organ}" ${organ === selected ? "selected" : ""}>${organ[0].toUpperCase()}${organ.slice(1)}</option>`).join("");
    const metric = (label, value) => `<div><span>${label}</span><strong>${value}</strong></div>`;
    const totalVariation = pairRow?.total_variation_pct ?? classNames.reduce((total, name) => total + Math.abs((vectorA.get(name) || 0) - (vectorB.get(name) || 0)), 0) / 2;
    const jsDistance = pairRow?.js_distance;
    const tableRows = classNames.map((name) => {
      const a = vectorA.get(name) || 0, b = vectorB.get(name) || 0, difference = b - a;
      return `<tr><th>${escapeHTML(CLASS_LABELS[name] || name)}</th><td>${a.toFixed(2)}%</td><td>${b.toFixed(2)}%</td><td>${difference >= 0 ? "+" : ""}${difference.toFixed(2)}%</td></tr>`;
    }).join("");
    dom.pairwiseList.innerHTML = `
      <p class="pairwise-intro">Compare the same confidence-qualified glycosite between organs. Profiles reconstruct the sample-weighted all-age class vectors.</p>
      <div class="pairwise-controls">
        <label>Organ A<select data-pair-organ-a>${organOptions(state.pairOrganA)}</select></label>
        <label>Organ B<select data-pair-organ-b>${organOptions(state.pairOrganB)}</select></label>
      </div>
      <div class="comparison-bars">${vectorBar(vectorA, state.pairOrganA)}${vectorBar(vectorB, state.pairOrganB)}</div>
      <div class="comparison-metrics">
        ${metric(`${state.pairOrganA} ${DIVERSITY_LABEL}`, statsA.shannon.toFixed(2))}
        ${metric(`${state.pairOrganB} ${DIVERSITY_LABEL}`, statsB.shannon.toFixed(2))}
        ${metric("Effective classes", statsA.effective.toFixed(2))}
        ${metric("Effective classes", statsB.effective.toFixed(2))}
        ${metric("Simpson diversity", statsA.simpson.toFixed(2))}
        ${metric("Simpson diversity", statsB.simpson.toFixed(2))}
        ${metric("Dominant class", `${escapeHTML(CLASS_LABELS[statsA.dominant] || statsA.dominant)} ${statsA.dominantPercent.toFixed(1)}%`)}
        ${metric("Dominant class", `${escapeHTML(CLASS_LABELS[statsB.dominant] || statsB.dominant)} ${statsB.dominantPercent.toFixed(1)}%`)}
        ${metric("Total variation", `${totalVariation.toFixed(2)}%`)}
        ${metric("Jensen–Shannon distance", Number.isFinite(jsDistance) ? jsDistance.toFixed(3) : "—")}
      </div>
      <div class="comparison-table-wrap"><table><thead><tr><th>Class</th><th>${state.pairOrganA}</th><th>${state.pairOrganB}</th><th>B − A</th></tr></thead><tbody>${tableRows}</tbody></table></div>`;
    dom.pairwiseList.querySelector("[data-pair-organ-a]").addEventListener("change", (event) => {
      state.pairOrganA = event.target.value;
      if (state.pairOrganA === state.pairOrganB) state.pairOrganB = eligibleOrgans.find((organ) => organ !== state.pairOrganA);
      renderPairwise(site);
    });
    dom.pairwiseList.querySelector("[data-pair-organ-b]").addEventListener("change", (event) => {
      state.pairOrganB = event.target.value;
      if (state.pairOrganA === state.pairOrganB) state.pairOrganA = eligibleOrgans.find((organ) => organ !== state.pairOrganB);
      renderPairwise(site);
    });
  }

  function pooledClassVector(site) {
    const totals = new Map();
    let totalWeight = 0;
    const sampleCounts = new Map((site?.shannon?.ages || []).map((row) => [String(row.key), row.n || 0]));
    AGE_MONTHS.map(String).forEach((key) => {
      const rows = site?.glycan_classes?.ages?.[key] || [];
      const weight = sampleCounts.get(key) || 0;
      if (!rows.length || !weight) return;
      totalWeight += weight;
      rows.forEach((row) => totals.set(row.name, (totals.get(row.name) || 0) + row.percent * weight));
    });
    if (!totalWeight) return totals;
    totals.forEach((value, key) => totals.set(key, value / totalWeight));
    const sum = [...totals.values()].reduce((total, value) => total + value, 0);
    if (sum > 0) totals.forEach((value, key) => totals.set(key, value / sum * 100));
    return totals;
  }

  function compositionStats(vector) {
    const entries = [...vector.entries()].filter(([, percent]) => percent > 0);
    const proportions = entries.map(([, percent]) => percent / 100);
    const shannon = -proportions.reduce((total, value) => total + value * Math.log(value), 0);
    const [dominant = "—", dominantPercent = 0] = entries.sort((a, b) => b[1] - a[1])[0] || [];
    return {
      shannon,
      effective: Math.exp(shannon),
      simpson: 1 - proportions.reduce((total, value) => total + value ** 2, 0),
      dominant,
      dominantPercent,
    };
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
  function formatNumber(value) { return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 1 }); }
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
