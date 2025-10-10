// VA Wealth Builder — with growth chart (Chart.js) and nice Y-axis ticks
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

  // Single input handler
  [els.rating, els.dependents, els.currentAge, els.retirementAge, els.returnRate, els.extraInvestment]
    .filter(Boolean)
    .forEach(el => el.addEventListener('input', onInputChange));

  // Initial compute
  enforceAgeConstraints();
  toggleDepNotice();
  calculateProjectionAndUpdate();

  function onInputChange(e) {
    if (e.target === els.returnRate) els.rrVal.textContent = fmtPct1(e.target.value);
    if (e.target === els.extraInvestment) els.exVal.textContent = fmtCurrency0(e.target.value);
    enforceAgeConstraints();
    toggleDepNotice();
    calculateProjectionAndUpdate();
  }

  function enforceAgeConstraints() {
    const cur = Math.max(parseInt(els.currentAge?.value || '22', 10), 18);
    if (els.currentAge) els.currentAge.value = cur;

    let ret = parseInt(els.retirementAge?.value || '60', 10);
    ret = Math.min(Math.max(ret, cur + 1), 110);
    if (els.retirementAge) els.retirementAge.value = ret;
  }

  function toggleDepNotice() {
    const rating = String(els.rating?.value || '');
    const hasDependents = (els.dependents?.value || 'alone') !== 'alone';
    const show = (rating === '10' || rating === '20') && hasDependents;
    if (els.depNotice) els.depNotice.hidden = !show;
  }

  function calculateProjectionAndUpdate() {
    const rating = document.getElementById('rating')?.value;
    const dependents = document.getElementById('dependents')?.value;

    const currentAge = Math.max(parseInt(document.getElementById('currentAge')?.value || '22', 10), 18);
    const retirementAge = Math.min(
      Math.max(parseInt(document.getElementById('retirementAge')?.value || '60', 10), currentAge + 1),
      110
    );

    // Choose the appropriate table (fallback to 'alone' if missing)
    const table = vaCompensationRates[dependents] || vaCompensationRates.alone;
    const baseMonthly = (table?.[rating] ?? vaCompensationRates.alone?.[rating]) || 0;

    const annualRate = parseFloat(document.getElementById('returnRate')?.value || '0') / 100;
    // Nominal monthly rate; for effective monthly use: Math.pow(1 + annualRate, 1/12) - 1
    const monthlyRate = annualRate / 12;

    const extraInvestment = parseFloat(document.getElementById('extraInvestment')?.value || '0') || 0;
    const COLA = 0.025;

    const years = Math.max(0, retirementAge - currentAge);
    let total = 0;
    let monthlyComp = baseMonthly;

    // Chart series (start at age with $0, then end-of-year totals)
    const labels = [currentAge];
    const data = [0];

    for (let y = 0; y < years; y++) {
      for (let m = 0; m < 12; m++) {
        const monthlyContribution = monthlyComp + extraInvestment;
        total = (total + monthlyContribution) * (1 + monthlyRate);
      }
      // After year-end, push the balance and bump COLA for next year
      labels.push(currentAge + y + 1);
      data.push(total);
      monthlyComp *= (1 + COLA);
    }

    // Update the displayed final number (rounded to nearest $100 to match your UX)
    const rounded = Math.round(total / 100) * 100;
    const out = document.getElementById('result');
    if (out) {
      out.textContent = new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', maximumFractionDigits: 0
      }).format(rounded);
    }

    // Update chart (pick nice Y ticks based on final balance)
    if (els.chartCanvas && window.Chart) {
      const maxY = data[data.length - 1] || 0;
      const { niceMax, step } = computeNiceAxis(maxY);
      renderOrUpdateChart(els.chartCanvas, labels, data, niceMax, step);
    }
  }
});

/* ---------- Chart helpers ---------- */

