// VA Wealth Builder — Real dollars display, child ages out at 18, external rates support
// Model in NOMINAL dollars (proper monthly compounding + COLA), then DEF LATE to today’s dollars.
// Extra monthly is flat in nominal dollars (no COLA). Results show today's $ @ chosen inflation.

let growthChart = null;
let vaCompensationRates = null;  // from JSON or fallback
let ratesYear = "Embedded";

document.addEventListener('DOMContentLoaded', () => {
  const els = {
    rating: document.getElementById('rating'),
    dependents: document.getElementById('dependents'),
    currentAge: document.getElementById('currentAge'),
    retirementAge: document.getElementById('retirementAge'),
    returnRate: document.getElementById('returnRate'),
    rrVal: document.getElementById('returnRateValue'),
    inflation: document.getElementById('inflation'),
    extraInvestment: document.getElementById('extraInvestment'),
    exVal: document.getElementById('extraInvestmentValue'),
    childFields: document.getElementById('childFields'),
    childAge: document.getElementById('childAge'),
    depNotice: document.getElementById('depNotice'),
    result: document.getElementById('result'),
    resultMeta: document.getElementById('resultMeta'),
    chartCanvas: document.getElementById('growthChart'),
    ratesYear: document.getElementById('ratesYear'),
  };

  const fmtCurrency0 = (n) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
      .format(Number(n) || 0);
  const fmtPct1 = (p) => `${(Number(p) || 0).toFixed(1)}%`;

  // init readouts
  els.rrVal.textContent = fmtPct1(els.returnRate.value);
  els.exVal.textContent = fmtCurrency0(els.extraInvestment.value);
  updateResultMeta();

  // events
  [
    els.rating, els.dependents, els.returnRate, els.inflation,
    els.extraInvestment, els.childAge
  ].forEach(el => el?.addEventListener('input', () => {
    if (event?.target === els.returnRate) els.rrVal.textContent = fmtPct1(els.returnRate.value);
    if (event?.target === els.extraInvestment) els.exVal.textContent = fmtCurrency0(els.extraInvestment.value);
    if (event?.target === els.inflation) updateResultMeta();
    toggleDepNotice();
    toggleChildFields();
    calculateProjectionAndUpdate();
  }));

  [els.currentAge, els.retirementAge].forEach(el => {
    el.addEventListener('input', onAgePreview);
    el.addEventListener('change', onAgeCommit);
    el.addEventListener('blur', onAgeCommit);
  });

  function updateResultMeta() {
    const infl = clampPct(els.inflation.value, 0, 20, 2.5);
    els.resultMeta.textContent = `(today’s $ @ ${fmtPct1(infl)})`;
  }

  function onAgePreview() {
    const maybe = readAgesRaw();
    if (isValidAgePair(maybe.cur, maybe.ret)) calculateProjectionAndUpdate({ cur: maybe.cur, ret: maybe.ret });
  }
  function onAgeCommit() { clampAndApplyAges(true); calculateProjectionAndUpdate(); }

  function toggleDepNotice() {
    const rating = String(els.rating?.value || '');
    const hasDependents = (els.dependents?.value || 'alone') !== 'alone';
    const show = (rating === '10' || rating === '20') && hasDependents;
    if (els.depNotice) els.depNotice.hidden = !show;
  }
  function toggleChildFields() {
    const dep = els.dependents?.value || 'alone';
    const hasChild = dep.includes('child');
    if (els.childFields) els.childFields.hidden = !hasChild;
  }

  // ages helpers
  function readAgesRaw() {
    return {
      cur: parseInt(els.currentAge?.value || '22', 10),
      ret: parseInt(els.retirementAge?.value || '60', 10),
    };
  }
  function clampAndApplyAges(writeBack=false) {
    let { cur, ret } = readAgesRaw();
    cur = Number.isInteger(cur) ? clamp(cur, 18, 110) : 22;
    ret = Number.isInteger(ret) ? clamp(ret, 19, 110) : 60;
    if (ret <= cur) ret = cur + 1;
    if (writeBack) { els.currentAge.value = cur; els.retirementAge.value = ret; }
    return { cur, ret };
  }
  function isValidAgePair(cur, ret) {
    return Number.isInteger(cur) && Number.isInteger(ret) && cur >= 18 && ret > cur && ret <= 110;
  }
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  function clampPct(v, lo, hi, def) {
    const x = Number.parseFloat(v);
    if (!Number.isFinite(x)) return def;
    return Math.max(lo, Math.min(hi, x));
  }

  // load rates JSON (fallback to embedded)
  loadRatesJSON('data/rates-2025.json').finally(() => {
    if (els.ratesYear) els.ratesYear.textContent = ratesYear;
    toggleDepNotice();
    toggleChildFields();
    clampAndApplyAges(true);
    calculateProjectionAndUpdate();
  });

  async function loadRatesJSON(url) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const payload = await res.json();
      if (payload?.monthly && typeof payload.monthly === 'object') {
        vaCompensationRates = payload.monthly;
        ratesYear = String(payload.year ?? 'Unknown');
      } else throw new Error('Bad schema');
    } catch (_) {
      vaCompensationRates = embeddedRates; // defined at bottom
      ratesYear = 'Embedded';
    }
  }

  // Main calculation (optionally with override ages during typing)
  function calculateProjectionAndUpdate(override=null) {
    const rating = (els.rating?.value || '10');
    const depKey = (els.dependents?.value || 'alone');

    let cur, ret;
    if (override && Number.isInteger(override.cur) && Number.isInteger(override.ret)) {
      cur = override.cur; ret = override.ret;
    } else {
      ({ cur, ret } = clampAndApplyAges(false));
    }

    const years = Math.max(0, ret - cur);
    const monthsTotal = years * 12;

    // Rates
    const nominalAnnual = Number.parseFloat(els.returnRate?.value || '0') / 100;
    const monthlyRate = Math.pow(1 + nominalAnnual, 1/12) - 1; // correct compounding

    // Inflation (used for COLA + deflation to today’s $)
    const inflPct = clampPct(els.inflation?.value, 0, 20, 2.5);
    const infl = inflPct / 100;

    // Extra monthly (flat nominal)
    const extraNominal = Number.parseFloat(els.extraInvestment?.value || '0') || 0;

    // Break depKey into base-without-child + child-addon
    const { baseNoChild, childAddon } = decomposeRate(rating, depKey);

    // Child months remaining (if applicable)
    const hasChild = depKey.includes('child');
    const childAgeNow = hasChild ? clamp(Number.parseInt(els.childAge?.value || '0', 10) || 0, 0, 17) : 0;
    const monthsChildRemaining = hasChild ? Math.max(0, Math.min(monthsTotal, (18 - childAgeNow) * 12)) : 0;

    // Simulate in NOMINAL then store DEFLATED point each year
    let totalNominal = 0;
    let baseThisYear = baseNoChild;   // nominal this year
    let childThisYear = childAddon;   // nominal this year

    const labels = [cur];
    const dataReal = [0];
    let processed = 0;

    for (let y = 0; y < years; y++) {
      for (let m = 0; m < 12; m++) {
        const childActive = processed < monthsChildRemaining;
        const monthlyContributionNominal = baseThisYear + (childActive ? childThisYear : 0) + extraNominal;
        totalNominal = (totalNominal + monthlyContributionNominal) * (1 + monthlyRate);
        processed++;
      }
      // Deflate to today's dollars for the end-of-year snapshot
      const deflator = Math.pow(1 + infl, y + 1);
      const realValue = totalNominal / deflator;

      labels.push(cur + y + 1);
      dataReal.push(realValue);

      // Apply COLA to VA components for the next year (extra stays flat nominal)
      baseThisYear *= (1 + infl);
      childThisYear *= (1 + infl);
    }

    // Update output (rounded to nearest $100)
    const last = dataReal[dataReal.length - 1] || 0;
    const rounded = Math.round(last / 100) * 100;
    els.result.textContent = fmtCurrency0(rounded);

    // Update chart
    const maxY = last || 0;
    const { niceMax, step } = computeNiceAxis(maxY, 6);
    renderOrUpdateChart(
      els.chartCanvas,
      labels,
      dataReal,
      niceMax,
      step,
      `Projected Balance (today’s $ @ ${fmtPct1(inflPct)} inflation)`
    );
  }

  // Given a dep key, split into base w/o child + child addon for the rating
  function decomposeRate(rating, depKey) {
    const r = String(rating);
    const tbl = vaCompensationRates || embeddedRates;
    const get = (key) => (tbl[key] && tbl[key][r]) || undefined;

    const alone = get('alone') ?? 0;

    if (depKey === 'with_spouse_and_child') {
      const spouse = get('with_spouse') ?? alone;
      const spouseChild = get('with_spouse_and_child') ?? spouse;
      return { baseNoChild: spouse, childAddon: Math.max(0, spouseChild - spouse) };
    }
    if (depKey === 'with_child_only') {
      const childOnly = get('with_child_only') ?? alone;
      return { baseNoChild: alone, childAddon: Math.max(0, childOnly - alone) };
    }
    // everything else: no child portion
    const base = get(depKey) ?? alone;
    return { baseNoChild: base, childAddon: 0 };
  }
});

