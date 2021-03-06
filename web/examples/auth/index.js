/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Raindrop.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc..
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 * */

/*jslint plusplus: false */
/*global require: false, location: true, window: false, alert: false */
"use strict";

require.def("signup",
        ["require", "jquery", "blade/fn", "rdapi", "placeholder", "blade/url"],
function (require,   $,        fn,         rdapi,   placeholder,   url) {

    //Given a new rd-token, save it to local storage
    var search = window.location.href.split('?')[1];
    if (search) {
        search = search.split('#')[0];
        var args = url.queryToObject(search);
        if (args['rd-token']) {
            localStorage['X-Raindrop-Token'] = args['rd-token'];
        }
    }
    var rdtoken = localStorage['X-Raindrop-Token'];
    if (rdtoken) {
        $('form').each(function(i, node) {
            node = $(node);
            node.append('<input type="hidden" name="rd-token" value="'+localStorage['X-Raindrop-Token']+'">')
        })
    }

    var validHashRegExp = /^\w+$/;

    function onHashChange() {
        var value = location.hash.split("#")[1]  || "authorize"
        show(value);
    }
    
    function show(value) {
        var start, end;
        if (validHashRegExp.test(value)) {
            $(".section").each(function (i, node) {
                node = $(node);
                if (node.hasClass(value)) {
                    end = node;
                } else if (!node.hasClass("hidden")) {
                    start = node;
                }
            });
        }

        //Animate!
        if (start) {
            //Start node
            start.fadeOut(600, function () {
                start.addClass("hidden");
            });
        }

        if (end) {
            //End node
            end.removeClass("hidden")
               .fadeIn(600);
        }
    }

    //Set up hashchange listener
    window.addEventListener("hashchange", onHashChange, false);

    $(function () {

        $("#oauthForm")
            .submit(function (evt) {
                show("authorize");
                //First clear old errors
                $(".error").addClass("invisible");

                var form = evt.target,
                    isError = false;
    
                //Make sure all form elements are trimmed and username exists.
                $.each(form.elements, function (i, node) {
                    var trimmed = node.value.trim();
                    
                    if (node.getAttribute("placeholder") === trimmed) {
                        trimmed = "";
                    }

                    node.value = trimmed;
                });
    
                if (isError) {
                    $(".usernameError", form).removeClass("invisible");
                    placeholder(form);
                    evt.stopPropagation();
                    evt.preventDefault();
                }
            })
            .each(function (i, node) {
                placeholder(node);
            });

        //Make sure we set up initial state
        onHashChange();
    });
});
