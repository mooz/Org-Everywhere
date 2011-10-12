var { WindowManager } = load('lib/WindowManager');
var { Org } = load('lib/org');
var { KeyboardShortcut } = load('lib/KeyboardShortcut');
var timer = load('lib/jstimer');

let { classes: Cc, interfaces: Ci } = Components;

const TYPE_BROWSER = 'navigator:browser';

const ID = "3ec95456-6ad8-4023-92cd-6bc4fa4790d4";
function id(name) ID + "-" + name;

const console = (function () {
  let consoleService = Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);

  return {
    log: function (msg) {
      consoleService.logStringMessage(msg);
    }
  };
})();

let DOM = (function () {
  let appendedChildren = [];

  return {
    appendChild: function (parent, child) {
      appendedChildren.push(child);
      return parent.appendChild(child);
    },

    removeAllChildren: function () {
      appendedChildren.forEach(function (child) {
        try {
          child.parentNode.removeChild(child);
        } catch ([]) {}
      });

      appendedChildren.length = 0;
    }
  };
})();

function handleWindow(aWindow) {
  const { document, window } = aWindow;

  if (document.documentElement.getAttribute('windowtype') !== TYPE_BROWSER)
    return;

  function $(selector) document.querySelectorAll(selector);

  function Element(name, doc) {
    if (!(this instanceof Element))
      return new Element(name, doc);
    this.$ = (doc || document).createElement(name);
  };

  Element.prototype = {
    attr: function (k, v) {
      this.$.setAttribute(k, v);
      return this;
    },

    prop: function (k, v) {
      this.$[k] = v;
      return this;
    },

    child: function (child) {
      if (child instanceof Element)
        child = child.$;
      this.$.appendChild(child);
      return this;
    },

    text: function (text) {
      this.$.textContent = text;
      return this;
    }
  };

  // ============================================================ //
  // Setup Codes
  // ============================================================ //

  function getTargetElement(ev) {
    if (window.gContextMenu)
      return window.gContextMenu.target;
    if (document.commandDispatcher.focusedElement)
      return document.commandDispatcher.focusedElement;
    if (document.commandDispatcher.focusedWindow.document.activeElement)
      return document.commandDispatcher.focusedWindow.document.activeElement;
    return ev.target;
  }

  function getBody(elem) {
    let doc = elem.ownerDocument;
    let body = doc.getElementsByTagName("body");
    return body[0];
  }

  // ------------------------------------------------------------ //
  // Arrange context menu item
  // ------------------------------------------------------------ //

  var contextMenu = document.getElementById("contentAreaContextMenu");
  var menuitem = Element("menuitem")
        .attr("label", "Launch Org Editor")
        .attr("accesskey", "r")
        .attr("id", id("launch-editor"))
        .$;
  DOM.appendChild(contextMenu, menuitem);
  menuitem.addEventListener("command", launchEditor, false);

  function blinkElement(elem, count, interval) {
    var flasher = Cc["@mozilla.org/inspector/flasher;1"].createInstance(Ci.inIFlasher);
    flasher.color = "#bfdecf";
    flasher.thickness = 3;
    // flasher.scrollElementIntoView(el);

    var blinked = 0;
    var drawOutLine = true;
    var id = timer.setInterval(function() {
      if (blinked > count) {
        timer.clearInterval(id);
        drawOutLine = false;
      }

      if (drawOutLine) {
        flasher.drawElementOutline(elem);
      } else {
        flasher.repaintElement(elem);
        blinked++;
      }

      drawOutLine = !drawOutLine;
    }, interval / 2);
  }

  function getActualContentEditableElement(elem) {
    if (!elem)
      return null;
    else if (elem.contentEditable === "true")
      return elem;
    else
      return getActualContentEditableElement(elem.parentNode);
  }

  function getEditableElement(elem) {
    if (/^on$/i.test(elem.ownerDocument.designMode))
      return getBody(elem); // .ownerDocument.documentElement;
    else
      return getActualContentEditableElement(elem);
  }

  function setMenuDisplay(ev) {
    let target = getTargetElement(ev);
    menuitem.hidden = !getEditableElement(target);
  }
  contextMenu.addEventListener("popupshowing", setMenuDisplay, false);

  // ------------------------------------------------------------ //
  // Arrange editor
  // ------------------------------------------------------------ //

  let popupSet = document.getElementById("mainPopupSet");

  let panel, editor;
  DOM.appendChild(
    popupSet,
    panel = Element("panel")
      .attr("position", "center")
      .attr("orient", "vertical")
      .attr("side", "top")
      .child(
        Element("titlebar")
          .child(
            Element("label")
              .attr("value", "Org Anywhere")
              .$
          )
          .$
      )
      .child(
        editor = Element("textbox")
          .attr("multiline", "true")
          .$
      )
      .$
  );

  let currentEditableElement = null;
  let orgCodeContainer = null;
  let parser = new Org.Parser({ noTitle: true });
  editor.addEventListener("input", function () {
    dumpOrgCode();
  }, false);

  function dumpOrgCode() {
    if (currentEditableElement) {
      let code = editor.value;

      currentEditableElement.innerHTML
        = Org.HtmlTextConverter.convertDocument(parser.parse(code), true);
      orgCodeContainer.textContent = code;
      currentEditableElement.appendChild(orgCodeContainer);
    }
  }

  panel.addEventListener("popuphidden", function () {
    dumpOrgCode();
  }, false);

  panel.addEventListener("popupshown", function () {
    editor.value = orgCodeContainer.textContent;
    editor.focus();
  }, false);

  KeyboardShortcut.create({
    shortcut : 'Ctrl-F8',
    oncommand : 'Oew.launchEditor(event)'
  }, document.getElementById('mainKeyset'));

  function launchEditor(ev) {
    let target = getTargetElement(ev);
    let doc = target.ownerDocument;
    currentEditableElement = getEditableElement(target);

    console.log("currentEditableElement: " + currentEditableElement.localName);

    if (!currentEditableElement)
      return;

    blinkElement(currentEditableElement, 2, 250);

    const elemName = "pre";
    let candidates = currentEditableElement.querySelectorAll(elemName);
    orgCodeContainer = candidates.length > 0 ?
      candidates[candidates.length - 1]
      : Element(elemName, doc).$;

    // let { innerWidth: width, innerHeight: height } = currentEditableElement.
    let width = currentEditableElement.clientWidth;
    let height = currentEditableElement.clientHeight;
    let editorStyle = "width:" + width + "px;height:" + height + "px;";
    editor.setAttribute("style", editorStyle);

    // Style attribute may be deleted by service provider (Tumblr, Posterous, ...)
    orgCodeContainer.setAttribute("style", "display:none");

    panel.openPopup(currentEditableElement, "before_start", 0, 0, false, true);
  }

  window.Oew = {
    launchEditor: launchEditor
  };
}

WindowManager.getWindows(TYPE_BROWSER).forEach(handleWindow);
WindowManager.addHandler(handleWindow);

// ============================================================ //
// Destructor
// ============================================================ //

function shutdown() {
  DOM.removeAllChildren();
  WindowManager.getWindows(TYPE_BROWSER).forEach(function (window) {
    delete window.Oew;
  });
}
