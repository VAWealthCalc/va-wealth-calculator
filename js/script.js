// VA Wealth Builder — with growth chart (Chart.js)
// - Age inputs: no clamping while typing; clamp on blur/change
// - Chart: 5-year x-ticks, nice y-axis (1–2–2.5–5–10), diamond keyframes

let growthChart = null;

document.addEventListener('DOMContentLoaded', () => {
  const els = {
    form: document.getElementById('calcForm'),
    rating: document.getElementById('rating'),
    dependents: document.getElementById('dependents'),
    currentAge: document.getElementById('currentAge'),
    retirementAge: document.getElementById('retirementAge'),
    returnRate: document.getElementById('returnRate'),
    extraInvestment: document.getElementById('extraInvestment'),
    rrVal: document.getElementById('returnRateValue'),
    exVal: document.getElementById('extraInvestmentValue'),
    result: document.getElementById('result'),
    depNotice: document.getElementById('depNotice'),
    chartCanvas: document.getElementById('growthChart')
  };

  const fmtCurrency0 = (n) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', maximumFractionDigits: 0
    }).format(Number(n) || 0);

  const fmtPct1 = (p) => `${(Number(p) || 0).toFixed(1)}%`;

  // Initialize readouts
  if (els.rrVal && els.returnRate) els.rrVal.textContent = fmtPct1(els.returnRate.value);
  if (els.exVal && els.extraInvestment) els.exVal.textContent = fmtCurrency0(els.extraInvestment.value);

  // --- Event wiring ---
  // Non-age inputs: recalc on input
  [els.rating, els.dependents, els.returnRate, els.extraInvestment]
    .filter(Boolean)
    .forEach(el => el.addEventListener('input', onNonAgeInput));

  // Age inputs: preview on input (no clamping), clamp on blur/change
  [els.currentAge, els.retirementAge]
    .filter(Boolean)
    .forEach(el => {
      el.addEventListener('input', onAgeInputPreview);
      el.addEventListener('change', onAgeCommit);
      el.addEventListener('blur', onAgeCommit);
    });

  // Initial draw
  toggleDepNotice();
  clampAndApplyAges(true); // normalize defaults into fields
  calculateProjectionAndUpdate();

  function onNonAgeInput(e) {
    if (e.target === els.returnRate) els.rrVal.textContent = fmtPct1(e.target.value);
    if (e.target === els.extraInvestment) els.exVal.textContent = fmtCurrency0(e.target.value);
    toggleDepNotice();
    calculateProjectionAndUpdate();
  }

  // While typing ages: preview if both look valid
  function onAgeInputPreview() {
    const maybe = readAgesRaw();
    if (isValidAgePair(maybe.cur, maybe.ret)) {
      calculateProjectionAndUpdate({ cur: maybe.cur, ret: maybe.ret });
    }
  }

  // On blur/change: clamp to rules and write back
  function onAgeCommit() {
    clampAndApplyAges(true);
    calculateProjectionAndUpdate();
  }

  function toggleDepNotice() {
    const rating = String(els.rating?.value || '');
    const hasDependents = (els.dependents?.value || 'alone') !== 'alone';
    const show = (rating === '10' || rating === '20') && hasDependents;
    if (els.depNotice) els.depNotice.hidden = !show;
  }

  // --- Age helpers ---
  function readAgesRaw() {
    const cur = parseInt(els.currentAge?.value ?? '', 10);
    const ret = parseInt(els.retirementAge?.value ?? '', 10);
    return { cur, ret };
  }

  function clampAndApplyAges(writeBack = false) {
    const { cur, ret } = readAgesRaw();

    // Defaults if empty/NaN
    let curSan = Number.isInteger(cur) ? cur : 22;
    let retSan = Number.isInteger(ret) ? ret : 60;

    // Hard limits
    curSan = Math.min(Math.max(curSan, 18), 110);
    retSan = Math.min(Math.max(retSan, 19), 110);

    // Relationship: retirement must be at least current + 1
    if (retSan <= curSan) retSan = curSan + 1;

    if (writeBack) {
      if (els.currentAge) els.currentAge.value = curSan;
      if (els.retirementAge) els.retirementAge.value = retSan;
    }
    return { cur: curSan, ret: retSan };
  }

  function isValidAgePair(cur, ret) {
    return Number.isInteger(cur) &&
           Number.isInteger(ret) &&
           cur >= 18 && cur <= 110 &&
           ret >= 19 && ret <= 110 &&
           ret > cur;
  }
});

