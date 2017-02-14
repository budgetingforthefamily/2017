// Global variables are bad, very bad. But, they are also very useful, so fakkit.
var $budgetTitle = 'Budget Projection',
	$daysPerPeriod = 0,
	$payPeriods = 0,
	$periodStartDate = '1/1/2016',
	$initialBankAmount = 0,

	$mainOwner = false,
	$owners = {},
	$onlyDisplayMainOwner = false,

	$useDarkTheme = false;

// Capturing the highest level function at the lowest level. Noice.
function main (budgetJSONFileName, initFunction) {
	var xhr = new XMLHttpRequest (),
		method = 'GET',
		url = './resources/' + budgetJSONFileName,
		ASYNCHRONOUS = true;

	xhr.onreadystatechange = function () {
		if (xhr.readyState === XMLHttpRequest.DONE) {
			// All went well acquiring the JSON file
			if (xhr.status === 200) {
				// *crosses fingers*
				try {
					initFunction (JSON.parse (xhr.responseText));
				}

				// Oh well; what can we do but give up right?
				catch (e) {
					alert ('Hi there, random user.\n\nLooks like your file, "' + budgetJSONFileName + '", is not of valid JSON format.\n\n' + e.stack);
				}
			}

			// Actually, no it didn't.
			else {
				alert ('Hi there, random user.\n\nLooks like your url, "' + url +'", leads to Narnia. Sorry!');
			}
		}
	};

	xhr.open (method, url, ASYNCHRONOUS);
	xhr.send ();
}

// Gives a new, normalized length array of zeros
function zeroIncomeArray (payPeriods) {
	var noIncomeArray = [];

	for (var i = 0; i < payPeriods; i++)
		noIncomeArray.push (0);

	return noIncomeArray;
}

// A nice updater for the evil global variables. Well, they wouldn't be global if I had continued with my object, but fakkit.
function updateBudgetJSONValues (newBudgetJSON) {
	$budgetTitle     = newBudgetJSON.budgetTitle || $budgetTitle,
	$periodStartDate = newBudgetJSON.periodStartDate || $periodStartDate,

	$daysPerPeriod     = parseNumberValue (newBudgetJSON.daysPerPeriod, $daysPerPeriod),
	$payPeriods        = parseNumberValue (newBudgetJSON.payPeriods, $payPeriods),
	$initialBankAmount = parseNumberValue (newBudgetJSON.initialBankAmount, $initialBankAmount),

	$mainOwner = newBudgetJSON.mainOwner || $mainOwner,
	$owners    = newBudgetJSON.owners || $owners,
	$onlyDisplayMainOwner = newBudgetJSON.onlyDisplayMainOwner || $onlyDisplayMainOwner,

	$useDarkTheme = !!newBudgetJSON.useDarkTheme;
}

// Allows for properties to be typed out in non-standard JavaScript format
function standardizeOwners (owners) {
	for (var owner in owners)
		owners[owner] = standardizeObject (owners[owner]);
}

// Generates the labels that will go on the x-axis of the budget graph
function generateXAxisCategories (daysPerPeriod, periodStartDate, payPeriods) {
	var DAY_MS = 86400000,

		// Can be inexact of the hour because these are precice to the day
		DAYLIGHT_SAVINGS_HOUR_ADJUSTMENT = 3600000,

		msPerPeriod = DAY_MS * daysPerPeriod,
		periodStartDateMS = dateMilliseconds.apply (dateMilliseconds, dateStringToArgsArray (periodStartDate));

	var dateRanges = [];
	for (var i = 0; i < payPeriods; i++) {

		var ms0 = new Date (periodStartDateMS + i * msPerPeriod + DAYLIGHT_SAVINGS_HOUR_ADJUSTMENT),
			ms1 = new Date (periodStartDateMS + (i + 1) * msPerPeriod - DAY_MS + DAYLIGHT_SAVINGS_HOUR_ADJUSTMENT);

		dateRanges.push (msFedDateObjToUSDate (ms0) + ' - ' + msFedDateObjToUSDate (ms1));
	}

	return dateRanges;
}

