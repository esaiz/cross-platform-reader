'use strict';

var Page = function(){
	this.path = 'http://localhost:9001/demo/#!/';

	var nextButton = element(by.css('[data-test="next-button"]')),
		prevButton = element(by.css('[data-test="prev-button"]')),
		status = element.all(by.css('[data-test="status"]')).first(),
		errors = element.all(by.css('[data-test="error"]')),
		fontSize = element(by.css('[data-test="font-size"]')),
		lineHeight = element(by.css('[data-test="line-height"]')),
		bookmark = element(by.css('[data-test="bookmark-button"]')),
		width = element(by.css('[data-test="width"]')),
		height = element(by.css('[data-test="height"]')),
		columns = element(by.css('[data-test="columns"]')),
		padding = element(by.css('[data-test="padding"]')),
		reader = element(by.css('[data-test="reader"] #cpr-iframe')),
		iframeButton = element(by.css('[data-test="iframebutton"]')),
		window = null;

	this.fontFamily = element.all(by.css('[data-test="font-family"] option'));
	this.textAlign = element.all(by.css('[data-test="text-align"] option'));
	this.theme = element.all(by.css('[data-test="theme"] option'));
	this.margin = element.all(by.css('[data-test="margin"] option'));
	this.isbn = element(by.css('[data-test="isbn"]'));

	this.useIframe = true;

	this.load = function(isbn, env, publisherStyles){
		var path = this.path + (isbn || '9780007441235') + '?env=' + (typeof env === 'undefined' ? 2 : env) + '&publisherStyles='+(!!publisherStyles ? 'true' : 'false')+'&transitionDuration=0';

		if(!this.useIframe || browser.params.noiframe === true){
			path += '&iframe=no';
		}

		browser.get(path);
		iframeButton.click();
		// wait at maximum 2 seconds for the reader to load the content (which means waiting for a status updated from the reader).
		var status = this.status;
		return browser.getWindowHandle().then(function(handle){
			window = handle;
			return status();
		});
	};

	this.next = function(){
		var status = this.status;
		return nextButton.isEnabled().then(function(isEnabled){
			if(isEnabled){
				return nextButton.click().then(function(){
					return status();
				});
			}
			// button is not clickable, cannot go next, reject
			return protractor.promise.rejected();
		});
	};

	this.prev = function(){
		var status = this.status;
		return prevButton.isEnabled().then(function(isEnabled){
			if(isEnabled){
				return prevButton.click().then(function(){
					return status();
				});
			}
			// button is not clickable, cannot go next, reject
			return protractor.promise.rejected();
		});
	};

	this.status = function(){
		return browser.wait(function() {
			return status.isPresent();
		}, 60000).then(function(){
				return status.getAttribute('data-json').then(function(e){
					return JSON.parse(e);
				});
			});
	};

	/**
	 * Protractor can only work in one document at a time.
	 * If a test should require access to the contents of the reader's iframe, it should wrap any tests in this function, which temporarily switches the context of protractor
	 * */
	this.readerContext = function(action){
		var ptor = protractor.getInstance();

		if(this.useIframe && !browser.params.noiframe){
			ptor.switchTo().frame(reader);
		}

		ptor.ignoreSynchronization = true;

		action(
			element.all(by.css('#cpr-reader span, #cpr-reader p, #cpr-reader em, #cpr-reader div, #cpr-reader strong, #cpr-reader a')).first(),
			element(by.css('body')),
			element(by.css('#cpr-reader')),
			element(by.css('#cpr-header')),
			element(by.css('#cpr-footer')),
			element(by.css('#cpr-reader')).element(by.xpath('..')) // gets the container element
		);

		// this does not seem to work, we need to reload page t oswitch back to original window
		ptor.ignoreSynchronization = false;
		return ptor.switchTo().window(window);
	};

	this.hasErrors = function(){
		return errors.count().then(function(count){
			return count > 0;
		});
	};

	/**
	 * Clicks a link with the given text within the reader
	 * */
	this.clickLink = function(text){
		var status = this.status;
		return this.readerContext(function(){
			return element(by.xpath('//a[contains(text(),"'+text+'")]')).click();
		}).then(function(){
				return status();
			});
	};

	/**
	 * This function will loop through the entire book by either calling next or previous repeatedly.
	 * callback is a function called every time the status updates
	 * reverse is a flag that tell the reader to loop backwards
	 * returns a promise that resolves when the loop completes
	 * */
	this.loop = function(callback, reverse){

		var _defer = protractor.promise.defer(),
			_action = !reverse ? this.next.bind(this) : this.prev.bind(this);

		var	_loop = function(status){
			var promise = callback(status);

			if(protractor.promise.isPromise(promise)){
				promise.then(function(){
					// the action will be rejected if the action cannot be completed (exp calling next on the last page)
					_action().then(_loop, _defer.fulfill);
				}, _defer.fulfill);
			} else {
				// the action will be rejected if the action cannot be completed (exp calling next on the last page)
				_action().then(_loop, _defer.fulfill);
			}
		};

		this.status().then(_loop);

		return _defer.promise;
	};

	// clears an input and sets the specified value
	var _input = function(el, value){
		var status = this.status;
		return el.clear().then(function(){
			return el.sendKeys(value).then(function(){
				return status();
			});
		});
	}.bind(this);

	this.setFontSize = function(value){
		return _input(fontSize, value);
	};

	this.setLineHeight = function(value){
		return _input(lineHeight, value);
	};

	this.bookmark = function(){
		var status = this.status;
		return bookmark.click().then(function(){
			return status();
		});
	};

	this.resize = function(dimension){
		return protractor.promise.all([
				_input(width, dimension.width),
				_input(height, dimension.height),
				_input(columns, dimension.columns),
				_input(padding, dimension.padding)
			]).then(function(){
				return reader.getSize();
			});
	};
};

module.exports = new Page();