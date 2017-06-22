if (typeof String.prototype.startsWith != 'function') {
    String.prototype.startsWith = function (str) {
        return this.slice(0, str.length) == str;
    };
}

if (typeof String.prototype.endsWith != 'function') {
    String.prototype.endsWith = function (str) {
        return this.slice(-str.length) == str;
    };
}

// sprintf.js - https://github.com/alexei/sprintf.js/tree/master/src
(function (window) {
    'use strict';

    var re = {
        not_string: /[^s]/,
        not_bool: /[^t]/,
        not_type: /[^T]/,
        not_primitive: /[^v]/,
        number: /[diefg]/,
        numeric_arg: /bcdiefguxX/,
        json: /[j]/,
        not_json: /[^j]/,
        text: /^[^\x25]+/,
        modulo: /^\x25{2}/,
        placeholder: /^\x25(?:([1-9]\d*)\$|\(([^\)]+)\))?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?([b-gijostTuvxX])/,
        key: /^([a-z_][a-z_\d]*)/i,
        key_access: /^\.([a-z_][a-z_\d]*)/i,
        index_access: /^\[(\d+)\]/,
        sign: /^[\+\-]/
    };

    function sprintf() {
        var key = arguments[0], cache = sprintf.cache;
        if (!(cache[key] && cache.hasOwnProperty(key))) {
            cache[key] = sprintf.parse(key)
        }
        return sprintf.format.call(null, cache[key], arguments)
    }

    sprintf.format = function (parse_tree, argv) {
        var cursor = 1, tree_length = parse_tree.length, node_type = '', arg, output = [], i, k, match, pad,
            pad_character, pad_length, is_positive = true, sign = '';
        for (i = 0; i < tree_length; i++) {
            node_type = get_type(parse_tree[i]);
            if (node_type === 'string') {
                output[output.length] = parse_tree[i]
            } else if (node_type === 'array') {
                match = parse_tree[i]; // convenience purposes only
                if (match[2]) { // keyword argument
                    arg = argv[cursor];
                    for (k = 0; k < match[2].length; k++) {
                        if (!arg.hasOwnProperty(match[2][k])) {
                            throw new Error(sprintf('[sprintf] property "%s" does not exist', match[2][k]))
                        }
                        arg = arg[match[2][k]]
                    }
                } else if (match[1]) { // positional argument (explicit)
                    arg = argv[match[1]]
                } else { // positional argument (implicit)
                    arg = argv[cursor++]
                }

                if (re.not_type.test(match[8]) && re.not_primitive.test(match[8]) && get_type(arg) == 'function') {
                    arg = arg()
                }

                if (re.numeric_arg.test(match[8]) && (get_type(arg) != 'number' && isNaN(arg))) {
                    throw new TypeError(sprintf("[sprintf] expecting number but found %s", get_type(arg)))
                }

                if (re.number.test(match[8])) {
                    is_positive = arg >= 0
                }

                switch (match[8]) {
                    case 'b':
                        arg = parseInt(arg, 10).toString(2);
                        break;
                    case 'c':
                        arg = String.fromCharCode(parseInt(arg, 10));
                        break;
                    case 'd':
                    case 'i':
                        arg = parseInt(arg, 10);
                        break;
                    case 'j':
                        arg = JSON.stringify(arg, null, match[6] ? parseInt(match[6]) : 0);
                        break;
                    case 'e':
                        arg = match[7] ? parseFloat(arg).toExponential(match[7]) : parseFloat(arg).toExponential();
                        break;
                    case 'f':
                        arg = match[7] ? parseFloat(arg).toFixed(match[7]) : parseFloat(arg);
                        break;
                    case 'g':
                        arg = match[7] ? parseFloat(arg).toPrecision(match[7]) : parseFloat(arg);
                        break;
                    case 'o':
                        arg = arg.toString(8);
                        break;
                    case 's':
                        arg = String(arg);
                        arg = (match[7] ? arg.substring(0, match[7]) : arg);
                        break;
                    case 't':
                        arg = String(!!arg);
                        arg = (match[7] ? arg.substring(0, match[7]) : arg);
                        break;
                    case 'T':
                        arg = get_type(arg);
                        arg = (match[7] ? arg.substring(0, match[7]) : arg);
                        break;
                    case 'u':
                        arg = parseInt(arg, 10) >>> 0;
                        break;
                    case 'v':
                        arg = arg.valueOf();
                        arg = (match[7] ? arg.substring(0, match[7]) : arg);
                        break;
                    case 'x':
                        arg = parseInt(arg, 10).toString(16);
                        break;
                    case 'X':
                        arg = parseInt(arg, 10).toString(16).toUpperCase();
                        break;
                }
                if (re.json.test(match[8])) {
                    output[output.length] = arg
                } else {
                    if (re.number.test(match[8]) && (!is_positive || match[3])) {
                        sign = is_positive ? '+' : '-';
                        arg = arg.toString().replace(re.sign, '')
                    } else {
                        sign = ''
                    }
                    pad_character = match[4] ? match[4] === '0' ? '0' : match[4].charAt(1) : ' ';
                    pad_length = match[6] - (sign + arg).length;
                    pad = match[6] ? (pad_length > 0 ? str_repeat(pad_character, pad_length) : '') : '';
                    output[output.length] = match[5] ? sign + arg + pad : (pad_character === '0' ? sign + pad + arg : pad + sign
                        + arg)
                }
            }
        }
        return output.join('')
    };

    sprintf.cache = {};

    sprintf.parse = function (fmt) {
        var _fmt = fmt, match = [], parse_tree = [], arg_names = 0;
        while (_fmt) {
            if ((match = re.text.exec(_fmt)) !== null) {
                parse_tree[parse_tree.length] = match[0]
            } else if ((match = re.modulo.exec(_fmt)) !== null) {
                parse_tree[parse_tree.length] = '%'
            } else if ((match = re.placeholder.exec(_fmt)) !== null) {
                if (match[2]) {
                    arg_names |= 1;
                    var field_list = [], replacement_field = match[2], field_match = [];
                    if ((field_match = re.key.exec(replacement_field)) !== null) {
                        field_list[field_list.length] = field_match[1];
                        while ((replacement_field = replacement_field.substring(field_match[0].length)) !== '') {
                            if ((field_match = re.key_access.exec(replacement_field)) !== null) {
                                field_list[field_list.length] = field_match[1]
                            } else if ((field_match = re.index_access.exec(replacement_field)) !== null) {
                                field_list[field_list.length] = field_match[1]
                            } else {
                                throw new SyntaxError("[sprintf] failed to parse named argument key")
                            }
                        }
                    } else {
                        throw new SyntaxError("[sprintf] failed to parse named argument key")
                    }
                    match[2] = field_list
                } else {
                    arg_names |= 2
                }
                if (arg_names === 3) {
                    throw new Error("[sprintf] mixing positional and named placeholders is not (yet) supported")
                }
                parse_tree[parse_tree.length] = match
            } else {
                throw new SyntaxError("[sprintf] unexpected placeholder")
            }
            _fmt = _fmt.substring(match[0].length)
        }
        return parse_tree
    };

    var vsprintf = function (fmt, argv, _argv) {
        _argv = (argv || []).slice(0);
        _argv.splice(0, 0, fmt);
        return sprintf.apply(null, _argv)
    };

    /**
     * helpers
     */
    function get_type(variable) {
        if (typeof variable === 'number') {
            return 'number'
        } else if (typeof variable === 'string') {
            return 'string'
        } else {
            return Object.prototype.toString.call(variable).slice(8, -1).toLowerCase()
        }
    }

    var preformattedPadding = {
        '0': ['', '0', '00', '000', '0000', '00000', '000000', '0000000'],
        ' ': ['', ' ', '  ', '   ', '    ', '     ', '      ', '       '],
        '_': ['', '_', '__', '___', '____', '_____', '______', '_______']
    };

    function str_repeat(input, multiplier) {
        if (multiplier >= 0 && multiplier <= 7 && preformattedPadding[input]) {
            return preformattedPadding[input][multiplier]
        }
        return Array(multiplier + 1).join(input)
    }

    /**
     * export to either browser or node.js
     */
    if (typeof exports !== 'undefined') {
        exports.sprintf = sprintf;
        exports.vsprintf = vsprintf
    } else {
        window.sprintf = sprintf;
        window.vsprintf = vsprintf;

        if (typeof define === 'function' && define.amd) {
            define(function () {
                return {
                    sprintf: sprintf,
                    vsprintf: vsprintf
                }
            })
        }
    }
})(typeof window === 'undefined' ? this : window);

