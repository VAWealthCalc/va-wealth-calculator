// VA Wealth Builder — Accessible, single-handler version
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
    depNotice: document.getElementById('depNotice')
  };

  const fmtCurrency0 = (n) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
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
  calculateProjection();

  function onInputChange(e) {
    if (e.target === els.returnRate) els.rrVal.textContent = fmtPct1(e.target.value);
    if (e.target === els.extraInvestment) els.exVal.textContent = fmtCurrency0(e.target.value);
    enforceAgeConstraints();
    toggleDepNotice();
    calculateProjection();
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
    if (els.depNotice) {
      if (show) els.depNotice.hidden = false;
      else els.depNotice.hidden = true;
    }
  }
});

function calculateProjection() {
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
  // Nominal monthly rate; to use effective monthly instead:
  // const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;
  const monthlyRate = annualRate / 12;

  const extraInvestment = parseFloat(document.getElementById('extraInvestment')?.value || '0') || 0;
  const COLA = 0.025;

  const years = Math.max(0, retirementAge - currentAge);
  let total = 0;
  let monthlyComp = baseMonthly;

  for (let y = 0; y < years; y++) {
    // Contribute THIS year's monthly benefit + extra
    for (let m = 0; m < 12; m++) {
      const monthlyContribution = monthlyComp + extraInvestment;
      total = (total + monthlyContribution) * (1 + monthlyRate);
    }
    // Apply COLA for NEXT year (end-of-year timing)
    monthlyComp *= (1 + COLA);
  }

  // Round to nearest $100 (kept by design)
  const rounded = Math.round(total / 100) * 100;

  const out = document.getElementById('result');
  if (out) {
    out.textContent = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(rounded);
  }
}

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
