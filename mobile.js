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

  function lectureNavCellWidthPx() {
    var rootStyle = getComputedStyle(document.documentElement);
    var numSizeEm = parseFloat(rootStyle.getPropertyValue("--lecture-nav-num-size")) || 2.15;
    var bodyFontPx = parseFloat(rootStyle.fontSize) || 16;
    return numSizeEm * bodyFontPx;
  }

  function chooseBalancedColumns(count, maxCols) {
    if (count <= 0) return 1;
    maxCols = Math.max(1, Math.min(maxCols, count));
    var bestCols = 1;
    var bestScore = Infinity;
    for (var cols = 1; cols <= maxCols; cols++) {
      var rows = Math.ceil(count / cols);
      var lastRow = count - (rows - 1) * cols;
      var imbalance = cols - lastRow;
      var squareness = Math.abs(cols - rows);
      // Minimize rows first, then row length imbalance, then squareness.
      var score = rows * 1000 + imbalance * 10 + squareness;
      if (score < bestScore || (score === bestScore && cols > bestCols)) {
        bestScore = score;
        bestCols = cols;
      }
    }
    return bestCols;
  }

  function gridWidthForCols(cols, cellWidth, gapPx) {
    if (cols <= 0) return 0;
    return cols * cellWidth + (cols - 1) * gapPx;
  }

  function maxColsForWidth(availableWidth, cellWidth, gapPx) {
    return Math.max(1, Math.floor((availableWidth + gapPx) / (cellWidth + gapPx)));
  }

  function measureLectureNavMetrics(container, main) {
    var sample = container.querySelector(".lecture-nav-num");
    var cellWidth = sample
      ? sample.getBoundingClientRect().width
      : lectureNavCellWidthPx();
    var gapPx = parseFloat(getComputedStyle(container).gap) || 0;
    var nav = main.closest(".lecture-nav");
    var availableWidth = main.clientWidth;
    if (nav) {
      var navStyle = getComputedStyle(nav);
      availableWidth =
        nav.clientWidth -
        parseFloat(navStyle.paddingLeft) -
        parseFloat(navStyle.paddingRight);
    }
    return { cellWidth: cellWidth, gapPx: gapPx, availableWidth: availableWidth };
  }

  function fitLectureNavGrid() {
    document.querySelectorAll(".lecture-nav-main").forEach(function (main) {
      var container = main.querySelector(".lecture-nav-lectures");
      if (!container) return;
      var count = container.children.length;
      if (count === 0) return;

      var metrics = measureLectureNavMetrics(container, main);
      var cellWidth = metrics.cellWidth;
      var gapPx = metrics.gapPx;
      var availableWidth = metrics.availableWidth;
      if (availableWidth <= 0 || cellWidth <= 0) return;

      var maxCols = maxColsForWidth(availableWidth, cellWidth, gapPx);
      maxCols = Math.min(maxCols, count);
      var cols = chooseBalancedColumns(count, maxCols);
      while (
        cols > 1 &&
        gridWidthForCols(cols, cellWidth, gapPx) > availableWidth + 0.5
      ) {
        maxCols = cols - 1;
        cols = chooseBalancedColumns(count, maxCols);
      }
      container.style.setProperty("--lecture-nav-columns", String(cols));
    });
  }

  function supportsHoverPreview() {
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }

  function initLectureNavPreview() {
    if (!supportsHoverPreview()) return;

    document.querySelectorAll(".lecture-nav").forEach(function (nav) {
      var preview = nav.querySelector(".lecture-nav-preview");
      if (!preview) return;

      var defaultPreviewHtml = preview.innerHTML;

      function showDefault() {
        preview.innerHTML = defaultPreviewHtml;
      }

      function showTarget(el) {
        var tpl = el.querySelector(".lecture-nav-preview-tpl");
        if (tpl) {
          preview.innerHTML = tpl.innerHTML;
          return;
        }
        showDefault();
      }

      nav.querySelectorAll(".lecture-nav-preview-tpl").forEach(function (tpl) {
        var target = tpl.parentElement;
        if (!target) return;

        target.addEventListener("mouseenter", function () {
          showTarget(target);
        });
        target.addEventListener("focus", function () {
          showTarget(target);
        });
      });

      nav.addEventListener("mouseleave", showDefault);
      nav.addEventListener("focusout", function (event) {
        if (!nav.contains(event.relatedTarget)) showDefault();
      });
    });
  }

  function applyMobileLayout() {
    fitDisplayMath();
    fitLectureNavGrid();
    requestAnimationFrame(fitLectureNavGrid);
  }

  function scheduleApply() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(applyMobileLayout, 100);
  }

  function init() {
    fixPunctuationAfterInlineMath();
    initLectureNavPreview();
    applyMobileLayout();
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(init);
  } else {
    window.addEventListener("load", init);
  }
  window.addEventListener("resize", scheduleApply);
})();
