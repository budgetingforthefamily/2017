// Used for easier readability in JSON construction
Array.prototype.toString = function () {
	var s = '';

	for (var i = 0; i < this.length; i++)
		s += i > 0? ', ' + this[i] : this[i];

	return '[' + s + ']';
};

var fs = require ('fs'),
	separator = require ('os').platform ().match (/^win/)? '\\' : '/',
	outputFileName = 'budget.auto.json',
	outputFileDestination = __dirname + separator + outputFileName,
	file = fs.createWriteStream (outputFileDestination),

	XLSX = require ('xlsx'),
	workbook = XLSX.readFile (__dirname + separator + '..' + separator + 'budget.xlsx'),

	GLOBAL_EXPENSES = 0,
	expenseSheet = workbook.Sheets[workbook.SheetNames[GLOBAL_EXPENSES]];

// Remove unnecessary !ref value
delete expenseSheet['!ref'];

// Remove any merge data since it is not necessary
delete expenseSheet['!merges'];

var DEPOSIT_OWNER_COLUMN    = 0,
	DEPOSIT_AMOUNT_COLUMN   = 1,
	EXPENSE_OWNER_COLUMN    = 3,
	EXPENSE_AMOUNT_COLUMN   = 4,
	EXPENSE_TYPE_COLUMN     = 5,
	MAIN_OWNER_COLUMN       = 17,
	ONLY_DISPLAY_MAIN_OWNER = 18,
	INITIAL_BANK_AMOUNT     = 19,
	PAY_PER_PERIOD_OWNER_COLUMN = 20,
	PAY_PER_PERIOD_VALUE_COLUMN = 21,
	BUDGET_TITLE_COLUMN = 22,
	DAYS_PER_PERIOD_COLUMN = 23,
	PAY_PERIODS_COLUMN = 24,
	PERIOD_START_DATE_COLUMN = 25,
	USE_DARK_THEME_COLUMN = 26,

	cNames = ['depositOwnerColumn',
				'depositAmountColumn',
				null,
				'expenseOwnerColumn',
				'expenseAmountColumn',
				'expenseTypeColumn',
				null, null, null, null, null, null, null, null, null, null, null,
				'mainOwner',
				'onlyDisplayOwnerColumn',
				'initialBankAmountColumn',
				'payPerPeriodOwnerColumn',
				'payPerPeriodValueColumn',
				'budgetTitleColumn',
				'daysPerPeriodColumn',
				'payPeriodsColumn',
				'periodStartDateColumn',
				'useDarkThemeColumn'];

var mtx = new SheetMatrix (expenseSheet, cNames);

	
var incomeCells         = mtx.mapCells (cNames[DEPOSIT_OWNER_COLUMN], cNames[DEPOSIT_AMOUNT_COLUMN], false, pNV),
	expenseCells        = mtx.mapCells (cNames[EXPENSE_OWNER_COLUMN], cNames[EXPENSE_AMOUNT_COLUMN], false, pNV),
	expenseTypeValues   = mtx.mapColumns (cNames[EXPENSE_OWNER_COLUMN], cNames[EXPENSE_TYPE_COLUMN]),
	payPerPeriodValues  = mtx.mapColumns (cNames[PAY_PER_PERIOD_OWNER_COLUMN], cNames[PAY_PER_PERIOD_VALUE_COLUMN], false, pNV);


// These budget JSON values aren't found on the spreadsheet, so they are added by default here.
var initialBankAmount    = pNV (expenseSheet[mtx.sheetMatrix[cNames[INITIAL_BANK_AMOUNT]][0]].v),
	mainOwner            =      expenseSheet[mtx.sheetMatrix[cNames[MAIN_OWNER_COLUMN]][0]].v,
	onlyDisplayMainOwner =      expenseSheet[mtx.sheetMatrix[cNames[ONLY_DISPLAY_MAIN_OWNER]][0]].v,
	budgetTitle          =      expenseSheet[mtx.sheetMatrix[cNames[BUDGET_TITLE_COLUMN]][0]].v,
	daysPerPeriod        = pNV (expenseSheet[mtx.sheetMatrix[cNames[DAYS_PER_PERIOD_COLUMN]][0]].v),
	payPeriods           = pNV (expenseSheet[mtx.sheetMatrix[cNames[PAY_PERIODS_COLUMN]][0]].v),
	periodStartDate      =      expenseSheet[mtx.sheetMatrix[cNames[PERIOD_START_DATE_COLUMN]][0]].w,
	useDarkTheme         =      expenseSheet[mtx.sheetMatrix[cNames[USE_DARK_THEME_COLUMN]][0]].v;


var allOwners = collectUniqueKeys (incomeCells, expenseCells, payPerPeriodValues),
	mainOwnerDepositCells = Array.isArray (incomeCells[mainOwner])? incomeCells[mainOwner] : [];


