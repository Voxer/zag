var sail = (function () {
  "use strict"

  /** Convenience aliases. */
  var isProperty = {}.hasOwnProperty, getClass = {}.toString, call = getClass.call, Index = 1

  /**
   * Local references to global host objects. Required for Browserify
   * compatibility (as in Node, `this` is the `exports` object).
   */
  var Window = typeof window != "undefined" ? window : null, Document = typeof document != "undefined" ? document : null
  var startTimer = typeof setTimeout != "undefined" ? setTimeout : null, clearTimer = typeof clearTimeout != "undefined" ? clearTimeout : null

  /** A set of primitive types returned by the `typeof` operator. */
  var Primitives = {
    "undefined": 1,
    "boolean": 1,
    "number": 1,
    "string": 1
  }

  /** A set of Sail methods that return new elements. */
  var Wrapped = {
    "up": 1,
    "down": 1,
    "next": 1,
    "previous": 1,
    "offsetParent": 1,
    "clone": 1,
    "first": 1,
    "last": 1,
    "wrap": 1,
    "replace": 1
  }

  /**
   * A set of whitespace characters matched by the `\s` class in ES 5 (see
   * section 15.10.2.12 and the notes in 7.3 and annex E).
   *
   * @see http://www.cs.tut.fi/~jkorpela/chars/spaces.html
   */
  var Whitespace =
    // Whitespace characters: space, tab, vertical tab, form feed, non-breaking
    // space, and byte-order mark (see section 7.2 of the ES 5 spec).
    " \t\x0b\f\xa0\ufeff" +

    // Line terminators: line feed, carriage return, line separator, and
    // paragraph separator (see section 7.3).
    "\n\r\u2028\u2029" +

    // Miscellaneous Unicode space characters (Category `Zs`). Excludes the
    // space, non-breaking space, and byte-order mark.
    "\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000"

  /**
   * Detect incomplete native `String#trim` implementations. This must occur
   * before the `\s` feature test below, as the `Whitespace` string has not
   * yet been converted into a character class.
   */
  var trimSupported = typeof Whitespace.trim == "function" && !Whitespace.trim()

  /**
   * Normalize inconsistent implementations of the `\s` character class.
   *
   * @see http://perfectionkills.com/whitespace-deviations
   */
  Whitespace = /^\s+$/.test(Whitespace) ? "\\s" : "[" + Whitespace + "]"

  /**
   * The Sail function.
   *
   * @param {Node|String} element The element to wrap. If `element` is a string,
   *  it is used as the tag name for a new element. All created elements belong
   *  to the current document.
   * @param {Object} [properties] An object literal containing properties to
   *  set on the element.
   * @returns {sail.Element} The wrapped element.
   */
  function sail(element, properties) {
    return element ? new Element(Primitives[typeof element] ? Document.createElement(element) : element).property(properties) : element
  }

  /**
   * Creates and returns a new wrapper around an existing element. If the
   * element has already been wrapped, returns the cached wrapper.
   *
   * @constructor
   * @memberOf sail
   * @param {Element} element
   */
  sail.Element = Element
  function Element(element) {
    var wrapper
    if (!element || element.element) {
      return element
    }
    if ((wrapper = sail.retrieve(element, "sail:element"))) {
      return wrapper
    }
    // Wrap and cache the element. The `tagName`, `nodeName`, and `nodeType`
    // are exposed directly for convenience.
    this.element = element
    this.tagName = this.nodeName = sail.nodeName(element)
    this.nodeType = element.nodeType
    sail.store(element, "sail:element", this)
  }

  /**
   * Reduces a collection to a single value by successively invoking a
   * callback function on each element. Each `n`th invocation of the callback
   * should return the value of the reduction to use in the `n+1`th invocation.
   * If the initial value is not specified, the first element of the collection
   * is used. The callback function accepts four arguments:
   * `(memo, value, index, collection)`.
   *
   * @static
   * @memberOf sail
   * @param {Array|Object} collection The collection to iterate over.
   * @param {Function} callback The function to call on each iteration.
   * @param {Mixed} [memo] The initial value of the reduction.
   * @param {Mixed} [binding] The callback's `this` binding.
   * @returns {Mixed} The final value of the reduction.
   */
  sail.reduce = reduce
  function reduce(collection, callback, memo, binding) {
    var length = collection.length, index = 0
    if (arguments.length < 3) {
      memo = collection[index++]
    }
    for (; index < length; index++) {
      memo = callback.call(binding, memo, collection[index], index, collection)
    }
    return memo
  }

  /**
   * Iterates over an object, invoking a callback function for each own
   * property. The callback may be bound to an optional binding, and accepts
   * three arguments: `(key, value, object)`.
   *
   * @static
   * @memberOf sail
   * @param {Object} object The object to iterate over.
   * @param {Function} callback The function to call on each iteration.
   * @param {Mixed} [binding] The callback's `this` binding.
   * @returns {Object} The enumerated object.
   */
  sail.enumerate = enumerate
  function enumerate(object, callback, binding) {
    for (var property in object) {
      if (isProperty.call(object, property) && call.call(callback, binding, property, object[property], object) === false) {
        break
      }
    }
    return object
  }

  /**
   * Returns the normalized name of the given node (either the uppercased tag
   * name for HTML element nodes, or the original node name for other node
   * types).
   *
   * @static
   * @memberOf sail
   * @param {Node} element The node.
   * @returns {String} The normalized node name.
   */
  sail.nodeName = Document.createElement("nav").nodeName == "NAV" ? function nodeName(element) {
    // HTML element node names are always uppercased.
    return element.nodeName
  } : function nodeName(element) {
    // XML and XHTML node names, as well as unrecognized elements in IE <= 8,
    // retain their original case.
    var name = element.nodeName
    return element.nodeType == 1 ? name.toUpperCase() : name
  }

  /**
   * Adds one or more methods to the Sail element wrapper. Named methods may
   * be specified directly, or as part of an object literal containing the
   * methods as property-value pairs. Each method should accept an element node
   * as its first argument.
   *
   * @static
   * @memberOf sail
   * @param {String|Object} name
   * @param {Function} method
   * @returns {Function} The Sail function.
   */
  sail.mixin = function mixin(name, method) {
    // Eventually, `mixin` should accept a boolean that indicates whether the
    // method returns a new element that should be wrapped (store the value in
    // `Wrapped`). Not certain yet how to specify this for object literals...
    if (typeof name == "object" && method == null) {
      sail.enumerate(name, function (name, method) {
        sail.mixin(name, method)
      })
    } else {
      sail[name] = sail.Element[name] = method
      sail.prototype[name] = function wrapped() {
        var element = this.element, parameters = [element], length = arguments.length, result
        while (length--) {
          parameters[length + 1] = arguments[length]
        }
        result = method.apply(sail, parameters)
        return result != null && Wrapped[name] ? sail(result) : result === element ? this : result
      }
    }
    return sail
  }

  sail.prototype = Element.prototype = {
    "constructor": sail
  }

  /* -- Begin Feature Tests. -- */

  /**
   * Determines if the given property is a host object property. Host objects
   * can return type values that differ from their actual types, or throw
   * exceptions when coercing certain properties to Booleans. Based on work by
   * John-David Dalton.
   *
   * @static
   * @memberOf sail
   * @param {Mixed} object The object containing the property.
   * @param {String} property The property name.
   * @returns {Boolean} `false` if the property value is a primitive (number,
   *  Boolean, string, or `undefined`); `true` otherwise.
   */
  sail.isHostType = isHostType
  function isHostType(object, property) {
    var type = object != null && typeof object[property]
    return type == "object" ? !!object[property] : !Primitives[type]
  }

  /**
   * Feature test registry. Inspired by `has.js`.
   *
   * @static
   * @memberOf sail
   * @type Object
   */
  var Features = sail.Features = (function () {
    var results = {}, element = Document.createElement("div")
    return {
      /**
       * Adds a feature test to the registry. The function should return a
       * Boolean if possible, or `null` if the test is inconclusive.
       *
       * @static
       * @memberOf sail.Features
       * @param {String} name The test name.
       * @param {Function} method The test function.
       */
      "add": function add(name, method) {
        results[name] = method
      },

      /**
       * Runs a feature test and caches its result. If a test is inconclusive,
       * the result will not be cached and the function will be called again the
       * next time the test is run.
       *
       * @static
       * @memberOf sail.Features
       * @param {String} name The test name.
       * @returns {Boolean|null} The test result.
       */
      "run": function run(name) {
        var value = results[name]
        if (typeof value == "function") {
          value = value(element, Document, Window)
          if (value !== null) {
            results[name] = value
          }
        }
        return value
      }
    }
  }())

  /**
   * Determines whether the `getComputedStyle` method is implemented
   * (DOM Level 2 CSS, section 2.2.1). Known to return `false` in IE <= 8,
   * which implements the semi-equivalent `currentStyle` property instead.
   * Based on work by John-David Dalton.
   */
  Features.add("features/methods/getComputedStyle", function (element, document) {
    return sail.isHostType(document, "defaultView") && sail.isHostType(document.defaultView, "getComputedStyle")
  })

  /**
   * Determines whether `document.defaultView` is implemented and refers to
   * the `window` object. Known to return `false` in IE <= 8 (not implemented)
   * and Safari <= 2.0.4 (`defaultView` is an `AbstractView` instance).
   */
  Features.add("features/properties/defaultView", function (element, document) {
    return sail.isHostType(document, "defaultView") && document.defaultView == Window
  })

  /**
   * Determines whether the `document.parentWindow` property is implemented.
   * Known to return `true` in all versions of IE.
   */
  Features.add("features/properties/parentWindow", function (element, document) {
    return sail.isHostType(document, "parentWindow") && document.parentWindow == Window
  })

  /**
   * Determines whether `hasAttribute` returns `false` if the attribute is
   * specified, but is set to the default value. Known to return `true` in
   * IE <= 8. Returns `true` if `hasAttribute` is not implemented. Based on
   * work by by Diego Perini.
   */
  Features.add("bugs/attributes/hasAttribute", function (element, document) {
    element = document.createElement("option")
    var isBuggy = !sail.isHostType(element, "hasAttribute");
    if (!isBuggy) {
      element.setAttribute("selected", "selected")
      isBuggy = !element.hasAttribute("selected")
    }
    return isBuggy
  })

  /**
   * Determines whether the browser conflates attribute and property values.
   * Known to return `true` in IE 6, 7, 8 in {compatibility, quirks} mode, and
   * browsers based on Trident < 4. Returns `true` if the browser does not
   * implement `getAttribute`. Based on work by David Mark.
   */
  Features.add("bugs/attributes/conflation", function (element, document) {
    return !sail.isHostType(element, "getAttribute") || element.getAttribute("style") && typeof element.getAttribute("style") != "string"
  })

  /**
   * Determines whether the `defaultValue` property and `value` attribute
   * of `input` elements are connected. Known to return `true` in IE <= 8.
   * Based on work by Diego Perini.
   */
  Features.add("bugs/attributes/default", function (element, document) {
    element = document.createElement("input")
    element.setAttribute("value", "1")
    // The `defaultValue` property of `input` elements should contain the
    // value of the HTML `value` attribute; conversely, setting the
    // `defaultValue` should set or update the `value` attribute.
    return element.defaultValue !== "5";
  })

  /**
   * Determines whether the browser's `getAttribute` implementation requires
   * an `lFlags` argument to perform a case-sensitive search. Known to return
   * `true` in environments that conflate attributes and properties. Does not
   * return `true` for XML (always case-sensitive) or HTML (case-insensitive
   * according to DOM 3 Core, section 1.3.1) documents.
   */
  Features.add("bugs/attributes/case", function (element, document) {
    var isBuggy = false
    // `setAttribute` is always case-sensitive.
    element.setAttribute("dir", "ltr")
    // This creates an expando property in IE < 8. According to DOM 3, this
    // should override the previously-set `dir` attribute (case-insensitive).
    element.setAttribute("DIR", "rtl")
    // `getAttribute` and `removeAttribute` are case-insensitive in IE < 8
    // and require an optional `lFlags` argument to enable case-sensitivity.
    isBuggy = element.getAttribute("dir") == "ltr" && element.getAttribute("DIR") == "ltr" && element.getAttribute("DIR", 1) == "rtl"
    element.removeAttribute("DIR")
    element.removeAttribute("dir")
    return isBuggy
  })

  /**
   * The `body` element's offset values should not include its margins.
   *
   * @author John-David Dalton
   */
  Features.add("bugs:margins", function (element, document) {
    var body = sail.isHostType(document, "body") && document.body, style, cssText, result
    if (!body) {
      // The document has not loaded yet; conclusive results cannot be obtained.
      return null
    }
    style = body.style
    cssText = style.cssText
    style.cssText += ";position:absolute;top:0;margin:1px 0 0 0"
    result = body.offsetTop == 1
    style.cssText = cssText
    return result
  })

  /**
   * The Microsoft-specific `children` collection contains an element's
   * immediate descendants, and has been implemented in most major browsers.
   * Safari 2 includes all descendants; IE <= 8 includes comment nodes.
   */
  Features.add("features/properties/children", function (parent, document) {
    var comment = parent.appendChild(document.createComment("")), child = parent.appendChild(document.createElement("div"))
    child.appendChild(document.createElement("div"))
    var result = sail.isHostType(parent, "children") && parent.children.length === 1 && parent.children[0] == child
    parent.removeChild(comment)
    parent.removeChild(child)
    return result
  })

  /**
   * IE <= 8 includes comment nodes in `getElementsByTagName("*")` results.
   */
  Features.add("bugs/collections/comments", function (element, document) {
    element.appendChild(document.createComment(""))
    var result = !!element.getElementsByTagName("*")[0]
    element.removeChild(element.firstChild)
    return result
  })

  /**
   * The border width should be included in all child offset values.
   */
  Features.add("border-width-not-inherited-by-descendants", function (element, document) {
    var body = sail.isHostType(document, "body") && document.body, style, cssText, offsetLeft, result
    if (!body) {
      return null
    }
    style = body.style
    cssText = style.cssText
    body.appendChild(element)
    offsetLeft = element.offsetLeft
    style.cssText += ";border:1px solid transparent"
    result = offsetLeft == element.offsetLeft
    style.cssText = cssText
    body.removeChild(element)
    return result
  })

  /**
   * The Microsoft-specific `uniqueNumber` property is available on all
   * element and comment nodes in IE <= 8. `uniqueNumber` is unique per
   * session. Unlike `uniqueID`, it does not change for document nodes.
   *
   * @author John-David Dalton
   */
  Features.add("features/properties/uniqueNumber", function (element, document) {
    return typeof element.uniqueNumber == "number" && typeof document.documentElement.uniqueNumber == "number" && element.uniqueNumber != document.documentElement.uniqueNumber
  })

  /**
   * `contains` is a non-standard Microsoft method available in most browsers,
   * but only implemented on element nodes. Safari <= 2.0.4 only returns `false`
   * if the target element is not a descendant of the ancestor.
   *
   * @author Juriy Zaytsev
   */
  Features.add("features/methods/contains", function (element, document) {
    return sail.isHostType(element, "contains") && !element.contains(document.createElement("div"))
  })

  /* -- End Feature Tests. -- */

  /* -- Begin Attributes. -- */

  ;(function () {
    /**
     * Determines whether an attribute is specified on an element. Based on
     * work by David Mark.
     *
     * @static
     * @name hasAttribute
     * @memberOf sail
     * @param {Element} element The element.
     * @param {String} name The attribute name.
     * @returns {Boolean} `true` if the attribute is specified on the element;
     *   `false` otherwise.
     */
    var Translations, hasAttribute
    if (sail.Features.run("bugs/attributes/hasAttribute")) {
      /**
       * An attribute-to-property map for IE 6 and 7. Cross-references the index
       * of HTML 4 attributes, DOM Level 1 HTML object definitions (section
       * 2.5.5), and MS-HTML 4.01E (section 2.3).
       *
       * @private
       * @type Object
       */
      Translations = sail.reduce(["accessKey", "aLink", "bgColor",
        "cellPadding", "cellSpacing", "codeBase", "codeType", "colSpan", "dateTime",
        // `encType` is a Microsoft-specific `attributes` collection alias. The
        // `enctype` attribute is reflected as the `encoding` property in IE <= 7.
        "encType", "frameBorder", "isMap", "longDesc", "marginHeight", "marginWidth",
        "maxLength", "noHref", "noResize", "noShade", "noWrap", "readOnly", "rowSpan",
        "tabIndex", "useMap", "vAlign", "valueType", "vLink",
        // Microsoft-specific attributes, excluding `dataFld`, `dataFormatAs`,
        // `dataPageSize`, `dataSrc` (data-bound elements), `tabStop`,
        // `viewInheritStyle`, `viewMasterTab` (HTC).
        "allowTransparency", "BaseHref", "bgProperties", "borderColor",
        // `borderColorDark` and `Light` are deprecated in favor of `borderColor`.
        "borderColorDark", "borderColorLight", "bottomMargin", "canHaveHTML",
        "frameSpacing", "leftMargin", "Methods", "rightMargin", "scrollAmount",
        "scrollDelay", "topMargin", "trueSpeed"
      ], function (memo, value) {
        // Map the property names to their corresponding attribute names.
        memo[value.toLowerCase()] = value
        return memo
      }, {})
      // Handle hyphenated attribute names separately.
      Translations["accept-charset"] = "acceptCharset"
      Translations["http-equiv"] = "httpEquiv"

      // Expose a fallback implementation for IE <= 8.
      hasAttribute = function (element, name) {
        var nodeName, defaultValue, normalized, translation, attribute
        name = String(name)
        if (isXML(element)) {
          // MSXML nodes do not implement `hasAttribute`. XML attribute names
          // are case-sensitive; normalization is not required.
          attribute = isHostType(element, "getAttributeNode") && element.getAttributeNode(name)
          return !!(attribute && attribute.specified)
        }
        nodeName = sail.nodeName(element)
        if (nodeName == "INPUT" || nodeName == "OPTION" || nodeName == "TEXTAREA") {
          // The `defaultValue` property reflects the `value` attribute. Neither
          // the `enctype` nor `value` attributes are specified in IE < 8.
          if (name == "value" && nodeName != "OPTION") {
            // `defaultValue` is implemented on `textarea` (4.10.13) and
            // `input` (4.10.7) elements. Not applicable to `option` elements.
            defaultValue = "defaultValue"
          } else if (name == "selected" && nodeName == "OPTION") {
            // `defaultSelected` is only implemented on `option` elements
            // (W3C HTML 5 section 4.10.12).
            defaultValue = "defaultSelected"
          } else if (name == "checked" && (element.type == "checkbox" || element.type == "radio")) {
            // `defaultChecked` is implemented on all `input` element types, but
            // only applicable to checkboxes and radio buttons.
            defaultValue = "defaultChecked"
          }
        }
        if (defaultValue) {
          return !!(element[defaultValue])
        }
        translation = Translations[name.toLowerCase()]
        attribute = element.getAttributeNode(translation || name)
        if (attribute) {
          if (attribute.specified && attribute.nodeValue) {
            return true
          }
          if (typeof element[translation] == "boolean") {
            return element[translation]
          }
          if (translation == "encType") {
            return attribute.value != "application/x-www-form-urlencoded"
          }
        }
        return false
      }
    } else {
      hasAttribute = function (element, name) {
        return element.hasAttribute(name)
      }
    }

    sail.mixin({
      "hasAttribute": hasAttribute
    })
  }());

  /* -- End Attributes. -- */

  /**
   * Converts a node list or HTML collection to an array.
   *
   * @private
   * @param {NodeList|HTMLCollection} The node list to convert.
   * @returns {Array} The converted array.
   */
  function toArray(list) {
    // The `length` property is not used because it may be shadowed by a
    // named element in an HTML collection.
    for (var results = [], index = 0, element; element = list[index++]; results.push(element));
    return results
  }

  /**
   * Returns a bound version of the given function.
   *
   * @static
   * @memberOf sail
   * @param {Function} method The function to bind.
   * @param {Mixed} [binding] The desired `this` binding of the function.
   * @param {Mixed} [parameters...] Additional arguments for partial
   *  application.
   * @returns {Function} The bound function.
   */
  sail.bind = bind
  function bind(method, binding) {
    var length = arguments.length, partial, index
    if (length < 2) {
      // `this` binding omitted; return the function as-is.
      return method
    }
    for (partial = [], index = 2; index < length; index++) {
      partial.push(arguments[index])
    }
    function Class() {}
    function bound() {
      var partialLength = partial.length, parameters, length, result
      if (partialLength) {
        parameters = partial.slice(0)
        for (length = arguments.length; length--;) {
          parameters[partialLength + length] = arguments[length]
        }
      } else {
        parameters = arguments
      }
      if (this instanceof bound) {
        Class.prototype = method.prototype
        binding = new Class()
        Class.prototype = null
        result = method.apply(binding, parameters)
        return typeof result == "object" && result ? result : binding
      }
      return method.apply(binding, parameters)
    }
    return bound
  }

  /**
   * Returns a debounced version of the given function. The function will only
   * be invoked if the specified number of milliseconds has elapsed since its
   * last invocation.
   *
   * @static
   * @memberOf sail
   * @param {Function} method The function to debounce.
   * @param {Number} milliseconds The number of milliseconds between executions.
   * @param {Boolean} [immediate=false] Specifies whether the function should be
   *  invoked on the leading edge of the timeout.
   * @returns {Function} The debounced function.
   */
  sail.debounce = debounce
  function debounce(method, milliseconds, immediate) {
    var binding, parameters, timer, result
    function deferred() {
      timer = null
      if (!immediate) {
        method.apply(binding, parameters)
      }
    }
    return function debounced() {
      var isImmediate = immediate && !timer
      binding = this
      parameters = arguments
      clearTimer(timer)
      timer = startTimer(deferred, milliseconds)
      if (isImmediate) {
        result = method.apply(binding, parameters)
      }
      return result
    }
  }

  /**
   * Strips all leading and trailing whitespace from a string. Uses the native
   * `String#trim` implementation, if available.
   *
   * @see http://blog.stevenlevithan.com/archives/faster-trim-javascript
   * @static
   * @memberOf sail
   * @param {String} value The string to remove whitespace from.
   * @returns {String} The string with leading and trailing whitespace removed.
   */
  sail.trim = trim
  function trim(value) {
    if (trimSupported) {
      sail.trim = function trim(value) {
        return String(value).trim()
      }
    } else {
      // Based on work by Steven Levithan.
      sail.trim = function trim(value) {
        value = String(value).replace(RegExp("^" + Whitespace + Whitespace + "*"), "")
        for (var whitespace = RegExp(Whitespace), length = value.length; whitespace.test(value.charAt(--length)););
        return value.slice(0, length + 1)
      }
    }
    return sail.trim(value)
  }

  /* Utility methods for manipulating elements.
   * Extracted from the Spec, Miniatures, and FuseJS libraries.
   *
   * Spec and Miniatures: Copyright 2009-2012, Kit Cambridge.
   * FuseJS: Copyright 2008-2012, John-David Dalton.
   *
   * Spec, Miniatures, and FuseJS are distributed under the MIT license.
   *
  */

  /** A cache of element class names and their corresponding regular expressions. */
  var Classes = {}, Leading = "(?:^|" + Whitespace + "+)", Trailing = "(?:" + Whitespace + "+|$)"

  /** A partial set of unitless CSS properties. */
  var Unitless = {
    "fontWeight": 1,
    "lineHeight": 1,
    "opacity": 1,
    "zIndex": 1,
    "zoom": 1
  }

  /**
   * The element data store. Values are indexed by the associated element's
   * unique identifier.
   *
   * @static
   * @memberOf sail
   * @type Object
   */
  sail.storage = {}

  sail.mixin({
    /**
     * Wraps an element.
     *
     * @param {Node|sail.Element} element The element to wrap.
     * @param {Node|sail.Element} wrapper The wrapper element.
     * @returns {Node} The wrapper element.
     */
    "wrap": function wrap(element, wrapper) {
      var parent = sail.up(element)
      wrapper = wrapper.element || wrapper
      if (parent) {
        parent.replaceChild(wrapper.element || wrapper, element)
      }
      wrapper.appendChild(element)
      return wrapper
    },

    /* Element storage module.
     * Based on code from FuseJS and Prototype.
     * FuseJS: Copyright 2008-2012, John-David Dalton.
     * Prototype: Copyright 2005-2010, Sam Stephenson.
     *
     * FuseJS and Prototype are distributed under the MIT license.
    */

    /**
     * Returns the given element's unique identifier. Based on work by
     * John-David Dalton.
     *
     * @static
     * @memberOf sail
     * @param {Element|Document|Window} element The element to identify.
     * @returns {Number|null} The element's unique identifier, or `null` if it
     *  cannot be identified.
     */
    "identify": function identify(element) {
      // The `uniqueNumber` property avoids setting expando properties on
      // elements. This works around two bugs in IE <= 8: `cloneNode` cloning
      // expando properties (due to the conflation of attributes and
      // properties, and the sharing of attribute nodes between clones), and
      // primitive expando properties appearing as attributes when accessing
      // the element's `outerHTML`.
      var property = (sail.Features.run("features/properties/uniqueNumber") ? "unique" : "-dashboard") + "Number", parentWindow
      // IE sets the `uniqueNumber` property on comment nodes.
      var unique = element.nodeType != 8 && element[property]
      if (!unique) {
        parentWindow = getParentWindow(element)
        if (element == parentWindow) {
          // Generate identifiers for frame content windows. The order of the
          // operands is important: in IE <= 8, `window == document`, but
          // `document != window`. Strict equality should not be used because
          // different references to the same `window` object may not be
          // identical (e.g., `window.window !== window`).
          unique = element == Window ? 0 : (sail.identify(element.frameElement) + "-0")
        } else if (element.nodeType == 9) {
          // Generate unique identifiers for foreign `document` nodes.
          unique = element == Document ? 1 : (sail.identify(parentWindow.frameElement) + "-1")
        } else if (element.nodeType == 1) {
          // Set an expando property on the element.
          unique = element[property] = ++Index
        } else {
          unique = null
        }
      }
      return unique
    },

    /**
     * Associates a key-value pair with the given element. Throws a `TypeError`
     * if the element cannot have data attached to it.
     *
     * @static
     * @memberOf sail
     * @param {Element} element The element to attach data to.
     * @param {String} key The key to associate with the element.
     * @param {Mixed} value The value to associate with the key.
     * @returns {Element} The given element.
     */
    "store": function store(element, key, value) {
      var index = sail.identify(element)
      if (index == null) {
        throw TypeError();
      }
      ;(sail.storage[index] || (sail.storage[index] = {
        "element": element,
        "data": {}
      })).data[key] = value
      return element
    },

    /**
     * Retrieves the value associated with the given key on the element. If
     * the key has not been associated with the element and a default value is
     * given, it will be associated with the key and returned. Throws a
     * `TypeError` if a default value is specified and the element cannot have
     * data attached to it.
     *
     * @static
     * @memberOf sail
     * @param {Element} element The element to retrieve data from.
     * @param {String} key The storage key associated with the element.
     * @param {Mixed} [defaultValue] The default value to assign if the key has
     *  not been associated with the element.
     * @returns {Mixed} The value associated with the storage key, or the
     *  default value.
     */
    "retrieve": function retrieve(element, key, defaultValue) {
      // Only create the element data store if a default value is specified.
      var index = sail.identify(element), isAssignment = arguments.length > 2, storage, data
      if (index == null) {
        if (isAssignment) {
          throw TypeError();
        }
      } else {
        storage = sail.storage[index] || isAssignment && (sail.storage[index] = {
          "element": element,
          "data": {}
        })
        if ((data = storage && storage.data)) {
          if (key in data) {
            return data[key]
          } else if (isAssignment) {
            return (data[key] = defaultValue)
          }
        }
      }
    },

    /**
     * Removes the key associated with the element from the data store, and
     * returns the value originally associated with the key.
     *
     * @static
     * @memberOf sail
     * @param {Element} element The element to remove data from.
     * @param {String} key The storage key to remove.
     * @returns {Mixed} The value associated with the removed key.
     */
    "unstore": function unstore(element, key) {
      var index = sail.identify(element), storage, data, value
      if (index != null && (storage = sail.storage[index]) && (data = storage.data)) {
        value = data[key]
        delete data[key]
        return value
      }
    },

    /**
     * Recursively purges an element and all its descendants of their storage
     * keys and attached event handlers.
     *
     * @static
     * @memberOf sail
     * @param {Element} element The element to purge.
     * @returns {Element} The purged element.
     */
    "purge": function purge(element) {
      var index = sail.identify(element), descendant
      if (index != null) {
        // Remove all event handlers attached to the element.
        sail.off(element)
        // Remove the element's associated storage keys.
        delete sail.storage[index]
        // Purge the descendants' storage keys.
        for (descendant = element.firstChild; descendant; descendant = descendant.nextSibling) {
          sail.purge(descendant)
        }
      }
      return element
    },

    /**
     * Returns an array containing the descendants of the given element or
     * document, excluding non-element descendants.
     *
     * @static
     * @memberOf sail
     * @param {Element|Document} element The element or document node.
     * @returns {Array} The element's descendants.
     */
    "descendants": function descendants(element) {
      var descendants = toArray(element.getElementsByTagName("*")), length
      if (sail.Features.run("bugs/collections/comments")) {
        // Manually exclude comment nodes from the descendant list.
        for (length = descendants.length; length--;) {
          if (descendants[length].nodeType != 1) {
            descendants.splice(length, 1)
          }
        }
      }
      return descendants
    },

    /**
     * Returns an array of the given element's children (immediate descendants),
     * excluding non-element nodes.
     *
     * @static
     * @memberOf sail
     * @param {Node} element The element.
     * @returns {Array} The element's children.
     */
    "children": function children(element) {
      var children, firstChild, nextSibling
      // Use the `children` collection if it's implemented correctly and available
      // on the element (it's not implemented for non-element nodes).
      if (sail.isHostType(element, "children") && sail.Features.run("features/properties/children")) {
        children = toArray(element.children)
      } else {
        children = []
        for (element = element.firstChild; element; element = element.nextSibling) {
          if (element.nodeType == 1) {
            children.push(element)
          }
        }
      }
      return children
    },

    /**
     * Returns an array of form controls associated with the given form element.
     * Equivalent to the `elements` collection.
     *
     * @static
     * @memberOf sail
     * @param {HTMLFormElement} element The form element.
     * @returns {Array} The listed elements associated with the form.
     */
    "controls": function controls(element) {
      var descendants = element.getElementsByTagName("*"), results = [], index = 0, descendant
      while ((descendant = descendants[index++])) {
        // The collection of listed elements for a form excludes the listed
        // elements of any child forms. Forms should not be nested according to
        // 4.10.3, but 4.10.18 defines instructions for handling this case.
        if (sail.nodeName(descendant) != "FORM" && descendant.form == element &&
          (sail.nodeName(descendant) == "INPUT" && descendant.type != "image" ||
          // `keygen` and `output` are defined by HTML 5.
          (/^(?:button|fieldset|keygen|object|output|select|textarea)$/i).test(descendant.nodeName))) {
            results.push(descendant)
          }
      }
      return results
    },

    /**
     * Determines whether the given form control is submittable (4.10.2) and
     * is subject to validation (i.e., is not barred from constraint validation
     * as defined by W3C HTML 5 section 4.10.21.1). Equivalent to the
     * `willValidate` property (4.10.21.3).
     *
     * @static
     * @memberOf sail
     * @param {HTMLElement} element The form control.
     * @returns {Boolean} `true` if the control is subject to validation;
     *   `false` otherwise.
     */
    "validates": function validates(element) {
      return (
          // There are no conditions barring `select` elements from constraint validation.
          sail.nodeName(element) == "SELECT" ||
          // `object` (4.8.4) and `keygen` (4.10.14) elements are always barred.
          (sail.nodeName(element) != "OBJECT" && sail.nodeName(element) != "KEYGEN") ||
          // `input` Elements: `type = hidden` (4.10.7.1), `reset` (4.10.7.1.21), and `button` (4.10.7.1.22).
          // `image` and `submit` are barred from validation according to "HTML 5 differences from HTML 4," section 3.2.
          // Firefox reports that neither will validate; Chrome reports that `submit` will validate.
          (sail.nodeName(element) == "INPUT" && !(/^(?:hidden|reset|button|submit|image)$/).test(element.type)) ||
          // `button` Elements: `type = reset`, `type = button` (4.10.8).
          (sail.nodeName(element) == "BUTTON" && !(/^(?:reset|button)$/).test(element.type)) ||
          // `input` (4.10.7.3.4) and `textarea` (4.10.13) elements with a `readonly` attribute.
          ((sail.nodeName(element) == "TEXTAREA" || sail.nodeName(element) == "INPUT") && !element.readOnly) || 
          // Any element with a `<datalist>` ancestor (4.10.10).
          sail.up(element, function (ancestor) { return sail.nodeName(ancestor) == "DATALIST" })
        ) &&
        // Disabled elements are barred from validation (4.10.19.2).
        !element.disabled
    },

    /**
     * Returns the index-th ancestor of the given element (or first, if the
     * index is omitted) that matches the criteria specified by the callback
     * function.
     *
     * @static
     * @memberOf sail
     * @param {Node} element The reference node.
     * @param {Number} [index=0]
     * @param {Function} [callback]
     * @returns {Element} The first element that matches the given criteria.
     */
    "up": walkElements("parentNode"),

    /**
     * Returns the index-th descendant of the given element (or first immediate
     * descendant, if the index is omitted) that matches the criteria specified
     * by the callback function.
     *
     * @static
     * @memberOf sail
     * @param {Node} element The reference node.
     * @param {Number} [index=0]
     * @param {Function} [callback]
     * @returns {Element} The first element that matches the given criteria.
     */
    "down": function down(element, index, callback) {
      var position, isIndex, isCallback, descendants, length, descendant, member
      if (typeof index == "function") {
        // Juggle arguments.
        callback = index
        index = null
      }
      isIndex = typeof index == "number"
      isCallback = typeof callback == "function"
      if (!isCallback && !isIndex) {
        for (descendant = element.firstChild; descendant && descendant.nodeType != 1; descendant = descendant.nextSibling);
        return descendant
      }
      descendants = sail.descendants(element)
      length = descendants.length
      if (isCallback && length) {
        for (position = member = 0; member < length; member++) {
          descendant = descendants[member]
          if (call.call(callback, element, descendant) && (!isIndex || position++ == index)) {
            return descendant
          }
        }
      } else if (isIndex && index > - 1 && index < length) {
        return descendants[index]
      }
      return null
    },

    /**
     * Returns the index-th next sibling of the given element (or first, if the
     * index is omitted) that matches the criteria specified by the callback
     * function.
     *
     * @static
     * @memberOf sail
     * @param {Node} element The reference node.
     * @param {Number} [index=0]
     * @param {Function} [callback]
     * @returns {Element} The first element that matches the given criteria.
     */
    "next": walkElements("nextSibling"),

    /**
     * Returns the index-th previous sibling of the given element (or first, if
     * the index is omitted) that matches the criteria specified by the callback
     * function.
     *
     * @static
     * @memberOf sail
     * @param {Node} element The reference node.
     * @param {Number} [index=0]
     * @param {Function} [callback]
     * @returns {Element} The first element that matches the given criteria.
     */
    "previous": walkElements("previousSibling"),

    /**
     * Returns the first immediate descendant of the given element.
     *
     * @static
     * @memberOf sail
     * @param {Node} element The reference node.
     * @returns {Node|null} The first child of the reference node, or `null`
     *  if the element has no children.
     */
    "first": function first(element) {
      for (element = element.firstChild; element && element.nodeType != 1; element = element.nextSibling);
      return element
    },

    /**
     * Returns the last immediate descendant of the given element.
     *
     * @static
     * @memberOf sail
     * @param {Node} element The reference node.
     * @returns {Node|null} The last child of the reference node, or `null`
     *  if the element has no children.
     */
    "last": function last(element) {
      for (element = element.lastChild; element && element.nodeType != 1; element = element.previousSibling);
      return element
    },

    /**
     * Appends the given element to a parent element.
     *
     * @static
     * @memberOf sail
     * @param {Node} element The element to append to a parent node.
     * @param {Node} parent The parent node.
     * @returns {Node} The given element.
     */
    "appendTo": function appendTo(element, parent) {
      parent.appendChild(element)
      return element
    },

    /**
     * Prepends the given element to a parent element.
     *
     * @static
     * @memberOf sail
     * @param {Node} element The element to prepend to a parent node.
     * @param {Node} parent The parent node.
     * @returns {Node} The given element.
     */
    "prependTo": function prependTo(element, parent) {
      parent.insertBefore(element, parent.firstChild);
      return element;
    },

    /**
     * Removes all child nodes of the given element. All storage keys
     * associated with the child nodes are purged recursively as well.
     *
     * @static
     * @memberOf sail
     * @param {Node} element The element to clear.
     * @returns {Node} The cleared element.
     */
    "clear": function clear(element) {
      for (var descendant; descendant = element.lastChild;) {
        sail.purge(descendant)
        element.removeChild(descendant)
      }
      return element
    },

    /**
     * Determines whether or not the element is visible.
     *
     * @static
     * @memberOf sail
     * @param {Node} element The element.
     * @returns {Boolean} `false` if the element is hidden via the HTML 5
     *  `hidden` attribute, `display: none`, or `visibility: hidden`; `true`
     *  otherwise.
     */
    "isVisible": function isVisible(element) {
      var style = element.style
      return sail.style(element, "display") != "none" && sail.style(element, "visibility") != "hidden"
    },

    /**
     * Determines if an element is a descendant of the given ancestor.
     *
     * @static
     * @memberOf sail
     * @param {Node} ancestor The ancestor node.
     * @param {Node} element The child node.
     * @returns {Boolean} `true` if the ancestor contains the child; `false`
     *  otherwise.
     */
    "contains": function contains(ancestor, element) {
      var descendants, length
      if (sail.isHostType(ancestor, "compareDocumentPosition")) {
        // `compareDocumentPosition` returns a bitmask that describes the
        // relationship between the two elements. `16` means "is contained by."
        return !!(ancestor.compareDocumentPosition(element) & 16)
      } else if (sail.isHostType(ancestor, "contains") && sail.Features.run("features/methods/contains")) {
        // `contains` is a non-standard Microsoft method available in most
        // browsers, but only implemented on element nodes.
        return ancestor != element && ancestor.contains(element)
      } else {
        for (descendants = sail.descendants(ancestor), length = descendants.length; length--;) {
          if (descendants[length] == element) {
            return true
          }
        }
        return false
      }
    },

    /**
     * Removes an element from the document, but preserves its storage.
     *
     * @static
     * @memberOf sail
     * @param {Node} element The node to detach.
     * @returns {Node} The detached node.
     */
    "detach": function detach(element) {
      if (!sail.isDetached(element)) {
        element.parentNode.removeChild(element)
      }
      return element
    },

    /**
     * Removes an element from the document. All storage keys associated with
     * the element and its children are purged as well.
     *
     * @static
     * @memberOf sail
     * @param {Node} element The node to remove.
     * @returns {Node} The removed node.
     */
    "remove": function remove(element) {
      sail.purge(element)
      return sail.detach(element)
    },

    /**
     * Determines whether or not an element is detached from its parent
     * document.
     *
     * @static
     * @memberOf sail
     * @param {Node} element The element.
     * @returns {Boolean} `true` if the element does not have a parent and is
     *  detached from its owner document; `false` otherwise.
     */
    "isDetached": function isDetached(element) {
      return !(element.parentNode && sail.contains(element.ownerDocument, element))
    },

    /* Element styles.
     * Based on work by John-David Dalton.
    */

    /**
     * Sets or retrieves one or more CSS property values. The property and its
     * corresponding value may be specified directly, or as property-value pairs.
     * If the value is omitted, the computed property value will be returned.
     *
     * @static
     * @memberOf sail
     * @param {Element} element The element.
     * @param {String|Object} property The style property to retrieve or set. If
     *  `property` is an object literal, it is assumed to contain style
     *  property-value pairs.
     * @param {String|Number} [value] The style value to set. Numeric values
     *  for properties that require units are assumed to be pixels.
     * @returns {Element|String|null}
     */
    "style": function style(element, property, value) {
      if (arguments.length < 3) {
        if (property && typeof property == "object") {
          // Setter; recursively set each property-value pair.
          sail.enumerate(property, function (property, value) {
            sail.style(element, property, value)
          })
        } else if (property) {
          // Hyphenated properties are converted to their camelized equivalents.
          property = camelize(property)
          // Normalize the `float` and `cssFloat` properties.
          if (property == "float" || property == "cssFloat") {
            property = "styleFloat" in element.style && !("cssFloat" in element.style) ? "styleFloat" : "cssFloat"
          }
          // Getter; retrieve the used style value.
          value = ((sail.Features.run("features/methods/getComputedStyle") ? element.ownerDocument.defaultView.getComputedStyle(element, null) : element.currentStyle) || element.style)[property]
          return value != "auto" && value || null
        }
      } else {
        property = camelize(property)
        if (property == "float" || property == "cssFloat") {
          property = "styleFloat" in element.style && !("cssFloat" in element.style) ? "styleFloat" : "cssFloat"
        }
        // Setter; set the style property directly. IE <= 8 throws an exception
        // for invalid style values.
        element.style[property] = (typeof value == "number" || getClass.call(value) == "[object Number]") && !isProperty.call(Unitless, property) ? value + "px" : value
      }
      return element
    },

    /**
     * Adds a class name to an element.
     *
     * @static
     * @memberOf sail
     * @param {Element} element The element.
     * @param {String} className The CSS class name to add. Duplicate class
     *  names are automatically removed.
     * @returns {Element} The given element.
     */
    "addClass": function addClass(element, className) {
      // Avoid adding duplicate class names.
      sail.removeClass(element, className)
      element.className += (element.className ? " " : "") + className
      return element
    },

    /**
     * Removes a class name from an element.
     *
     * @static
     * @memberOf sail
     * @param {Element} element The element.
     * @param {String} className The class name to remove.
     * @returns {Element} The given element.
     */
    "removeClass": function removeClass(element, className) {
      element.className = sail.trim(element.className.replace(Classes[className] || (Classes[className] = RegExp(Leading + className + Trailing)), " "))
      return element
    },

    /**
     * Toggles a class name on an element.
     *
     * @static
     * @memberOf sail
     * @param {Element} element The element.
     * @param {String} className The class name to toggle.
     * @returns {Element} The given element.
     */
    "toggleClass": function toggleClass(element, className) {
      return sail[sail.hasClass(element, className) ? "removeClass" : "addClass"](element, className)
    },

    /**
     * Determines if a class name is assigned to an element.
     *
     * @static
     * @memberOf sail
     * @param {Element} element The element.
     * @param {String} className The class name to test.
     * @returns {Boolean} `true` if the class name is assigned to the given
     *  element; `false` otherwise.
     */
    "hasClass": function hasClass(element, className) {
      return !!element.className && (element.className == className || (Classes[className] || (Classes[className] = RegExp(Leading + className + Trailing))).test(element.className))
    },

    /* Element positioning. */

    /**
     * Returns an element's closest positioned ancestor. See the W3C CSSOM
     * View Module draft, section 7.1 (`offsetParent`).
     *
     * @static
     * @memberOf sail
     * @param {Element} element The reference node.
     * @returns {Element|null} The closest positioned ancestor, or `null` if
     *  a positioned ancestor does not exist.
     */
    "offsetParent": function offsetParent(element) {
      var nodeName = sail.nodeName(element), ancestor, isStatic
      // Abort if the element does not have a defined layout, if it is the root or
      // `body` element, or if its computed `position` style is `fixed`.
      if (sail.isDetached(element) || nodeName == "HTML" || nodeName == "BODY" || sail.style(element, "position") == "fixed") {
        return null
      }
      // From the 2009-08-04 draft: if the element is an `area` element and has a
      // `map` element as its ancestor, return the closest `map` ancestor.
      if (nodeName == "AREA" && (ancestor = sail.up(element, function (ancestor) { return sail.nodeName(ancestor) == "MAP" }))) {
        return ancestor
      }
      for (ancestor = element; ancestor = ancestor.parentNode;) {
        nodeName = sail.nodeName(ancestor)
        // Terminate if the ancestor is the `body` or root element. Peter-Paul
        // Koch notes that the latter sometimes enters the `offsetParent` chain.
        if (nodeName == "BODY" || nodeName == "HTML") {
          return ancestor.ownerDocument.body
        }
        isStatic = sail.style(ancestor, "position") == "static"
        // Return the ancestor if its computed `position` style is not `static`
        // or if it is a statically-positioned `td`, `th`, or `table` element.
        if (!isStatic || isStatic && (nodeName == "TD" || nodeName == "TH" || nodeName == "TABLE")) {
          return ancestor
        }
      }
      return null
    },

    /**
     * Returns an element's offsets relative to its closest positioned ancestor.
     *
     * @static
     * @memberOf sail
     * @param {Element} element The element.
     * @returns {Array} The element's horizontal and vertical offsets, accessed
     *  as `[left, top]`. Alternatively, corresponding `left` and `top`
     *  properties are available directly on the array.
     */
    "position": function position(element) {
      var left = 0, top = 0, isAncestor = false, result
      while (!isAncestor) {
        top += element.offsetTop || 0
        left += element.offsetLeft || 0
        element = sail.offsetParent(element)
        // The first ancestor to have a relative, absolute, or fixed position is
        // the closest positioned ancestor.
        isAncestor = !element || sail.nodeName(element) == "BODY" || sail.style(element, "position") != "static"
      }
      result = [left, top]
      result.left = left
      result.top = top
      return result
    },

    /**
     * Returns an element's offsets relative to the top left corner of the given
     * ancestor, or the document if the ancestor is omitted.
     *
     * @static
     * @memberOf sail
     * @param {Element} element The reference element.
     * @param {Element|Document} [ancestor=document] The ancestor to compute
     *  the offsets from, or the current document if the ancestor is omitted.
     * @returns {Array} The reference element's horizontal and vertical offsets.
     */
    "offset": function offset(element, ancestor) {
      var visible, style, cssText, offsetParent, position, top, left, Border, Margins, result
      if (!ancestor || ancestor.nodeType != 1) {
        ancestor = null
      }
      if (!(visible = sail.isVisible(element))) {
        style = element.style
        cssText = style.cssText
        style.cssText += ";visibility:hidden;display:block"
      }
      top = left = 0
      // Lazy-load feature tests that require the body to be loaded.
      Border = sail.Features.run("border-width-not-inherited-by-descendants")
      Margins = sail.Features.run("bugs:margins")
      for (; element; element = offsetParent) {
        top += element.offsetTop || 0
        left += element.offsetLeft || 0
        offsetParent = sail.offsetParent(element)
        position = sail.style(element, "position")
        if (offsetParent && Border) {
          // Manually add the border width to the offsets if the former is not
          // inherited. `parseFloat` removes the trailing `"px"` suffix.
          top += parseFloat(sail.style(offsetParent, "borderTopWidth")) || 0
          left += parseFloat(sail.style(offsetParent, "borderLeftWidth")) || 0
        }
        if (position == "fixed" || offsetParent && (offsetParent == ancestor || (Margins && position == "absolute" && sail.nodeName(offsetParent) == "BODY"))) {
          break
        }
      }
      if (!visible) {
        // Restore the element's original styles.
        style.cssText = cssText
      }
      result = [left, top]
      result.left = left
      result.top = top
      return result
    },

    /**
     * Sets or retrieves one or more properties on an element.
     *
     * @static
     * @memberOf sail
     * @param {Element} element The element.
     * @param {String|Object} name The property name to set or retrieve.
     * @param {Mixed} [value] The property value to set.
     * @returns {Element|Mixed}
     */
    "property": function property(element, name, value) {
      if (arguments.length < 3) {
        if (name && typeof name == "object") {
          // Setter; multiple properties.
          sail.enumerate(name, function (name, value) {
            sail.property(element, name, value)
          })
        } else if (name) {
          // Getter.
          return element[name]
        }
      } else {
        // Setter; single property.
        element[name] = value
      }
      return element
    },

    /**
     * Appends a variable number of children to a parent element.
     *
     * @static
     * @memberOf sail
     * @param {Node} element The parent element.
     * @param {Node|String|Number|Boolean|null} [children...] Child nodes to
     *  append to the given parent. Primitive values are automatically
     *  converted to text nodes.
     * @returns {Node} The given parent element.
     */
    "append": insertElements({
      "method": "appendChild"
    }),

    /**
     * Prepends a variable number of children to a parent element.
     *
     * @static
     * @memberOf sail
     * @param {Node} element The parent element.
     * @param {Node|String|Number|Boolean|null} [children...] Child nodes to
     *  prepend to the given parent.
     * @returns {Node} The parent element.
     */
    "prepend": insertElements({
      "method": "insertBefore",
      "reference": "firstChild"
    }),

    /**
     * Inserts the specified elements immediately before the given element.
     *
     * @static
     * @memberOf sail
     * @param {Node} element The reference element.
     * @param {Node|String|Number|Boolean|null} [appendees...] Elements to
     *  insert before the given reference element.
     * @returns {Node} The given reference element.
     */
    "before": insertElements({
      "method": "insertBefore",
      "target": "parentNode"
    }),

    /**
     * Inserts the specified elements after the given element.
     *
     * @static
     * @memberOf sail
     * @param {Node} element The reference element.
     * @param {Node|String|Number|Boolean|null} [appendees...] Elements to
     *  insert after the reference element.
     * @returns {Node} The reference element.
     */
    "after": insertElements({
      "method": "insertBefore",
      "reference": "nextSibling",
      "target": "parentNode"
    }),

    /**
     * Replaces the given element with the specified elements.
     *
     * @static
     * @memberOf sail
     * @param {Node} element The element to replace.
     * @param {Node|String|Number|Boolean|null} [replacements...] Elements
     *  to replace the given element with.
     * @returns {Node} The replaced element.
     */
    "replace": function replace(element) {
      var index, length, ownerDocument, node, target
      if (sail.isDetached(element)) {
        return element
      }
      ownerDocument = element.ownerDocument
      length = arguments.length
      if (length == 2) {
        target = arguments[1]
      } else {
        // The mutation method macro described in section 5.2.2 of the DOM
        // 4 draft uses a document fragment to combine multiple operations.
        target = ownerDocument.createDocumentFragment()
        for (index = 1; index < length; index++) {
          node = arguments[index]
          if (Primitives[typeof node] || !node) {
            // Convert all primitive values to text nodes. The DOM 4 methods
            // only implement this automatic conversion for strings.
            node = ownerDocument.createTextNode(String(node))
          }
          target.appendChild(node.element || node)
        }
      }
      if (Primitives[typeof target] || !target) {
        target = ownerDocument.createTextNode(String(target))
      }
      sail.purge(element)
      element.parentNode.replaceChild(target.element || target, element)
      return target
    },

    /**
     * Positions an element absolutely, removing it from the normal flow.
     * Because this method calculates content dimensions, the element must
     * be attached to the document.
     *
     * @static
     * @memberOf sail
     * @param {Element} element The element to reposition.
     * @returns {Element} The repositioned element.
     */
    "makeAbsolute": function makeAbsolute(element) {
      var style, computedStyle, contentWidth, contentHeight, offsets
      // Abort if the element is already absolutely-positioned.
      if (sail.style(element, "position") == "absolute") {
        return element
      }
      style = element.style
      // Subtract the padding and border dimensions to obtain the content
      // dimensions. `parseFloat` converts the pixel values to numbers.
      contentWidth = sail.width(element) - (parseFloat(sail.style(element, "borderLeftWidth")) || 0) - (parseFloat(sail.style(element, "borderRightWidth")) || 0) - (parseFloat(sail.style(element, "paddingLeft")) || 0) - (parseFloat(sail.style(element, "paddingRight")) || 0)
      contentHeight = sail.height(element) - (parseFloat(sail.style(element, "borderTopWidth")) || 0) - (parseFloat(sail.style(element, "borderBottomWidth")) || 0) - (parseFloat(sail.style(element, "paddingTop")) || 0) - (parseFloat(sail.style(element, "paddingBottom")) || 0)
      // Store the original element styles.
      sail.store(element, "position:absolute", {
        "position": style.position,
        "left": style.left,
        "top": style.top,
        "width": style.width,
        "height": style.height
      })
      // Compute the element's offsets from its closest positioned parent.
      offsets = sail.position(element)
      // Reposition the element.
      sail.style(element, {
        "position": "absolute",
        "left": offsets[0] + "px",
        "top": offsets[1] + "px",
        "width": contentWidth + "px",
        "height": contentHeight + "px"
      })
      return element
    },

    /**
     * Reverts an absolutely-positioned element to its original position.
     *
     * @static
     * @memberOf sail
     * @param {Element} element The element to reposition.
     * @returns {Element} The repositioned element.
     */
    "undoAbsolute": function undoAbsolute(element) {
      var styles = sail.style(element, "position") == "absolute" && sail.retrieve(element, "position:absolute")
      if (styles) {
        sail.style(element, styles)
        sail.unstore(element, "position:absolute")
      }
      return element
    },

    /**
     * Positions an element relative to its parent. The element does not need
     * to be attached to the document.
     *
     * @static
     * @memberOf sail
     * @param {Element} element The element to reposition.
     * @returns {Element} The repositioned element.
     */
    "makeRelative": function makeRelative(element) {
      var style = element.style, position = sail.style(element, "position")
      if (!position || position == "static") {
        sail.store(element, "position:relative", {
          "position": style.position,
          "left": style.left,
          "top": style.top
        })
        style.top = style.left = 0
        style.position = "relative"
      }
      return element
    },

    /**
     * Reverts a relatively-positioned element to its original position.
     *
     * @static
     * @memberOf sail
     * @param {Element} element The element to reposition.
     * @returns {Element} The repositioned element.
     */
    "undoRelative": function undoRelative(element) {
      var styles = sail.style(element, "position") == "relative" && sail.retrieve(element, "position:relative")
      if (styles) {
        sail.style(element, styles)
        sail.unstore(element, "position:relative")
      }
      return element
    },

    /**
     * Clones an element.
     *
     * @static
     * @memberOf sail
     * @param {Node} element The element to clone.
     * @param {Boolean} [deep=true] `true` if the element's descendants,
     *  including text nodes, should be cloned; `false` otherwise.
     * @returns {Node} The cloned element.
     */
    "clone": function clone(element, deep) {
      return element.cloneNode(deep !== false)
    },

    /**
     * Shows an element.
     *
     * @static
     * @memberOf sail
     * @param {Element} element The element to show.
     * @returns {Element} The shown element.
     */
    "show": function show(element) {
      var style = element.style, display = style.display, data = sail.retrieve(element, "sail:visibility", {})
      if (display == "none") {
        style.display = data.display || ""
      } else if (sail.style(element, "display") == "none") {
        // Explicitly override the computed `display` style.
        style.display = "block"
        data.computed = true
      }
      delete data.display
      return element
    },

    /**
     * Hides an element.
     *
     * @static
     * @memberOf sail
     * @param {Element} element The element to hide.
     * @returns {Element} The hidden element.
     */
    "hide": function hide(element) {
      var style = element.style, display = style.display, data = sail.retrieve(element, "sail:visibility", {})
      if (display && display != "none") {
        data.display = display
      }
      style.display = data.computed ? "" : "none";
      delete data.computed
      return element
    }
  })

  /** Create the `width` and `height` methods. */
  for (var index = 0; index < 2 || (index = null); index++) {
    (function (index) {
      var dimension = index ? "Height" : "Width", Property = "offset" + dimension
      /**
       * Calculates an element's border edge width. The border edge width is
       * the sum of the content, padding, and border widths.
       *
       * @static
       * @name width
       * @memberOf sail
       * @param {Element} element
       * @returns {Number} The border edge width in pixels.
       */

      /**
       * Calculates an element's border edge height. The border edge height is
       * the sum of the content, padding, and border heights.
       *
       * @static
       * @name height
       * @memberOf sail
       * @param {Element} element
       * @returns {Number} The border edge height in pixels.
       */
      sail.mixin(dimension.toLowerCase(), function getDimension(element) {
        var style, cssText, result
        // The `offsetWidth` and `offsetHeight` of hidden elements is `0`. See
        // section 7.1 of the W3C CSSOM View Module.
        if (!sail.isVisible(element)) {
          style = element.style
          // Back up the element's styles. `display: none` removes an element from
          // the normal flow, whereas `visibility: hidden` hides its contents.
          cssText = style.cssText
          // The leading semicolon is necessary because browsers (e.g., IE <= 8)
          // may not automatically terminate the `cssText` value with one.
          style.cssText += ";visibility:hidden;display:block"
          result = element[Property]
          // Restore the element's original styles.
          style.cssText = cssText
        } else {
          result = element[Property]
        }
        return result
      })
    }(index))
  }

  /**
   * Creates an element mutation method.
   *
   * @private
   * @param {Object} data The mutation method options.
   *
   *  target - The target element property name.
   *  method - The underlying DOM mutation method name.
   *  reference - The reference element property name.
   *
   * @returns {Function} The mutation method.
   */
  function insertElements(data) {
    return function mutate(element) {
      var index, length, ownerDocument, node, target
      // The `before`, `after`, and `replace` methods cannot operate on
      // detached elements.
      if (data.target == "parentNode" && sail.isDetached(element)) {
        return element
      }
      ownerDocument = element.ownerDocument
      length = arguments.length
      if (length == 2) {
        target = arguments[1]
      } else {
        // The mutation method macro described in section 5.2.2 of the DOM
        // 4 draft uses a document fragment to combine multiple operations.
        target = ownerDocument.createDocumentFragment()
        for (index = 1; index < length; index++) {
          node = arguments[index]
          if (Primitives[typeof node] || !node) {
            // Convert all primitive values to text nodes. The DOM 4 methods
            // only implement this automatic conversion for strings.
            node = ownerDocument.createTextNode(String(node))
          }
          target.appendChild(node.element || node)
        }
      }
      if (Primitives[typeof target] || !target) {
        target = ownerDocument.createTextNode(String(target))
      }
      ;(data.target ? element[data.target] : element)[data.method](target.element || target, data.method == "insertBefore" ? data.reference ? element[data.reference] : element : null)
      return element
    }
  }

  /**
   * Creates an element traversal method.
   *
   * @private
   * @param {String} property The property used to walk the elements.
   * @returns {Function} The traversal method.
   */
  function walkElements(property) {
    return function get(element, index, callback) {
      var binding = element, isIndex, isCallback, position = 0
      if (typeof index == "function") {
        // Juggle arguments.
        callback = index
        index = null
      }
      isIndex = typeof index == "number"
      isCallback = typeof callback == "function"
      if ((element = element[property])) {
        if (!isCallback && !isIndex && element.nodeType == 1) {
          // Optimize retrieving the closest ancestor or sibling.
          return element
        }
        do {
          if (element.nodeType == 1) {
            if (isCallback) {
              if (call.call(callback, binding, element) && (!isIndex || position++ == index)) {
                return element
              }
            } else if (isIndex) {
              if (position++ == index) {
                return element
              }
            } else {
              return element
            }
          }
        } while ((element = element[property]))
      }
      return null
    }
  }

  /**
   * Creates an unwrapped element with the given tag name, properties, and
   * additional children.
   *
   * @static
   * @deprecated
   * @memberOf sail
   * @param {String} tagName The tag name.
   * @param {Object} [properties={}] Properties to set on the created element.
   * @param {Array} [children=[]] Children to append to the element.
   * @returns {Element} The unwrapped created element.
   */
  sail.createElement = createElement
  function createElement(tagName, properties, children) {
    var wrapper
    if (properties && getClass.call(properties) == "[object Array]") {
      children = properties
      properties = null
    }
    wrapper = sail(tagName, properties)
    if (children && getClass.call(children) == "[object Array]") {
      wrapper.append.apply(wrapper, children)
    }
    return wrapper.element
  }

  /**
   * Converts a hyphenated CSS property name to its camelCased equivalent. The
   * first character immediately following a vendor prefix is not capitalized.
   *
   * @private
   * @param {String} property The hyphenated property name.
   * @returns {String} The camelCased property name.
   */
  function camelize(property) {
    return (property || "").replace(/-+[a-z]/gi, function (match, index) {
      match = match.slice(-1)
      // Avoid capitalizing the first character following a vendor prefix.
      return index ? match.toUpperCase() : match
    })
  }

  /**
   * Converts a camelCased value to its hyphenated equivalent.
   *
   * @private
   * @param {String} value The camelCased value.
   * @returns {String} The hyphenated result.
   */
  function hyphenate(value) {
    return (value || "").replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2").replace(/([a-z\d])([A-Z])/g, "$1-$2")
  }

  /**
   * Escapes all HTML entities within a string.
   *
   * @static
   * @memberOf sail
   * @param {String} string The string to escape.
   * @returns {String} The escaped string.
   */
  sail.escapeHTML = escapeHTML
  function escapeHTML(string) {
    var element = Document.createElement("pre"), text = element.appendChild(Document.createTextNode(""))
    sail.escapeHTML = function escapeHTML(string) {
      text.data = string
      return element.innerHTML
    }
    return sail.escapeHTML(string)
  }

  /**
   * Produces an encoded `parameter=value` pair.
   *
   * @private
   * @param {String} parameter The query parameter.
   * @param {String|null} value The value associated with the query parameter.
   * @returns {String} The URI-encoded `parameter=value` pair.
   */
  function toQueryPair(parameter, value) {
    parameter = encodeURIComponent(parameter)
    if (value == null) {
      // `null` and `undefined` values produce value-less parameters.
      return parameter
    }
    return parameter + "=" + encodeURIComponent(value)
  }

  /**
   * Serializes an object's contents as URL-encoded `parameter=value` pairs.
   * The order of the pairs in the resulting string is not guaranteed.
   *
   * @static
   * @memberOf sail
   * @param {Object} object The object to serialize.
   * @param {String} [separator="&"] The separator to use between the
   *  `parameter=value` pairs.
   * @returns {String} The serialized query string.
   */
  sail.toQueryString = toQueryString
  function toQueryString(object, separator) {
    var results = [], parameter, value, member, length
    for (parameter in object) {
      if (isProperty.call(object, parameter)) {
        value = object[parameter]
        if (value && !Primitives[typeof value] && (length = value.length, length > -1 && length >>> 0 === length)) {
          // Array values produce identically-named parameters for each
          // element.
          while (length--) {
            if ((member = toQueryPair(parameter, value[length]))) {
              results.unshift(member)
            }
          }
        } else if ((member = toQueryPair(parameter, value))) {
          results.push(member)
        }
      }
    }
    return results.join(separator == null ? "&" : separator)
  }

  /**
   * Parses a query string into an object containing the URL-decoded
   * `parameter=value` pairs.
   *
   * @static
   * @memberOf sail
   * @param {String} string The string to parse.
   * @param {String} [separator="&"] The separator between the encoded
   *  `parameter=value` pairs in the string.
   * @returns {Object} The parsed object.
   */
  sail.parseQuery = parseQuery
  function parseQuery(string, separator) {
    var match = string.split("?"), results = {}, members, index, length, member
    // If the given string contains an unescaped `?` or `#`, it is assumed to be
    // a URL (all characters before the `?` and after the `#` are ignored).
    if (match.length > 1 && !match[1] || !(((match = (match = match[1] || match[0]).split("#"))) && (match = match[0].split(" ")[0]))) {
      return results
    }
    for (members = match.split(separator == null ? "&" : separator), index = 0, length = members.length; index < length; index++) {
      member = members[index]
      // Parameters without corresponding values are set to `null`.
      var value = null, position = member.indexOf("="), parameter
      if (member && position) {
        if (position < 0) {
          parameter = member
        } else {
          parameter = decodeURIComponent(member.slice(0, position))
          if ((value = member.slice(position + 1))) {
            value = decodeURIComponent(value)
          }
        }
        // The values of identical parameters (e.g., `a=1&a=2`) are
        // aggregated into an array of values.
        if (isProperty.call(results, parameter)) {
          if (!results[parameter] || typeof results[parameter].push != "function") {
            results[parameter] = [results[parameter]]
          }
          results[parameter].push(value)
        } else {
          results[parameter] = value
        }
      }
    }
    return results
  }

  /**
   * Substitutes named parameters in a string with their corresponding values.
   *
   * @static
   * @memberOf sail
   * @param {String} source The source string.
   * @param {Object} values The values to substitute.
   * @returns {String} The interpolated string.
   */
  sail.interpolate = interpolate
  function interpolate(source, values) {
    return source.replace(/#\{(.*?)\}/g, function (match, name) {
      return name in values ? values[name] : ""
    })
  }

  /**
   * Serializes a JavaScript value to a JSON string. Supports RegExps, DOM
   * nodes, and cyclic structures.
   *
   * @deprecated
   * @static
   * @memberOf sail
   * @param {Mixed} value The value to serialize.
   * @returns {String} The serialized JSON string.
   */
  sail.serialize = serialize
  function serialize(value) {
    var stack = []
    return JSON.stringify(function serialize(value) {
      var className, length, results
      // Convert `undefined` to `null`.
      if (value == null) {
        return null
      }
      className = getClass.call(value)
      switch (className) {
        // Return strings, numbers, dates, and booleans as-is.
        case "[object String]":
        case "[object Number]":
        case "[object Boolean]":
        case "[object Date]":
          return value
        // Represent RegExp literals as strings.
        case "[object RegExp]":
          return interpolate("/#{source}/#{global}#{case}#{multiline}", {
            "source": value.source,
            "global": value.global ? "g" : "",
            "case": value.ignoreCase ? "i" : "",
            "multiline": value.multiline ? "m" : ""
          })
      }
      // Recursively clone and sanitize objects and arrays.
      if (typeof value == "object") {
        // Replace circular references with `null`.
        for (length = stack.length; length--;) {
          if (stack[length] == value) {
            return null
          }
        }
        stack.push(value)
        if (className == "[object Array]") {
          results = []
          // A desired side effect of using an unfiltered `for` loop
          // is that sparse arrays will be converted to dense arrays.
          for (length = value.length; length--;) {
            results[length] = serialize(value[length])
          }
        } else if ((className != "[object Error]" && className != "[object Object]") || typeof value.constructor != "function") {
          if ("nodeName" in value && "nodeValue" in value && "nodeType" in value) {
            // Based on work by Joseph Pecoraro.
            switch (+value.nodeType) {
              // Element nodes.
            case 1:
              results = interpolate("<#{name}>", {
                "name": sail.nodeName(value)
              })
              break
              // Text nodes.
            case 3:
              results = interpolate("<(#{value})>", {
                "value": value.nodeValue || "whitespace"
              })
              break
              // Comment nodes.
            case 8:
              results = interpolate("<!-- #{value} -->", {
                "value": value.nodeValue
              })
              break
              // Document nodes.
            case 9:
              results = "<Document>"
              break
              // Document type nodes.
            case 10:
              results = "<!DOCTYPE>"
            }
          } else {
            results = "{...}"
          }
        } else {
          results = {}
          for (length in value) {
            if (isProperty.call(value, length)) {
              // Only own properties are serialized.
              results[length] = serialize(value[length])
            }
          }
        }
        stack.pop()
        return results
      }
      // Convert all other non-JSON values to `null`.
      return null
    }(value))
  }

  /**
   * Extends a destination object with the enumerable properties of one or more
   * sources. Properties appearing in subsequent sources will override those of
   * the same name in previously-enumerated sources.
   *
   * @static
   * @memberOf sail
   * @param {Object} destination The destination object.
   * @param {Object} [sources...] The source objects.
   * @returns {Object} The destination object.
   */
  sail.extend = extend
  function extend(destination) {
    var index = 1, length = arguments.length, source, property, value
    for (; index < length; index++) {
      source = arguments[index]
      for (property in source) {
        if (isProperty.call(source, property)) {
          destination[property] = source[property]
        }
      }
    }
    return destination
  }

  /**
   * Weakly determines if a document is an XML or XHTML document. According to
   * the DOM Level 2 Core, section 1.1.7, XML is case-sensitive when normalizing
   * element names, while HTML is case-insensitive (the exception is unknown
   * elements in IE <= 8, which retain their original case). Based on work by
   * Diego Perini.
   *
   * @static
   * @memberOf sail
   * @param {Node|Window} element The reference node or `window` object.
   * @returns {Boolean|null}
   */
  sail.isXML = isXML
  function isXML(element) {
    var ownerDocument = element.ownerDocument || element.document || (element.nodeType == 9 ? element : null)
    if (ownerDocument) {
      // MSXML 3.0 and 6.0 documents implement the proprietary "MS-DOM" feature.
      if (sail.isHostType(ownerDocument, "implementation") && sail.isHostType(ownerDocument.implementation, "hasFeature") && ownerDocument.implementation.hasFeature("MS-DOM", "1.0")) {
        return true
      }
      // Infer from case-sensitivity in other browsers.
      return ownerDocument.createElement("Br").nodeName == "Br"
    }
    return null
  }

  /**
   * Returns the parent `window` object of the given element or document. Based
   * on work by David Mark, Diego Perini, and John-David Dalton.
   *
   * @static
   * @memberOf sail
   * @param {Node|Window} element The reference node or `window` object.
   * @returns {Window} The `window` object associated with the reference
   *  element.
   */
  sail.getParentWindow = getParentWindow
  function getParentWindow(element) {
    var ownerDocument = element.ownerDocument || element.document || (element.nodeType == 9 ? element : null), frame, frames, index
    if (!ownerDocument) {
      return null
    }
    if (sail.Features.run("features/properties/parentWindow") && sail.isHostType(ownerDocument, "parentWindow")) {
      return ownerDocument.parentWindow
    } else if (sail.Features.run("features/properties/defaultView") && sail.isHostType(ownerDocument, "defaultView")) {
      return ownerDocument.defaultView
    } else {
      for (index = 0, frames = Window.frames; frame = frames[index++];) {
        // This property access may trigger a security error if the frame has
        // a different origin than 
        if (frame.document == ownerDocument) {
          return frame
        }
      }
      return Window
    }
  }

  /**
   * Viewport dimensions.
   *
   * @deprecated
   * @static
   * @memberOf sail
   * @type Object
   */

  sail.viewport = (function () {
    /**
     * The `html` element functions as the viewport in standards mode, and
     * `body` in quirks mode. `document.clientWidth` and `clientHeight` are
     * non-standard KHTML extensions available in Konqueror and Safari 2.
     */
    var root = Document.compatMode.indexOf("CSS") < 0 ? Document.body : Document.documentElement

    return {
      /**
       * Returns the pixel width of the viewport.
       *
       * @deprecated
       * @static
       * @memberOf sail.viewport
       * @returns {Number} The viewport width.
       */
      "width": function width() {
        return ("clientWidth" in Document ? Document : root).clientWidth
      },

      /**
       * Returns the pixel height of the viewport.
       *
       * @deprecated
       * @static
       * @memberOf sail.viewport
       * @returns {Number} The viewport height.
       */
      "height": function height() {
        return ("clientHeight" in Document ? Document : root).clientHeight
      },

      /**
       * Repositions an element so that it appears within the viewport.
       *
       * @deprecated
       * @static
       * @memberOf sail.viewport
       * @param {Element} element The element to reposition.
       * @returns {Element} The repositioned element.
       */
      "reposition": function reposition(element) {
        var offset = sail.offset(element), width = sail.width(element), height = sail.height(element), clientWidth = sail.viewport.width(), clientHeight = sail.viewport.height()
        if (offset[0] + width >= clientWidth) {
          sail.makeAbsolute(element)
          sail.style(element, "left", clientWidth - width)
        }
        if (offset[1] + height >= clientHeight) {
          sail.makeAbsolute(element)
          sail.style(element, "top", clientHeight - height)
        }
        return element
      }
    }
  }())

  /**
   * Unified events module.
   *
   * @static
   * @memberOf sail
   * @type Object
   */

  var Events2 = sail.Events2 = {
    /**
     * Creates an event dispatcher that executes event handlers in succession.
     * Each handler is optionally bound to the default `this` binding.
     *
     * @static
     * @memberOf sail.Events2
     * @param {Object} delegate An object that specifies how to interact with
     *  the underlying event registry. The delegate may implement a `yield`
     *  method that wraps the event before successively invoking the handlers.
     * @param {Array} callbacks A list of event handlers to execute.
     * @param {Mixed} [target] The default `this` binding.
     * @returns {Function} The event dispatcher.
     */
    "dispatch": function dispatch(delegate, callbacks, target) {
      return function dispatcher(event) {
        // Clone the event handler registry.
        var data = callbacks.slice(0), index = 0, length = data.length
        if (typeof delegate.yield == "function") {
          event = delegate.yield(event)
        }
        for (; index < length; index += 2) {
          call.call(data[index], data[index + 1] || target, event)
        }
      }
    },

    /**
     * Fires an event by executing its attached handlers in succession. The
     * associated event object is passed as the first argument to each handler.
     *
     * @static
     * @memberOf sail.Events2
     * @param {Object} delegate An object that specifies how to interact with
     *  the underlying event registry. The delegate must implement a `get`
     *  method that returns the event target's event registry.
     * @param {Object} target The event target.
     * @param {String|Object} event The event type, specified by either a
     *  string identifier or an object with a `type` property.
     * @returns {Object} The event target.
     */
    "trigger": function trigger(delegate, target, event) {
      var registry = delegate.get(target), isPrimitive, data, all, index, length
      if (registry) {
        if (typeof event != "object" || !event) {
          // Convert primitive identifiers to event objects.
          event = {
            "type": event
          }
        }
        isProperty.call(event, "target") || (event.target = target)
        event.currentTarget = target
        // Clone the `all` event handler registry to prevent modifications by
        // firing event handlers.
        all = registry.all && registry.all.callbacks.slice(0)
        // Fire the attached event handlers.
        if (event.type != "all" && (data = registry[event.type])) {
          data.dispatcher(event)
        }
        if (all) {
          // Manually fire the `all` event.
          for (index = 0, length = all.length; index < length; index += 2) {
            call.call(all[index], all[index + 1] || target, event)
          }
        }
      }
      return target
    },

    /**
     * Registers an event handler for one or more event types. The handler will
     * be invoked whenever the event is triggered.
     *
     * @static
     * @memberOf sail.Events2
     * @param {Object} delegate An object that specifies how to interact with
     *  the underlying event registry. The delegate must implement a `get`
     *  method for retrieving the target's event registry, and may implement an
     *  `add` method that will be invoked whenever a new handler registry is
     *  created.
     * @param {Object} target The event target.
     * @param {String} event The event type.
     * @param {Function} callback The event handler.
     * @param {Mixed} [binding] The event handler's `this` binding.
     * @returns {Object} The event target.
     */
    "on": function on(delegate, target, event, callback, binding) {
      var registry, events, data
      if (event != null && typeof callback == "function") {
        registry = delegate.get(target)
        events = String(event).split(RegExp(Whitespace + "+"))
        while (events.length) {
          event = events.pop()
          if (!(data = registry[event])) {
            // Create the event handler registry and dispatcher.
            data = registry[event] = {}
            data.dispatcher = Events2.dispatch(delegate, data.callbacks = [], target)
            if (typeof delegate.add == "function") {
              delegate.add(target, event, data)
            }
          }
          data.callbacks.push(callback, binding)
        }
      }
      return target
    },

    /**
     * Removes a previously-registered event handler from one or more event
     * types. If the `this` binding is omitted, all instances of the handler,
     * including those bound to different `this` bindings, will be removed. If
     * the handler is omitted, all handlers registered for the event will be
     * removed. If both the event and handler are omitted, all handlers for all
     * events will be removed.
     *
     * @static
     * @memberOf sail.Events2
     * @param {Object} delegate An object that specifies how to interact with
     *  the underlying event registry. The `delegate` must implement `get` and
     *  `removeAll` methods, and may implement a `remove` method for cleaning up
     *  the handler registry.
     * @param {Object} target The event target.
     * @param {String} event The event type.
     * @param {Function} callback The event handler.
     * @param {Mixed} [binding] The event handler's `this` binding.
     * @returns {Object} The event target.
     */
    "off": function off(delegate, target, event, callback, binding) {
      var registry = delegate.get(target), events, data, callbacks, length
      if (event == null && callback == null) {
        // `event` and `callback` omitted; clear the event registry.
        delegate.removeAll(target, registry)
      } else {
        events = String(event).split(RegExp(Whitespace + "+"))
        while (events.length) {
          event = events.pop()
          if ((data = registry[event]) && (callbacks = data.callbacks) && (length = callbacks.length)) {
            if (callback != null) {
              for (length -= 1; length >= 0; length -= 2) {
                // Remove the `callback` from the event handler registry.
                if (callbacks[length - 1] === callback && (binding == null || callbacks[length] === binding)) {
                  callbacks.splice(length - 1, 2)
                }
              }
            }
            if (callback == null || !callbacks.length) {
              // `callback` omitted or empty handler registry; remove all
              // attached event handlers.
              if (typeof delegate.remove == "function") {
                delegate.remove(target, event, data)
              }
              delete registry[event]
            }
          }
        }
      }
      return target
    }
  }

  /** DOM events mix-in. */
  ;(function () {
    var delegate = {
      /** @nodoc */
      "get": function get(element) {
        return sail.retrieve(element, "sail:events", {})
      },

      /** @nodoc */
      "add": function add(element, event, data) {
        if (sail.isHostType(element, "addEventListener")) {
          element.addEventListener(event, data.dispatcher, false)
        } else if (sail.isHostType(element, "attachEvent")) {
          element.attachEvent("on" + event, data.dispatcher)
        }
      },

      /** @nodoc */
      "removeAll": function removeAll(element, registry) {
        sail.enumerate(registry, function (event, data) {
          if (sail.isHostType(element, "addEventListener")) {
            element.removeEventListener(event, data.dispatcher, false)
          } else if (sail.isHostType(element, "attachEvent")) {
            element.detachEvent("on" + event, data.dispatcher)
          }
        })
        sail.unstore(element, "sail:events")
      },

      /** @nodoc */
      "remove": function remove(element, event, data) {
        if (sail.isHostType(element, "addEventListener")) {
          element.removeEventListener(event, data.dispatcher, false)
        } else if (sail.isHostType(element, "attachEvent")) {
          element.detachEvent("on" + event, data.dispatcher)
        }
      },

      /** @nodoc */
      "yield": function (event) {
        event || (event = Window.event)
        if (!sail.isHostType(event, "target") && sail.isHostType(event, "srcElement")) {
          event.target = event.srcElement
        }
        if (event.target.nodeType == 3) {
          event.target = event.target.parentNode
        }
        if (!sail.isHostType(event, "stopPropagation")) {
          event.stopPropagation = function () {
            event.cancelBubble = true
          }
        }
        if (!sail.isHostType(event, "preventDefault")) {
          event.preventDefault = function () {
            event.returnValue = false
          }
        }
        if (/^(?:mousedown|mouseover|mouseout|mouseup|click|dblclick|mousemove)$/.test(event.type) && !("which" in event)) {
          event.which = event.button
        }
        if (!("pageX" in event)) {
          event.pageX = event.clientX + Document.body.scrollLeft + Document.documentElement.scrollLeft
        }
        if (!("pageY" in event)) {
          event.pageY = event.clientY + Document.body.scrollTop + Document.documentElement.scrollTop
        }
        return event
      }
    }
    sail.mixin("on", function on(element, event, callback, binding) {
      return Events2.on(delegate, element, event, callback, binding)
    })
    sail.mixin("off", function off(element, event, callback, binding) {
      return Events2.off(delegate, element, event, callback, binding)
    })
  }())

  /** Custom events mix-in. */
  var Events = sail.Events = (function () {
    var delegate = {
      /** @nodoc */
      "get": function get(target) {
        return target.events || (target.events = {})
      },

      /** @nodoc */
      "removeAll": function removeAll(target) {
        target.events = {}
      }
    }

    // Deprecation helper.
    return function Events() {
      return {
        /** @deprecated */
        "on": function on(event, callback, binding) {
          return Events2.on(delegate, this, event, callback, binding)
        },

        /** @deprecated */
        "off": function off(event, callback, binding) {
          return Events2.off(delegate, this, event, callback, binding)
        },

        /** @deprecated */
        "trigger": function trigger(event) {
          return Events2.trigger(delegate, this, event)
        }
      }
    }
  }())

  /**
   * Creates an Ajax request.
   *
   * @static
   * @nodoc
   * @memberOf sail
   * @param {String} url
   * @param {Object} [options={}]
   * @param {Function} [callback]
   */
  sail.ajax = function ajax(url, options, callback) {
    var transport
    if (typeof options == "function" && callback == null) {
      // Juggle arguments.
      callback = options
      options = null
    }
    options = Object(options)
    transport = new Ajax2(options)
    if (typeof callback == "function") {
      transport.on("all", function (event) {
        switch (event.type) {
          case "success":
          case "failure":
            call.call(callback, this, event.type == "failure", this.transport.responseText, this.transport)
        }
      })
    }
    return transport.send(url, {
      "parameters": options.parameters,
      "body": options.body,
      "timeout": options.timeout
    })
  }

  /**
   * Creates an `XMLHttpRequest` object.
   *
   * @static
   * @memberOf sail.Ajax2
   * @returns {XMLHttpRequest|ActiveXObject} An `XMLHttpRequest` object in
   *  standards-compliant browser, or an `ActiveXObject` in IE <= 8.
   */
  Ajax2.create = function create() {
    var transport
    if (typeof ActiveXObject != "undefined") {
      // The `Msxml2` namespace should be preferred where available. The version
      // string is required; omitting it uses the MSXML 3 control.
      transport = "Msxml2.XMLHTTP.6.0"
      try {
        new ActiveXObject(transport)
      } catch (exception) {
        // The `Microsoft` namespace is deprecated, and only implemented in
        // MSXML 3 for backward-compatibility.
        transport = "Microsoft.XMLHTTP"
        try {
          new ActiveXObject(transport)
        } catch (exception) {
          // Possible security error. IE <= 6 users must enable ActiveX to make
          // Ajax requests. IE >= 7's `XMLHttpRequest` object is not affected by
          // ActiveX security settings.
          transport = null
        }
      }
      if (transport) {
        return (Ajax2.create = function create() {
          return new ActiveXObject(transport)
        })()
      }
    }
    if (typeof XMLHttpRequest != "undefined") {
      // IE >= 7 natively implements the `XMLHttpRequest` object, but doesn't
      // support local file requests.
      return (Ajax2.create = function create() {
        return new XMLHttpRequest()
      })()
    }
  }

  /**
   * Creates a cross-browser Ajax transport object.
   *
   * @constructor
   * @memberOf sail
   * @param {Object} [options={}] Persistent options, used for each request
   *  made with the transport object.
   *
   *  method - The HTTP method to use. Defaults to `get`.
   *  async - A Boolean that specifies whether the request should be
   *   asynchronous.
   *  encoding - The body encoding. Defaults to `utf-8`.
   *  headers - An object literal containing HTTP message headers to send with
   *   each request.
   */
  sail.Ajax2 = Ajax2
  function Ajax2(options) {
    options = Object(options)
    this.transport = Ajax2.create()
    this.onStateChange = sail.bind(this.onStateChange, this)

    this.method = String("method" in options && options.method || "get").toLowerCase()
    this.async = "async" in options ? options.async !== false : true
    this.encoding = "encoding" in options && options.encoding || "utf-8"
    this.headers = typeof options.headers == "object" && options.headers || null
  }

  /**
   * A set of event names associated with each `XMLHttpRequest` ready state.
   *
   * @static
   * @memberOf sail.Ajax2
   * @type Object
   */
  Ajax2.Events = {
    1: "loading",
    2: "loaded",
    3: "interactive",
    4: "complete"
  }

  Ajax2.prototype = extend(new Events(), {
    "constructor": Ajax2,

    /**
     * Makes a request to a remote URL.
     *
     * @param {String} url The URL to connect to.
     * @param {Object} [options={}] Request-specific options, used in addition
     *  to the persistent options.
     *
     *  parameters - An object containing query parameters to serialize and
     *   append to the URL.
     *  timeout - The request timeout duration, in seconds. Defaults to `15`.
     *  body - The message body to send with the request. Ignored for `get`
     *   requests.
     */
    "send": function send(url, options) {
      var self = this, parameters, contentType
      options = Object(options)
      if ((parameters = "parameters" in options && sail.toQueryString(options.parameters))) {
        url += (url.indexOf("?") < 0 ? "?" : "&") + parameters
      }
      this.trigger("create")
      this.timer = startTimer(function () {
        if (self.transport.readyState != 4) {
          self.transport.onreadystatechange = function () {}
          self.transport.abort()
          self.trigger("timeout").trigger("complete")
        }
      }, options.timeout * 1e3 || 15e3)
      this.transport.open(this.method.toUpperCase(), url, this.async)
      this.transport.onreadystatechange = this.onStateChange
      if (this.headers) {
        sail.enumerate(this.headers, function (header, value) {
          header = hyphenate(header).toLowerCase()
          value = String(value)
          if (header == "content-type") {
            contentType = value
          } else {
            self.transport.setRequestHeader(header, value)
          }
        })
      }
      if (this.method == "post") {
        contentType || (contentType = "application/x-www-form-urlencoded")
        if (contentType.indexOf("charset=") < 0) {
          contentType += "; charset=" + self.encoding
        }
        this.transport.setRequestHeader("content-type", contentType)
      }
      this.transport.send(this.method == "get" ? null : ("body" in options && options.body || null))
      return this
    },

    /** @nodoc */
    "onStateChange": function onStateChange() {
      var readyState = this.transport.readyState, event = Ajax2.Events[readyState], status
      if (readyState == 4) {
        clearTimer(this.timer)
        status = this.transport.status
        this.trigger((status >= 200 && status < 300 || status == 304) ? "success" : "failure")
        this.transport.onreadystatechange = function () {}
      }
      event && this.trigger(event)
    },

    /** @nodoc */
    "abort": function abort() {
      if (this.transport.readyState != 4) {
        clearTimer(this.timer)
        this.transport.onreadystatechange = function () {}
        this.transport.abort()
        this.trigger("abort").trigger("complete")
      }
      return this
    }
  })

  /** Storage deprecation helper. */
  sail.Storage = {}

  /** Ajax deprecation helper. */
  sail.Ajax = function Ajax(source, options) {
    options = Object(options)
    var ajax = sail.ajax({
      "method": options.method || "get",
      "async": options.asynchronous !== false,
      "encoding": options.encoding || null,
      "headers": options.headers || null
    })
    return ajax
  }

  /**
   * Clean up element storage to prevent memory leaks in IE <= 8. These versions
   * of IE don't support back-forward cache, so attaching an `unload` event
   * should not thwart caching.
   */
  if (!sail.isHostType(Window, "addEventListener") && sail.isHostType(Window, "attachEvent")) {
    (function (event) {
      function unload() {
        Window.detachEvent(event, unload)
        sail.enumerate(sail.storage, function (property, storage) {
          sail.purge(storage.element)
          delete sail.storage[property]
        })
      }
      Window.attachEvent(event, unload)
    }("onunload"))
  }

  /** Assign the Sail function to the global `sail` variable. */
  return sail
}())

/** Export Sail. Based on work by John-David Dalton and Mathias Bynens. */
if (typeof define === "function" && define.amd) {
  // Asynchronous module loaders. The strict equality check for `define` is
  // necessary for compatibility with the RequireJS optimizer (`r.js`).
  define(function () {
    return sail
  })
} else if (typeof exports == "object" && exports) {
  // Export for Browserify and other CommonJS-compatible build systems.
  if (typeof module == "object" && module && module.exports == exports) {
    (module.exports = sail).sail = sail
  } else {
    exports.sail = sail
  }
}
