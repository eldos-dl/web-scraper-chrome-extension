var SelectorElementClick = {

	canReturnMultipleRecords: function () {
		return true;
	},

	canHaveChildSelectors: function () {
		return true;
	},

	canHaveLocalChildSelectors: function () {
		return true;
	},

	canCreateNewJobs: function () {
		return false;
	},
	willReturnElements: function () {
		return true;
	},

	getClickElements: function(parentElement) {
		var clickElements = ElementQuery(this.clickElementSelector, parentElement);
		return clickElements;
	},

	/**
	 * Check whether element is still reachable from html. Useful to check whether the element is removed from DOM.
	 * @param element
	 */
	isElementInHTML: function(element) {
		return $(element).closest("html").length !== 0;
	},

	triggerButtonClick: function(clickElement) {

		var cs = new CssSelector({
			enableSmartTableSelector: false,
			parent: $("body")[0],
			enableResultStripping:false
		});
		var cssSelector = cs.getCssSelector([clickElement]);

		// this function will catch window.open call and place the requested url as the elements data attribute
		var script   = document.createElement("script");
		script.type  = "text/javascript";
		script.text  = "" +
			"(function(){ " +
			"var el = document.querySelectorAll('"+cssSelector+"')[0]; " +
			"el.click(); " +
			"})();";
		document.body.appendChild(script);
	},

	extractElementsAfterClick: function(clickElement, parentElement, cloneElements) {

		var deferredResponse = $.Deferred();

		// check whether this element is still available in dom. If its not then there is no data to extract.
		if(!this.isElementInHTML(clickElement)) {
			deferredResponse.resolve([]);
			return deferredResponse.promise();
		}

		// click clickElement. executed in browsers scope
		this.triggerButtonClick(clickElement);

		var delay = parseInt(this.delay) || 0;

		// sleep for `delay` and the extract elements
		setTimeout(function() {
			var elements
			if(cloneElements) {
				elements = $(this.getDataElements(parentElement)).clone().get();
			}
			else {
				elements = this.getDataElements(parentElement);
			}

			deferredResponse.resolve(elements);
		}.bind(this), delay);
		return deferredResponse.promise();
	},

	_getData: function (parentElement) {

		if(this.clickType === 'clickOnce') {
			return this.getDataClickOnce(parentElement);
		}
		else if(this.clickType === 'clickMore') {
			return this.getDataClickMore(parentElement);
		}
		else {
			return $.Deferred().reject("invalid type").promise();
		}
	},

	getDataClickOnce: function(parentElement) {

		var delay = parseInt(this.delay) || 0;

		// elements that are available before clicking
		var startElements = $(this.getDataElements(parentElement)).clone().get();

		var deferredResultCalls = [];

		// will be clicking all click buttons with unique texts
		var clickedButtons = {};
		var extractElementsAfterUniqueButtonClick = function(button) {

			var buttonText = $(button).text().trim();
			if(!(buttonText in clickedButtons)) {
				clickedButtons[buttonText] = true;

				deferredResultCalls.push(function() {

					// extracts elements
					var deferredElements = this.extractElementsAfterClick(button, parentElement, true);

					// adds additional buttons to click on
					deferredElements.done(function(elements) {
						// @FIXME limited to recursion stack size
						var clickElements = this.getClickElements(parentElement);
						clickElements.forEach(extractElementsAfterUniqueButtonClick);
					}.bind(this));

					return deferredElements;

				}.bind(this));
			}
		}.bind(this);

		var clickElements = this.getClickElements(parentElement);
		clickElements.forEach(extractElementsAfterUniqueButtonClick);

		var deferredResponse = $.Deferred();
		$.whenCallSequentially(deferredResultCalls).done(function(results) {

			var dataElements = [];

			// elements that we got after clicking
			results.forEach(function(elements) {
				$(elements).each(function(i, element){
					dataElements.push(element);
				});
			});

			// add StartElements
			if(!this.discardInitialElements) {
				$(startElements).each(function(i, element) {
					dataElements.push(element);
				});
			}

			deferredResponse.resolve(dataElements);
		}.bind(this));
		return deferredResponse.promise();
	},

	getDataClickMore: function(parentElement) {

		var delay = parseInt(this.delay) || 0;
		var deferredResponse = $.Deferred();
		var foundElements = [];
		var clickElements = this.getClickElements(parentElement);

		// @TODO refactor. create unique element list class
		var addedElements = {};
		var addElement = function(element) {

			var elementTxt = $(element).text().trim();
			if(elementTxt in addedElements) {
				return false;
			}
			else {
				addedElements[elementTxt] = true;
				foundElements.push($(element).clone(true)[0]);
				return true;
			}
		};

		// add elements that are available before clicking
		var elements = this.getDataElements(parentElement);
		elements.forEach(addElement);

		// discard initial elements
		if(this.discardInitialElements) {
			foundElements = [];
		}

		// initial click and wait
		if(clickElements.length) {
			this.triggerButtonClick(clickElements[0]);
		}
		var nextElementSelection = (new Date()).getTime()+delay;

		// infinitely scroll down and find all items
		var interval = setInterval(function() {

			// no elements to click
			if(clickElements.length === 0) {
				clearInterval(interval);
				deferredResponse.resolve(foundElements);
			}

			var now = (new Date()).getTime();
			// sleep. wait when to extract next elements
			if(now < nextElementSelection) {
				return;
			}

			// add newly found elements to element foundElements array.
			var elements = this.getDataElements(parentElement);
			var addedAnElement = false;
			elements.forEach(function(element) {
				var added = addElement(element);
				if(added) {
					addedAnElement = true;
				}
			});

			// no new elements found
			if(!addedAnElement) {
				clickElements.shift();
			}
			else {
				// continue scrolling and add delay
				this.triggerButtonClick(clickElements[0]);
				nextElementSelection = now+delay;
			}
		}.bind(this), 50);

		return deferredResponse.promise();
	},

	getDataColumns: function () {
		return [];
	},

	getFeatures: function () {
		return ['multiple', 'delay', 'clickElementSelector', 'clickType', 'discardInitialElements']
	}
};