/* ---------- Chart helpers ---------- */
function computeNiceAxis(maxVal, targetTicks = 6) {
  const safeMax = Math.max(0, maxVal);
  if (safeMax === 0) return { niceMax: 1000, step: 200 };
  const range = safeMax - 0;
  const roughStep = range / Math.max(1, targetTicks - 1);
  const step = niceNum(roughStep, true);
  const niceMax = Math.ceil((safeMax - 0) / step) * step;
  return { niceMax, step };
}
function niceNum(x, round) {
  const exp = Math.floor(Math.log10(x));
  const f = x / Math.pow(10, exp);
  let nf;
  if (round) { nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10; }
  else       { nf = f <  1 ? 1 : f <  2 ? 2 : f <  2.5 ? 2.5 : f <  5 ? 5 : 10; }
  return nf * Math.pow(10, exp);
}
function formatAbbrevUSD(v) {
  const n = Math.abs(v), sign = v < 0 ? "-" : "";
  if (n >= 1e9) return `${sign}$${(n/1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${sign}$${(n/1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${sign}$${(n/1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(n).toLocaleString("en-US")}`;
}
function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
function buildKeyframePoints(labels, data) {
  const pts = [];
  for (let i = 0; i < labels.length; i++) {
    const age = Number(labels[i]);
    if (i === 0 || i === labels.length - 1 || (Number.isFinite(age) && age % 5 === 0)) {
      pts.push({ x: labels[i], y: data[i] });
    }
  }
  return pts;
}
function renderOrUpdateChart(canvas, labels, data, niceMax, step, seriesLabel) {
  if (!canvas || !window.Chart) return;
  const lineColor = cssVar('--blue', '#0a58ca');
  const keyframeFill = cssVar('--card', '#ffffff');
  const keyframes = buildKeyframePoints(labels, data);

  const main = {
    label: seriesLabel,
    data, borderColor: lineColor, backgroundColor: lineColor,
    borderWidth: 2, tension: 0.25, pointRadius: 0, fill: false
  };
  const diamonds = {
    label: 'Keyframes', data: keyframes, type: 'line', showLine: false,
    pointStyle: 'rectRot', pointRadius: 5, pointHoverRadius: 7,
    borderColor: lineColor, backgroundColor: keyframeFill, borderWidth: 2, skipTooltip: true
  };

  if (growthChart) {
    growthChart.data.labels = labels;
    growthChart.data.datasets[0].data = data;
    growthChart.data.datasets[0].label = seriesLabel;
    growthChart.data.datasets[1].data = keyframes;
    growthChart.options.scales.y.suggestedMax = niceMax;
    growthChart.options.scales.y.ticks.stepSize = step;
    growthChart.update();
    return;
  }

  const cfg = {
    type: 'line',
    data: { labels, datasets: [main, diamonds] },
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { right: 16, bottom: 8 } },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          filter: (item) => item.dataset?.skipTooltip !== true,
          callbacks: {
            title: (items) => items.length ? `Age ${items[0].label}` : '',
            label: (ctx) => ` ${new Intl.NumberFormat('en-US', {
              style: 'currency', currency: 'USD', maximumFractionDigits: 0
            }).format(ctx.parsed.y || 0)}`
          }
        }
      },
      scales: {
        x: {
          offset: true, grid: { display: false }, border: { display: false },
          ticks: {
            autoSkip: false, padding: 6,
            callback: function(value, index, ticks) {
              const label = Number(this.getLabelForValue(value));
              if (index === 0 || index === ticks.length - 1 || (Number.isFinite(label) && label % 5 === 0)) return String(label);
              return '';
            }
          }
        },
        y: {
          beginAtZero: true, suggestedMax: niceMax,
          ticks: { stepSize: step, maxTicksLimit: 7, precision: 0, callback: (v) => formatAbbrevUSD(v) }
        }
      }
    }
  };
  const ctx = canvas.getContext('2d');
  growthChart = new Chart(ctx, cfg);
}