// Generates the label that will go on the y-axis of the budget graph
function generateYAxisCategory (owners, mainOwner, payPeriods, initialBankAmount) {
	var mainOwnerIsDefined = mainOwner !== false,
		mainIncomeAmount = 0,
		otherIncomeAmount = parseNumberValue (initialBankAmount, 0); // Aggregate income of all other owners combined

	// Extract the easy information of the main owner first
	if (mainOwnerIsDefined && owners[mainOwner]) {
		var payPerPeriod = parseNumberValue (owners[mainOwner].payPerPeriod, 0),
			extractedIncomeArray = extractSubArray (owners[mainOwner].income? owners[mainOwner].income : [], 0, payPeriods),
			mainIncomeAmount = sum (extractedIncomeArray) + (payPeriods - extractedIncomeArray.length) * payPerPeriod;
	}

	// Iterate through each owner and extract the information that we are looking for.
	for (var owner in owners) {
		
		// We don't want any funky business with a false owner. That's shady as heck.
		if (owner !== false) {
			var payPerPeriod = parseNumberValue (owners[owner].payPerPeriod, 0),
				extractedIncomeArray = extractSubArray (owners[owner].income? owners[owner].income : [], 0, payPeriods);
				
			otherIncomeAmount += sum (extractedIncomeArray) + (payPeriods - extractedIncomeArray.length) * payPerPeriod;
		}
	}

	// Return a slightly different label if a main owner was specified or not
	if (mainOwnerIsDefined) {
		// Remove double-count of owner's income
		otherIncomeAmount -= mainIncomeAmount;

		var totalMoney = round (mainIncomeAmount + otherIncomeAmount, 2);
		return 'Money ($' + round (mainIncomeAmount, 2) + ' reg. + $' + round (otherIncomeAmount, 2) + ' other = $' + totalMoney + ' total)';
	}

	return 'Money ($' + round (otherIncomeAmount, 2) + ')';
}

// Normalizes income lengths for all owners and returns a mapping of owners to incomes
function generateNormalizedIncomeMap (owners, payPeriods) {
	var ownerIncomes = {};

	// Iterate through every owner to calculate the normalized length of income (no expenses factored in yet)
	for (var owner in owners) {
		if (owners[owner].income) {
			var ownerIncome = extractSubArray (owners[owner].income, 0, payPeriods),
				payPerPeriod = parseNumberValue (owners[owner].payPerPeriod, 0);

			while (ownerIncome.length < payPeriods)
				ownerIncome.push (payPerPeriod);

			ownerIncomes[owner] = ownerIncome;
		}

		else ownerIncomes[owner] = zeroIncomeArray (payPeriods);
	}

	return ownerIncomes;
}

// Normalizes expenses (both planned and actual) and returns a mapping of owners to incomes
function generateNormalizedExpenseMap (owners, payPeriods) {
	var ownerExpenses = {};

	for (var owner in owners) {
		var plannedExpenses = owners[owner].plannedExpenses,
			actualExpenses = owners[owner].actualExpenses;

		ownerExpenses[owner] = {};

		// Only bother iterating if there were any planned expenses given
		if (plannedExpenses) {
			for (var expense in plannedExpenses)
				ownerExpenses[owner][expense] = zeroPaddedVersionOf (plannedExpenses[expense]);
		}

		// Only bother iterating if there were any actual expenses given
		if (actualExpenses) {
			for (var expense in actualExpenses) {
				var actualExpenseArray = extractSubArray (actualExpenses[expense], 0, payPeriods);

				// Override any planned expense values as real values are here to work with
				if (ownerExpenses[owner][expense]) {
					for (var i = 0; i < actualExpenseArray.length; i++)
						ownerExpenses[owner][expense][i] = actualExpenseArray[i];
				}

				// Attach any unplanned expense that popped up for an owner
				else ownerExpenses[owner][expense] = zeroPaddedVersionOf (actualExpenseArray);
			}
		}
	}

	// Pads the right of the fed array with zeros until it is of length payPeriods
	function zeroPaddedVersionOf (array) {
		while (array.length < payPeriods)
			array.push (0);

		return array;
	}

	return ownerExpenses;
}

