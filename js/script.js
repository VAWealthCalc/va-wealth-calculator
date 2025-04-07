// VA Compensation Rates for 2025
// For ratings 10 and 20, dependents do not increase the payment, so we use the "alone" rates.
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
  }
};

// Annual COLA Increase
const COLA_RATE = 0.025; // 2.5%

// Default Ages
const DEFAULT_CURRENT_AGE = 22;
const DEFAULT_RETIREMENT_AGE = 67;

// Populate VA Rating Dropdown
const vaRatingSelect = document.getElementById('va-rating');
for (let rating in vaCompensationRates.alone) {
  let option = document.createElement('option');
  option.value = rating;
  option.text = `${rating}%`;
  vaRatingSelect.add(option);
}

// Get Input Elements
const currentAgeInput = document.getElementById('current-age');
const retirementAgeInput = document.getElementById('retirement-age');
const returnRateInput = document.getElementById('return-rate');
const additionalInvestmentInput = document.getElementById('additional-investment');
const dependentStatusSelect = document.getElementById('dependent-status');

// Get Slider Display Elements
const returnRateDisplay = document.getElementById('return-rate-display');
const additionalInvestmentDisplay = document.getElementById('additional-investment-display');

// Get Error Message Elements
const currentAgeError = document.getElementById('current-age-error');
const retirementAgeError = document.getElementById('retirement-age-error');

// Output Element
const projectedAmountOutput = document.getElementById('projected-amount');

// Update slider display values on input change
returnRateInput.addEventListener('input', function () {
  returnRateDisplay.textContent = returnRateInput.value + '%';
});
additionalInvestmentInput.addEventListener('input', function () {
  additionalInvestmentDisplay.textContent = '$' + additionalInvestmentInput.value;
});

// Add Event Listeners to Inputs
const inputs = document.querySelectorAll('#calculator-form input, #calculator-form select');
inputs.forEach((input) => {
  input.addEventListener('input', calculateProjection);
});

// Highlight input text on focus (for number inputs)
[currentAgeInput, retirementAgeInput].forEach((input) => {
  input.addEventListener('focus', function () {
    input.select();
  });
});

// Calculation Function
function calculateProjection() {
  // Use default ages if input fields are empty
  const currentAge = currentAgeInput.value.trim() === "" ? DEFAULT_CURRENT_AGE : parseInt(currentAgeInput.value);
  const retirementAge = retirementAgeInput.value.trim() === "" ? DEFAULT_RETIREMENT_AGE : parseInt(retirementAgeInput.value);
  const vaRating = parseInt(vaRatingSelect.value);
  const returnRate = parseFloat(returnRateInput.value) / 100;
  const additionalInvestment = parseFloat(additionalInvestmentInput.value) || 0;
  const dependentStatus = dependentStatusSelect.value;
  
  // Validate Inputs
  let hasError = false;
  if (isNaN(currentAge) || currentAge < 18 || currentAge > 100) {
    currentAgeError.textContent = 'Current age must be between 18 and 100.';
    hasError = true;
  } else {
    currentAgeError.textContent = '';
  }
  if (isNaN(retirementAge) || retirementAge <= currentAge || retirementAge > 120) {
    retirementAgeError.textContent = 'Retirement age must be greater than current age and no more than 120.';
    hasError = true;
  } else {
    retirementAgeError.textContent = '';
  }
  if (isNaN(returnRate) || returnRate < 0) {
    projectedAmountOutput.textContent = 'Please enter a valid investment return rate.';
    return;
  }
  if (hasError) {
    projectedAmountOutput.textContent = '0.00';
    return;
  }

  // Determine Number of Years
  const years = retirementAge - currentAge;

  // Get Monthly VA Compensation
  // For ratings 10 and 20, no extra dependents compensation applies.
  let monthlyCompensation;
  if (vaRating < 30) {
    monthlyCompensation = vaCompensationRates.alone[vaRating];
  } else {
    // Use the selected dependent status rates
    monthlyCompensation = vaCompensationRates[dependentStatus][vaRating];
  }
  
  // Initialize Total Amount
  let totalAmount = 0;
  const monthlyReturnRate = returnRate / 12;
  const totalMonths = years * 12;

  // Loop through each month: compound current total, add compensation and additional investment, and adjust for COLA annually
  for (let i = 0; i < totalMonths; i++) {
    totalAmount *= (1 + monthlyReturnRate);
    totalAmount += monthlyCompensation + additionalInvestment;
    // Apply COLA increase on the first month of each year
    if ((i + 1) % 12 === 0) {
      monthlyCompensation += monthlyCompensation * COLA_RATE;
    }
  }

  // Format and display the final projected amount
  projectedAmountOutput.textContent = formatNumber(totalAmount);
}

// Format Number with Commas
function formatNumber(num) {
  return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Initial Calculation
calculateProjection();