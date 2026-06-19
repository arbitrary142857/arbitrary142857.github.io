(function () {
  var resizeTimer;

  function fitDisplayMath() {
    document.querySelectorAll("main .katex-display").forEach(function (display) {
      var inner = display.querySelector(":scope > .katex");
      if (!inner) return;

      display.style.fontSize = "";

      var available = display.clientWidth;
      if (available <= 0) return;

      var needed = inner.scrollWidth;
      if (needed <= available) return;

      // Scale via font-size so layout width shrinks (transform: scale() only
      // changes visuals, leaving a wide layout box that overflow:hidden clips).
      var scale = available / needed;
      display.style.fontSize = scale + "em";

      for (var pass = 0; pass < 2; pass++) {
        needed = inner.scrollWidth;
        if (needed <= available) break;
        scale *= available / needed;
        display.style.fontSize = scale + "em";
      }
    });
  }

  function fixPunctuationAfterInlineMath() {
    var containers = document.querySelectorAll(
      "main p, main li .item-body, section.env, blockquote.quote, .boxed-text",
    );
    containers.forEach(function (container) {
      for (var i = 0; i < container.childNodes.length - 1; i++) {
        var node = container.childNodes[i];
        var next = container.childNodes[i + 1];
        if (
          node.nodeType !== Node.ELEMENT_NODE ||
          !node.classList.contains("katex") ||
          next.nodeType !== Node.TEXT_NODE
        ) {
          continue;
        }

        var match = next.textContent.match(/^[,;:.!?]+/);
        if (!match) continue;

        var punct = match[0];
        var rest = next.textContent.slice(punct.length);
        var wrap = document.createElement("span");
        wrap.className = "keep-punct";
        node.replaceWith(wrap);
        wrap.appendChild(node);
        wrap.appendChild(document.createTextNode(punct));
        if (rest) {
          next.textContent = rest;
        } else {
          next.remove();
        }
      }
    });
  }

  function applyMobileLayout() {
    fitDisplayMath();
  }

  function scheduleApply() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(applyMobileLayout, 100);
  }

  function init() {
    fixPunctuationAfterInlineMath();
    applyMobileLayout();
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(init);
  } else {
    window.addEventListener("load", init);
  }
  window.addEventListener("resize", scheduleApply);
})();