// Choose “nice” axis max and step using 1–2–5 progression aiming ~5 ticks
function computeNiceAxis(maxVal) {
  const safeMax = Math.max(0, maxVal);
  if (safeMax === 0) return { niceMax: 1000, step: 200 };
  const niceMax = niceCeil(safeMax);
  const step = niceCeil(niceMax / 5);
  return { niceMax, step };
}

function niceCeil(n) {
  const exp = Math.floor(Math.log10(n));
  const pow10 = Math.pow(10, exp);
  const f = n / pow10;
  let nf;
  if (f <= 1) nf = 1;
  else if (f <= 2) nf = 2;
  else if (f <= 5) nf = 5;
  else nf = 10;
  return nf * pow10;
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

function renderOrUpdateChart(canvas, labels, data, niceMax, step) {
  const lineColor = cssVar('--blue', '#0a58ca');

  const cfg = {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Projected Balance',
        data,
        borderColor: lineColor,
        backgroundColor: lineColor,
        borderWidth: 2,
        tension: 0.25,
        pointRadius: 0,
        fill: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false, // use CSS height
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            title: (items) => items.length ? `Age ${items[0].label}` : '',
            label: (ctx) => {
              const val = ctx.parsed.y || 0;
              return ` ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            autoSkip: true,
            maxTicksLimit: 8
          },
          title: { display: false }
        },
        y: {
          beginAtZero: true,
          suggestedMax: niceMax,
          ticks: {
            stepSize: step,
            callback: (v) => formatAbbrevUSD(v),
          },
          title: { display: false }
        }
      }
    }
  };

  if (growthChart) {
    growthChart.data.labels = labels;
    growthChart.data.datasets[0].data = data;
    growthChart.options.scales.y.suggestedMax = niceMax;
    growthChart.options.scales.y.ticks.stepSize = step;
    growthChart.update();
  } else {
    const ctx = canvas.getContext('2d');
    growthChart = new Chart(ctx, cfg);
  }
}

/* ---------- Existing rates table ---------- */
// Monthly USD rates. Note: 10% & 20% do not have dependent add-ons.
const vaCompensationRates = {
  alone: {
    10: 175.51,
    20: 346.95,
    30: 537.42,
    40: 774.16,
    50: 1102.04,
    60: 1395.93,
    70: 1759.19,
    80: 2044.89,
    90: 2297.96,
    100: 3831.30
  },
  with_spouse: {
    30: 601.42,
    40: 859.16,
    50: 1208.04,
    60: 1523.93,
    70: 1908.19,
    80: 2214.89,
    90: 2489.96,
    100: 4044.91
  },
  with_spouse_and_child: {
    30: 648.42,
    40: 922.16,
    50: 1287.04,
    60: 1617.93,
    70: 2018.19,
    80: 2340.89,
    90: 2630.96,
    100: 4201.35
  },
  with_child_only: {
    30: 579.42,
    40: 831.16,
    50: 1173.04,
    60: 1480.93,
    70: 1858.19,
    80: 2158.89,
    90: 2425.96,
    100: 3974.15
  },
  with_spouse_and_1_parent: {
    30: 652.42,
    40: 927.16,
    50: 1293.04,
    60: 1625.93,
    70: 2028.19,
    80: 2351.89,
    90: 2643.96,
    100: 4216.35
  },
  with_spouse_and_2_parents: {
    30: 703.42,
    40: 995.16,
    50: 1378.04,
    60: 1727.93,
    70: 2148.19,
    80: 2488.89,
    90: 2797.96,
    100: 4387.79
  },
  with_1_parent_only: {
    30: 588.42,
    40: 842.16,
    50: 1187.04,
    60: 1497.93,
    70: 1879.19,
    80: 2181.89,
    90: 2451.96,
    100: 4002.74
  },
  with_2_parents_only: {
    30: 639.42,
    40: 910.16,
    50: 1272.04,
    60: 1599.93,
    70: 1999.19,
    80: 2318.89,
    90: 2605.96,
    100: 4174.18
  }
};