// Calculate & update UI; optionally accept override ages (used during typing)
function calculateProjectionAndUpdate(override = null) {
  const rating = document.getElementById('rating')?.value;
  const dependents = document.getElementById('dependents')?.value;

  let cur, ret;
  if (override && Number.isInteger(override.cur) && Number.isInteger(override.ret)) {
    cur = override.cur;
    ret = override.ret;
  } else {
    // Clamp for compute, but do NOT write back to inputs
    const ages = (function clampForCompute() {
      let c = parseInt(document.getElementById('currentAge')?.value || '22', 10);
      let r = parseInt(document.getElementById('retirementAge')?.value || '60', 10);
      c = Number.isInteger(c) ? Math.min(Math.max(c, 18), 110) : 22;
      r = Number.isInteger(r) ? Math.min(Math.max(r, 19), 110) : 60;
      if (r <= c) r = c + 1;
      return { cur: c, ret: r };
    })();
    cur = ages.cur; ret = ages.ret;
  }

  // Pick appropriate table (fallback to 'alone')
  const table = vaCompensationRates[dependents] || vaCompensationRates.alone;
  const baseMonthly = (table?.[rating] ?? vaCompensationRates.alone?.[rating]) || 0;

  const annualRate = parseFloat(document.getElementById('returnRate')?.value || '0') / 100;
  // Nominal monthly rate; for effective monthly:
  // const monthlyRate = Math.pow(1 + annualRate, 1/12) - 1;
  const monthlyRate = annualRate / 12;

  const extraInvestment = parseFloat(document.getElementById('extraInvestment')?.value || '0') || 0;
  const COLA = 0.025;

  const years = Math.max(0, ret - cur);
  let total = 0;
  let monthlyComp = baseMonthly;

  const labels = [cur];
  const data = [0];

  for (let y = 0; y < years; y++) {
    for (let m = 0; m < 12; m++) {
      const monthlyContribution = monthlyComp + extraInvestment;
      total = (total + monthlyContribution) * (1 + monthlyRate);
    }
    labels.push(cur + y + 1);
    data.push(total);
    monthlyComp *= (1 + COLA);
  }

  // Display rounded total to nearest $100
  const rounded = Math.round(total / 100) * 100;
  const out = document.getElementById('result');
  if (out) {
    out.textContent = new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', maximumFractionDigits: 0
    }).format(rounded);
  }

  // Update chart
  const canvas = document.getElementById('growthChart');
  if (canvas && window.Chart) {
    const maxY = data[data.length - 1] || 0;
    const { niceMax, step } = computeNiceAxis(maxY, 6); // ~6 ticks target
    renderOrUpdateChart(canvas, labels, data, niceMax, step);
  }
}

/* ---------- Chart helpers ---------- */

// “Nice numbers” with 1–2–2.5–5–10 progression
function computeNiceAxis(maxVal, targetTicks = 6) {
  const safeMax = Math.max(0, maxVal);
  if (safeMax === 0) return { niceMax: 1000, step: 200 };

  const min = 0;
  const range = safeMax - min;
  const roughStep = range / Math.max(1, targetTicks - 1);
  const step = niceNum(roughStep, true);
  const niceMax = Math.ceil((safeMax - min) / step) * step + min;
  return { niceMax, step };
}

function niceNum(x, round) {
  const exp = Math.floor(Math.log10(x));
  const f = x / Math.pow(10, exp);
  let nf;
  if (round) {
    if (f <= 1) nf = 1;
    else if (f <= 2) nf = 2;
    else if (f <= 2.5) nf = 2.5;
    else if (f <= 5) nf = 5;
    else nf = 10;
  } else {
    if (f < 1) nf = 1;
    else if (f < 2) nf = 2;
    else if (f < 2.5) nf = 2.5;
    else if (f < 5) nf = 5;
    else nf = 10;
  }
  return nf * Math.pow(10, exp);
}

