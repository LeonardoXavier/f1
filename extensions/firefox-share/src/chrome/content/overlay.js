'use strict';
/*jslint indent: 2, plusplus: false */
/*global document: false, setInterval: false, clearInterval: false,
  Application: false, gBrowser: false, window: false, Components: false */

/*
 TODO
 - if user navigates away from page, then should auto-close the share pane.
 - Detect if the user already uses some services and pass them to the iframe.
*/

var ffshare;
(function () {

  var slice = Array.prototype.slice,
      ostring = Object.prototype.toString, fn;

  var dbConn = Cc["@mozilla.org/browser/nav-history-service;1"].
    getService(Ci.nsPIPlacesDatabase).
    DBConnection;

  function log(msg) {
    Application.console.log('.'+msg); // avoid clearing on empty log
  }

  fn = {

    /**
     * Determines if the input a function.
     * @param {Object} it whatever you want to test to see if it is a function.
     * @returns Boolean
     */
    is: function (it) {
      return ostring.call(it) === '[object Function]';
    },

    /**
     * Different from Function.prototype.bind in ES5 --
     * it has the "this" argument listed first. This is generally
     * more readable, since the "this" object is visible before
     * the function body, reducing chances for error by missing it.
     * If only obj has a real value then obj will be returned,
     * allowing this method to be called even if you are not aware
     * of the format of the obj and f types.
     * It also allows the function to be a string name, in which case,
     * obj[f] is used to find the function.
     * @param {Object||Function} obj the "this" object, or a function.
     * @param {Function||String} f the function of function name that
     * should be called with obj set as the "this" value.
     * @returns {Function}
     */
    bind: function (obj, f) {
      //Do not bother if 
      if (!f) {
        return obj;
      }

      //Make sure we have a function
      if (typeof f === 'string') {
        f = obj[f];
      }
      var args = slice.call(arguments, 2);
      return function () {
        return f.apply(obj, args.concat(slice.call(arguments, 0)));
      };
    }
  };

  var iframeProgressListener = {
    // detect communication from the iframe via location setting
    QueryInterface: function(aIID) {
      if (aIID.equals(Components.interfaces.nsIWebProgressListener)   ||
          aIID.equals(Components.interfaces.nsIWebProgressListener2)  ||
          aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
          aIID.equals(Components.interfaces.nsISupports))
        return this;
      throw Components.results.NS_NOINTERFACE;
    },

    onLocationChange: function(/*in nsIWebProgress*/ aWebProgress,
                          /*in nsIRequest*/ aRequest,
                          /*in nsIURI*/ aLocation) {
      var hashIndex = aLocation.spec.indexOf("#");
      if (hashIndex != -1) {
        var tail = aLocation.spec.slice(hashIndex+1, aLocation.spec.length)
        // XXX jrburke goes here.
        if (tail == "!close") {
          ffshare.hide();
        } else if (tail == "!resize") {
          ffshare.matchIframeContentHeight();
        }
      }
    }
  };

  var httpObserver = {
    
    started: true,
    found: false,
    // 
    observe: function(subject, topic, data) {
      try {
        var channel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);
      } catch (e) {
        return;
      }
      if (channel) {
        var shortenedBy = null;
        shortenedBy = channel.getResponseHeader("x-shortened-by");
        if (shortenedBy) {
          //Application.console.log('found x-shortened-by');
          ffshare.friend = shortenedBy;
          this.found = true;
        }
      }
    },

    onLocationChange: function(/*in nsIWebProgress*/ aWebProgress,
                          /*in nsIRequest*/ aRequest,
                          /*in nsIURI*/ aLocation) {
    },
    onStatusChange: function(/*in nsIWebProgress*/ aWebProgress,
                          /*in nsIRequest*/ aRequest,
                          /*in nsIURI*/ aLocation) {
    },
    onProgressChange: function(/*in nsIWebProgress*/ aWebProgress,
                          /*in nsIRequest*/ aRequest,
                          /*in nsIURI*/ aLocation) {
    },
    onSecurityChange: function(/*in nsIWebProgress*/ aWebProgress,
                          /*in nsIRequest*/ aRequest,
                          /*in nsIURI*/ aLocation) {
    },

    onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
    // maybe can just use onLocationChange, but I don't think so?
    var flags = Components.interfaces.nsIWebProgressListener;
    var orange = document.getElementById('share-indicator')
    if (aStateFlags & flags.STATE_IS_DOCUMENT) {
      if (aStateFlags & flags.STATE_START) {
        //Application.console.log("DOC START");
        //Application.console.log("hiding on docstart");
        this.started = true;
        orange.style.visibility = 'collapse';
      } else if (aStateFlags & flags.STATE_STOP) {
        //Application.console.log("DOC STOP: ");
        this.started = false;
        if (this.found) {
          //Application.console.log('showing');
          orange.style.visibility = 'visible';
        } else {
          //Application.console.log('hiding');
          //orange.style.visibility = 'collapse';
        }
        this.found = false;
      }
    }
  },

  QueryInterface: function(iid) {
    if (iid.equals(Components.interfaces.nsIObserver) ||
        iid.equals(Components.interfaces.nsIWebProgressListener) ||
        iid.equals(Components.interfaces.nsISupportsWeakReference) ||
        iid.equals(Components.interfaces.nsISupports))
      return this;
    throw Components.results.NS_NOINTERFACE;
  }

  };

  var navProgressListener = {
    // detect navigational events for the tab, so we can close

    QueryInterface: function(aIID) {
      if (aIID.equals(Components.interfaces.nsIWebProgressListener)   ||
          aIID.equals(Components.interfaces.nsIWebProgressListener2)  ||
          aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
          aIID.equals(Components.interfaces.nsISupports))
        return this;
      throw Components.results.NS_NOINTERFACE;
    },

    onLocationChange: function(/*in nsIWebProgress*/ aWebProgress,
                          /*in nsIRequest*/ aRequest,
                          /*in nsIURI*/ aLocation) {
      // For now, any navigation causes collapsing.
      // XXX refine to be tolerant of #-appending
      ffshare.hide();
    }
  };

  ffshare = {

    whoFrom: function() {
      var popup = document.getElementById("ffshare-popup");
      var orange = document.getElementById("share-indicator");
      var friend = document.getElementById("friend");
      friend.value = this.friend;
      popup.hidden = false;
      var rect = orange.getBoundingClientRect();
      popup.openPopup(null,null,rect.left - 10, rect.top + rect.height);
      popup.popupBoxObject.setConsumeRollupEvent(Ci.nsIPopupBoxObject.ROLLUP_CONSUME);

    },
    onPopupShown: function() {
      Application.console.log("shownPOPUP!");
    },

    frameAnimationTime: 300,
    // You may want to set the pref to 'http://127.0.0.1:5000/share/' for local dev.
    shareUrl: Application.prefs.getValue("linkdrop.share_url", 'http://linkdrop.mozillamessaging.com/share/'),
    shareFrame: null,

    onLoad: function () {
      // initialization code
      this.initialized = true;
      this.strings = document.getElementById("ffshare-strings");
      var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
      observerService.addObserver(httpObserver, "http-on-examine-response", false);
      var flags = Components.interfaces.nsIWebProgress;
      gBrowser.selectedTab.linkedBrowser.addProgressListener(httpObserver, flags.STATE_DOCUMENT);
    },

    onUnload: function () {
      // initialization code
      var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
      observerService.removeObserver(httpObserver, "http-on-examine-response");
      gBrowser.selectedTab.linkedBrowser.removeProgressListener(httpObserver);
    },

    onMenuItemCommand: function (e) {
      this.onToolbarButtonCommand(e);
    },

    getKnownServices: function () {
      // Returns a map of all of the known services we have found logins
      // for, with the following structure:
       //{'gmail': {
       //     'usernames': ['john.doe', 'jane baz']
       //     },
       //{'twitter': {
       //     'usernames': ['john.doe', 'jane baz']
       //     },
       //
      var loginMgr = Components.classes["@mozilla.org/login-manager;1"]
                         .getService(Components.interfaces.nsILoginManager),
          logins = loginMgr.getAllLogins({}),
          knownServices = [
        {'hostnames': [['http://twitter.com', true],
                       ['https://twitter.com', true]
                       ], 'name': 'twitter'},
        {'hostnames': [['http://mail.google.com', true],
                       ['https://mail.google.com', true],
                       ['http://www.google.com', false],
                       ['https://www.google.com', false],
                       ], 'name': 'gmail'},
        {'hostnames': [['http://www.facebook.com', true],
                       ['https://login.facebook.com', true]
                       ], 'name': 'facebook'}
      ],
          detectedServices = [],
          detectedServicesMap = {},
          i, j, hostnameIndex, svcName, username, svcData, exists, ui;
      for (i = 0; i < logins.length; i++) {
        for (j = 0; j < knownServices.length; j++) {
          for (hostnameIndex = 0; hostnameIndex < knownServices[j].hostnames.length; hostnameIndex++) {
            var [svcUrl, countsTowardsFrecency] = knownServices[j].hostnames[hostnameIndex];
            if (svcUrl === logins[i].hostname) {
              var svcName = knownServices[j].name;
              var svcData;
              var username = logins[i].username;
              if (! detectedServicesMap[svcName]) {
                svcData = {'usernames': [], 'frecency': 0};
                detectedServicesMap[svcName] = svcData;
                detectedServices.push(svcName);
              } else {
                svcData = detectedServicesMap[svcName];
              }
              if (countsTowardsFrecency) // should count frecency for this domain
                svcData['frecency'] += this.getFrecencyForURI(svcUrl);
              exists = false;
              for (ui = 0; ui < svcData.usernames.length; ui++) {
                if (svcData.usernames[ui] === username) {
                  exists = true;
                }
              }
              if (!exists) {
                svcData.usernames.push(username);
              }
            }
          }
        }
      }
      return detectedServicesMap;
    },

    /**
     * Returns the frecency of a URI.
     *
     * XXX: should move to async as places moves to async.
     *
     * @param  aURI
     *         the URI of a place
     * @return the frecency of aURI
     */
    getFrecencyForURI: function(url) {
      var ios = Cc["@mozilla.org/network/io-service;1"].
             getService(Ci.nsIIOService);
      var uri = ios.newURI(url, null, null);
      var sql = "SELECT frecency FROM moz_places WHERE url = :url LIMIT 1";
      var stmt = dbConn.createStatement(sql);
      stmt.params.url = uri.spec;
      var retval = stmt.executeStep();
      if (retval == false) return 0;
      var frecency = stmt.getInt32(0);
      stmt.finalize();
      return frecency;
    },

    registerListener: function() {
      this.shareFrame.webProgress.addProgressListener(iframeProgressListener, Components.interfaces.nsIWebProgress.NOTIFY_LOCATION);
      this.tab.linkedBrowser.webProgress.addProgressListener(navProgressListener, Components.interfaces.nsIWebProgress.NOTIFY_LOCATION);
    },
    
    unregisterListener: function(listener) {
      this.shareFrame.webProgress.removeProgressListener(iframeProgressListener);
      this.tab.linkedBrowser.webProgress.removeProgressListener(navProgressListener);
    },

    hide: function () {
      this.unregisterListener();
      this.tab = null;
      this.changeHeight(0, fn.bind(this, function () {
          this.shareFrame.parentNode.removeChild(this.shareFrame);
          this.shareFrame = null;
      }));
    },
  
    show: function () {
      //Create the iframe.
      var tab = gBrowser.selectedTab,
          parentNode = tab.linkedBrowser.parentNode,
          iframeNode = document.createElement("browser"),
          url, options;

      //Remember iframe node for later.
      this.shareFrame = iframeNode;
      this.tab = tab;

      iframeNode.className = 'ffshare-frame';
      iframeNode.style.width = '100%';
      iframeNode.style.height = 0;
      //Make sure it can go all the way to zero.
      iframeNode.style.minHeight = 0;

      //Figure out if CSS transitions can be used
      if ('MozTransition' in iframeNode.style) {
        this.useCssTransition = true;
        iframeNode.addEventListener("transitionend", fn.bind(this, 'onTransitionEnd'), true);
      } else {
        this.useCssTransition = false;
      }

      iframeNode.addEventListener('load', fn.bind(this, 'matchIframeContentHeight'), true);

      options = {
        services: this.getKnownServices(),
        title: this.getPageTitle(),
        description : this.getPageDescription(),
        medium : this.getPageMedium(),
        url: gBrowser.currentURI.spec,
        canonicalUrl: this.getCanonicalURL(),
        previews: this.previews()
      };
      
      if (! options.previews.length) {
        // then we need to make our own thumbnail
        options['thumbnail'] = this.getThumbnailData();
      }

      url = this.shareUrl +
                '#options=' + encodeURIComponent(JSON.stringify(options));

      iframeNode.setAttribute("type", "content");
      iframeNode.setAttribute("src", url);
      parentNode.insertBefore(iframeNode, parentNode.firstChild);
      this.registerListener();
    },

    changeHeight: function (height, onEnd) {

      if (this.useCssTransition) {
        this.onHeightEnd = onEnd;
      }
      
      this.shareFrame.style.height = height + 'px';

      if (!this.useCssTransition && onEnd) {
        onEnd();
      }
    },

    matchIframeContentHeight: function () {
      var height = this.shareFrame.contentDocument.documentElement.getBoundingClientRect().height;
      this.changeHeight(height);
    },

    onTransitionEnd: function (evt) {
      if (this.onHeightEnd) {
        this.onHeightEnd();
      }
    },

    onToolbarButtonCommand: function (e) {
      if (this.shareFrame) {
        this.hide();
      } else {
        this.show();
      }
    },

    getPageTitle: function () {
      var metaNodes = gBrowser.contentDocument.getElementsByTagName('meta');
      var titleNode = gBrowser.contentDocument.getElementsByTagName('title')[0];
      for (var i = 0; i < metaNodes.length; i++) {
        if ("title" == metaNodes[i].getAttribute("name")) {
          var content = metaNodes[i].getAttribute("content");
          if (content)
            return content;
        }
      }
      if (titleNode) {
        return titleNode.firstChild.nodeValue;
      }
      return '';
    },

    getPageDescription: function () {
      var metaNodes = gBrowser.contentDocument.getElementsByTagName('meta');
      for (var i = 0; i < metaNodes.length; i++) {
        if ("description" == metaNodes[i].getAttribute("name")) {
          var content = metaNodes[i].getAttribute("content");
          if (content)
            return content;
        }
      }
      return "";
    },

    // According to Facebook - (only the first 3 are interesting)
    // Valid values for medium_type are audio, image, video, news, blog, and mult.
    getPageMedium: function() {
      var metaNodes = gBrowser.contentDocument.getElementsByTagName('meta');
      for (var i = 0; i < metaNodes.length; i++) {
        if ("medium" == metaNodes[i].getAttribute("name")) {
          var content = metaNodes[i].getAttribute("content");
          if (content)
            return content;
        }
      }
      return "";
    },

    getCanonicalURL: function () {
      var links = gBrowser.contentDocument.getElementsByTagName("link"),
        rel = null,
        rev = null,
        i;

      for (i = 0; i < links.length; i++) {
        // we prefer 'rev' canonicals
        if (links[i].getAttribute("rel") === "shortlink") {
          return gBrowser.currentURI.resolve(links[i].getAttribute("href"));
        }
        // but we'll take 'rev' canonicals
        if (links[i].getAttribute("rev") === "canonical") {
          rev = gBrowser.currentURI.resolve(links[i].getAttribute("href"));
        }
        // but we'll take 'rel' canonicals if that's all we have
        if (links[i].getAttribute("rel") === "canonical") {
          rel = gBrowser.currentURI.resolve(links[i].getAttribute("href"));
        }
      }

      if (rev) {
        return rev;
      }
      if (rel) {
        return rel;
      }
      return '';
    },

    getThumbnailData: function() {
      var canvas = gBrowser.contentDocument.createElement("canvas"); // where?
      canvas.setAttribute('width', '90');
      canvas.setAttribute('height', '70');
      var tab = getBrowser().selectedTab;
      var win = tab.linkedBrowser.contentWindow;
      var aspectRatio = canvas.width / canvas.height;
      var w = win.innerWidth + win.scrollMaxX;
      var h = Math.max(win.innerHeight, w/aspectRatio);

      if (w > 10000) w = 10000;
      if (h > 10000) h = 10000;

      var canvasW = canvas.width;
      var canvasH = canvas.height;
      var ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvasW, canvasH);
      ctx.save();

      var scale = canvasH/h;
      ctx.scale(scale, scale);
      ctx.drawWindow(win, 0, 0, w, h, "rgb(255,255,255)");
      ctx.restore();
      return canvas.toDataURL("image/png", "");
    },

    previews: function () {
      // Look for rel="image_src" and use those if they're available
      // see e.g. http://about.digg.com/thumbnails

      var links = gBrowser.contentDocument.getElementsByTagName("link"),
          previews = [], i;

      for (i = 0; i < links.length; i++) {
        if (links[i].getAttribute("rel") === "image_src") {
          previews.push(links[i].getAttribute("href"));
        }
      }
      return previews;
    }
  };

  window.addEventListener("load", ffshare.onLoad, false);
  window.addEventListener("unload", ffshare.onUnload, false);
}());
