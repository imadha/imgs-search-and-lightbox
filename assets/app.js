/**
 * IMGS - app.js
 * @author Ibrahim Madha
 * @website http://ibrahim.madha.net
 *
 * Main app logic for searching, fetching, and displaying photos from Instagram
 * Uses Hashtag recent endpoint
 * see https://instagram.com/developer/endpoints/tags/#get_tags_media_recent
 *
 * Contents
 * --------
 * 0. Constants and contructor
 * 1. Navigation and request methods
 * 2. UI updates/messaging
 * 3. DOM writing
 * 4. Instgram utilities
 * 5. Lightbox methods and event handlers
 * 6. Other event handlers
 */

'use strict';

var App = (function () {

  // Define constants
  var DEFAULT_TIMEOUT = 4000; // ms
  var INFINTE_SCROLL_PADDING = 250; // px
  var INSTAGRAM_CLIENT_ID = '1a3bed712fe84aaaa61d7649a9b4172f';
  var RESULTS_PER_PAGE = 20;

  // Key codes
  var KEY_ESC = 27;
  var KEY_LEFT = 37;
  var KEY_RIGHT = 39;
  
  // Getting elements with native methods
  // Look at all the ways we can do this!
  var bodyEl = document.body;
  var lightboxImgEl = document.getElementsByClassName('lightbox-img')[0];
  var lightboxInnerEl = document.getElementsByClassName('lightbox-inner')[0];
  var lightboxCaptionEl = document.getElementsByClassName('lightbox-caption')[0];
  var lightboxPrevEl = document.getElementsByClassName('lightbox-prev')[0];
  var lightboxNextEl = document.getElementsByClassName('lightbox-next')[0];
  var lightboxOffEl = document.getElementsByClassName('lightbox-off')[0];
  var linkHomeEl = document.getElementById('link-home');
  var messagingEl = document.getElementsByClassName('messaging')[0];
  var searchFormEl = document.getElementById('search-form');
  var searchInputEl = document.getElementById('search-input');
  var searchSubmitEl = document.getElementById('search-submit');
  var thumbsEl = document.getElementsByClassName('thumbs')[0];

  // determine if IE
  // only used because IE does not fire popstate on hashchange
  var ua = window.navigator.userAgent;
  var isIE = ua.indexOf('MSIE ') !== -1 || ua.indexOf('Trident/') !== -1 || ua.indexOf('Edge/') !== -1;

  /**
   * The IMGS App
   * @constructor
   */
  function App () {

    // Set up initial state
    this.state = {};
    this.initialState = {
      color: 'initial',
      hashtag: null,
      lightbox: false,
      lightboxIndex: null,
      lightboxWaiting: false,
      loading: false,
      messagingActive: false,
      nextUrl: null,
      resultsPage: 0,
      view: 'initial'
    };
    this.updateState(this.initialState);

    // Define shared timers
    this.colorStateTimer = null;
    this.messagingTimer = null;
    this.waitingForInputTimer = null;

    // Save bound lightbox event listener for attaching/detaching
    this.boundLightboxKeyUp = this.onLightboxKeyUp.bind(this);

    // Attach event listeners to lightbox controls
    lightboxInnerEl.addEventListener('animationend', this.onLightboxTransition.bind(this));
    lightboxInnerEl.addEventListener('webkitAnimationEnd', this.onLightboxTransition.bind(this));
    lightboxOffEl.addEventListener('click', this.lightboxOff.bind(this));
    lightboxPrevEl.addEventListener('click', this.lightboxPrev.bind(this));
    lightboxNextEl.addEventListener('click', this.lightboxNext.bind(this));

    // Attach event listeners to input
    searchInputEl.addEventListener('input', this.onSearchInput.bind(this));
    searchInputEl.addEventListener('keyup', this.onSearchKeyUp.bind(this));

    // Attach event listeners for submission
    searchSubmitEl.addEventListener('animationend', this.onSubmitAnimationEnd.bind(this));
    searchSubmitEl.addEventListener('webkitAnimationEnd', this.onSubmitAnimationEnd.bind(this));
    searchFormEl.addEventListener('submit', this.onSubmit.bind(this));

    // Attach event listeners to window
    window.addEventListener('scroll', this.onScroll.bind(this));

    // Support Internet Explorer hashchange behavior
    if (!isIE) {
      window.addEventListener('popstate', this.onPopState.bind(this));
    } else {
      window.addEventListener('hashchange', this.onPopState.bind(this));
      linkHomeEl.href = window.location.origin + window.location.pathname;
    }

    // Handle hashtag in url if present
    // if not, autofocus on text field
    if (window.location.hash) {
      this.handleLocationHash();
    } else {
      searchInputEl.focus();
      this.updateMessage('type your hashtag to get started');
    }
  }
  
  /**
   *
   * 1. Navigation and request methods
   *
   */
  
  /**
   * Handle if there is a hashtag search in the url
   * Sanitize value and request photos 
   */
  App.prototype.handleLocationHash = function () {
    var hashValue = window.location.hash.replace('#', '');
    var hashtag = this.getSanitizedHashtag(hashValue);
    
    if (hashtag) {
      searchInputEl.value = hashtag;
      this.requestPhotos(hashtag);
    }
  };

  /**
   * Injects JSONP script tag into the DOM for Instagram request
   * (Fetching JSON via XHR won't work because of CORS)
   * @param {string} url - url to inject into script's src
   */
  App.prototype.injectJSONP = function (url) {
    var _this = this;

    var script = document.createElement('script');
    script.setAttribute('src', url);
    script.setAttribute('async', true);

    // Update loading state when the script loads
    script.addEventListener('load', function () {
      _this.updateState({ loading: false });
    });

    // Notify user on error loading data
    script.addEventListener('error', function (errorObject) {
      _this.updateState({ loading: false });
      _this.updateMessage('could not get data from instagram', 'error');
      console.error({
        requestedUrl: url,
        error: errorObject
      });
    });

    this.updateState({ loading: true });
    bodyEl.appendChild(script);
  };

  /**
   * Make the JSONP call for a hashtag
   * The script that gets loaded will make the callback
   * @param {string} hashtag - tag to search for
   */
  App.prototype.requestPhotos = function (hashtag) { 
    // Clear DOM element and scroll to top
    thumbsEl.innerHTML = '';
    window.scrollTo(0,0);
    
    // Empty array store for incoming photo data
    this.photoStore = [];
    
    this.lightboxOff();
    this.updateState({ 
      hashtag: hashtag,
      resultsPage: 0 
    });

    var url = 'https://api.instagram.com/v1/tags/' + hashtag + '/media/recent'
      + '?callback=imgsApp.renderResults'
      + '&client_id=' + INSTAGRAM_CLIENT_ID;

    this.injectJSONP(url);
  };
  
  /**
   *
   * 2. UI updates/messaging
   *
   */

  /**
   * Updates state in variable and DOM (to be used by CSS)
   * A primitive way to create immutable application state
   * @param {object} updates - states to update
   */
  App.prototype.updateState = function (updates) {
    var keys = Object.keys(updates);
    var thisKey;

    for (var i = 0, len = keys.length; i < len; i++) {
      thisKey = keys[i];
      this.state[thisKey] = updates[thisKey];
      bodyEl.setAttribute('data-state-' + thisKey, updates[thisKey]);
    }
  };

  /**
   * Send a message to the user, optionally updating state
   * @param {string} message - the message to send
   * @param {string} colorState (optional) - option to change color of message
   */
  App.prototype.updateMessage = function (message, colorState) {
    colorState = colorState || null;
    var _this = this;

    // Reset shared timers
    clearTimeout(this.waitingForInputTimer);
    clearTimeout(this.messagingTimer);
    
    // Fade out current message before setting new one
    this.updateState({ messagingActive: false });
    messagingEl.textContent = '(' + message + ')';
    
    this.updateState({ 
      messagingActive: true,
      color: colorState ? colorState : this.state.color // only change if needed
    });
   
    // Automatically fade message and set state back later
    this.messagingTimer = setTimeout(function() {
      _this.updateState({ 
        color: 'initial',
        messagingActive: false 
      });
    }, DEFAULT_TIMEOUT);
  };

  /**
   * Waits for a user to stop typing, then reminds them to submit
   */
  App.prototype.waitForInput = function () {
    var _this = this;

    // Reset timer to before its set again
    clearTimeout(this.waitingForInputTimer);

    // Remind the user to submit if there is valid input
    searchFormEl.value && (this.waitingForInputTimer = setTimeout(function () {
      _this.updateMessage('push enter or hit the icon to search');
    }, DEFAULT_TIMEOUT));
  };

  /**
   * 
   * 3. DOM writing
   *
   */

  /**
   * Creates thumb elements in grid
   * @param {object} data - data for Instagram post
   * @param {int} index - index of current thumbnail in loop
   */
  App.prototype.createThumbEl = function (data, index) {
    var _this = this;

    var img = document.createElement('img');
    img.className = 'thumb smooth';
    img.src = data.images.low_resolution.url;
    
    img.addEventListener('load', function (event) {
      img.setAttribute('data-loaded', true);
    });
    
    // Calculate the total index based on what page we are on
    var lightboxIndex = ((this.state.resultsPage - 1) * RESULTS_PER_PAGE) + index;

    img.addEventListener('click', function (event) {
      event.preventDefault();
      _this.lightboxPopulate(lightboxIndex); 
      _this.lightboxOn();
    })
    
    thumbsEl.appendChild(img);
  };

  /**
   * Will be called back by JSONP script from Instagram
   * Validates response and renders results
   * @param {object} response - JSON response from Instagram
   */
  App.prototype.renderResults = function (response) {
    // Throw error in UI if the data we got back is empty
    if (response.meta.code !== 200 || response.data.length === 0) {
      this.lightboxOff();
      this.updateMessage('instagram could not return search results', 'error');
      return;
    }

    // Update the store with results
    this.photoStore = this.photoStore.concat(response.data);
    
    this.updateState({
      view: 'results',
      nextUrl: response.pagination.next_url || null,
      resultsPage: this.state.resultsPage + 1
    });

    for (var i=0, len = response.data.length; i < len; i++) {
      this.createThumbEl(response.data[i], i);
    }

    // If we are in the lightbox and clicked next on the last photo
    if (this.state.lightboxWaiting) {
      this.updateState({ lightboxWaiting: false });
      this.lightboxNext();
    }
  };

  /**
   * 
   * 4. Instagram utilities
   *
   */

  /**
   * Coverts #hashtags and @usernames to clickable links
   * @param {string} caption - Instagram caption
   * @returns {string} caption with links inside
   */
  App.prototype.getCaptionWithLinks = function (caption) {
    var _this = this;
    var regExp = /#([a-z0-9_]+)|(?:\s)@([a-z0-9_]+)/ig; // #(hashtag)|@(username)
    return caption.replace(regExp, function (match, hashtag, username) {
      if (hashtag) {
        return '<a class="hashtag" href="#' + _this.getSanitizedHashtag(hashtag) + '">#' + hashtag + '</a>';
      }
      if (username) {
        return _this.getUserLink(username);
      }
    });
  }

  /**
   * Automatically lowercase and add underscores for spaces
   * Strips any non-alphanumeric characters
   * @param {string} rawValue - hashtag to be santized
   * @param {bool} returnFullObject - whether to return an object for comparison, defaults to false
   * @returns {string|object} sanitized value or object with different levels of santized string
   */
  App.prototype.getSanitizedHashtag = function (rawValue, returnFullObject) {
    returnFullObject = returnFullObject || false;

    var newValue = rawValue
      .toLowerCase() // No caps allowed
      .replace(' ', '_'); // Automatically convert spaces to underscores

    var newValueStripped = newValue
      .replace(/[^a-z0-9_]+/g, ''); // Strip all unacceptable characters
    
    if (returnFullObject) {
      return {
        rawValue: rawValue,
        newValue: newValue,
        newValueStripped: newValueStripped
      };
    }

    return newValueStripped;
  };

  /**
   * Creates a offsite link to Instagram user
   * @param {string} username - Instagram username
   * @returns {string} HTML for link to Instagram user profile
   */
  App.prototype.getUserLink = function (username) {
    return '<a class="username" href="https://instagram.com/' + username + '" target="_blank">'
      + '@' + username + '</a>';
  }

  /**
   *
   * 5. Lightbox methods and event handlers
   *
   */

  /*
   * Turns on the lightbox and attaches keyboard listener
   */
  App.prototype.lightboxOn = function () {
    this.updateState({ lightbox: true });
    window.addEventListener('keyup', this.boundLightboxKeyUp);
  }

  /**
   * Turns off the lightbox and detaches keyboard listener
   * @param {DOM event} - optionally use this method as event listener
   */
  App.prototype.lightboxOff = function (event) {
    event && event.preventDefault();
    lightboxOffEl.blur();
    this.updateState({ lightbox: false });
    window.removeEventListener('keyup', this.boundLightboxKeyUp);
  }

  /**
   * Switches to the previous image in the lightbox
   * @param {DOM event} - optionally use this method as event listener
   */
  App.prototype.lightboxPrev = function (event) {
    event && event.preventDefault();
    lightboxPrevEl.blur();

    // Do not attempt anything if we are on first image
    if (this.state.lightboxIndex === 0) {
      return;
    }

    // Begin animation
    lightboxInnerEl.setAttribute('data-animate', 'prev1');
  }

  /**
   * Switches to the next image in the lightbox
   * @param {DOM event} - optionally use this method as event listener
   */
  App.prototype.lightboxNext = function (event) {
    event && event.preventDefault();
    lightboxNextEl.blur();

    // Do not attempt anything there is no more data to get
    if (this.state.lightboxLast && !this.state.nextUrl) {
      return;
    }

    // Request more if on last index
    if (this.state.lightboxLast) {
      this.updateState({ lightboxWaiting: true });
      this.injectJSONP(this.state.nextUrl);
      return;
    }

    // Begin animation
    lightboxInnerEl.setAttribute('data-animate', 'next1');
  };

  /**
   * Populates the lightbox with the current data
   * @param {object} data - data for Instagram post
   */
  App.prototype.lightboxPopulate = function (index) {
    var data = this.photoStore[index];

    this.updateState({ 
      lightboxIndex: index,
      // If we are on the last item of the currently available photos
      lightboxLast: this.state.lightboxIndex === this.photoStore.length - 1 
    });

    lightboxImgEl.style.backgroundImage = 'url(' + data.images.standard_resolution.url + ')';
    
    lightboxCaptionEl.innerHTML = '';
    var p = document.createElement('p');
    p.innerHTML = this.getUserLink(data.user.username) + ' ' + this.getCaptionWithLinks(data.caption.text);

    lightboxCaptionEl.appendChild(p);
  }

  /**
   * Event handler for key up on window
   * Navigation controls for window
   * @param {DOM Event} event
   */
  App.prototype.onLightboxKeyUp = function (event) {
    switch (event.keyCode) {
      case KEY_ESC:
        this.lightboxOff(event);
      break;
      case KEY_LEFT:
        this.lightboxPrev(event);
      break;
      case KEY_RIGHT:
        this.lightboxNext(event);
      break;
    }
  };

  /**
   * Event handler for end of animation on lightbox inner el
   * Moves animations to their second step after populating lightbox with new data
   * @param {DOM event} - optionally use this method as event listener
   */
  App.prototype.onLightboxTransition = function (event) {
    var el = lightboxInnerEl;
    
    switch (el.getAttribute('data-animate')) {
      case 'prev1':
        this.lightboxPopulate(this.state.lightboxIndex - 1);
        el.setAttribute('data-animate', 'prev2');
      break;
      case 'next1':
        this.lightboxPopulate(this.state.lightboxIndex + 1);
        el.setAttribute('data-animate', 'next2');
      break;
      default:
        el.setAttribute('data-animate', '');
      break;
    }
  };

  /**
   *
   * 6. Ohter event handlers
   *
   */

  /**
   * Event Listener for pop state on window
   * @param {DOM Event} event - contains the popped state
   */
  App.prototype.onPopState = function (event) {
    if (!window.location.hash) {
      searchInputEl.value = '';
      this.updateState(this.initialState);
    } else {
      this.handleLocationHash();
    }
  };

  /**
   * Scroll Event Listener
   * Used for infinite scroll
   * @param {DOM Event} event
   */
  App.prototype.onScroll = function (event) {
    if (
      this.state.nextUrl 
      && !this.state.loading
      && thumbsEl.getBoundingClientRect().bottom - INFINTE_SCROLL_PADDING < window.innerHeight
    ) {
      this.injectJSONP(this.state.nextUrl);
    }
  }

  /**
   * Event Listener for input on search input
   * Sanitizes hashtag text and messages users appropriately
   * @param {DOM Event} event
   */
  App.prototype.onSearchInput = function (event) {
    var sanitized = this.getSanitizedHashtag(searchInputEl.value, true);
    searchInputEl.value = sanitized.newValueStripped;
    
    // Remind user to push enter
    this.waitForInput();

    // If we had to change anything, just remind them what is going on 
    if (sanitized.newValue !== sanitized.rawValue) {
      this.updateMessage('uppercase letters and spaces are automatically converted')
    }

   // If we had to strip characters, let's warn the user to not use those characters
    if (sanitized.newValue !== sanitized.newValueStripped) {
      this.updateMessage('non-alphanumeric characters do not work in hashtags', 'warn');
    }
  };

  /**
   * Event Listener for key up on search input
   * Blurs input when user hits ESC key
   * @param {DOM Event} event
   */
  App.prototype.onSearchKeyUp = function (event) {
    if (event.keyCode === KEY_ESC) {
      searchInputEl.blur();
    }
  };

  /**
   * Search Submit Event Listener
   * Makes sure there is a valid hashtag search before querying Instagram
   * @param {DOM Event} event
   */
  App.prototype.onSubmit = function (event) {
    event.preventDefault();
    clearTimeout(this.waitingForInputTimer);
    
    // Perform UI updates
    searchInputEl.blur();
    searchSubmitEl.blur();
    searchSubmitEl.setAttribute('data-animate', 'true');
    this.updateState({ messagingActive: false });
    
    var hashtag = searchInputEl.value;
    
    if (!hashtag || hashtag.length === 0) {
      this.updateMessage('you must enter a search value to submit your search', 'error');
      return;
    }

    // Only request new photos if this is a new hashtag
    if (hashtag !== this.state.hashtag) {
      window.history.pushState(this.state, '', '#' + hashtag);
      this.requestPhotos(hashtag);
    }
  };

  /**
   * Search Submit Animation Event Listener
   * Simply removes className when animation is finished
   */
  App.prototype.onSubmitAnimationEnd = function () {
    searchSubmitEl.setAttribute('data-animate', 'false');
  };

  return App;
})();