// Merges normalized income and expense objects into useful projection information to be displayed with the Highcharts API
function generateDataSeries (ownerIncomes, ownerExpenses, mainOwner, payPeriods, initialBankAmount, onlyDisplayMainOwner, visibleOwner) {
	var dataSeries = [],
		mainOwnerIsDefined = mainOwner !== false;

	var ownerCount = 1;
	for (owner in ownerIncomes) {
		var isMainOwner = mainOwnerIsDefined && owner === mainOwner;

		// This part combines all expenses to avoid micromanagement of where expenses go
		var expensesData = [], // container for avoiding double-iteration of expenses
			expenseAccumulator = zeroIncomeArray (payPeriods);

		for (var expense in ownerExpenses[owner]) {
			expensesData.push (postProcessExpenseData ({name: expense, data: ownerExpenses[owner][expense]}, isMainOwner, ownerCount, visibleOwner !== undefined, owner === visibleOwner || visibleOwner === '_ALL_OWNER$'));
			expenseAccumulator = fusionOf (expenseAccumulator, ownerExpenses[owner][expense]);
		}	

		// This part takes the information compiled of expenses and accrues them over pay periods to make a useful projection
		var incomeAccumulator = zeroIncomeArray (payPeriods);
		if (payPeriods) incomeAccumulator[0] = round (ownerIncomes[owner][0] - expenseAccumulator[0], 2);

		for (var i = 1; i < payPeriods; i++)
			incomeAccumulator[i] = round (incomeAccumulator[i - 1] + ownerIncomes[owner][i] - expenseAccumulator[i], 2);


		// Appends the data differently in order to showcase the main owner to the Highcharts API
		var incomeData = [postProcessIncomeData ({name: owner, data: incomeAccumulator}, isMainOwner, ownerCount, visibleOwner !== undefined, owner === visibleOwner || visibleOwner === '_ALL_OWNER$')];
		
		if (isMainOwner)
			dataSeries = dataSeries.concat (expensesData).concat (incomeData);

		else
			dataSeries = expensesData.concat (incomeData).concat (dataSeries);

		ownerCount++;
	}

	// Adds individual elements of two arrays and returns the results in a new array
	function fusionOf (a0, a1) {
		var fusion = [];

		for (var i = 0; i < a0.length; i++)
			fusion.push (round (a0[i] + a1[i], 2));

		return fusion;
	}

	// Used to add additional information to each expense
	function postProcessExpenseData (object, expenseBelongsToMainOwner, id, visibleOwnerIsGiven, ownerIsTheOnlyOneThatShouldBeVisibleBecauseOfButtonClick) {
		var expenseTotal = sum (object.data);

		var display = visibleOwnerIsGiven? ownerIsTheOnlyOneThatShouldBeVisibleBecauseOfButtonClick : !(onlyDisplayMainOwner && !expenseBelongsToMainOwner);

		return {name: '(' + id + ') ' + object.name + ' ($' + expenseTotal + ')', data: object.data, visible: display};
	}

	// Used to add additional information to each income
	function postProcessIncomeData (object, incomeBelongsToMainOwner, id, visibleOwnerIsGiven, ownerIsTheOnlyOneThatShouldBeVisibleBecauseOfButtonClick) {
		object.name = '(' + id + ') ' + object.name;

		var display = visibleOwnerIsGiven? ownerIsTheOnlyOneThatShouldBeVisibleBecauseOfButtonClick : !(onlyDisplayMainOwner && !incomeBelongsToMainOwner);

		object.visible = display;

		if (incomeBelongsToMainOwner) {
			for (var i = 0; i < object.data.length; i++)
				object.data[i] = round (object.data[i] + initialBankAmount);

			return object;
		}

		return object;
	}

	return dataSeries;
}