// jquery extend function
$.extend({

    // create a temporary form and sends data with POST
    redirectPost: function (location, args) {
        var form = '';
        $.each(args, function (key, value) {
            form += '<input type="hidden" name="' + key + '" value="' + value + '">';
        });
        $('<form action="' + location + '" method="POST">' + form + '</form>').appendTo($(document.body)).submit();
    },

    // create a dictionary with the url parameters
    urlParam: function (name) {
        var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
        if (results == null)
            return null;
        else
            return results[1] || 0;
    }
});

jQuery.fn.visible = function (isVisible) {
    if (isVisible && !this.is(':visible'))
        this.show();
    if (!isVisible && this.is(':visible'))
        this.hide();
};

var searchBox = {

    last_search: '',

    clearSearchText: function () {
        $('#search_box').val('').focus();
        searchBox.updateSearchResults();
    },

    onkeydown: function (event) {
        event = event || window.event; // For IE
        switch (event.keyCode) {
            case 13:// enter
                searchBox.onclick(searchBox.selectedItem);
                break;
            case 38:// up
                if (!searchBox.selectedItem) {
                    var items = $('#search_result li');
                    if (items.length)
                        searchBox.selectItem(items[0]);
                } else
                    searchBox.selectItem($(searchBox.selectedItem).next());
                break;
            case 40:// down
                if (!searchBox.selectedItem) {
                    var items = $('#search_result li');
                    if (items.length)
                        searchBox.selectItem(items[items.length - 1]);
                } else
                    searchBox.selectItem($(searchBox.selectedItem).prev());
                break;
        }

        if ([13, 38, 40].indexOf(event.keyCode) > -1) {
            if (event.preventDefault)
                event.preventDefault();
            else
                event.stopPropagation();
        }
    },

    selectedItem: null,

    selectItem: function (item) {
        $(searchBox.selectedItem).removeClass('search_item_selected');
        searchBox.selectedItem = item;
        node.children('span').addClass('search_item_selected');
    },

    updateSearchResults: function () {
        var search_box = $('#search_box');
        var search_url = search_box.attr('data-search_url');
        var search_value = encodeURIComponent(search_box.val());
        var search_result = $('#search_result');
        search_result.visible(search_box.val());
        if (searchBox.last_search != search_value) {
            searchBox.last_search = search_value;
            search_result.load(search_url + search_value);
        }
    },

    init: function () {
        var sb = $('#search_box');
        if (!sb.length)
            return;
        sb.keyup(searchBox.updateSearchResults);
        searchBox.updateSearchResults();
    }
};

function formHideAndSubmit() {
    $("form").hide();
    $("#message").show();
    $("form").submit();
}

function goToCustomUrl(url) {
    $('#custom_url').attr('href', url)[0].click();
}

function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    var expires = "expires=" + d.toGMTString();
    document.cookie = cname + "=" + cvalue + "; " + expires;
}

function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i].trim();
        if (c.indexOf(name) == 0)
            return c.substring(name.length, c.length);
    }
    return "";
}

function eraseCookie(cname) {
    setCookie(cname, "", -1);
}

$(function () {
    searchBox.init();
});