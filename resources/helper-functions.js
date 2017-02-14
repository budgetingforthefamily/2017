/**
 * Functions that will help with compilation of all elements for budgeting.
 */

// Used for easier readability in debugging
Array.prototype.toString = function () {
	var s = '';

	for (var i = 0; i < this.length; i++)
		s += i > 0? ', ' + this[i] : this[i];

	return '[' + s + ']';
};

// Used for making [object Object] a bit more... descriptive
function objToString (obj) {
	var s = '',
		notFirst = false;

	for (var prop in obj) {
		if (notFirst) {
			s += ',\n' + '"' + prop + '": ' + obj[prop];
		}

		else {
			notFirst = true;
			s += '"' + prop + '": ' + obj[prop];
		}
	}

	return '{' + s + '}';
}

// Allows for non-JavaScript-standard naming of JSON keys for easier maintainence
// by taking all properties and addingThemInThisFormat (unless already defined)
function standardizeObject (object) {
	// alert ('Incoming Object:\n' + objToString (object));

	var newObject = {};

	for (var prop in object) {
		var standardProp = standardizeString (prop);

		if (standardProp != prop) {
			// The user has defined both a standardized and a non-standardized version of the same property.
			// Prefer standard over non-standard
			if (!object[standardProp])
				newObject[standardProp] = object[prop];

			else newObject[standardProp] = object[standardProp];
		}

		else newObject[standardProp] = object[standardProp];
	}

	// Takes "any string of-symbols" and returns "anyStringOfSymbols"
	function standardizeString (str) {
		if (!hasDelimiters (str))
			return str;

		var s = '',
			capitalizeFirstEncounter = false,
			testForCapitalization = true;

		// Let's attempt doing this without the aid of Regex...
		for (var i = 0; i < str.length; i++) {
			if (!isDelimiter (str.charAt (i))) {
				if (testForCapitalization) {
					s += capitalizeFirstEncounter? str.charAt (i).toUpperCase () : str.charAt (i).toLowerCase ();
					capitalizeFirstEncounter = true;
				}
				
				else s += str.charAt (i).toLowerCase ();
				testForCapitalization = false;
			}

			else testForCapitalization = true;
		}

		// Self-explanatory, right?
		function isDelimiter (s) {return s === '\s' || s === '\t' || s === '\n' || s === '\r' || s === '-'}

		function hasDelimiters (s) {return s.match (/\s|-|\t|\n|\r/)}

		return s;
	}

	// alert ('Outgoing object:\n' + objToString (newObject))
	return newObject;
}



// Fast floating point error rounding
function round (v, d) {
	if (arguments.length < 2)
		d = 2;

	var l = Math.pow (10, d) << 0;
	return Math.round (l * v) / l;
}

// Converts the remainder operation to modulus operation
function mod (a, b) {
	return ((a % b) + b) % b;
}

// Summation of all of the values in an array
function sum (array) {
	return round (array.reduce (function (v, e) {return v + e}, 0));
}

// Makes sure that a number n is of type number, otherwise use the default value
function parseNumberValue (n, defaultValue) {
	if (typeof n == 'number')
		return n;

	return +defaultValue;
}

// Makes a shallow copy of an array
function arrayCopy (array) {
	var copy = [];

	for (var i = 0; i < array.length; i++)
		copy.push (array[i]);

	return copy;
}

// Returns a copy of a sub array from i (inclusive) to j (exclusive). Handy for shortening long arrays
function extractSubArray (array, i, j) {
	var extraction = [],
		l = Math.min (j, array.length);

	for (var k = Math.max (i, 0); k < l; k++)
		extraction.push (array[k]);

	return extraction;
}



// Returns the number of days of a standardly enumerated month in a given year
function numDaysOf (month, year) {
	// February, you bastard.
	if (month == 2)
		return !mod (year, 4)? 29 : 28;

	// First half of the year
	else if (month < 8)
		return 30 + mod (month, 2);

	// Is different from the second half...
	else return 31 - mod (month, 2);
}

// Converts a U.S. Date String (mm/dd/yyyy, mm-dd-yyyy, mm*dd*yyyy, etc.) to Date function argument array
function dateStringToArgsArray (dateString) {
	var numbers = dateString.match (/\d+/g);

	if (numbers) {
		initialYear = numbers[2],

		// Handle the YY convention
		yearString = initialYear.length == 2? '20' + initialYear : initialYear,

		year = +yearString,
		month = mod ((+numbers[0] - 1), 12),
		day = mod (+numbers[1], numDaysOf (month + 1, year));

		return [year, month, day];
	}

	return false;
}

// Converts a new Date object fed milliseconds to a clean U.S. date string
function msFedDateObjToUSDate (msFedDateObject) {
	var months = {
		'jan': 1,
		'feb': 2,
		'mar': 3,
		'apr': 4,
		'may': 5,
		'jun': 6,
		'jul': 7,
		'aug': 8,
		'sep': 9,
		'oct': 10,
		'nov': 11,
		'dec': 12
	};

	var words = (msFedDateObject + '').match (/\S+/g),
		month = months[words[1].toLowerCase ()],
		day = +words[2],
		year = +words[3];

	return month + '/' + day + '/' + year;
}

// Returns the number of milliseconds used to represent a specific date
function dateMilliseconds (year, month, day) {
	return new Date (year, month, day).getTime ();
}
