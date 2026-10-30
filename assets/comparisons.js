/* Linked manuscript-inspired views over the current public atlas release. */
(() => {
  "use strict";
  const { CLASS_ORDER, CLASS_LABELS, CLASS_COLORS, ORGAN_COLORS } = window.ATLAS_THEME;
  const { ROW_HEIGHT, PAIR_STYLES, MATRIX_CLASSES, displayPair, matrixColor, windowRange, changeCounts } = window.ATLAS_COMPARISON_LAYOUT;
  const labels = { brain: "Brain", spleen: "Spleen", liver: "Liver", kidney: "Kidney", plasma: "Plasma", myelin_male: "Myelin (male)", myelin_female: "Myelin (female)" };
  const ageLabels = { O_vs_Y: 'Old versus young', O_vs_MA: 'Old versus middle-aged', MA_vs_Y: 'Middle-aged versus young' };
  const classes = MATRIX_CLASSES;
  const classLabel = (name) => CLASS_LABELS[name] || (name === "mixed" ? "Mixed" : name);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const num = (v) => Number(v).toLocaleString("en-US");
  const fmt = (v) => Number(v).toFixed(1);
  const cache = new Map();
  const profiling = new URLSearchParams(location.search).has('profileComparisons');
  let hooks, age = {}, ageRequest = 0, interRequest = 0;
  const inter = { scope: "atlas", pair: "all", state: "all", diversity: "all", query: "", metric: "tvd", sort: "descending", selectedSite: null };
  const queryMatch = (row, query, includeCanonicalPrefixes = false) => !query.trim() ||
    hooks.matchesProtein(row.protein_id, query, `${row.glycosite} ${row.site_key}`, {includeCanonicalPrefixes});
  const paint = (name) => name === "mixed" ? "repeating-linear-gradient(135deg, #221F20 0 2px, #A0E481 2px 4px, #5A8C54 4px 6px, #BDBDBD 6px 8px, #4168B9 8px 10px, #CD4D2C 10px 12px, #A34599 12px 14px)" : name === "fucosylated_and_sialylated" ? "repeating-linear-gradient(135deg, #CD4D2C 0 3px, #A34599 3px 6px)" : CLASS_COLORS[name];
  const swatch = (name) => `<i class="legend-swatch" style="background:${paint(name)}"></i>`;
  function profile(operation, start, extra = {}) {
    if (profiling) console.info('ATLAS_PROFILE '+JSON.stringify({operation,milliseconds:+(performance.now()-start).toFixed(2),...extra}));
  }
  async function get(file) {
    if (!cache.has(file)) cache.set(file, fetch(`data/comparisons/${file}?v=2026-10-24-composition`).then(r => {
      if (!r.ok) throw new Error(`${file}: ${r.status}`);
      return r.json();
    }).catch(error => { cache.delete(file); throw error; }));
    return cache.get(file);
  }
  function errorMessage(node, retry) {
    node.innerHTML = '<p class="empty-note">Comparison data could not be loaded. <button type="button" data-retry>Try again</button></p>';
    node.querySelector('[data-retry]').addEventListener('click', retry);
  }
  function siteHref(row, organ, other) {
    const params = new URLSearchParams({ organ, site: row.site_key });
    if (other) params.set('compare', other);
    return `#explore/${encodeURIComponent(row.protein_id)}?${params}`;
  }
  function bindSites(node) {
    node.onclick = event => {
      const link = event.target.closest('[data-comparison-site]');
      if (!link) return;
      event.preventDefault();
      hideHover();
      hooks.openSite(link.getAttribute('href'));
    };
    bindHover(node);
  }
  let hoverTip, hoverTarget;
  function hideHover() {
    if (hoverTip) hoverTip.hidden = true;
    hoverTarget?.removeAttribute('aria-describedby');
    hoverTarget = null;
  }
  function bindHover(node) {
    const move = event => {
      if (!hoverTarget || !event.clientX) return;
      const { width, height } = hoverTip.getBoundingClientRect();
      const left = event.clientX + 12 + width > innerWidth - 8 ? event.clientX - width - 12 : event.clientX + 12;
      const top = event.clientY + 12 + height > innerHeight - 8 ? event.clientY - height - 12 : event.clientY + 12;
      hoverTip.style.left = `${Math.max(8,Math.min(left,innerWidth-width-8))}px`;
      hoverTip.style.top = `${Math.max(8,Math.min(top,innerHeight-height-8))}px`;
    };
    const show = event => {
      const target = event.target.closest('[data-hover-label], [data-box], [data-point-site], [data-comparison-site]');
      if (!target || event.pointerType==='touch') return;
      if (target !== hoverTarget) {
        hideHover();
        if (!hoverTip) {
          hoverTip = document.createElement('div');
          hoverTip.className = 'comparison-hover'; hoverTip.id = 'comparison-hover';
          hoverTip.setAttribute('role','tooltip'); document.body.append(hoverTip);
        }
        hoverTarget = target;
        hoverTip.textContent = target.dataset.hoverLabel || target.getAttribute('aria-label');
        hoverTip.hidden = false; target.setAttribute('aria-describedby',hoverTip.id);
      }
      if (event.type==='focusin') {
        const box = target.getBoundingClientRect();
        move({clientX:box.left+box.width/2,clientY:box.top+box.height/2});
      } else move(event);
    };
    node.onpointerover = show; node.onpointermove = move; node.onpointerleave = hideHover;
    if (!node.dataset.hoverFocusBound) {
      node.dataset.hoverFocusBound = 'true';
      node.addEventListener('focusin',show); node.addEventListener('focusout',hideHover);
    }
    node.onpointerout = event => { if (hoverTarget && !hoverTarget.contains(event.relatedTarget)) hideHover(); };
  }
  function compositionDescription(values) {
    return CLASS_ORDER.map((name,i)=>values[i]>0?`${classLabel(name)} ${fmt(values[i])}%`:null).filter(Boolean).join(', ');
  }
  function compositionBar(values, organ, glycosite, psm) {
    const description = `${glycosite} · ${labels[organ]} · ${num(psm)} total glycoPSMs\n${compositionDescription(values)}`;
    return `<div class="comparison-composition-bar composition-bar" role="img" aria-label="${esc(description)}" data-hover-label="${esc(description)}">${CLASS_ORDER.map((name,i)=>values[i]>0?`<i style="width:${values[i]}%;background:${paint(name)}"></i>`:'').join('')}</div>`;
  }
  function changeDetails(row) {
    if (!row.changes) return '';
    const gains = row.changes.reduce((sum,x)=>sum+Math.max(x,0),0), losses = row.changes.reduce((sum,x)=>sum+Math.max(-x,0),0);
    return `<dl>${CLASS_ORDER.map((name,i)=>{
      const value = row.changes[i], total = value>0?gains:losses;
      return `<div><dt>${swatch(name)}${esc(classLabel(name))}</dt><dd>${value>0?'+':''}${value.toFixed(2)} pp<small>${value?`${fmt(100*Math.abs(value)/total)}% of total ${value>0?'gain':'loss'}`:'No change'}</small></dd></div>`;
    }).join('')}</dl>`;
  }
  function pairedWeightedValues(a, b, organs) {
    return `<div class="inter-metric-values" data-hover-label="${esc(`${labels[organs[0]]}: ${a.toFixed(2)}; ${labels[organs[1]]}: ${b.toFixed(2)}`)}"><span>${a.toFixed(2)}</span><span>${b.toFixed(2)}</span></div>`;
  }
  function hitRows(rows, { organ, ageHits = false, startIndex = 0 } = {}) {
    return rows.map((row,index) => {
      const a = organ || row.organs[0], b = row.organs?.[1], selected = !ageHits && row.pair===inter.pair && row.site_key===inter.selectedSite;
      const cells = ageHits
        ? `<td>${fmt(row.percent_difference)}</td><td>${Number(row.p_value).toExponential(2)}</td><td>${swatch(row.loss)}${esc(classLabel(row.loss))} → ${swatch(row.gain)}${esc(classLabel(row.gain))}${row.changes?`<details class="change-details" data-change-site="${esc(row.site_key)}"><summary>Glycan type composition changes</summary></details>`:''}</td>`
        : `<td><div class="comparison-pair"><span>${esc(labels[a])}</span><span>${esc(labels[b])}</span></div></td><td><div class="composition-bar-pair">${compositionBar(row.composition_a,a,row.glycosite,row.psm_a)}${compositionBar(row.composition_b,b,row.glycosite,row.psm_b)}</div></td><td>${pairedWeightedValues(row.effective_a,row.effective_b,[a,b])}</td><td>${fmt(row.tvd)}</td>`;
      return `<tr class="${ageHits?'':'site-row'} ${selected?'selected-site':''}" ${selected?'data-selected-site tabindex="-1"':''} ${ageHits?'':`aria-rowindex="${startIndex+index+2}"`}><th scope="row"><a data-comparison-site data-hover-label="${esc(`${row.glycosite} · ${row.protein_id} · ${labels[a]}${b?` v ${labels[b]}`:''} · Open in Explore`)}" href="${esc(siteHref(row, a, b))}">${esc(row.glycosite)}</a><small>${esc(row.protein_id)}${ageHits && row.organs ? ` · ${esc(row.organs.map(x => labels[x]).join(' v '))}` : ''}</small></th>${cells}</tr>`;
    }).join('');
  }
  const emptyList = '<p class="empty-note">No glycosites match these filters. Reset filters or try another search.</p>';
  const spacer = (height, columns) => height ? `<tr class="window-spacer" aria-hidden="true"><td colspan="${columns}" style="height:${height}px"></td></tr>` : '';
  function hitTable(rows, options = {}) {
    const { ageHits = false, totalRows = rows.length, before = 0, after = 0 } = options;
    if (!totalRows) return emptyList;
    const columns = ageHits ? 4 : 5;
    return `<table class="hit-table ${ageHits?'age-hit-table':'inter-hit-table'}" aria-rowcount="${totalRows+1}" style="--comparison-row-height:${ROW_HEIGHT}px">${ageHits?'':'<colgroup><col style="width:18%"><col style="width:17%"><col style="width:31%"><col style="width:18%"><col style="width:16%"></colgroup>'}<thead><tr><th scope="col">Glycosite</th>${ageHits ? '<th scope="col">TVD (%)</th><th scope="col">P value</th><th scope="col">Dominant loss → Dominant gain</th>' : '<th scope="col">Comparison</th><th scope="col">Glycosite composition</th><th scope="col">Weighted glycan types</th><th scope="col">TVD (%)</th>'}</tr></thead><tbody>${spacer(before,columns)}${hitRows(rows,options)}${spacer(after,columns)}</tbody></table>`;
  }
  function quantile(sorted, p) {
    const i = (sorted.length - 1) * p, j = Math.floor(i);
    return sorted[j] + (sorted[Math.ceil(i)] - sorted[j]) * (i-j);
  }
  function boxPlot(groups, { metric = 'tvd', caption, selected = '', plotWidth = 720 } = {}) {
    const w = Math.max(520, plotWidth), h = 654;
    const longLabels = groups.some(g => g.label.length > 24);
    const left = 72, top = 44, bottom = 125;
    const width = w-left-20, height = h-top-bottom;
    const labelY = top+height+(longLabels ? 36 : 11);
    const values = groups.flatMap(g => g.rows.map(r => metric === 'tvd' ? r.tvd : r[`${metric}_b`] - r[`${metric}_a`]));
    const limit = Math.max(1, ...values.map(Math.abs));
    const min = metric === 'tvd' ? 0 : -Math.ceil(limit), max = metric === 'tvd' ? 100 : Math.ceil(limit);
    const y = v => top + height * (max-v)/(max-min), step = width / Math.max(1, groups.length);
    let svg = `<svg viewBox="0 0 ${w} ${h}" role="group" aria-label="${esc(caption)}">`;
    for (let i=0; i<=4; i++) {
      const v = min+(max-min)*i/4;
      svg += `<line class="box-grid" x1="${left}" x2="${w-20}" y1="${y(v)}" y2="${y(v)}"/><line class="box-axis" x1="${left-5}" x2="${left}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-9}" y="${y(v)+4}" text-anchor="end">${fmt(v)}</text>`;
    }
    svg += `<line class="box-axis" x1="${left}" x2="${left}" y1="${top}" y2="${top+height}"/><line class="box-axis" x1="${left}" x2="${w-20}" y1="${y(0)}" y2="${y(0)}"/>`;
    if (metric === 'tvd') for (const v of [20,50]) svg += `<line class="box-threshold" x1="${left}" x2="${w-20}" y1="${y(v)}" y2="${y(v)}"/>`;
    groups.forEach((g, i) => {
      const x = left+step*(i+.5), vals = g.rows.map(r => metric === 'tvd' ? r.tvd : r[`${metric}_b`] - r[`${metric}_a`]).sort((a,b)=>a-b);
      const [first, second] = g.label.split(' v ');
      const label = longLabels && second
        ? `<text class="box-label" x="${x}" y="${labelY}" text-anchor="middle"><tspan x="${x}">${esc(first)}</tspan><tspan x="${x}" dy="22">v</tspan><tspan x="${x}" dy="22">${esc(second)}</tspan></text>`
        : `<text class="box-label" transform="translate(${x+4} ${labelY}) rotate(-48)" text-anchor="end">${esc(g.label)}</text>`;
      if (!vals.length) {
        svg += `<text x="${x}" y="${y(0)-10}" text-anchor="middle">n = 0</text>`;
      } else {
        const q1=quantile(vals,.25), median=quantile(vals,.5), q3=quantile(vals,.75), iqr=q3-q1;
        const low=vals.find(v=>v>=q1-1.5*iqr), high=[...vals].reverse().find(v=>v<=q3+1.5*iqr);
        const color = g.color || '#087f78';
        const selectionTop=Math.max(top,y(q3)-8), selectionBottom=Math.min(top+height-2,y(q1)+8);
        svg += `<g class="box-choice ${selected===g.key?'selected':''}" data-box="${esc(g.key)}" tabindex="0" role="button" aria-pressed="${selected===g.key}" data-hover-label="${esc(`${g.label} · ${num(vals.length)} glycosites · Median ${fmt(median)} · Click to browse`)}" aria-label="${esc(`Browse ${g.label}, ${num(vals.length)} glycosites`)}"><rect class="box-hit-area" x="${x-step/2+2}" y="${top}" width="${step-4}" height="${height+140}"/><rect class="box-selection" x="${x-24}" y="${selectionTop}" width="48" height="${selectionBottom-selectionTop}" rx="4"/><line stroke="#222" x1="${x}" x2="${x}" y1="${y(low)}" y2="${y(high)}"/><line stroke="#222" x1="${x-10}" x2="${x+10}" y1="${y(low)}" y2="${y(low)}"/><line stroke="#222" x1="${x-10}" x2="${x+10}" y1="${y(high)}" y2="${y(high)}"/><rect x="${x-16}" y="${y(q3)}" width="32" height="${Math.max(1,y(q1)-y(q3))}" fill="${color}" fill-opacity=".45" stroke="#222" stroke-width="1.5"/><line stroke="#222" stroke-width="3" x1="${x-16}" x2="${x+16}" y1="${y(median)}" y2="${y(median)}"/><text class="box-count" x="${x}" y="24" text-anchor="middle">${num(vals.length)}</text>${label}</g>`;
        // Every site contributes a point. Deterministic jitter avoids layout drift.
        svg += g.rows.map((r,j) => {
          const v = metric === 'tvd' ? r.tvd : r[`${metric}_b`]-r[`${metric}_a`];
          const active = inter.pair===g.key && inter.selectedSite===r.site_key;
          return `<circle class="box-point ${active?'selected':''}" data-point-pair="${esc(g.key)}" data-point-site="${esc(r.site_key)}" tabindex="0" role="button" aria-pressed="${active}" data-hover-label="${esc(`${r.glycosite} · ${g.label} · ${metric==='tvd'?'TVD':metric==='h'?'Shannon H change':'Weighted glycan type change'}: ${fmt(v)}${metric==='tvd'?'%':''} · Click to show in list`)}" aria-label="${esc(`Select ${r.glycosite}, ${g.label}, ${fmt(v)}`)}" cx="${x+(((j*37)%101)/100-.5)*25}" cy="${y(v)}" r="2" fill="${color}" fill-opacity=".2"/>`;
        }).join('');
      }
      if (!vals.length) svg += label;
    });
    const axis = metric === 'tvd' ? 'Total variation distance (%)' : metric === 'effective' ? 'Weighted glycan types, B − A' : 'Shannon H, B − A';
    return svg+`<text transform="translate(15 ${top+height/2}) rotate(-90)" text-anchor="middle">${esc(axis)}</text></svg>`;
  }
  function bindBoxes(node, callback, selectPoint) {
    const choose = event => {
      if (event.type==='keydown' && event.key!=='Enter' && event.key!==' ') return;
      const point = event.target.closest('[data-point-site]');
      const box = event.target.closest('[data-box]');
      if (!point && !box) return;
      event.preventDefault(); hideHover();
      if (point) selectPoint(point.dataset.pointPair,point.dataset.pointSite);
      else callback(box.dataset.box);
    };
    node.onclick = choose; node.onkeydown = choose;
    bindHover(node);
  }
  function resetAge() {
    ++ageRequest;
    age = {};
    for (const selector of ['[data-age-matrix]', '[data-age-hits]']) document.querySelector(selector).innerHTML = '<p class="empty-note">Loading comparison…</p>';
    for (const selector of ['[data-age-hit-count]', '[data-age-active-filter]']) document.querySelector(selector).textContent = '';
    document.querySelector('[data-age-selection]').textContent = 'Loading comparison…';
  }
  function resetAgeFilters() {
    age.loss = null;
    age.gain = null;
    age.query = '';
    drawAge();
  }
  async function renderAge({ dataset, comparison, query }) {
    const request = ++ageRequest;
    const matrix = document.querySelector('[data-age-matrix]');
    if (age.dataset !== dataset || age.comparison !== comparison) {
      age = { dataset, comparison, query, loss: null, gain: null };
      matrix.innerHTML = '<p class="empty-note">Loading glycan gains and losses…</p>';
      document.querySelector('[data-age-hits]').innerHTML = '';
    }
    age.query = query;
    const organLabel = labels[dataset.replace(/^atlas_/, '')];
    const comparisonLabel = (ageLabels[comparison] || comparison.replaceAll('_', ' ')).replace(/\b(young|middle-aged)\b/g, word => word[0].toUpperCase()+word.slice(1));
    const organColor = ORGAN_COLORS[dataset.replace(/^atlas_/, '')] || '#173a35';
    const coloredComparison = `<span class="comparison-organ" style="color:${organColor}">${esc(organLabel)} (${esc(comparisonLabel)})</span>`;
    document.querySelector('[data-age-selection]').innerHTML = coloredComparison;
    document.querySelector('[data-age-matrix-title]').innerHTML = `Glycan type gains and losses: ${coloredComparison}`;
    document.querySelector('[data-age-hits-title]').innerHTML = `Browse hits: ${coloredComparison}`;
    try {
      const manifest = await get('manifest.json');
      const record = manifest.age.find(r => r.dataset===dataset && r.comparison===comparison);
      const hits = await get(record.file);
      if (request !== ageRequest) return;
      age.hits = hits;
      age.bySite = new Map(hits.map(row=>[row.site_key,row]));
      drawAge();
    } catch(error) {
      if (request !== ageRequest) return;
      const retry = () => renderAge({ dataset, comparison, query });
      errorMessage(matrix, retry);
    }
  }
  function drawAge() {
    if (!age.hits) return;
    const profileStart = performance.now();
    const matrix = document.querySelector('[data-age-matrix]');
    const hits = age.hits.filter(r => queryMatch(r, age.query, true));
    const totals = changeCounts(hits, classes);
    const count = (loss, gain) => loss && gain ? totals.cells[loss][gain] : loss ? totals.losses[loss] : gain ? totals.gains[gain] : hits.length;
    const button = (loss, gain, text, label, extra='') => `<button type="button" ${loss?`data-loss="${loss}"`:''} ${gain?`data-gain="${gain}"`:''} aria-label="${esc(label)}" aria-pressed="${age.loss===loss && age.gain===gain}" ${extra}>${text}</button>`;
    const totalButton = (type, loss, gain) => {
      const n = count(loss, gain);
      const darkText = ['paucimannose', 'high_mannose', 'phospho'].includes(type);
      const patterned = ['mixed', 'fucosylated_and_sialylated'].includes(type);
      return button(loss, gain, `<span${patterned?' class="matrix-pattern-count"':''}>${num(n)}</span>`, `${classLabel(type)} ${loss?'loss':'gain'}: ${num(n)} ${n===1?'hit':'hits'}`, `class="matrix-margin-button" style="background:${paint(type)};color:${darkText?'#000':'#fff'}"`);
    };
    const key = `<div class="matrix-count-key"><span>Number of glycosites</span><div class="matrix-count-scale"><span>1</span><i aria-hidden="true"></i><span>30+</span></div></div>`;
    const legend = `<div class="matrix-class-legend" aria-label="Glycan type color key">${classes.map(type=>`<span>${swatch(type)}${esc(classLabel(type))}</span>`).join('')}</div>`;
    matrix.innerHTML = `${key}${legend}<div class="matrix-table-wrap"><table class="gain-loss-matrix"><colgroup><col class="matrix-axis-col"><col class="matrix-label-col"><col class="matrix-separation">${classes.map(()=>'<col class="matrix-cell">').join('')}</colgroup><tbody>${[...classes].reverse().map((loss,index)=>`<tr>${index===0?`<th scope="rowgroup" rowspan="${classes.length}" class="matrix-loss-title"><span>Dominant glycan type loss</span></th>`:''}<th scope="row">${totalButton(loss,loss,null)}</th><td class="matrix-separation" aria-hidden="true"></td>${classes.map(gain=>{
      const n=count(loss,gain);
      return `<td>${button(loss,gain,n ? num(n) : '',`${classLabel(loss)} loss → ${classLabel(gain)} gain: ${num(n)} hits`,`style="background:${matrixColor(n)};color:${n>0&&n<16?'white':'#000'}"`)}</td>`;
    }).join('')}</tr>`).join('')}</tbody><tfoot><tr class="matrix-gain-totals"><td colspan="3" aria-hidden="true"></td>${classes.map(gain=>`<th scope="col">${totalButton(gain,null,gain)}</th>`).join('')}</tr><tr><td colspan="3" aria-hidden="true"></td><th colspan="${classes.length}" class="matrix-gain-title"><span>Dominant glycan type gain</span></th></tr></tfoot></table></div>`;
    matrix.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { age.loss=b.dataset.loss||null; age.gain=b.dataset.gain||null; drawAge(); matrix.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true}); }));
    const selected = hits.filter(r=>(!age.loss || r.loss===age.loss) && (!age.gain || r.gain===age.gain)).sort((a,b)=>b.percent_difference-a.percent_difference || a.p_value-b.p_value);
    document.querySelector('[data-age-hit-count]').textContent = `${num(selected.length)} of ${num(age.hits.length)} hits`;
    document.querySelector('[data-age-active-filter]').textContent = age.loss || age.gain ? `${age.loss?classLabel(age.loss):'Any'} loss → ${age.gain?classLabel(age.gain):'any'} gain` : 'All glycan type changes';
    const list = document.querySelector('[data-age-hits]');
    list.innerHTML = hitTable(selected, { organ: age.dataset.replace(/^atlas_/,''), ageHits:true });
    bindSites(list);
    if (!list.dataset.detailsBound) {
      list.dataset.detailsBound = 'true';
      list.addEventListener('toggle',event=>{
        const detail = event.target.closest('[data-change-site]');
        if (!detail) return;
        if (!detail.open) { detail.querySelector('dl')?.remove(); return; }
        if (!detail.querySelector('dl')) detail.insertAdjacentHTML('beforeend',changeDetails(age.bySite.get(detail.dataset.changeSite)));
      },true);
    }
    document.querySelector('[data-age-clear]').onclick = () => hooks?.resetTVDFilters ? hooks.resetTVDFilters() : resetAgeFilters();
    profile('age-render',profileStart,{rows:selected.length,nodes:profiling?document.querySelector('#tvd').querySelectorAll('*').length:undefined});
  }
  async function loadInter() {
    inter.scope=inter.scope==='myelin'?'myelin':'atlas';
    const page = document.querySelector('[data-inter-content]');
    if (inter.loadedScope===inter.scope && page.querySelector('[data-inter-boxes]')) return;
    const request=++interRequest, start=performance.now();
    hideHover(); page.innerHTML='<p class="empty-note">Loading inter-organ comparisons…</p>';
    try {
      const manifest=await get('manifest.json');
      const records = manifest.pairs.filter(r=>(inter.scope==='myelin') === r.key.includes('myelin')).slice().sort((a,b)=>PAIR_STYLES.findIndex(pair=>pair.key===a.key)-PAIR_STYLES.findIndex(pair=>pair.key===b.key));
      const lists=await Promise.all(records.map(r=>get(r.file)));
      if(request!==interRequest)return;
      if(!records.some(r=>r.key===inter.pair))inter.pair='all';
      inter.groups=records.map((record,i)=>{ const group=displayPair(record,lists[i]); return {...group,label:group.organs.map(organ=>labels[organ]).join(' v ')}; });
      inter.loadedScope=inter.scope;
      profile('inter-data',start,{sites:lists.reduce((sum,rows)=>sum+rows.length,0)});
      mountInter();
    } catch(error) { if(request===interRequest)errorMessage(page,loadInter); }
  }
  const stateLabels={conserved:'Conserved (TVD < 20%)',partially_shifted:'Partially shifted (20% ≤ TVD < 50%)',strongly_remodeled:'Strongly remodeled (TVD ≥ 50%)'};
  const diversityLabels={'low-low':'Both low','intermediate-intermediate':'Both intermediate','high-high':'Both high','low-intermediate':'Low ↔ intermediate','intermediate-high':'Intermediate ↔ high','low-high':'Low ↔ high'};
  const diversityColors=['#4e79a7','#76b7b2','#59a14f','#edc948','#f28e2b','#e15759'];
  function mountInter() {
    const start=performance.now(), page=document.querySelector('[data-inter-content]'), groups=inter.groups;
    const options=(obj,value)=>Object.entries(obj).map(([k,v])=>`<option value="${k}" ${k===value?'selected':''}>${esc(v)}</option>`).join('');
    page.innerHTML=`<div class="comparison-toolbar"><label>Datasets<select data-inter-scope>${options({atlas:'Atlas organs',myelin:'Brain and myelin'},inter.scope)}</select></label><label>Organ pair<select data-inter-pair>${options({all:'All pairs',...Object.fromEntries(groups.map(g=>[g.key,g.label]))},inter.pair)}</select></label><label>Box plot metric<select data-inter-metric>${options({tvd:'TVD (%)',effective:'Weighted glycan types: B − A'},inter.metric)}</select></label><button type="button" class="comparison-reset inter-toolbar-reset" data-inter-toolbar-reset>Reset filters</button></div>
      <div class="comparison-legend composition-legend" aria-label="Glycan type colors"><strong class="composition-legend-title">Glycan types</strong><div class="composition-legend-items">${CLASS_ORDER.map(name=>`<span>${swatch(name)}${esc(classLabel(name))}</span>`).join('')}</div></div>
      <div class="comparison-grid inter-grid"><article class="comparison-card"><h3 data-inter-plot-title></h3><div class="comparison-boxes" data-inter-boxes></div></article>
      <article class="comparison-card"><div class="comparison-heading"><h3>Browse glycosites: <span class="inter-pair-context" data-inter-pair-context aria-live="polite"></span></h3><strong data-inter-count aria-live="polite"></strong></div><div class="comparison-toolbar list-filters"><label>Remodeling<select data-inter-state>${options({all:'All states',...stateLabels},inter.state)}</select></label><label>Heterogeneity relationship<select data-inter-diversity>${options({all:'All relationships',...diversityLabels},inter.diversity)}</select></label><label>Find a protein or site<input type="search" data-inter-search value="${esc(inter.query)}" placeholder="Gene, alias, UniProt ID, or site"></label><label>Sort sites<select data-inter-sort>${options({descending:'Largest TVD first',ascending:'Smallest TVD first',gene:'Glycosite name'},inter.sort)}</select></label></div><button type="button" class="comparison-reset" data-inter-clear>Reset filters</button><div class="comparison-hit-scroll inter-hit-scroll" tabindex="0" role="region" aria-label="All matching inter-organ glycosites" data-inter-hits></div><p class="comparison-window-note" data-inter-window-count></p></article></div>
      <article class="comparison-card diversity-summary" data-inter-summary></article>`;
    const list=page.querySelector('[data-inter-hits]');
    let scrollFrame=0;
    list.onscroll=()=>{
      if (!scrollFrame) scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;renderInterWindow();});
    };
    list.onkeydown=event=>{
      const link=event.target.closest('[data-comparison-site]');
      if (event.key!=='Tab' || !link) return;
      const next=Number(link.closest('tr').getAttribute('aria-rowindex'))-2+(event.shiftKey?-1:1);
      if (next<0 || next>=inter.rows.length || (next>=inter.windowStart && next<inter.windowEnd)) return;
      event.preventDefault();
      const position=Math.max(0,60+next*ROW_HEIGHT-(list.clientHeight-ROW_HEIGHT)/2);
      renderInterWindow(true,position);list.scrollTop=position;
      list.querySelector(`[aria-rowindex="${next+2}"] a`).focus({preventScroll:true});
    };
    bindSites(list);
    page.querySelector('[data-inter-scope]').onchange=event=>{
      Object.assign(inter,{scope:event.target.value,pair:'all',state:'all',diversity:'all',query:'',selectedSite:null});loadInter();
    };
    page.querySelector('[data-inter-metric]').onchange=event=>{inter.metric=event.target.value;renderInterPlot();};
    page.querySelector('[data-inter-pair]').onchange=event=>{
      inter.pair=event.target.value;inter.selectedSite=null;updateInterList();syncPlotSelection();renderInterSummary();
    };
    for (const [selector,key] of [['[data-inter-state]','state'],['[data-inter-diversity]','diversity'],['[data-inter-sort]','sort']]) {
      page.querySelector(selector).onchange=event=>{inter[key]=event.target.value;inter.selectedSite=null;updateInterList();syncPlotSelection();};
    }
    page.querySelector('[data-inter-search]').oninput=event=>{
      inter.query=event.target.value;inter.selectedSite=null;updateInterList();syncPlotSelection();
    };
    const resetFilters=()=>{
      Object.assign(inter,{pair:'all',state:'all',diversity:'all',query:'',sort:'descending',selectedSite:null});syncInterControls();updateInterList();syncPlotSelection();renderInterSummary();
    };
    page.querySelector('[data-inter-clear]').onclick=resetFilters;
    page.querySelector('[data-inter-toolbar-reset]').onclick=resetFilters;
    page.querySelector('[data-inter-summary]').onclick=event=>{
      const button=event.target.closest('[data-summary-state]');
      if (!button) return;
      Object.assign(inter,{state:button.dataset.summaryState,diversity:button.dataset.summaryDiversity||'all',selectedSite:null});
      syncInterControls();updateInterList();syncPlotSelection();
    };
    renderInterPlot();updateInterList();renderInterSummary();
    profile('inter-render',start,{rows:inter.rows.length,mountedRows:list.querySelectorAll('.site-row').length,nodes:profiling?page.querySelectorAll('*').length:undefined});
  }
  function syncInterControls() {
    const page=document.querySelector('[data-inter-content]');
    for (const key of ['pair','state','diversity','sort']) page.querySelector(`[data-inter-${key}]`).value=inter[key];
    page.querySelector('[data-inter-search]').value=inter.query;
  }
  function renderInterPlot() {
    const start=performance.now(), page=document.querySelector('[data-inter-content]'), node=page.querySelector('[data-inter-boxes]');
    hideHover();
    page.querySelector('[data-inter-plot-title]').textContent=inter.metric==='tvd'?'Glycosite composition across datasets':'Heterogeneity across datasets';
    inter.plotWidth=Math.max(520,node.clientWidth);
    node.innerHTML=boxPlot(inter.groups,{metric:inter.metric,caption:'Inter-organ glycosite distributions',selected:inter.pair,plotWidth:inter.plotWidth});
    bindBoxes(node,key=>selectInter(key), (pair,site)=>selectInter(pair,site));
    syncPlotSelection();
    profile('inter-plot',start,{points:node.querySelectorAll('[data-point-site]').length});
  }
  function resizeInter() {
    const node=document.querySelector('[data-inter-boxes]');
    if (!node || node.closest('[hidden]') || !inter.groups) return;
    if (Math.max(520,node.clientWidth)!==inter.plotWidth) renderInterPlot();
  }
  function syncPlotSelection() {
    const node=document.querySelector('[data-inter-boxes]');
    node.querySelectorAll('.selected').forEach(el=>{el.classList.remove('selected');el.setAttribute('aria-pressed','false');});
    const matches=inter.query.trim()?new Set((inter.rows||[]).map(row=>`${row.pair}\u0000${row.site_key}`)):null;
    node.querySelectorAll('.box-point').forEach(point=>{
      point.classList.toggle('search-match',!!matches?.has(`${point.dataset.pointPair}\u0000${point.dataset.pointSite}`));
    });
    const box=node.querySelector(`[data-box="${inter.pair}"]`);
    if (box) { box.classList.add('selected');box.setAttribute('aria-pressed','true'); }
    if (inter.selectedSite) {
      const point=node.querySelector(`[data-point-pair="${inter.pair}"][data-point-site="${CSS.escape(inter.selectedSite)}"]`);
      if (point) { point.classList.add('selected');point.setAttribute('aria-pressed','true'); }
    }
  }
  function selectInter(pair, site=null) {
    const start=performance.now();hideHover();
    Object.assign(inter,{pair,state:'all',diversity:'all',query:'',selectedSite:site});
    syncInterControls();updateInterList({reveal:!!site});syncPlotSelection();renderInterSummary();
    if (!site) document.querySelector('[data-inter-boxes] .box-choice.selected')?.focus({preventScroll:true});
    profile('inter-select',start,{pair,site,nodes:profiling?document.querySelector('[data-inter-content]').querySelectorAll('*').length:undefined});
  }
  function updateInterList({reveal=false}={}) {
    const start=performance.now(), page=document.querySelector('[data-inter-content]'), node=page.querySelector('[data-inter-hits]');
    hideHover();
    inter.base=inter.groups.filter(group=>inter.pair==='all'||group.key===inter.pair).flatMap(group=>group.rows);
    inter.rows=inter.base.filter(row=>(inter.state==='all'||row.state===inter.state)&&(inter.diversity==='all'||row.diversity===inter.diversity)&&queryMatch(row,inter.query,true));
    inter.rows.sort((a,b)=>inter.sort==='gene'?a.glycosite.localeCompare(b.glycosite):(inter.sort==='ascending'?1:-1)*(a.tvd-b.tvd)||a.site_key.localeCompare(b.site_key));
    page.querySelector('[data-inter-count]').textContent=`${num(inter.rows.length)} of ${num(inter.base.length)}`;
    const selectedGroup=inter.groups.find(group=>group.key===inter.pair), pairContext=page.querySelector('[data-inter-pair-context]');
    pairContext.textContent=selectedGroup?.label || 'All organ comparisons';
    pairContext.style.color=selectedGroup?.color || '';
    const index=reveal?inter.rows.findIndex(row=>row.site_key===inter.selectedSite):-1;
    const desired=index<0?0:Math.max(0,60+index*ROW_HEIGHT-(node.clientHeight-ROW_HEIGHT)/2);
    renderInterWindow(true,desired);node.scrollTop=desired;
    if (index>=0) {
      const row=node.querySelector('[data-selected-site]');
      row.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});row.focus({preventScroll:true});
    }
    profile('inter-list',start,{rows:inter.rows.length,mountedRows:node.querySelectorAll('.site-row').length});
  }
  function renderInterWindow(force=false, scrollTop) {
    if (!inter.rows) return;
    const node=document.querySelector('[data-inter-hits]');
    if (!node) return;
    const position=scrollTop===undefined?node.scrollTop:scrollTop, height=node.clientHeight||430;
    const range=windowRange(inter.rows.length,position,height,ROW_HEIGHT);
    const first=Math.min(inter.rows.length,1+Math.floor(Math.max(0,position-60)/ROW_HEIGHT));
    const last=Math.min(inter.rows.length,Math.max(first,Math.ceil((position+height-60)/ROW_HEIGHT)));
    document.querySelector('[data-inter-window-count]').textContent=inter.rows.length?`Sites ${num(first)}–${num(last)} of ${num(inter.rows.length)} · scroll to browse all`:'';
    if (!force && inter.windowStart===range.start && inter.windowEnd===range.end) return;
    inter.windowStart=range.start;inter.windowEnd=range.end;
    hideHover();
    const active=document.activeElement, hadFocus=node.contains(active)&&active!==node;
    const focusedHref=hadFocus?active.closest('[data-comparison-site]')?.getAttribute('href'):null;
    const rows=inter.rows.slice(range.start,range.end), table=node.querySelector('table');
    const options={totalRows:inter.rows.length,startIndex:range.start,before:range.before,after:range.after};
    if (!inter.rows.length) node.innerHTML=emptyList;
    else if (!table) node.innerHTML=hitTable(rows,options);
    else {
      table.setAttribute('aria-rowcount',inter.rows.length+1);
      table.tBodies[0].innerHTML=spacer(range.before)+hitRows(rows,options)+spacer(range.after);
    }
    if (hadFocus) {
      const replacement=focusedHref?[...node.querySelectorAll('[data-comparison-site]')].find(link=>link.getAttribute('href')===focusedHref):node.querySelector('[data-selected-site]');
      (replacement||node).focus({preventScroll:true});
    }
  }
  function renderInterSummary() {
    const base=inter.base;
    document.querySelector('[data-inter-summary]').innerHTML=`<h3>Remodeling and glycan type heterogeneity</h3><div data-diversity-summary>${Object.entries(stateLabels).map(([state,label])=>{
      const rows=base.filter(row=>row.state===state), n=rows.length;
      return `<div class="diversity-row"><button class="diversity-state" type="button" data-summary-state="${state}">${label}<small>n = ${num(n)}</small></button><div class="diversity-stack">${Object.entries(diversityLabels).map(([band,name],i)=>{
        const count=rows.filter(row=>row.diversity===band).length;
        return count?`<button type="button" data-summary-state="${state}" data-summary-diversity="${band}" style="width:${100*count/n}%;background:${diversityColors[i]}" aria-label="${esc(`${label}, ${name}: ${num(count)} comparisons`)}" title="${esc(`${name}: ${num(count)} (${fmt(100*count/n)}%)`)}"><span>${100*count/n>=10?`${fmt(100*count/n)}%`:''}</span></button>`:'';
      }).join('')}</div></div>`;
    }).join('')}<div class="comparison-legend">${Object.values(diversityLabels).map((name,i)=>`<span><i style="background:${diversityColors[i]}"></i>${name}</span>`).join('')}</div><p class="comparison-note">Low heterogeneity: Weighted glycan types &lt; 1.5<br>Intermediate heterogeneity: 1.5 ≤ Weighted glycan types &lt; 2.5<br>High heterogeneity: Weighted glycan types ≥ 2.5</p></div>`;
  }
  function refreshSearch() {
    if (inter.groups && inter.query.trim() && document.querySelector('[data-inter-hits]')) {updateInterList();syncPlotSelection();}
  }
  window.ATLAS_COMPARISONS={configure:config=>{hooks=config;},resetAge,resetAgeFilters,renderAge,loadInter,resize:resizeInter,refreshSearch};
})();
