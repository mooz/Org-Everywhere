var { WindowManager } = load('lib/WindowManager');
var { Org } = load('lib/org');
var { KeyboardShortcut } = load('lib/KeyboardShortcut');
var timer = load('lib/org');

const TYPE_BROWSER = 'navigator:browser';

const ID = "3ec95456-6ad8-4023-92cd-6bc4fa4790d4";
function id(name) ID + "-" + name;

const console = (function () {
  let consoleService = Components.classes["@mozilla.org/consoleservice;1"]
        .getService(Components.interfaces.nsIConsoleService);

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
    return window.gContextMenu ?
      window.gContextMenu.target
      : ev.originalTarget;
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

  function setMenuDisplay(ev) {
    let body = getBody(getTargetElement(ev));
    menuitem.hidden = !body.contentEditable;
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
          .attr("style", "width:400px;height:300px;")
          .$
      )
      .$
  );

  let currentDocument = null;
  let orgCodeContainer = null;
  let parser = new Org.Parser({ noTitle: true });
  editor.addEventListener("input", function () {
    dumpOrgCode();
  }, false);

  function dumpOrgCode() {
    if (currentDocument) {
      let code = editor.value;
      let body = getBody(currentDocument.documentElement);

      body.innerHTML
        = Org.HtmlTextConverter.convertDocument(parser.parse(code), true);
      orgCodeContainer.textContent = code;
      body.appendChild(orgCodeContainer);
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
    let docElem = doc.documentElement;

    currentDocument = doc;
    const elemName = "pre";
    let candidates = doc.querySelectorAll(elemName);
    orgCodeContainer = candidates.length > 0 ?
      candidates[candidates.length - 1]
      : Element(elemName, doc)
      .attr("style", "display:none")
      .$;

    panel.openPopup(target, "center");
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
