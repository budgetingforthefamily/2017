/**
 * A compilation of all functions defined at the lower scope.
 */
var $budgetJSONFileName = "budget.auto.json",
	
	// Used for keeping track of the button where the mouse went down on
	$prevTarget = false;

$(window).load (function () {main ($budgetJSONFileName, init);});

// Encapsulated in a function because of AJAX. Interfaces with Highcharts to make a nice projection via a stacked bar chart
function init (newBudgetJSON) {
	updateBudgetJSONValues (standardizeObject (newBudgetJSON));
	standardizeOwners ($owners);

	updateHiCharts ();
	addToggleableButton ();
	addToggleableOwnerButtons ();
}

function updateHiCharts (visibleOwner) {
	var xAxisCategories = generateXAxisCategories ($daysPerPeriod, $periodStartDate, $payPeriods),
		yAxisCategory   = generateYAxisCategory ($owners, $mainOwner, $payPeriods, $initialBankAmount),

		normalizedIncomeMap  = generateNormalizedIncomeMap ($owners, $payPeriods),
		normalizedExpenseMap = generateNormalizedExpenseMap ($owners, $payPeriods),
		dataSeries = generateDataSeries (normalizedIncomeMap, normalizedExpenseMap, $mainOwner, $payPeriods, $initialBankAmount, $onlyDisplayMainOwner, visibleOwner);

	// Make sure that if there is a main owner, the money left over is colored green. This is for emphasis
	if ($mainOwner && $mainOwner !== false) dataSeries[dataSeries.length - 1].color = '#008800';

	// The main owner has the possibility of being in debt
	var minYValue = Math.min.apply (Math, dataSeries[dataSeries.length - 1].data);


	// Setting the color for theming purposes
	var masterDarkThemeBg = '#303030',
		plotDarkThemeBg   = '#202020',
		hoverDarkThemeBg  = '#444',
		outlinesDarkThemeColor = '#c5c5c5',

		largeDarkThemeFontColor = '#B5B5B5',
		smallDarkThemeFontColor = '#858585',

		chartOptions  = $useDarkTheme? (function () {$('#body').css ({backgroundColor: plotDarkThemeBg}); return {type: 'column', plotBackgroundColor: masterDarkThemeBg, backgroundColor: plotDarkThemeBg}})() : {type: 'column'},
		titleOptions  = $useDarkTheme? {text: $budgetTitle, style: {color: largeDarkThemeFontColor}} : {text: $budgetTitle},
		xAxisOptions  = $useDarkTheme? {categories: xAxisCategories, labels: {style: {color: smallDarkThemeFontColor}}} : {categories: xAxisCategories},
		yAxisOptions  = $useDarkTheme? {min: minYValue, title: {text: yAxisCategory, style: {color: largeDarkThemeFontColor}}, labels: {style: {color: smallDarkThemeFontColor}}, gridLineColor: outlinesDarkThemeColor} : {min: minYValue, title: {text: yAxisCategory}},
		legendOptions = $useDarkTheme? {reversed: true, itemHoverStyle: {color: largeDarkThemeFontColor}, itemHiddenStyle: {color: '#555'}, itemStyle: {color: smallDarkThemeFontColor}} : {reversed: true},
		plotOptionsOptions = $useDarkTheme? {series: {stacking: 'normal', borderColor: outlinesDarkThemeColor}} : {series: {stacking: 'normal'}};

	var apiObject = {
		chart:  chartOptions,
		title:  titleOptions,
		xAxis:  xAxisOptions,
		yAxis:  yAxisOptions,
		legend: legendOptions,
		plotOptions: plotOptionsOptions,

		series: dataSeries,

		navigation: {
			buttonOptions: {
				theme: {
					'stroke-width': 1,
					r: 0,
					stroke: 'silver',
					states: {hover: {stroke: '#999', fill: '#ccc'}, select: {'stroke-width': 2, fill: '#ccc', stroke: '#999'}}
				}
			},

			menuStyle: {
				'box-shadow': 'none'
			}
		}
	};

	// Also theme the exporting button as to not be an eyesore in dark theme
	if ($useDarkTheme) {
		apiObject.navigation.buttonOptions.theme.stroke = smallDarkThemeFontColor;
		apiObject.navigation.buttonOptions.theme.fill = plotDarkThemeBg;
		apiObject.navigation.buttonOptions.theme.states.hover.stroke = largeDarkThemeFontColor;
		apiObject.navigation.buttonOptions.theme.states.hover.fill = hoverDarkThemeBg;
		apiObject.navigation.buttonOptions.theme.states.select.fill = hoverDarkThemeBg;
		apiObject.navigation.buttonOptions.theme.states.select.stroke = largeDarkThemeFontColor;

		apiObject.navigation.menuStyle.border = '1px solid ' + smallDarkThemeFontColor;
		apiObject.navigation.menuStyle.backgroundColor = masterDarkThemeBg;
		apiObject.navigation.menuItemStyle = {};
		apiObject.navigation.menuItemStyle.color = smallDarkThemeFontColor;
	}

	// Let it begin
	$('#container').highcharts (apiObject);

	// Remove watermark because it's ugly
	$('g + text').each (function (i) {
		var child = $(this);
		if (child.html ().match (/highcharts\.com/i)) {
			child.remove ();
			return false;
		}
	});
}

