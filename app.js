// TCP & CMPort - RTG Replacement vs Retrofit Decision Dashboard
// Core Application Logic - Rev 2.5 (3 Strategic Solutions + ZPMC Benchmark + Genset Impact)

document.addEventListener('DOMContentLoaded', () => {
  if (window.I18N) {
    window.onLanguageChange = (lang) => {
      renderKPIs();
      renderFleetTable();
      renderKayoMatrix();
      renderCharts();
      updateSimulatorUI();
      const searchInp = document.getElementById('fleet-search');
      if (searchInp) searchInp.placeholder = window.I18N.get('search_placeholder');
    };
    window.I18N.init();
  }
  initTabs();
  initSimulator();
  renderKPIs();
  renderFleetTable();
  renderKayoMatrix();
  renderCharts();
  initModal();
});

// State
const state = {
  activeTab: 'solutions',
  sim: {
    capexNewUSD: 2.4, // Milhões USD
    capexRetroUSD: 1.35, // Milhões USD
    freightSavingsUSD: 4.0, // Milhões USD economia frete naval conjunto com STS
    fxRate: 5.50, // USD to BRL
    horizonYears: 20,
    annualElecSavingsUSD: 0.18, // Economia anual diesel p/ elétrico por RTG (M USD)
    maintSavingsPct: 0.65 // Redução de manutenção do RTG novo vs antigo
  },
  charts: {}
};

// Navigation Tabs
function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      
      tab.classList.add('active');
      const target = tab.dataset.target;
      const pane = document.getElementById(target);
      if (pane) pane.classList.add('active');
      
      state.activeTab = target;
      window.dispatchEvent(new Event('resize'));
    });
  });
}

// Formatters
const fmtBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const fmtUSD = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 1 }).format(val);
const fmtNum = (val) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(val);

// Render KPIs
function renderKPIs() {
  const fleet = window.FLEET_DATA || [];
  const activeFleet = fleet.filter(f => f.status !== 'Desativado');
  
  const totalCost8m = activeFleet.reduce((acc, cur) => acc + (cur.custo8m || 0), 0);
  const totalHours8m = activeFleet.reduce((acc, cur) => acc + (cur.horas8m || 0), 0);
  const avgCostPerHour = totalHours8m > 0 ? (totalCost8m / totalHours8m) : 0;
  
  // ZPMC Benchmark
  const zpmcFleet = activeFleet.filter(f => f.modelo === 'ZMPC');
  const zpmcCost8m = zpmcFleet.reduce((acc, cur) => acc + (cur.custo8m || 0), 0);
  const zpmcHours8m = zpmcFleet.reduce((acc, cur) => acc + (cur.horas8m || 0), 0);
  const zpmcCostPerHour = zpmcHours8m > 0 ? (zpmcCost8m / zpmcHours8m) : 0;

  // Lote 04 a 14 (10 unidades ativas)
  const lote10 = activeFleet.filter(f => {
    const num = parseInt(f.rtg.replace('RTG ', ''));
    return num >= 4 && num <= 14;
  });
  const costLote10 = lote10.reduce((acc, cur) => acc + (cur.custo8m || 0), 0);
  const pctLote10 = totalCost8m > 0 ? ((costLote10 / totalCost8m) * 100).toFixed(1) : 0;

  const lang = window.I18N ? window.I18N.currentLang : 'en';
  const fleetActiveTxt = lang === 'en' ? `${activeFleet.length} Active Assets` :
                         lang === 'zh' ? `${activeFleet.length} 臺在役設備` : `${activeFleet.length} Ativos`;
  const elTotalFleet = document.getElementById('kpi-total-fleet');
  if (elTotalFleet) elTotalFleet.textContent = fleetActiveTxt;

  const elCost8m = document.getElementById('kpi-cost-8m');
  if (elCost8m) elCost8m.textContent = fmtBRL(totalCost8m);

  const elAvgHour = document.getElementById('kpi-avg-hour');
  if (elAvgHour) elAvgHour.textContent = fmtBRL(avgCostPerHour) + '/h';

  const pctFleetTxt = lang === 'en' ? `${pctLote10}% of Fleet` :
                      lang === 'zh' ? `佔全港 ${pctLote10}%` : `${pctLote10}% da Frota`;
  const elLote10Impact = document.getElementById('kpi-lote10-impact');
  if (elLote10Impact) elLote10Impact.textContent = pctFleetTxt;

  const elZpmcBench = document.getElementById('kpi-zpmc-bench');
  if (elZpmcBench) elZpmcBench.textContent = `${fmtBRL(zpmcCostPerHour)}/h`;
}

