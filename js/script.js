window.onload = () => {
    const elements = document.querySelectorAll('input, select');
    elements.forEach(elem => elem.addEventListener('input', calculateProjection));
  
    document.getElementById('returnRate').oninput = () => {
      document.getElementById('returnRateValue').textContent = `${document.getElementById('returnRate').value}%`;
      calculateProjection();
    };
  
    document.getElementById('extraInvestment').oninput = () => {
      document.getElementById('extraInvestmentValue').textContent = `$${document.getElementById('extraInvestment').value}`;
      calculateProjection();
    };
  
    calculateProjection();
  };
  
  function calculateProjection() {
    const rating = document.getElementById('rating').value;
    const dependents = document.getElementById('dependents').value;
    const currentAge = Math.max(Number(document.getElementById('currentAge').value) || 22, 18);
    let retirementAge = Math.min(Number(document.getElementById('retirementAge').value) || 67, 110);
    if (retirementAge <= currentAge) retirementAge = currentAge + 1;
  
    // For ratings 10 and 20, the dependent groups won’t contain values,
    // so we use the "alone" rates if the selected rate is undefined.
    const baseCompensation = (vaCompensationRates[dependents] && vaCompensationRates[dependents][rating])
                              ? vaCompensationRates[dependents][rating]
                              : vaCompensationRates.alone[rating];
    const annualRate = Number(document.getElementById('returnRate').value) / 100;
    const extraInvestment = Number(document.getElementById('extraInvestment').value);
    const COLA = 0.025;
    let total = 0;
  
    let monthlyCompensation = baseCompensation;
  
    for (let year = 0; year < retirementAge - currentAge; year++) {
      monthlyCompensation *= (1 + COLA);
      let monthlyInvestment = monthlyCompensation + extraInvestment;
      for (let month = 0; month < 12; month++) {
        total = (total + monthlyInvestment) * (1 + annualRate / 12);
      }
    }
  
    document.getElementById('result').textContent = `$${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  }
  
  // Updated VA Compensation Rates with proper values.
  // Note: For ratings 10 and 20, only the "alone" rates are defined.
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
      100: 3831.30,
    },
    with_spouse: {
      30: 601.42,
      40: 859.16,
      50: 1208.04,
      60: 1523.93,
      70: 1908.19,
      80: 2214.89,
      90: 2489.96,
      100: 4044.91,
    },
    with_spouse_and_child: {
      30: 648.42,
      40: 922.16,
      50: 1287.04,
      60: 1617.93,
      70: 2018.19,
      80: 2340.89,
      90: 2630.96,
      100: 4201.35,
    },
    with_child_only: {
      30: 579.42,
      40: 831.16,
      50: 1173.04,
      60: 1480.93,
      70: 1858.19,
      80: 2158.89,
      90: 2425.96,
      100: 3974.15,
    },
    with_spouse_and_1_parent: {
      30: 652.42,
      40: 927.16,
      50: 1293.04,
      60: 1625.93,
      70: 2028.19,
      80: 2351.89,
      90: 2643.96,
      100: 4216.35,
    },
    with_spouse_and_2_parents: {
      30: 703.42,
      40: 995.16,
      50: 1378.04,
      60: 1727.93,
      70: 2148.19,
      80: 2488.89,
      90: 2797.96,
      100: 4387.79,
    },
    with_1_parent_only: {
      30: 588.42,
      40: 842.16,
      50: 1187.04,
      60: 1497.93,
      70: 1879.19,
      80: 2181.89,
      90: 2451.96,
      100: 4002.74,
    },
    with_2_parents_only: {
      30: 639.42,
      40: 910.16,
      50: 1272.04,
      60: 1599.93,
      70: 1999.19,
      80: 2318.89,
      90: 2605.96,
      100: 4174.18,
    },
  };
