(function () {
  function initLectureNavbar() {
    var shell = document.querySelector(".lecture-navbar-shell");
    if (!shell) return;

    document.body.classList.add("lecture-page");

    var toggle = shell.querySelector(".lecture-navbar-toggle");
    var progress = shell.querySelector(".lecture-navbar-progress");
    var sectionItems = shell.querySelectorAll(".lecture-navbar-section-item");
    var markers = shell.querySelectorAll(".lecture-navbar-marker");
    var toggleLabel = shell.getAttribute("data-toggle-label") || "Show section navigation";
    var toggleLabelOpen = shell.getAttribute("data-toggle-label-open") || "Hide section navigation";
    var ticking = false;
    var timelineMetrics = null;
    var lastLayoutWidth = window.innerWidth;

    function sectionElements() {
      return Array.from(sectionItems)
        .map(function (item) {
          var slug = item.getAttribute("data-slug");
          if (!slug) return null;
          return document.getElementById(slug);
        })
        .filter(Boolean);
    }

    function sectionLinks() {
      return shell.querySelectorAll(".lecture-navbar-section");
    }

    function maxScrollY() {
      return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    }

    function documentOffset(el) {
      return el.getBoundingClientRect().top + window.pageYOffset;
    }

    function sectionScrollY(heading) {
      var margin = parseFloat(getComputedStyle(heading).scrollMarginTop);
      if (!Number.isFinite(margin)) margin = 0;
      return Math.max(0, documentOffset(heading) - margin);
    }

    function measureTimeline() {
      var headings = sectionElements();
      var rangeStart = 0;
      var span = Math.max(1, maxScrollY() - rangeStart);
      var markerProgress = headings.map(function (heading) {
        return Math.min(1, Math.max(0, sectionScrollY(heading) / span));
      });

      timelineMetrics = {
        rangeStart: rangeStart,
        span: span,
        markerProgress: markerProgress,
      };

      markers.forEach(function (marker, index) {
        marker.style.left = markerProgress[index] * 100 + "%";
      });
    }

    function scrollProgress() {
      if (!timelineMetrics) return 0;
      return Math.min(
        1,
        Math.max(0, (window.pageYOffset - timelineMetrics.rangeStart) / timelineMetrics.span),
      );
    }

    function setNavbarHeightVar() {
      var height = shell.classList.contains("is-open") ? shell.offsetHeight : 0;
      document.documentElement.style.setProperty("--lecture-navbar-height", height + "px");
    }

    function setActiveIndex(activeIndex) {
      sectionItems.forEach(function (item, index) {
        item.classList.toggle("is-active", index === activeIndex);
      });
      sectionLinks().forEach(function (link, index) {
        link.classList.toggle("is-active", index === activeIndex);
      });
      markers.forEach(function (marker, index) {
        marker.classList.toggle("is-active", index === activeIndex);
      });
    }

    function activeSectionIndex() {
      if (!timelineMetrics || timelineMetrics.markerProgress.length === 0) return -1;

      var progress = scrollProgress();
      var positions = timelineMetrics.markerProgress;

      for (var i = positions.length - 1; i >= 0; i--) {
        if (progress + 0.0005 < positions[i]) continue;
        if (i === positions.length - 1 || progress + 0.0005 < positions[i + 1]) return i;
      }
      return -1;
    }

    function updateActiveSection() {
      setActiveIndex(activeSectionIndex());
    }

    function updateProgressBar() {
      if (!progress) return;
      progress.style.width = scrollProgress() * 100 + "%";
    }

    function layoutUpdate() {
      setNavbarHeightVar();
      measureTimeline();
    }

    function scrollUpdate() {
      updateProgressBar();
      updateActiveSection();
    }

    function updateAll() {
      layoutUpdate();
      scrollUpdate();
    }

    function setOpen(open) {
      shell.classList.toggle("is-open", open);
      if (toggle) {
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.setAttribute("aria-label", open ? toggleLabelOpen : toggleLabel);
      }
      layoutUpdate();
      scrollUpdate();
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        scrollUpdate();
        ticking = false;
      });
    }

    function onResize() {
      if (window.innerWidth === lastLayoutWidth) return;
      lastLayoutWidth = window.innerWidth;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        updateAll();
        ticking = false;
      });
    }

    function onOrientationChange() {
      lastLayoutWidth = window.innerWidth;
      updateAll();
    }

    function scheduleNavUpdate() {
      layoutUpdate();
      scrollUpdate();
      requestAnimationFrame(function () {
        layoutUpdate();
        scrollUpdate();
      });
      window.setTimeout(function () {
        layoutUpdate();
        scrollUpdate();
      }, 120);
      window.setTimeout(function () {
        layoutUpdate();
        scrollUpdate();
      }, 400);
    }

    if (toggle) {
      toggle.addEventListener("click", function () {
        setOpen(!shell.classList.contains("is-open"));
      });
    }

    shell.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener("click", scheduleNavUpdate);
    });
    window.addEventListener("hashchange", scheduleNavUpdate);

    setOpen(shell.classList.contains("is-open"));
    updateAll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onOrientationChange);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLectureNavbar);
  } else {
    initLectureNavbar();
  }
})();