// Simulator Calculations
function calculateEconomics() {
  const { capexNewUSD, capexRetroUSD, freightSavingsUSD, fxRate, horizonYears, maintSavingsPct } = state.sim;
  const qty = 10;
  
  // SOLUÇÃO 1: 10 Novos RTGs (Substitui 04-14) + Preserva 01-03 com Canibalização 04-06
  const sol1GrossCapexUSD = qty * capexNewUSD; // 10 * 2.4 = 24.0M
  const sol1NetCapexUSD = sol1GrossCapexUSD - freightSavingsUSD; // 24.0 - 4.0 = 20.0M
  const sol1LifeYears = 22;
  const sol1AnnualCapitalUSD = (sol1NetCapexUSD / sol1LifeYears) / qty; // per machine = $90,909 / ano
  
  // OPEX de manutenção (Milhões USD):
  const oldMaintPerCraneUSD_M = (450000 / fxRate) / 1e6; // ~0.0818M USD por máquina/ano
  const sol1AnnualOpexUSD = (oldMaintPerCraneUSD_M * (1 - maintSavingsPct)) * qty; // ~0.286M / ano
  const sol1TotalCostUSD = sol1NetCapexUSD + (sol1AnnualOpexUSD * horizonYears); // ~25.7M

  // SOLUÇÃO 2: 10 Novos RTGs (Substitui 01-10) + Eletrificação e Preservação dos 11-14
  const sol2NetCapexUSD = sol1NetCapexUSD + 0.8; // +US$ 0.8M para eletrificar os 4 RTGs (11 a 14) = 20.8M
  const sol2LifeYears = 22;
  const sol2AnnualCapitalUSD = (sol2NetCapexUSD / sol2LifeYears) / qty; // per machine = $94,545 / ano
  const sol2AnnualOpexUSD = sol1AnnualOpexUSD * 0.90; // ~0.257M / ano
  const sol2TotalCostUSD = sol2NetCapexUSD + (sol2AnnualOpexUSD * horizonYears); // ~26.0M

  // SOLUÇÃO 3: Retrofit 10 RTGs (Norma CMP) + Mercado para 01-03
  const sol3NetCapexUSD = qty * capexRetroUSD; // 10 * 1.35 = 13.5M
  const sol3LifeYears = 6.5;
  const sol3AnnualCapitalUSD = (sol3NetCapexUSD / sol3LifeYears) / qty; // per machine = $207,692 / ano
  const sol3AnnualOpexUSD = (oldMaintPerCraneUSD_M * 0.70) * qty; // ~0.572M / ano
  
  // No horizonte de 20 anos, o retrofit exige reinvestimentos cíclicos a cada 6-7 anos
  const cycles = horizonYears / sol3LifeYears; // ex: 20 / 6.5 = 3.07 ciclos
  const sol3ReinvestmentCapexUSD = (sol3NetCapexUSD * Math.max(1, cycles - 1) * 0.85); 
  const sol3TotalCostUSD = sol3NetCapexUSD + sol3ReinvestmentCapexUSD + (sol3AnnualOpexUSD * horizonYears); // ~50.5M
  
  const savingsSol1VsSol3 = sol3TotalCostUSD - sol1TotalCostUSD;
  const savingsSol2VsSol3 = sol3TotalCostUSD - sol2TotalCostUSD; // ~24.5M

  return {
    sol1NetCapexUSD,
    sol1AnnualCapitalUSD,
    sol1TotalCostUSD,
    sol2NetCapexUSD,
    sol2AnnualCapitalUSD,
    sol2TotalCostUSD,
    sol3NetCapexUSD,
    sol3AnnualCapitalUSD,
    sol3TotalCostUSD,
    savingsSol1VsSol3,
    savingsSol2VsSol3,
    freightSavingsUSD
  };
}

function updateSimulatorUI() {
  const eco = calculateEconomics();
  
  const elSimNew = document.getElementById('sim-val-capex-new');
  if (elSimNew) elSimNew.textContent = `$${state.sim.capexNewUSD.toFixed(2)}M`;
  
  const elSimRetro = document.getElementById('sim-val-capex-retro');
  if (elSimRetro) elSimRetro.textContent = `$${state.sim.capexRetroUSD.toFixed(2)}M`;
  
  const elSimFreight = document.getElementById('sim-val-freight');
  if (elSimFreight) elSimFreight.textContent = `$${state.sim.freightSavingsUSD.toFixed(1)}M`;
  
  const elSimHorizon = document.getElementById('sim-val-horizon');
  if (elSimHorizon) elSimHorizon.textContent = `${state.sim.horizonYears} Anos`;

  const elResSol1 = document.getElementById('res-sol1-capex');
  if (elResSol1) elResSol1.textContent = fmtUSD(eco.sol1NetCapexUSD * 1e6);

  const elResSol2 = document.getElementById('res-sol2-capex');
  if (elResSol2) elResSol2.textContent = fmtUSD(eco.sol2NetCapexUSD * 1e6);

  const elResSol3 = document.getElementById('res-sol3-capex');
  if (elResSol3) elResSol3.textContent = fmtUSD(eco.sol3NetCapexUSD * 1e6);

  const elResAnn1 = document.getElementById('res-sol1-ann-cap');
  if (elResAnn1) elResAnn1.textContent = `${fmtUSD(eco.sol1AnnualCapitalUSD * 1e6)} / ano`;

  const elResAnn2 = document.getElementById('res-sol2-ann-cap');
  if (elResAnn2) elResAnn2.textContent = `${fmtUSD(eco.sol2AnnualCapitalUSD * 1e6)} / ano por RTG`;

  const elResAnn3 = document.getElementById('res-sol3-ann-cap');
  if (elResAnn3) elResAnn3.textContent = `${fmtUSD(eco.sol3AnnualCapitalUSD * 1e6)} / ano`;
  
  const elSavings = document.getElementById('res-total-savings');
  if (elSavings) {
    elSavings.textContent = `${fmtUSD(eco.savingsSol2VsSol3 * 1e6)}`;
    elSavings.style.color = 'var(--accent-green)';
  }

  updateCharts();
}

function initSimulator() {
  const inCapexNew = document.getElementById('input-capex-new');
  const inCapexRetro = document.getElementById('input-capex-retro');
  const inFreight = document.getElementById('input-freight');
  const inHorizon = document.getElementById('input-horizon');

  if (inCapexNew) {
    inCapexNew.addEventListener('input', (e) => {
      state.sim.capexNewUSD = parseFloat(e.target.value);
      updateSimulatorUI();
    });
  }
  if (inCapexRetro) {
    inCapexRetro.addEventListener('input', (e) => {
      state.sim.capexRetroUSD = parseFloat(e.target.value);
      updateSimulatorUI();
    });
  }
  if (inFreight) {
    inFreight.addEventListener('input', (e) => {
      state.sim.freightSavingsUSD = parseFloat(e.target.value);
      updateSimulatorUI();
    });
  }
  if (inHorizon) {
    inHorizon.addEventListener('input', (e) => {
      state.sim.horizonYears = parseInt(e.target.value);
      updateSimulatorUI();
    });
  }

  updateSimulatorUI();
}