function addToggleableButton () {
	var togglerDiv = document.createElement ('div'),
		togglerDivId = 'daynighttoggler',
		togglerDivClass = 'ownervisibilitytoggler',
		dayText = document.createTextNode ('\u263e'),
		nightText = document.createTextNode ('\u2600');

	// Let JavaScript access these new nodes more easily
	togglerDiv.setAttribute ('id', togglerDivId);
	togglerDiv.setAttribute ('class', togglerDivClass);

	// Initialize the toggler div with the correct text
	togglerDiv.appendChild ($useDarkTheme? nightText : dayText);

	// Add the toggler to the document
	document.body.appendChild (togglerDiv);

	// Toggle day and night
	togglerDiv.addEventListener ('mousedown', function (e) {$prevTarget = e.target;});
	togglerDiv.addEventListener ('mouseup', function (e) {
		// Only works with left click
		if (e.which == 1 && $prevTarget === e.target) {
			$useDarkTheme = !$useDarkTheme;

			updateHiCharts ();

			togglerDiv.innerHTML = '';
			togglerDiv.appendChild ($useDarkTheme? nightText : dayText);
		}
	});
}

function addToggleableOwnerButtons () {
	const DAY_NIGHT_TOGGLER_BUTTON_PIXEL_WIDTH = 28,
		RIGHT_MARGIN_PIXEL_DISTANCE = 10;

	// Add a button for each owner to be toggled and add the mouseup handler to toggle that visibility
	var rightOffset = DAY_NIGHT_TOGGLER_BUTTON_PIXEL_WIDTH + RIGHT_MARGIN_PIXEL_DISTANCE;
	for (var owner in $owners) {
		var visibilityTogglerDiv = document.createElement ('div'),
			visibilityTogglerDivClass = 'ownervisibilitytoggler',
			ownerText = document.createTextNode (owner);

		// Let CSS do what it's gotta do
		visibilityTogglerDiv.setAttribute ('class', visibilityTogglerDivClass);
	
		// Add the owner's name to the text so that the user knows which one is about to be toggled
		visibilityTogglerDiv.appendChild (ownerText);

		// Make sure that it is positioned correctly in the document
		visibilityTogglerDiv.style.right = (rightOffset += RIGHT_MARGIN_PIXEL_DISTANCE) + 'px';

		// Add the current toggler to the document
		document.body.appendChild (visibilityTogglerDiv);

		// Add the width of the current visibility toggler div to the right offset to make the next button be positioned correctly
		rightOffset += visibilityTogglerDiv.offsetWidth;

		// Toggle between owners
		visibilityTogglerDiv.addEventListener ('mousedown', function (e) {$prevTarget = e.target;});
		visibilityTogglerDiv.addEventListener ('mouseup', function (e) {if (e.which == 1 && $prevTarget === e.target) updateHiCharts (e.target.innerHTML);});
	}

	// Add the show all special button
	var allTogglerDiv = document.createElement ('div'),
		allTogglerDivClass = 'ownervisibilitytoggler',
		allTogglerTooltip = 'show all owner information',
		allVisibilityText = document.createTextNode ('All');

	allTogglerDiv.setAttribute ('class', allTogglerDivClass);
	allTogglerDiv.setAttribute ('title', allTogglerTooltip);
	allTogglerDiv.appendChild (allVisibilityText);
	allTogglerDiv.style.right = rightOffset + RIGHT_MARGIN_PIXEL_DISTANCE + 'px';
	document.body.appendChild (allTogglerDiv);

	allTogglerDiv.addEventListener ('mousedown', function (e) {$prevTarget = e.target;});
	allTogglerDiv.addEventListener ('mouseup', function (e) {if (e.which == 1 && $prevTarget === e.target) updateHiCharts ('_ALL_OWNER$');});

	rightOffset += allTogglerDiv.offsetWidth;

	
	// Add the show none special button
	var noneTogglerDiv = document.createElement ('div'),
		noneTogglerDivClass = 'ownervisibilitytoggler',
		noneTogglerTooltip = 'hide all owner information',
		noneVisibilityText = document.createTextNode ('\u2716');

	noneTogglerDiv.setAttribute ('class', noneTogglerDivClass);
	noneTogglerDiv.setAttribute ('title', noneTogglerTooltip);
	noneTogglerDiv.appendChild (noneVisibilityText);
	noneTogglerDiv.style.right = rightOffset + RIGHT_MARGIN_PIXEL_DISTANCE + 'px';
	document.body.appendChild (noneTogglerDiv);

	noneTogglerDiv.addEventListener ('mousedown', function (e) {$prevTarget = e.target;});
	noneTogglerDiv.addEventListener ('mouseup', function (e) {if (e.which == 1 && $prevTarget === e.target) updateHiCharts ('_NO_OWNER$');});

	
	// Used to position the buttons correctly once the font has been fully loaded to the screen
	function positionToggleableButtonsCorrectly (msDuration) {
		var time = Date.now (),
			animationId = false;

		function repeat () {
			if (!(Date.now () - time >= msDuration)) {
				var bodyChildren = document.body.children,
					rightOffset = DAY_NIGHT_TOGGLER_BUTTON_PIXEL_WIDTH + RIGHT_MARGIN_PIXEL_DISTANCE;

				for (var i = 2; i < bodyChildren.length; i++) {
					bodyChildren[i].style.right = (rightOffset += RIGHT_MARGIN_PIXEL_DISTANCE) + 'px';
					rightOffset += bodyChildren[i].offsetWidth;
				}

				time = Date.now ();
				animationId = requestAnimationFrame (repeat);
			}
			
			else cancelAnimationFrame (animationId);
		}

		repeat ();
	}

	// Do this forever because why not...
	positionToggleableButtonsCorrectly (Infinity);
}