// $1.2K / $3.4M / $1.1B tick formatter
function formatAbbrevUSD(v) {
  const n = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (n >= 1e9) return `${sign}$${(n/1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${sign}$${(n/1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${sign}$${(n/1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(n).toLocaleString("en-US")}`;
}

// Read CSS var (fallback if unset)
function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// Diamonds at every 5-year mark + first + last
function buildKeyframePoints(labels, data) {
  const points = [];
  for (let i = 0; i < labels.length; i++) {
    const age = Number(labels[i]);
    const isFirst = i === 0;
    const isLast = i === labels.length - 1;
    const every5 = Number.isFinite(age) && age % 5 === 0;
    if (isFirst || isLast || every5) {
      points.push({ x: labels[i], y: data[i] });
    }
  }
  return points;
}

function renderOrUpdateChart(canvas, labels, data, niceMax, step) {
  const lineColor = cssVar('--blue', '#0a58ca');
  const keyframeFill = cssVar('--card', '#ffffff'); // diamond fill
  const keyframes = buildKeyframePoints(labels, data);

  const mainDataset = {
    label: 'Projected Balance',
    data,
    borderColor: lineColor,
    backgroundColor: lineColor,
    borderWidth: 2,
    tension: 0.25,
    pointRadius: 0,
    fill: false
  };

  const keyframeDataset = {
    label: 'Keyframes',
    data: keyframes,
    type: 'line',
    showLine: false,
    pointStyle: 'rectRot',   // diamond
    pointRadius: 5,
    pointHoverRadius: 7,
    borderColor: lineColor,
    backgroundColor: keyframeFill,
    borderWidth: 2,
    skipTooltip: true
  };

  const cfg = {
    type: 'line',
    data: { labels, datasets: [mainDataset, keyframeDataset] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 16, bottom: 8 } },
      interaction: { mode: 'index', intersect: false }, // scrubbing
      plugins: {
        legend: { display: false },
        tooltip: {
          filter: (item) => item.dataset?.skipTooltip !== true,
          callbacks: {
            title: (items) => items.length ? `Age ${items[0].label}` : '',
            label: (ctx) => {
              const val = ctx.parsed.y || 0;
              return ` ${new Intl.NumberFormat('en-US', {
                style: 'currency', currency: 'USD', maximumFractionDigits: 0
              }).format(val)}`;
            }
          }
        }
      },
      scales: {
        x: {
          offset: true,                  // prevents first/last label clipping
          grid: { display: false },
          border: { display: false },
          ticks: {
            autoSkip: false,
            padding: 6,
            callback: function(value, index, ticks) {
              const label = Number(this.getLabelForValue(value));
              const isFirst = index === 0;
              const isLast  = index === ticks.length - 1;
              if (isFirst || isLast || (Number.isFinite(label) && label % 5 === 0)) {
                return String(label);
              }
              return '';
            }
          }
        },
        y: {
          beginAtZero: true,
          suggestedMax: niceMax,
          ticks: {
            stepSize: step,
            maxTicksLimit: 7,
            precision: 0,
            callback: (v) => formatAbbrevUSD(v),
          }
        }
      }
    }
  };

  if (growthChart) {
    growthChart.data.labels = labels;
    growthChart.data.datasets[0].data = data;

    if (!growthChart.data.datasets[1]) {
      growthChart.data.datasets[1] = keyframeDataset;
    } else {
      growthChart.data.datasets[1].data = keyframes;
    }

    growthChart.options.scales.y.suggestedMax = niceMax;
    growthChart.options.scales.y.ticks.stepSize = step;
    growthChart.options.scales.x.ticks.autoSkip = false;
    growthChart.options.scales.x.offset = true;

    growthChart.update();
  } else {
    const ctx = canvas.getContext('2d');
    growthChart = new Chart(ctx, cfg);
  }
}

/* ---------- Rates table ---------- */
// Monthly USD rates. Note: 10% & 20% do not have dependent add-ons.
const vaCompensationRates = {
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