// Fleet Table Rendering
function renderFleetTable() {
  const tbody = document.getElementById('fleet-table-body');
  if (!tbody) return;

  const fleet = window.FLEET_DATA || [];
  const searchInput = document.getElementById('fleet-search');
  const filterModel = document.getElementById('fleet-filter-model');
  const filterLot = document.getElementById('fleet-filter-lot');

  function filterData() {
    const q = (searchInput?.value || '').toLowerCase();
    const model = filterModel?.value || 'ALL';
    const lot = filterLot?.value || 'ALL';

    return fleet.filter(item => {
      const matchSearch = item.rtg.toLowerCase().includes(q) || 
                          item.tag.includes(q) || 
                          item.modelo.toLowerCase().includes(q) ||
                          item.tipo.toLowerCase().includes(q);
      
      const matchModel = model === 'ALL' || item.modelo === model;
      
      let matchLot = true;
      const num = parseInt(item.rtg.replace('RTG ', ''));
      if (lot === '01-03') matchLot = num >= 1 && num <= 3;
      else if (lot === '04-06') matchLot = num >= 4 && num <= 6;
      else if (lot === '08-10') matchLot = num >= 8 && num <= 10;
      else if (lot === '11-14') matchLot = num >= 11 && num <= 14;
      else if (lot === '15-30') matchLot = num >= 15 && num <= 30;
      else if (lot === '31-41') matchLot = num >= 31 && num <= 41;

      return matchSearch && matchModel && matchLot;
    });
  }

  function renderRows() {
    const list = filterData();
    tbody.innerHTML = '';

    list.forEach(item => {
      const tr = document.createElement('tr');
      const num = parseInt(item.rtg.replace('RTG ', ''));

      let rowClass = '';
      let badgeAction = '';
      
      if (item.status === 'Desativado') {
        rowClass = 'decommissioned-row';
        badgeAction = `<span class="badge-tag red">${window.I18N ? window.I18N.get('badge_decommissioned') : 'Desativado / Baixado'}</span>`;
      } else if (num >= 1 && num <= 3) {
        rowClass = 'highlight-preserve';
        badgeAction = `<span class="badge-tag green">${window.I18N ? window.I18N.get('badge_rail_preserve') : 'E-RTG Ferrovia (Requer Redutor/NDT)'}</span>`;
      } else if (num >= 4 && num <= 6) {
        rowClass = 'highlight-donor';
        badgeAction = `<span class="badge-tag blue">${window.I18N ? window.I18N.get('badge_replace_donor') : 'Substituição & Banco Peças Doador'}</span>`;
      } else if (num >= 8 && num <= 10) {
        rowClass = 'highlight-donor';
        badgeAction = `<span class="badge-tag gold">${window.I18N ? window.I18N.get('badge_priority_replace') : 'Substituição Prioritária (Kalmar 21a)'}</span>`;
      } else if (num >= 11 && num <= 14) {
        rowClass = 'highlight-electrify';
        badgeAction = `<span class="badge-tag cyan">${window.I18N ? window.I18N.get('badge_kone_electrify') : 'Konecranes 2008: Eletrificar & Salvar'}</span>`;
      } else if (num >= 31 && num <= 41) {
        rowClass = 'highlight-zpmc';
        badgeAction = `<span class="badge-tag zpmc">${window.I18N ? window.I18N.get('badge_zpmc_benchmark') : 'Benchmark Novo (2,8 anos - R$ 22,9/h)'}</span>`;
      } else {
        badgeAction = `<span class="badge-tag purple">${window.I18N ? window.I18N.get('badge_midlife_electrify') : 'Eletrificação Contínua (Meia-Vida)'}</span>`;
      }

      tr.className = rowClass;

      const costHrFormatted = item.custoHora > 0 ? fmtBRL(item.custoHora) : (item.status === 'Desativado' ? '-' : 'R$ 0,00');
      const cost8mFormatted = item.custo8m > 0 ? fmtBRL(item.custo8m) : (item.status === 'Desativado' ? '-' : 'R$ 0,00');
      const hoursFormatted = item.horas8m > 0 ? fmtNum(item.horas8m) + ' h' : (item.status === 'Desativado' ? '-' : '0 h');
      const yearsLabel = window.I18N ? window.I18N.get('card_lbl_years') : 'anos';

      tr.innerHTML = `
        <td><strong>${item.rtg}</strong></td>
        <td><code>#${item.tag}</code></td>
        <td>${item.modelo}</td>
        <td>${item.ano} (${item.idade} ${yearsLabel})</td>
        <td>${item.tipo}</td>
        <td>${hoursFormatted}</td>
        <td><strong>${costHrFormatted}</strong></td>
        <td>${cost8mFormatted}</td>
        <td>${badgeAction}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  searchInput?.addEventListener('input', renderRows);
  filterModel?.addEventListener('change', renderRows);
  filterLot?.addEventListener('change', renderRows);

  renderRows();
}

// ========================================================
// Kayo Matrix (Rev 1.0) - Interactive System & Charts
// ========================================================
let currentKayoFilter = 'all';
let currentKayoView = 'cards';
let kayoControlsInitialized = false;

function initKayoControls() {
  if (kayoControlsInitialized) return;
  kayoControlsInitialized = true;

  // Filter buttons
  const filterBtns = document.querySelectorAll('.kayo-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentKayoFilter = btn.dataset.filter;
      updateKayoViews();
    });
  });

  // View switch buttons
  const viewBtns = document.querySelectorAll('.kayo-view-btn');
  viewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      viewBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentKayoView = btn.dataset.view;

      const cardsView = document.getElementById('kayo-cards-view');
      const chartsView = document.getElementById('kayo-charts-view');
      const tableView = document.getElementById('kayo-table-view');
      const ecoView = document.getElementById('kayo-economic-view');

      if (cardsView) cardsView.style.display = currentKayoView === 'cards' ? 'block' : 'none';
      if (chartsView) chartsView.style.display = currentKayoView === 'charts' ? 'block' : 'none';
      if (tableView) tableView.style.display = currentKayoView === 'table' ? 'block' : 'none';
      if (ecoView) ecoView.style.display = currentKayoView === 'economic' ? 'block' : 'none';

      if (currentKayoView === 'charts') {
        setTimeout(renderKayoCharts, 50);
      }
    });
  });
}

function getFilteredCranes() {
  const data = window.KAYO_ASSESSMENT_DATA;
  if (!data || !data.cranes) return [];

  return data.cranes.filter(cr => {
    const num = parseInt(cr.rtg.replace(/\D/g, ''), 10);
    if (currentKayoFilter === '04-06') return num >= 4 && num <= 6;
    if (currentKayoFilter === '07') return num === 7;
    if (currentKayoFilter === '08-10') return num >= 8 && num <= 10;
    if (currentKayoFilter === '11-14') return num >= 11 && num <= 14;
    return true; // 'all'
  });
}

function updateKayoViews() {
  renderKayoCards();
  renderKayoTable();
  renderKayoEconomic();
  if (currentKayoView === 'charts') {
    renderKayoCharts();
  }
}

// Funções auxiliares para tradução dinâmica do Kayo
function getCraneEvidence(cr) {
  const key = 'evidence_' + cr.rtg.replace(' ', '_');
  return window.I18N ? window.I18N.get(key) : cr.evidence;
}

function getCraneStrategy(cr) {
  const n = parseInt(cr.rtg.replace(/\D/g, ''), 10);
  let key = '';
  if (n >= 4 && n <= 6) key = 'strategy_RTG_04_06';
  else if (n === 7) key = 'strategy_RTG_07';
  else if (n >= 8 && n <= 10) key = 'strategy_RTG_08_10';
  else if (n >= 11 && n <= 14) key = 'strategy_RTG_11_14';
  return window.I18N && key ? window.I18N.get(key) : cr.estrategiaSugerida;
}

function getCraneCMPRec(cr) {
  const n = parseInt(cr.rtg.replace(/\D/g, ''), 10);
  let key = '';
  if (n >= 4 && n <= 6) key = 'cmprec_RTG_04_06';
  else if (n === 7) key = 'cmprec_RTG_07';
  else if (n >= 8 && n <= 10) key = 'cmprec_RTG_08_10';
  else if (n >= 11 && n <= 14) key = 'cmprec_RTG_11_14';
  return window.I18N && key ? window.I18N.get(key) : cr.recomendacaoCMP;
}

// 1. Render Kayo Cards View
function renderKayoCards() {
  const container = document.getElementById('kayo-matrix-cards');
  if (!container) return;

  const data = window.KAYO_ASSESSMENT_DATA;
  if (!data || !data.cranes) return;

  const cranes = getFilteredCranes();
  container.innerHTML = '';

  const yearsLabel = window.I18N ? window.I18N.get('card_lbl_years') : 'anos';
  const cmpCondLabel = window.I18N ? window.I18N.get('card_lbl_cmp_cond') : 'Condição Média CMP';
  const tcpStratLabel = window.I18N ? window.I18N.get('card_lbl_tcp_strat') : 'Estratégia TCP';
  const techEvidLabel = window.I18N ? window.I18N.get('card_lbl_tech_evid') : 'Evidência Técnica Auditada:';
  const subsystemsLabel = window.I18N ? window.I18N.get('card_lbl_subsystems') : '10 Subsistemas Avaliados:';
  const decommissionedLabel = window.I18N ? window.I18N.get('card_lbl_decommissioned') : 'Desativado';

  cranes.forEach(cr => {
    const card = document.createElement('div');
    card.className = 'kpi-card';
    card.style.borderLeft = cr.rtg === 'RTG 07' ? '4px solid var(--accent-red)' : 
      (cr.scores[0] <= 2.2 ? '4px solid var(--cmp-gold)' : '4px solid var(--accent-green)');

    let scoresHtml = '';
    data.systems.forEach((sys, idx) => {
      const score = cr.scores[idx];
      let colorClass = 'color:var(--accent-green)';
      if (score < 2.0) colorClass = 'color:var(--accent-red); font-weight:800;';
      else if (score < 3.0) colorClass = 'color:var(--cmp-gold); font-weight:700;';

      const sysName = window.I18N ? window.I18N.get('sys_' + (idx + 1)) : sys.name;
      const zeroText = window.I18N && window.I18N.currentLang === 'en' ? '0.0 (Scrapped)' :
                       window.I18N && window.I18N.currentLang === 'zh' ? '0.0 (報廢除籍)' : '0.0 (Baixado)';

      scoresHtml += `
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; padding:3px 0; border-bottom:1px solid rgba(255,255,255,0.03);">
          <span style="color:var(--text-muted);">${sysName}:</span>
          <strong style="${colorClass}">
            ${score > 0 ? score.toFixed(1) : zeroText}
          </strong>
        </div>
      `;
    });

    const isKone1114 = cr.rtg >= 'RTG 11' && cr.rtg <= 'RTG 14';
    const cmpRec = getCraneCMPRec(cr);
    const tcpStrategy = getCraneStrategy(cr);
    const techEvidence = getCraneEvidence(cr);

    card.innerHTML = `
      <div class="kpi-header" style="margin-bottom:0.4rem;">
        <div>
          <span class="kpi-title" style="font-size:1.1rem; font-weight:800; color:var(--text-main);">${cr.rtg} ${cr.tag ? '(' + cr.tag + ')' : ''}</span>
          <div style="font-size:0.75rem; color:var(--text-dim);">${cr.fabricante} • ${cr.ano} (${cr.idade} ${yearsLabel}) • ${cr.modelo}</div>
        </div>
        <span class="badge-tag ${cr.rtg === 'RTG 07' ? 'red' : (cr.condicaoGeral < 2.5 ? 'gold' : 'green')}">
          ${cr.rtg === 'RTG 07' ? decommissionedLabel : cmpRec}
        </span>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:flex-end; background:rgba(0,0,0,0.2); padding:0.6rem 0.8rem; border-radius:var(--radius-sm); margin:0.5rem 0;">
        <div>
          <div style="font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">${cmpCondLabel}</div>
          <div style="font-size:1.5rem; font-weight:800; color:${cr.condicaoGeral >= 2.6 ? 'var(--accent-green)' : (cr.condicaoGeral >= 2.0 ? 'var(--cmp-gold)' : 'var(--accent-red)')};">
            ${cr.condicaoGeral > 0 ? cr.condicaoGeral.toFixed(1) + ' / 5.0' : (window.I18N ? window.I18N.get('card_lbl_scrapped') : '0.0 (Baixado)')}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">${tcpStratLabel}</div>
          <div style="font-size:0.8rem; font-weight:700; color:var(--tcp-blue-light);">${tcpStrategy}</div>
        </div>
      </div>

      <div style="background:rgba(255,255,255,0.02); border-left:3px solid ${isKone1114 ? 'var(--accent-green)' : 'var(--cmp-gold)'}; padding:0.5rem 0.75rem; margin-bottom:0.75rem; border-radius:0 4px 4px 0;">
        <div style="font-size:0.7rem; color:var(--text-dim); text-transform:uppercase; font-weight:700;">${techEvidLabel}</div>
        <div style="font-size:0.78rem; color:var(--text-main); line-height:1.35; margin-top:2px;">${techEvidence}</div>
      </div>

      <div style="border-top:1px solid rgba(255,255,255,0.06); padding-top:0.4rem;">
        <div style="font-size:0.7rem; color:var(--text-dim); text-transform:uppercase; margin-bottom:0.3rem; font-weight:700;">${subsystemsLabel}</div>
        ${scoresHtml}
      </div>
    `;
    container.appendChild(card);
  });
}

// 2. Render Kayo Table View (11 RTGs x 10 Subsistemas)
function renderKayoTable() {
  const tbody = document.getElementById('kayo-subs-tbody');
  if (!tbody) return;

  const data = window.KAYO_ASSESSMENT_DATA;
  if (!data || !data.cranes) return;

  const cranes = getFilteredCranes();
  tbody.innerHTML = '';

  cranes.forEach(cr => {
    const tr = document.createElement('tr');
    
    let scoresTds = '';
    cr.scores.forEach(s => {
      let bg = 'rgba(16,185,129,0.15); color:var(--accent-green);';
      if (s < 2.0) bg = 'rgba(239,68,68,0.2); color:var(--accent-red); font-weight:800;';
      else if (s < 3.0) bg = 'rgba(245,158,11,0.15); color:var(--cmp-gold); font-weight:700;';

      scoresTds += `<td style="text-align:center; background:${bg};">${s > 0 ? s.toFixed(1) : '-'}</td>`;
    });

    tr.innerHTML = `
      <td style="font-weight:700; color:var(--tcp-blue-light);">${cr.rtg}</td>
      <td>${cr.fabricante}</td>
      <td>${cr.ano}</td>
      <td>${cr.idade}a</td>
      ${scoresTds}
      <td style="text-align:center; font-weight:800; color:${cr.condicaoGeral >= 2.6 ? 'var(--accent-green)' : 'var(--cmp-gold)'};">
        ${cr.condicaoGeral.toFixed(1)}
      </td>
      <td>
        <span class="badge-tag ${cr.rtg === 'RTG 07' ? 'red' : (cr.condicaoGeral < 2.5 ? 'gold' : 'green')}" style="font-size:0.7rem;">
          ${getCraneCMPRec(cr)}
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 3. Render Kayo Economic Assessment View (TCO 5 Anos CMP)
function renderKayoEconomic() {
  const tbody = document.getElementById('kayo-eco-tbody');
  if (!tbody) return;

  const cranes = getFilteredCranes();
  tbody.innerHTML = '';

  cranes.forEach(cr => {
    const tr = document.createElement('tr');
    const pctCapex = cr.capexNovoUSD > 0 ? Math.round((cr.capexRetrofitUSD / cr.capexNovoUSD) * 100) : 0;
    const yrsText = cr.capexRetrofitUSD > 0 ? (cr.rtg >= 'RTG 11' ? (window.I18N && window.I18N.currentLang === 'en' ? '7 years' : (window.I18N && window.I18N.currentLang === 'zh' ? '7年' : '7 anos')) : (window.I18N && window.I18N.currentLang === 'en' ? '5 years' : (window.I18N && window.I18N.currentLang === 'zh' ? '5年' : '5 anos'))) : '0';

    tr.innerHTML = `
      <td style="font-weight:700; color:var(--tcp-blue-light);">${cr.rtg}</td>
      <td>${fmtUSD(cr.custoAnualManutUSD)}</td>
      <td style="font-weight:600; color:${cr.capexRetrofitUSD > 1000000 ? 'var(--cmp-gold)' : 'var(--accent-green)'};">
        ${cr.capexRetrofitUSD > 0 ? fmtUSD(cr.capexRetrofitUSD) : 'US$ 0 (Baixado)'}
      </td>
      <td style="text-align:center;">${yrsText}</td>
      <td style="font-weight:700; color:var(--text-main);">${fmtUSD(cr.custo5AnosRetrofitUSD)}</td>
      <td>${fmtUSD(cr.capexNovoUSD)}</td>
      <td style="font-weight:700; color:var(--accent-green);">${fmtUSD(cr.custo5AnosNovoUSD)}</td>
      <td style="text-align:center; font-weight:700; color:${pctCapex > 50 ? 'var(--accent-red)' : 'var(--accent-green)'};">
        ${pctCapex}%
      </td>
      <td>
        <span class="badge-tag ${cr.rtg === 'RTG 07' ? 'red' : (cr.rtg >= 'RTG 11' ? 'green' : 'blue')}" style="font-size:0.7rem;">
          ${getCraneCMPRec(cr)}
        </span>
      </td>
      <td style="font-size:0.75rem; color:var(--tcp-blue-light); font-weight:600;">
        ${getCraneStrategy(cr)}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 4. Render Kayo Charts (Radar & Bar Chart)
function renderKayoCharts() {
  if (typeof Chart === 'undefined') return;

  const data = window.KAYO_ASSESSMENT_DATA;
  if (!data || !data.systems) return;

  // Radar Chart
  const radarCtx = document.getElementById('kayoRadarChart');
  if (radarCtx) {
    if (state.charts.kayoRadar) {
      state.charts.kayoRadar.destroy();
    }

    // Calcula medias por grupo nos 10 subsistemas
    const calcGroupAvg = (minNum, maxNum) => {
      const crs = data.cranes.filter(c => {
        const n = parseInt(c.rtg.replace(/\D/g, ''), 10);
        return n >= minNum && n <= maxNum;
      });
      return data.systems.map((s, idx) => {
        const sum = crs.reduce((acc, c) => acc + c.scores[idx], 0);
        return crs.length > 0 ? +(sum / crs.length).toFixed(2) : 0;
      });
    };

    const avg0406 = calcGroupAvg(4, 6);
    const avg0810 = calcGroupAvg(8, 10);
    const avg1114 = calcGroupAvg(11, 14);

    const lang = window.I18N ? window.I18N.currentLang : 'en';
    const label1114 = lang === 'en' ? 'RTG 11 to 14 (Konecranes 2008)' :
                      lang === 'zh' ? 'RTG 11-14 號 (2008年科尼)' : 'RTG 11 ao 14 (Konecranes 2008)';
    const label0810 = lang === 'en' ? 'RTG 08 to 10 (Kalmar 2004)' :
                      lang === 'zh' ? 'RTG 08-10 號 (2004年卡爾瑪)' : 'RTG 08 ao 10 (Kalmar 2004)';
    const label0406 = lang === 'en' ? 'RTG 04 to 06 (Konecranes 2001)' :
                      lang === 'zh' ? 'RTG 04-06 號 (2001年科尼)' : 'RTG 04 ao 06 (Konecranes 2001)';

    state.charts.kayoRadar = new Chart(radarCtx.getContext('2d'), {
      type: 'radar',
      data: {
        labels: data.systems.map((s, idx) => {
          const sysName = window.I18N ? window.I18N.get('sys_' + (idx + 1)) : s.name;
          return sysName.replace(' System', '').replace('Sistema ', '');
        }),
        datasets: [
          {
            label: label1114,
            data: avg1114,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            pointBackgroundColor: '#10b981',
            borderWidth: 2
          },
          {
            label: label0810,
            data: avg0810,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            pointBackgroundColor: '#f59e0b',
            borderWidth: 2
          },
          {
            label: label0406,
            data: avg0406,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            pointBackgroundColor: '#ef4444',
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            angleLines: { color: 'rgba(255,255,255,0.08)' },
            grid: { color: 'rgba(255,255,255,0.08)' },
            pointLabels: { color: '#cbd5e1', font: { size: 10 } },
            ticks: { color: '#94a3b8', backdropColor: 'transparent', min: 0, max: 5, stepSize: 1 }
          }
        },
        plugins: {
          legend: { position: 'top', labels: { color: '#f0f4f8', font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} / 5.0`
            }
          }
        }
      }
    });
  }

  // TCO 5 Years Bar Chart
  const barCtx = document.getElementById('kayoTcoBarChart');
  if (barCtx) {
    if (state.charts.kayoTcoBar) {
      state.charts.kayoTcoBar.destroy();
    }

    const cranes = data.cranes.filter(c => c.rtg !== 'RTG 07');
    const lang = window.I18N ? window.I18N.currentLang : 'en';
    const labelRetrofit = lang === 'en' ? '5Y CMP Retrofit Cost (CAPEX + OPEX)' :
                          lang === 'zh' ? '5年招商局大修改造總成本 (CAPEX + OPEX)' : 'Custo 5Y Retrofit CMP (CAPEX + OPEX)';
    const labelNew = lang === 'en' ? '5Y CMP New E-RTG Cost (US$ 2.68M)' :
                     lang === 'zh' ? '5年新購 E-RTG 總成本 (268萬 美元)' : 'Custo 5Y RTG Novo CMP (US$ 2.68M)';
    const yTitle = lang === 'en' ? 'USD Millions ($M)' :
                   lang === 'zh' ? '百萬美元 ($M)' : 'Milhões de USD ($M)';

    state.charts.kayoTcoBar = new Chart(barCtx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: cranes.map(c => c.rtg),
        datasets: [
          {
            label: labelRetrofit,
            data: cranes.map(c => +(c.custo5AnosRetrofitUSD / 1000000).toFixed(2)),
            backgroundColor: cranes.map(c => c.rtg >= 'RTG 11' ? 'rgba(16, 185, 129, 0.85)' : 'rgba(245, 158, 11, 0.85)'),
            borderRadius: 4
          },
          {
            label: labelNew,
            data: cranes.map(c => +(c.custo5AnosNovoUSD / 1000000).toFixed(2)),
            backgroundColor: 'rgba(56, 189, 248, 0.4)',
            borderColor: '#38bdf8',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { color: '#cbd5e1' } },
          y: {
            grid: { color: 'rgba(255,255,255,0.06)' },
            ticks: {
              color: '#94a3b8',
              callback: (val) => '$' + val + 'M'
            },
            title: { display: true, text: yTitle, color: '#94a3b8' }
          }
        },
        plugins: {
          legend: { position: 'top', labels: { color: '#f0f4f8', font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: $${ctx.raw}M USD`
            }
          }
        }
      }
    });
  }
}

function renderKayoMatrix() {
  initKayoControls();
  updateKayoViews();
}

// Charts Initialization
function renderCharts() {
  if (typeof Chart === 'undefined') return;

  Chart.defaults.color = '#94a3b8';
  Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.08)';

  const lang = window.I18N ? window.I18N.currentLang : 'en';

  // 1. Chart LCC Over Time (3 Solutions + As-Is)
  const ctxLcc = document.getElementById('chart-lcc-horizon')?.getContext('2d');
  if (ctxLcc) {
    if (state.charts.lcc) state.charts.lcc.destroy();

    const lccLabels = lang === 'en' ? ['Year 0', 'Year 3', 'Year 6', 'Year 10', 'Year 15', 'Year 20'] :
                      lang === 'zh' ? ['第0年', '第3年', '第6年', '第10年', '第15年', '第20年'] :
                      ['Ano 0', 'Ano 3', 'Ano 6', 'Ano 10', 'Ano 15', 'Ano 20'];

    const lblSol1 = lang === 'en' ? 'Solution 1: 10 New (04-14) + Preserve 01-03 with Donors' :
                    lang === 'zh' ? '方案一：10臺新機 (04-14) + 拆解保障 01-03' : 'Solução 1: 10 Novos (04-14) + Preserva 01-03 com Doador';

    const lblSol2 = lang === 'en' ? 'Solution 2: 10 New (01-10) + Electrify RTG 11-14 (Optimal LCC)' :
                    lang === 'zh' ? '方案二：10臺新機 (01-10) + 11-14油改電 (最優LCC)' : 'Solução 2: 10 Novos (01-10) + Eletrificar RTG 11-14 (Ótimo LCC)';

    const lblSol3 = lang === 'en' ? 'Solution 3: Retrofit 04-14 (CMP Standard) + Re-investment 6Y' :
                    lang === 'zh' ? '方案三：04-14大修改造 (招商局標準) + 6年後再投資' : 'Solução 3: Retrofit 04-14 (Norma CMP) + Re-investimento 6a';

    const lblAsIs = lang === 'en' ? 'As-Is Scenario: Retain Old Fleet without Action' :
                    lang === 'zh' ? '維持現狀：不做處置維持老舊車隊' : 'Cenário As-Is: Manter Frota Antiga sem Ação';

    const yTitleLcc = lang === 'en' ? 'Cumulative Cost (USD Millions)' :
                      lang === 'zh' ? '累計總成本 (百萬美元)' : 'Custo Acumulado (Milhões US$)';

    state.charts.lcc = new Chart(ctxLcc, {
      type: 'line',
      data: {
        labels: lccLabels,
        datasets: [
          {
            label: lblSol1,
            data: [20.0, 21.2, 22.4, 24.0, 26.0, 28.0],
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.08)',
            fill: false,
            tension: 0.3,
            borderWidth: 2
          },
          {
            label: lblSol2,
            data: [20.8, 21.8, 22.8, 24.2, 25.8, 27.5],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.3,
            borderWidth: 3
          },
          {
            label: lblSol3,
            data: [13.5, 17.5, 21.5, 33.0, 42.0, 52.0],
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.05)',
            fill: false,
            borderDash: [5, 5],
            tension: 0.3,
            borderWidth: 2
          },
          {
            label: lblAsIs,
            data: [0, 11.5, 24.0, 42.0, 68.0, 95.0],
            borderColor: '#ef4444',
            borderDash: [3, 3],
            tension: 0.3,
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: US$ ${ctx.parsed.y.toFixed(1)}M`
            }
          }
        },
        scales: {
          y: {
            title: { display: true, text: yTitleLcc }
          }
        }
      }
    });
  }

  // 2. Chart Capital Cost per Year of Life Extension
  const ctxAnn = document.getElementById('chart-capital-annual')?.getContext('2d');
  if (ctxAnn) {
    if (state.charts.ann) state.charts.ann.destroy();

    const annLabels = lang === 'en' ? ['Solution 1: New (04-14)', 'Solution 2: New (01-10) + Electr. 11-14', 'Solution 3: CMP Retrofit'] :
                      lang === 'zh' ? ['方案一：新機 (04-14)', '方案二：新機(01-10) + 11-14油改電', '方案三：招商局大修改造'] :
                      ['Solução 1: Novo (04-14)', 'Solução 2: Novo (01-10) + Eletr. 11-14', 'Solução 3: Retrofit CMP'];

    const annDatasetLabel = lang === 'en' ? 'Annualized CAPEX per Crane (US$/Useful Year)' :
                            lang === 'zh' ? '單臺設備年化資本開支 (美元/有效年限)' : 'CAPEX Anualizado por Máquina (US$/Ano Útil)';

    const annTooltipSuffix = lang === 'en' ? ' / useful year' :
                             lang === 'zh' ? ' / 有效年限' : ' / ano de utilidade';

    const yTitleAnn = lang === 'en' ? 'US$ / Residual Year' :
                      lang === 'zh' ? '美元 / 殘餘年限' : 'US$ / Ano Residual';

    state.charts.ann = new Chart(ctxAnn, {
      type: 'bar',
      data: {
        labels: annLabels,
        datasets: [{
          label: annDatasetLabel,
          data: [91000, 94500, 225000],
          backgroundColor: ['#38bdf8', '#10b981', '#f59e0b'],
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `US$ ${ctx.parsed.y.toLocaleString()}${annTooltipSuffix}`
            }
          }
        },
        scales: {
          y: {
            title: { display: true, text: yTitleAnn }
          }
        }
      }
    });
  }

  // 3. Chart Critical Hourly Cost (Top Guindastes)
  const ctxCost = document.getElementById('chart-hourly-cost')?.getContext('2d');
  if (ctxCost) {
    const fleet = window.FLEET_DATA || [];
    const topCostly = [...fleet]
      .filter(f => f.status !== 'Desativado' && f.custoHora > 0)
      .sort((a, b) => b.custoHora - a.custoHora)
      .slice(0, 10);

    state.charts.hourly = new Chart(ctxCost, {
      type: 'bar',
      data: {
        labels: topCostly.map(c => c.rtg),
        datasets: [{
          label: 'Custo por Hora Operada (R$/h)',
          data: topCostly.map(c => c.custoHora),
          backgroundColor: topCostly.map(c => {
            const num = parseInt(c.rtg.replace('RTG ', ''));
            if (num >= 11 && num <= 14) return '#f59e0b'; // Konecranes 2008 (gerador crítico)
            if (num >= 4 && num <= 10) return '#ef4444'; // Crítico antigo
            return '#0284c7';
          }),
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `R$ ${ctx.parsed.y.toFixed(2)}/h`
            }
          }
        },
        scales: {
          y: {
            title: { display: true, text: 'R$ / Hora' }
          }
        }
      }
    });
  }

  // 4. Chart ZPMC Benchmark Comparison
  const ctxZpmc = document.getElementById('chart-zpmc-benchmark')?.getContext('2d');
  if (ctxZpmc) {
    state.charts.zpmc = new Chart(ctxZpmc, {
      type: 'bar',
      data: {
        labels: [
          'ZPMC 2024 (2,8 anos)',
          'RTG 01-03 (E-RTG Ferrovia)',
          'RTG 11-14 Pós-Eletrificação (Proj.)',
          'Média da Frota Total',
          'RTG 04-06 (Konecranes 2001)',
          'RTG 11-14 Atual (Diesel 2008)'
        ],
        datasets: [{
          label: 'Custo Médio por Hora Operada (R$/h)',
          data: [22.90, 48.50, 57.03, 64.09, 91.77, 162.93],
          backgroundColor: [
            '#10b981', // ZPMC
            '#06b6d4', // RTG 01-03
            '#38bdf8', // 11-14 pós-eletr.
            '#8b5cf6', // Média
            '#f59e0b', // 04-06
            '#ef4444'  // 11-14 atual
          ],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `R$ ${ctx.parsed.y.toFixed(2)} / hora operada`
            }
          }
        },
        scales: {
          y: {
            title: { display: true, text: 'R$ / Hora' }
          }
        }
      }
    });
  }

  // 5. Chart Genset vs Other Costs in RTG 11-14
  const ctxGenset = document.getElementById('chart-genset-impact')?.getContext('2d');
  if (ctxGenset) {
    state.charts.genset = new Chart(ctxGenset, {
      type: 'doughnut',
      data: {
        labels: [
          'Grupo Gerador Diesel & Combustível (Eliminado c/ Eletrificação)',
          'Desgastes Mecânicos & Estruturais Residuais (Mantidos)'
        ],
        datasets: [{
          data: [65, 35],
          backgroundColor: ['#ef4444', '#0284c7'],
          borderWidth: 2,
          borderColor: '#1f2c4c'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ~${ctx.parsed}% dos custos`
            }
          }
        }
      }
    });
  }
}

function updateCharts() {
  if (!state.charts.lcc || !state.charts.ann) return;
  const eco = calculateEconomics();

  const h = state.sim.horizonYears;
  state.charts.lcc.data.datasets[0].data = [
    eco.sol1NetCapexUSD,
    eco.sol1NetCapexUSD + (h * 0.15 * 0.4),
    eco.sol1NetCapexUSD + (h * 0.15 * 0.8),
    eco.sol1NetCapexUSD + (h * 0.15 * 1.3),
    eco.sol1NetCapexUSD + (h * 0.15 * 1.9),
    eco.sol1TotalCostUSD
  ];

  state.charts.lcc.data.datasets[1].data = [
    eco.sol2NetCapexUSD,
    eco.sol2NetCapexUSD + (h * 0.14 * 0.4),
    eco.sol2NetCapexUSD + (h * 0.14 * 0.8),
    eco.sol2NetCapexUSD + (h * 0.14 * 1.3),
    eco.sol2NetCapexUSD + (h * 0.14 * 1.9),
    eco.sol2TotalCostUSD
  ];

  state.charts.lcc.data.datasets[2].data = [
    eco.sol3NetCapexUSD,
    eco.sol3NetCapexUSD + 4.0,
    eco.sol3NetCapexUSD + 8.5,
    eco.sol3NetCapexUSD + 18.0,
    eco.sol3NetCapexUSD + 30.0,
    eco.sol3TotalCostUSD
  ];
  state.charts.lcc.update();

  state.charts.ann.data.datasets[0].data = [
    Math.round(eco.sol1AnnualCapitalUSD * 1e6),
    Math.round(eco.sol2AnnualCapitalUSD * 1e6),
    Math.round(eco.sol3AnnualCapitalUSD * 1e6)
  ];
  state.charts.ann.update();
}

// Modal Export / Dossier
function initModal() {
  const modal = document.getElementById('report-modal');
  const openBtn = document.getElementById('btn-open-report');
  const closeBtn = document.getElementById('btn-close-modal');
  const printBtn = document.getElementById('btn-print-report');

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      modal.classList.add('open');
    });
  }
  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('open');
    });
  }
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  }
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }
}