/* ---------- Embedded fallback rates (monthly USD) ---------- */
const embeddedRates = {
  alone: {
    10: 175.51, 20: 346.95, 30: 537.42, 40: 774.16, 50: 1102.04,
    60: 1395.93, 70: 1759.19, 80: 2044.89, 90: 2297.96, 100: 3831.30
  },
  with_spouse: {
    30: 601.42, 40: 859.16, 50: 1208.04, 60: 1523.93, 70: 1908.19,
    80: 2214.89, 90: 2489.96, 100: 4044.91
  },
  with_spouse_and_child: {
    30: 648.42, 40: 922.16, 50: 1287.04, 60: 1617.93, 70: 2018.19,
    80: 2340.89, 90: 2630.96, 100: 4201.35
  },
  with_child_only: {
    30: 579.42, 40: 831.16, 50: 1173.04, 60: 1480.93, 70: 1858.19,
    80: 2158.89, 90: 2425.96, 100: 3974.15
  },
  with_spouse_and_1_parent: {
    30: 652.42, 40: 927.16, 50: 1293.04, 60: 1625.93, 70: 2028.19,
    80: 2351.89, 90: 2643.96, 100: 4216.35
  },
  with_spouse_and_2_parents: {
    30: 703.42, 40: 995.16, 50: 1378.04, 60: 1727.93, 70: 2148.19,
    80: 2488.89, 90: 2797.96, 100: 4387.79
  },
  with_1_parent_only: {
    30: 588.42, 40: 842.16, 50: 1187.04, 60: 1497.93, 70: 1879.19,
    80: 2181.89, 90: 2451.96, 100: 4002.74
  },
  with_2_parents_only: {
    30: 639.42, 40: 910.16, 50: 1272.04, 60: 1599.93, 70: 1999.19,
    80: 2318.89, 90: 2605.96, 100: 4174.18
  }
};
