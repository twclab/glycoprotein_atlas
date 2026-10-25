/* Linked manuscript-inspired views over the current public atlas release. */
(() => {
  "use strict";
  const { CLASS_ORDER, CLASS_LABELS, CLASS_COLORS, ORGAN_COLORS } = window.ATLAS_THEME;
  const labels = { brain: "Brain", spleen: "Spleen", liver: "Liver", kidney: "Kidney", plasma: "Plasma", myelin_male: "Male myelin", myelin_female: "Female myelin" };
  const classes = [...CLASS_ORDER, "mixed"];
  const classLabel = (name) => CLASS_LABELS[name] || (name === "mixed" ? "Mixed" : name);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const num = (v) => Number(v).toLocaleString("en-US");
  const fmt = (v) => Number(v).toFixed(1);
  const cache = new Map();
  let hooks, age = {}, ageRequest = 0, interRequest = 0;
  const inter = { scope: "atlas", pair: "all", state: "all", diversity: "all", query: "", metric: "tvd", sort: "descending" };
  const queryMatch = (row, query) => `${row.glycosite} ${row.protein_id} ${row.site_key}`.toLowerCase().includes(query.trim().toLowerCase());
  const paint = (name) => name === "mixed" ? "linear-gradient(135deg, #5A8C54, #A34599)" : name === "fucosylated_and_sialylated" ? "repeating-linear-gradient(135deg, #CD4D2C 0 3px, #A34599 3px 6px)" : CLASS_COLORS[name];
  const swatch = (name) => `<i class="legend-swatch" style="background:${paint(name)}"></i>`;
  async function get(file) {
    if (!cache.has(file)) cache.set(file, fetch(`data/comparisons/${file}?v=2026-10-24`).then(r => {
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
    node.querySelectorAll('[data-comparison-site]').forEach(link => link.addEventListener('click', event => {
      event.preventDefault();
      hooks.openSite(link.getAttribute('href'));
    }));
  }
  function hitTable(rows, { organ, other, ageHits = false } = {}) {
    if (!rows.length) return '<p class="empty-note">No glycosites match these filters. Clear a filter or try another search.</p>';
    return `<table class="hit-table"><thead><tr><th scope="col">Glycosite</th><th scope="col">TVD (%)</th>${ageHits ? '<th scope="col">Raw p</th><th scope="col">Loss → gain</th>' : '<th scope="col">Heterogeneity A / B</th>'}</tr></thead><tbody>${rows.map(row => {
      const a = organ || row.organs[0], b = other || row.organs?.[1];
      return `<tr><th scope="row"><a data-comparison-site href="${esc(siteHref(row, a, b))}">${esc(row.glycosite)}</a><small>${esc(row.protein_id)}${row.organs ? ` · ${esc(row.organs.map(x => labels[x]).join(' / '))}` : ''}</small></th><td>${fmt(ageHits ? row.percent_difference : row.tvd)}</td>${ageHits ? `<td>${Number(row.p_value).toExponential(2)}</td><td>${esc(classLabel(row.loss))} → ${esc(classLabel(row.gain))}</td>` : `<td>${Number(row.effective_a).toFixed(2)} / ${Number(row.effective_b).toFixed(2)}<small>Shannon H: ${Number(row.h_a).toFixed(2)} / ${Number(row.h_b).toFixed(2)}</small></td>`}</tr>`;
    }).join('')}</tbody></table>`;
  }
  function quantile(sorted, p) {
    const i = (sorted.length - 1) * p, j = Math.floor(i);
    return sorted[j] + (sorted[Math.ceil(i)] - sorted[j]) * (i-j);
  }
  function boxPlot(groups, { metric = 'tvd', caption, selected = '' } = {}) {
    const w = Math.max(560, groups.length * 70 + 100), h = 370;
    const left = 58, top = 32, bottom = 115, width = w-left-20, height = h-top-bottom;
    const values = groups.flatMap(g => g.rows.map(r => metric === 'tvd' ? r.tvd : r[`${metric}_b`] - r[`${metric}_a`]));
    const limit = Math.max(1, ...values.map(Math.abs));
    const min = metric === 'tvd' ? 0 : -Math.ceil(limit), max = metric === 'tvd' ? 100 : Math.ceil(limit);
    const y = v => top + height * (max-v)/(max-min), step = width / Math.max(1, groups.length);
    let svg = `<svg viewBox="0 0 ${w} ${h}" role="group" aria-label="${esc(caption)}"><line class="box-axis" x1="${left}" x2="${w-20}" y1="${y(0)}" y2="${y(0)}"/>`;
    for (let i=0; i<=4; i++) {
      const v = min+(max-min)*i/4;
      svg += `<line class="box-grid" x1="${left}" x2="${w-20}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-9}" y="${y(v)+4}" text-anchor="end">${fmt(v)}</text>`;
    }
    if (metric === 'tvd') for (const v of [20,50]) svg += `<line class="box-threshold" x1="${left}" x2="${w-20}" y1="${y(v)}" y2="${y(v)}"/>`;
    groups.forEach((g, i) => {
      const x = left+step*(i+.5), vals = g.rows.map(r => metric === 'tvd' ? r.tvd : r[`${metric}_b`] - r[`${metric}_a`]).sort((a,b)=>a-b);
      if (!vals.length) {
        svg += `<text x="${x}" y="${y(0)-10}" text-anchor="middle">n=0</text>`;
      } else {
        const q1=quantile(vals,.25), median=quantile(vals,.5), q3=quantile(vals,.75), iqr=q3-q1;
        const low=vals.find(v=>v>=q1-1.5*iqr), high=[...vals].reverse().find(v=>v<=q3+1.5*iqr);
        const color = g.color || '#087f78';
        svg += `<g class="box-choice ${selected===g.key?'selected':''}" data-box="${esc(g.key)}" tabindex="0" role="button" aria-label="${esc(`Browse ${g.label}, ${num(vals.length)} glycosites`)}"><title>${esc(g.label)}: n=${num(vals.length)}; median ${fmt(median)}</title><rect class="box-hit-area" x="${x-step/2+2}" y="${top}" width="${step-4}" height="${height+12}"/><line stroke="${color}" x1="${x}" x2="${x}" y1="${y(low)}" y2="${y(high)}"/><line stroke="${color}" x1="${x-10}" x2="${x+10}" y1="${y(low)}" y2="${y(low)}"/><line stroke="${color}" x1="${x-10}" x2="${x+10}" y1="${y(high)}" y2="${y(high)}"/><rect x="${x-16}" y="${y(q3)}" width="32" height="${Math.max(1,y(q1)-y(q3))}" fill="${color}" fill-opacity=".24" stroke="${color}"/><line stroke="${color}" stroke-width="3" x1="${x-16}" x2="${x+16}" y1="${y(median)}" y2="${y(median)}"/><text x="${x}" y="20" text-anchor="middle">${num(vals.length)}</text></g>`;
        // Every site contributes a point. Deterministic jitter avoids layout drift.
        svg += g.rows.map((r,j) => {
          const v = metric === 'tvd' ? r.tvd : r[`${metric}_b`]-r[`${metric}_a`];
          return `<a data-comparison-site href="${esc(siteHref(r, g.organs[0], g.organs[1]))}" aria-label="${esc(`${r.glycosite}, ${g.label}, ${fmt(v)}`)}"><circle cx="${x+(((j*37)%101)/100-.5)*25}" cy="${y(v)}" r="2" fill="${color}" fill-opacity=".2"><title>${esc(r.glycosite)} · ${fmt(v)}</title></circle></a>`;
        }).join('');
      }
      svg += `<text transform="translate(${x+4} ${top+height+28}) rotate(-48)" text-anchor="end">${esc(g.label)}</text>`;
    });
    const axis = metric === 'tvd' ? 'TVD (%)' : metric === 'effective' ? 'Effective glycan types, B − A' : 'Shannon H, B − A';
    return svg+`<text transform="translate(15 ${top+height/2}) rotate(-90)" text-anchor="middle">${esc(axis)}</text></svg>`;
  }
  function bindBoxes(node, callback) {
    node.querySelectorAll('[data-box]').forEach(button => {
      const choose = () => callback(button.dataset.box);
      button.addEventListener('click', choose);
      button.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
    });
    bindSites(node);
  }
  function resetAge() {
    ++ageRequest;
    age = {};
    for (const selector of ['[data-age-matrix]', '[data-age-hits]', '[data-age-context]']) document.querySelector(selector).innerHTML = '<p class="empty-note">Loading comparison…</p>';
    document.querySelector('[data-age-hit-count]').textContent = '';
    document.querySelector('[data-age-active-filter]').textContent = '';
  }
  async function renderAge({ dataset, comparison, rows, query }) {
    const request = ++ageRequest;
    const matrix = document.querySelector('[data-age-matrix]');
    if (age.dataset !== dataset || age.comparison !== comparison) {
      age = { dataset, comparison, query, loss: null, gain: null, rows };
      matrix.innerHTML = '<p class="empty-note">Loading glycan gains and losses…</p>';
      document.querySelector('[data-age-hits]').innerHTML = '';
      document.querySelector('[data-age-context]').innerHTML = '<p class="empty-note">Loading distributions…</p>';
    }
    age.query = query;
    try {
      const manifest = await get('manifest.json');
      const record = manifest.age.find(r => r.dataset===dataset && r.comparison===comparison);
      const hits = await get(record.file);
      if (request !== ageRequest) return;
      age.hits = hits;
      drawAge();
      await drawAgeContext(manifest, request);
    } catch(error) { if (request === ageRequest) errorMessage(matrix, () => renderAge({ dataset, comparison, rows, query })); }
  }
  function drawAge() {
    if (!age.hits) return;
    const matrix = document.querySelector('[data-age-matrix]');
    const hits = age.hits.filter(r => queryMatch(r, age.query));
    const count = (loss, gain) => hits.filter(r => (!loss || r.loss===loss) && (!gain || r.gain===gain)).length;
    const button = (loss, gain, text, label, extra='') => `<button type="button" ${loss?`data-loss="${loss}"`:''} ${gain?`data-gain="${gain}"`:''} aria-label="${esc(label)}" aria-pressed="${age.loss===loss && age.gain===gain}" ${extra}>${text}</button>`;
    matrix.innerHTML = `<div class="matrix-class-legend">${classes.map(c=>`<span>${swatch(c)}${esc(classLabel(c))}</span>`).join('')}</div><table class="gain-loss-matrix"><caption>Rows: dominant loss · columns: dominant gain</caption><thead><tr><th scope="col">Loss ↓ / Gain →</th>${classes.map(c=>`<th scope="col">${button(null,c,`${swatch(c)}<span class="sr-only">${esc(classLabel(c))}</span>`,`Any loss → ${classLabel(c)} gain`)}</th>`).join('')}<th scope="col">All gains</th></tr></thead><tbody>${classes.map(loss=>`<tr><th scope="row">${button(loss,null,`${swatch(loss)}${esc(classLabel(loss))}`,`${classLabel(loss)} loss → any gain`)}</th>${classes.map(gain=>{
      const n=count(loss,gain), strength=Math.min(1,n/Math.max(1,...classes.flatMap(l=>classes.map(g=>count(l,g)))));
      return `<td>${button(loss,gain,n,`${classLabel(loss)} loss → ${classLabel(gain)} gain: ${num(n)} hits`,`style="background:${n?`rgba(8,127,120,${.08+.72*strength})`:'#f1f3ef'};color:${strength>.6?'white':'#122d2a'}"`)}</td>`;
    }).join('')}<td>${button(loss,null,count(loss,null),`All ${classLabel(loss)} losses`)}</td></tr>`).join('')}</tbody><tfoot><tr><th scope="row">All losses</th>${classes.map(gain=>`<td>${button(null,gain,count(null,gain),`All ${classLabel(gain)} gains`)}</td>`).join('')}<td><strong>${num(hits.length)}</strong></td></tr></tfoot></table>`;
    matrix.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { age.loss=b.dataset.loss||null; age.gain=b.dataset.gain||null; drawAge(); }));
    const selected = hits.filter(r=>(!age.loss || r.loss===age.loss) && (!age.gain || r.gain===age.gain)).sort((a,b)=>b.percent_difference-a.percent_difference || a.p_value-b.p_value);
    document.querySelector('[data-age-hit-count]').textContent = `${num(selected.length)} of ${num(age.hits.length)} hits`;
    document.querySelector('[data-age-active-filter]').textContent = age.loss || age.gain ? `${age.loss?classLabel(age.loss):'Any'} loss → ${age.gain?classLabel(age.gain):'any'} gain` : 'All glycan changes';
    const list = document.querySelector('[data-age-hits]');
    list.innerHTML = hitTable(selected, { organ: age.dataset.replace(/^atlas_/,''), ageHits:true });
    bindSites(list);
    document.querySelector('[data-age-clear]').onclick = () => { age.loss=null; age.gain=null; drawAge(); };
  }
  async function drawAgeContext(manifest, request) {
    const organ=age.dataset.replace(/^atlas_/,''), node=document.querySelector('[data-age-context]');
    const records = manifest.young_pairs.filter(r=>r.organs.includes(organ));
    const pairRows = await Promise.all(records.map(r=>get(r.file)));
    if (request !== ageRequest) return;
    const groups = [{ key:'age', label:age.comparison.replaceAll('_',' '), color:ORGAN_COLORS[organ], organs:[organ], rows:age.rows.map(r=>({...r,tvd:r.percent_difference})) }, ...records.map((r,i)=>({ ...r,label:`vs ${labels[r.organs.find(x=>x!==organ)]} (Y)`,color:ORGAN_COLORS[r.organs.find(x=>x!==organ)],rows:pairRows[i] }))];
    node.innerHTML = boxPlot(groups,{caption:'Aging versus young inter-organ TVD distributions'})+`<p class="comparison-note">${records.length?'The first box uses the selected age comparison. Other boxes use pooled young-bin composition across organs (Tier 2+, ≥9 detected animals and ≥18 PSMs in each young bin). Click a box to browse its full list.':'Young inter-organ reference distributions are available for the five atlas organs.'} All points are shown; boxes mark median and IQR, whiskers extend to 1.5 × IQR.</p>`;
    bindBoxes(node, key=>{
      if (key==='age') { document.querySelector('[data-age-hits]').scrollIntoView({behavior:'smooth',block:'center'}); return; }
      Object.assign(inter,{scope:'young',pair:key,state:'all',diversity:'all',query:'',metric:'tvd'});
      hooks.showInterPage();
    });
  }
  async function loadInter() {
    const request=++interRequest, page=document.querySelector('[data-inter-content]');
    page.innerHTML='<p class="empty-note">Loading inter-organ comparisons…</p>';
    try {
      const manifest=await get('manifest.json');
      const records = inter.scope==='young' ? manifest.young_pairs : manifest.pairs.filter(r=>(inter.scope==='myelin') === r.key.includes('myelin'));
      const lists=await Promise.all(records.map(r=>get(r.file)));
      if(request!==interRequest)return;
      if(!records.some(r=>r.key===inter.pair))inter.pair='all';
      inter.groups=records.map((r,i)=>({...r,label:r.organs.map(x=>labels[x]).join(' / '),color:ORGAN_COLORS[r.organs[1]],rows:lists[i].map(row=>({...row,pair:r.key,organs:r.organs}))}));
      drawInter();
    } catch(error) { if(request===interRequest)errorMessage(page,loadInter); }
  }
  const stateLabels={conserved:'Conserved (<20%)',partially_shifted:'Partially shifted (20–<50%)',strongly_remodeled:'Strongly remodeled (≥50%)'};
  const diversityLabels={'low-low':'Both low','intermediate-intermediate':'Both intermediate','high-high':'Both high','low-intermediate':'Low ↔ intermediate','intermediate-high':'Intermediate ↔ high','low-high':'Low ↔ high'};
  const diversityColors=['#4e79a7','#76b7b2','#59a14f','#edc948','#f28e2b','#e15759'];
  function drawInter() {
    const page=document.querySelector('[data-inter-content]');
    const groups=inter.groups;
    const base=groups.filter(g=>inter.pair==='all'||g.key===inter.pair).flatMap(g=>g.rows);
    const filtered=base.filter(r=>(inter.state==='all'||r.state===inter.state) && (inter.diversity==='all'||r.diversity===inter.diversity) && queryMatch(r,inter.query));
    filtered.sort((a,b)=>inter.sort==='gene' ? a.glycosite.localeCompare(b.glycosite) : (inter.sort==='ascending'?1:-1)*(a.tvd-b.tvd) || a.site_key.localeCompare(b.site_key));
    const options=(obj,value)=>Object.entries(obj).map(([k,v])=>`<option value="${k}" ${k===value?'selected':''}>${esc(v)}</option>`).join('');
    page.innerHTML=`<div class="comparison-toolbar"><label>Datasets<select data-inter-scope>${options({atlas:'Atlas organs · pooled',myelin:'Brain and myelin · pooled',young:'Atlas organs · young only'},inter.scope)}</select></label><label>Organ pair<select data-inter-pair>${options({all:'All pairs',...Object.fromEntries(groups.map(g=>[g.key,g.label]))},inter.pair)}</select></label><label>Box-plot metric<select data-inter-metric>${options({tvd:'TVD (%)',effective:'Effective glycan types: B − A',h:'Shannon H: B − A'},inter.metric)}</select></label></div>
      <p class="comparison-note">${inter.scope==='young'?'Young bins only; pooled PSM composition, Tier 2+, ≥9 detected animals and ≥18 PSMs in each young bin.':'All ages pooled within each site and dataset; ≥5 PSMs in both datasets.'} Organ pairs are ordered A / B. Effective glycan types = exp(Shannon H).</p>
      <div class="comparison-grid inter-grid"><article class="comparison-card"><h3>${inter.metric==='tvd'?'Site composition across datasets':'Heterogeneity across datasets'}</h3><p class="comparison-note">Click a box to select an organ pair; click a point to open its glycosite.</p><div class="comparison-boxes" data-inter-boxes>${boxPlot(groups,{metric:inter.metric,caption:'Inter-organ glycosite distributions',selected:inter.pair})}</div></article>
      <article class="comparison-card"><div class="comparison-heading"><h3>Browse glycosites</h3><strong data-inter-count>${num(filtered.length)} of ${num(base.length)}</strong></div><div class="comparison-toolbar list-filters"><label>Remodeling<select data-inter-state>${options({all:'All states',...stateLabels},inter.state)}</select></label><label>Diversity relationship<select data-inter-diversity>${options({all:'All relationships',...diversityLabels},inter.diversity)}</select></label><label>Find a protein or site<input type="search" data-inter-search value="${esc(inter.query)}" placeholder="Gene, UniProt ID, or site"></label><label>Sort sites<select data-inter-sort>${options({descending:'Largest TVD first',ascending:'Smallest TVD first',gene:'Glycosite name'},inter.sort)}</select></label></div><button type="button" class="comparison-reset" data-inter-clear>Clear list filters</button><div class="comparison-hit-scroll" tabindex="0" role="region" aria-label="All matching inter-organ glycosites" data-inter-hits>${hitTable(filtered)}</div></article></div>
      <article class="comparison-card diversity-summary"><h3>Remodeling and glycan-type heterogeneity</h3><p class="comparison-note">${inter.pair==='all'?'All displayed organ pairs':esc(groups.find(g=>g.key===inter.pair)?.label)} · low: &lt;1.5, intermediate: 1.5–&lt;2.5, high: ≥2.5 effective glycan types. Click a segment to browse that state and diversity relationship.</p><div data-diversity-summary>${Object.entries(stateLabels).map(([state,label])=>{
        const rows=base.filter(r=>r.state===state), n=rows.length;
        return `<div class="diversity-row"><button class="diversity-state" type="button" data-summary-state="${state}">${label}<small>n=${num(n)}</small></button><div class="diversity-stack">${Object.entries(diversityLabels).map(([band,name],i)=>{
          const count=rows.filter(r=>r.diversity===band).length;
          return count?`<button type="button" data-summary-state="${state}" data-summary-diversity="${band}" style="width:${100*count/n}%;background:${diversityColors[i]}" aria-label="${esc(`${label}, ${name}: ${num(count)} comparisons`)}" title="${esc(`${name}: ${num(count)} (${fmt(100*count/n)}%)`)}"><span>${100*count/n>=10?`${fmt(100*count/n)}%`:''}</span></button>`:'';
        }).join('')}</div></div>`;
      }).join('')}<div class="comparison-legend">${Object.values(diversityLabels).map((name,i)=>`<span><i style="background:${diversityColors[i]}"></i>${name}</span>`).join('')}</div></div></article>`;
    const bind=(selector,key,callback=drawInter)=>page.querySelector(selector).addEventListener('change',e=>{inter[key]=e.target.value;callback();});
    bind('[data-inter-scope]','scope',()=>{Object.assign(inter,{pair:'all',state:'all',diversity:'all',query:''});loadInter();});
    bind('[data-inter-pair]','pair');bind('[data-inter-metric]','metric');bind('[data-inter-state]','state');bind('[data-inter-diversity]','diversity');bind('[data-inter-sort]','sort');
    // Preserve search focus and cursor: update only the hit table during typing.
    page.querySelector('[data-inter-search]').addEventListener('input',e=>{
      inter.query=e.target.value;
      const rows=base.filter(r=>(inter.state==='all'||r.state===inter.state)&&(inter.diversity==='all'||r.diversity===inter.diversity)&&queryMatch(r,inter.query));
      rows.sort((a,b)=>inter.sort==='gene'?a.glycosite.localeCompare(b.glycosite):(inter.sort==='ascending'?1:-1)*(a.tvd-b.tvd)||a.site_key.localeCompare(b.site_key));
      page.querySelector('[data-inter-count]').textContent=`${num(rows.length)} of ${num(base.length)}`;
      const node=page.querySelector('[data-inter-hits]');node.innerHTML=hitTable(rows);bindSites(node);
    });
    page.querySelector('[data-inter-clear]').onclick=()=>{Object.assign(inter,{state:'all',diversity:'all',query:''});drawInter();};
    page.querySelectorAll('[data-summary-state]').forEach(b=>b.onclick=()=>{inter.state=b.dataset.summaryState;inter.diversity=b.dataset.summaryDiversity||'all';drawInter();});
    bindBoxes(page.querySelector('[data-inter-boxes]'),key=>{inter.pair=key;drawInter();});
    bindSites(page.querySelector('[data-inter-hits]'));
  }
  window.ATLAS_COMPARISONS={configure:config=>{hooks=config;},resetAge,renderAge,loadInter};
})();