var budgetJSON = initBudgetJSON (budgetTitle, daysPerPeriod, payPeriods, periodStartDate, useDarkTheme, initialBankAmount, mainOwner, onlyDisplayMainOwner, allOwners);
addPayPerPeriodToBudgetJSON (budgetJSON, expenseSheet, payPerPeriodValues);
addIncomeToBudgetJSON (budgetJSON, expenseSheet, incomeCells, mainOwnerDepositCells);
addExpensesToBudgetJSON (budgetJSON, expenseSheet, expenseCells, expenseTypeValues, mainOwnerDepositCells);





// Stringifies the object JSON, makes arrays fit on a single line, and finally casts them to arrays rather than array strings
var outputJSONString = JSON.stringify (budgetJSON, function (n, v) {return Array.isArray (v)? ''+v : v;}, '\t').replace (/("\[)/g, "[").replace (/\]"/g, "]");
try {
	file.write (outputJSONString);
	file.end ();
	console.log ('\n\033[92mSuccess!\033[0m')
	console.log ('Your budget JSON was written to "\033[36m' + __dirname + separator + outputFileName + '\033[0m"');
}

catch (e) {
	console.log ('\n\033[91mFailure!\033[0m There was a problem writing to the file.');
	console.error ('\033[91m' + e.stack + '\033[0m');
}



// Takes as input an excel spreadsheet object and a column names array to make data extraction straightforward
function SheetMatrix (eS, cN) {
	var excelSheet = eS,
		columnNames = cN,
		cells = getSortedCells ();

	// Map each column name to all sparse values found in that column of the spreadsheet
	this.sheetMatrix = generateSheetMatrix ();

	// Returns a mapping of the values in colA to the cell values in colB as an object
	this.mapColumns = function (colA, colB, aTransform, bTransform) {
		var a = this.sheetMatrix[colA],
			b = this.sheetMatrix[colB],
			aT = aTransform? aTransform : function (v) {return v;},
			bT = bTransform? bTransform : function (v) {return v;};

		if (!a || !b)
			throw '"' + (!a? colA : colB) + '" does not exist as a column in the mtx.';

		else if (a.length != b.length)
			throw '"' + colA + '"\'s column length (' + a.length + ') does not equal "' + colB + '"\'s column length (' + b.length + ').';

		var mapping = {};
		for (var i = 0; i < a.length; i++) {
			var key = aT (excelSheet[a[i]].v),
				val = bT (excelSheet[b[i]].v);

			if (!Array.isArray (mapping[key]))
				mapping[key] = [];

			mapping[key].push (val);
		}
		
		return mapping;
	};

	// Returns a mapping of the values in colA to the cell location values in colB as an object 
	this.mapCells = function (colA, colB, aTransform) {
		var a = this.sheetMatrix[colA],
			b = this.sheetMatrix[colB],
			aT = aTransform? aTransform : function (v) {return v;};

		if (!a || !b)
			throw '"' + (!a? colA : colB) + '" does not exist as a column in the mtx.';

		else if (a.length != b.length)
			throw '"' + colA + '"\'s column length (' + a.length + ') does not equal "' + colB + '"\'s column length (' + b.length + ').';

		var mapping = {};
		for (var i = 0; i < a.length; i++) {
			var key = aT (excelSheet[a[i]].v),
				val = b[i];

			if (!Array.isArray (mapping[key]))
				mapping[key] = [];

			mapping[key].push (val);
		}
		
		return mapping;
	};

	function getSortedCells () {
		var sheetCells = [];

		for (var cell in excelSheet)
			sheetCells.push (cell);

		sheetCells.sort (columnRowCompare);

		return sheetCells;
	}

	function generateSheetMatrix () {
		var sM = {};

		var lastColumn = false,
			h = -1;

		for (var i = 0; i < cells.length; i++) {
			var currColumn = cells[i].match (/^\D+/)[0];

			if (currColumn !== lastColumn)
				sM[columnNames[++h]] = [];

			// Skip the first row because it is just information for a user of the spreadsheet
			if (+cells[i].match (/\d+$/)[0] !== 1)
				sM[columnNames[h]].push (cells[i]);

			lastColumn = currColumn;
		}

		return sM;
	}
}

// Parse Number Value
function pNV (n) {return typeof n === 'number'? n : 0;}

// Compares cell values. Returns a value < 0 if a < b, 0 if a = b, and a value > 0 if a > b
function columnRowCompare (a, b) {
	var A = a.match (/^\D+/)[0],
		B = b.match (/^\D+/)[0];

	return A == B? +a.match (/\d+$/)[0] - +b.match (/\d+$/)[0] : A.length != B.length? A.length - B.length : A < B? -1 : 1;
}

function rowCompare (a, b) {return (typeof a == 'number' && !isFinite (a))? 1 : typeof b == 'number' && !isFinite (b)? -1 : +a.match (/\d+$/)[0] - +b.match (/\d+$/)[0];}

// Rounds number values to 2 decimal places
function round (n) {return Math.round (100 * n) / 100;}

// Returns an array of all unique keys found in objects fed to the function
function collectUniqueKeys () {
	var uniqueKeys = [];

	for (var i = 0; i < arguments.length; i++) {
		for (var prop in arguments[i]) {
			if (uniqueKeys.indexOf (prop) < 0)
				uniqueKeys.push (prop);
		}
	}

	return uniqueKeys;
}

// Initializes the content of the budget JSON object
function initBudgetJSON (budTit, dPP, pP, pSD, uDT, iBA, mO, oDMO, aO) {
	var json = {};

	json.budgetTitle = budTit;
	json.daysPerPeriod = dPP;
	json.payPeriods = pP;
	json.periodStartDate = pSD;
	json.useDarkTheme = uDT;
	json.initialBankAmount = iBA;
	json.mainOwner = mO;
	json.onlyDisplayMainOwner = oDMO;
	json.owners = {};

	for (var i = 0; i < aO.length; i++)
		json.owners[aO[i]] = {};

	return json;
}

function addPayPerPeriodToBudgetJSON (json, eS, pPPV) {
	for (var owner in pPPV) {
		if (!json.owners[owner])
			json.owners[owner] = {};

		if (pPPV[owner][0] > 0)
			json.owners[owner].payPerPeriod = pPPV[owner][0];
	}
}

function addIncomeToBudgetJSON (json, eS, iC, mainOwnerIncomeCells) {
	// Send each owner's deposit to the correct location in the JSON object
	for (var owner in iC) {
		var k = 0,
			loCell = k < mainOwnerIncomeCells.length? mainOwnerIncomeCells[k] : Infinity,
			hiCell = k + 1 < mainOwnerIncomeCells.length? mainOwnerIncomeCells[k + 1] : Infinity;

		var ownerIncomeCells = iC[owner];

		for (var i = 0; i < ownerIncomeCells.length; i++) {
			var cell = ownerIncomeCells[i];

			// Owner's income came before the low row that marks another pay period
			if (rowCompare (cell, loCell) >= 0 && rowCompare (cell, hiCell) < 0) {
				if (!Array.isArray (json.owners[owner].income))
					json.owners[owner].income = [];

				if (typeof json.owners[owner].income[k] != 'number')
					json.owners[owner].income[k] = 0;


				json.owners[owner].income[k] = round (json.owners[owner].income[k] + pNV (eS[cell].v));
			}

			// We have entered a new income boundary, but we are not on the main owner's income cells
			else {
				k++;
				loCell = k < mainOwnerIncomeCells.length? mainOwnerIncomeCells[k] : Infinity;
				hiCell = k + 1 < mainOwnerIncomeCells.length? mainOwnerIncomeCells[k + 1] : Infinity;

				// Go back 1 iteration to do the cell compare at the top of this if-else chain
				i--;
			}

			// Make sure that there are no nulls in the array on the last income check
			if (i == ownerIncomeCells.length - 1) {
				for (var j = 0; j < mainOwnerIncomeCells.length; j++) {
					if (typeof json.owners[owner].income[j] != 'number')
						json.owners[owner].income[j] = 0;
				}
			}
		}
	}
}

function addExpensesToBudgetJSON (json, eS, eC, eTV, mainOwnerIncomeCells) {
	// Send each owner's expense to the correct location in the JSON object
	for (var owner in eC) {
		var k = 0,
			loCell = k < mainOwnerIncomeCells.length? mainOwnerIncomeCells[k] : Infinity,
			hiCell = k + 1 < mainOwnerIncomeCells.length? mainOwnerIncomeCells[k + 1] : Infinity;

		var ownerExpenseCells = eC[owner],
			expenseTypes = eTV[owner];
		for (var i = 0; i < ownerExpenseCells.length; i++) {
			var cell = ownerExpenseCells[i];
				expense = expenseTypes[i];

			// Owner's expense came before the row that marks another pay period
			if (rowCompare (cell, loCell) >= 0 && rowCompare (cell, hiCell) < 0) {
				if (!json.owners[owner].actualExpenses)
					json.owners[owner].actualExpenses = {};

				if (!json.owners[owner].actualExpenses[expense])
					json.owners[owner].actualExpenses[expense] = [];

				if (typeof json.owners[owner].actualExpenses[expense][k] != 'number')
					json.owners[owner].actualExpenses[expense][k] = 0;

				json.owners[owner].actualExpenses[expense][k] = round (json.owners[owner].actualExpenses[expense][k] + pNV (eS[ownerExpenseCells[i]].v));
			}

			// We have entered a new income boundary
			else {
				k++;
				loCell = k < mainOwnerIncomeCells.length? mainOwnerIncomeCells[k] : Infinity;
				hiCell = k + 1 < mainOwnerIncomeCells.length? mainOwnerIncomeCells[k + 1] : Infinity;

				// Go back 1 iteration to do the cell compare at the top of this if-else chain
				i--;
			}

			// Make sure that there are no nulls in the array on the last expense check
			if (i == ownerExpenseCells.length - 1) {
				for (var doneExpense in json.owners[owner].actualExpenses) {
					for (var j = 0; j < json.owners[owner].actualExpenses[doneExpense].length; j++) {
						if (typeof json.owners[owner].actualExpenses[doneExpense][j] != 'number')
							json.owners[owner].actualExpenses[doneExpense][j] = 0;
					}
				}
			}
		}
	}
}
