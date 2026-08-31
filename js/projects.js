// Projects page: show one case study at a time with prev/next navigation.
// Without JavaScript the page falls back to all case studies stacked.
(function () {
  'use strict';

  var carousel = document.getElementById('project-carousel');
  if (!carousel) return;

  var sections = Array.prototype.slice.call(carousel.querySelectorAll('.service'));
  if (sections.length < 2) return;

  var chips = Array.prototype.slice.call(document.querySelectorAll('.service-chips a'));
  var current = 0;

  function indexOfId(id) {
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].id === id) return i;
    }
    return -1;
  }

  function titleOf(i) {
    var h = sections[i].querySelector('h2');
    return h ? h.textContent : '';
  }

  function buildNav(extraClass) {
    var nav = document.createElement('div');
    nav.className = 'project-nav' + (extraClass ? ' ' + extraClass : '');
    nav.innerHTML =
      '<button type="button" class="pn-btn pn-prev" aria-label="Previous project">&larr;</button>' +
      '<div class="pn-info"><span class="pn-count"></span><span class="pn-title"></span></div>' +
      '<button type="button" class="pn-btn pn-next" aria-label="Next project">&rarr;</button>';
    nav.querySelector('.pn-prev').addEventListener('click', function () { go(current - 1, true); });
    nav.querySelector('.pn-next').addEventListener('click', function () { go(current + 1, true); });
    return nav;
  }

  var topNav = buildNav('pn-top');
  var bottomNav = buildNav('pn-bottom');
  topNav.querySelector('.pn-info').setAttribute('aria-live', 'polite');
  carousel.parentNode.insertBefore(topNav, carousel);
  carousel.parentNode.insertBefore(bottomNav, carousel.nextSibling);
  carousel.classList.add('is-carousel');

  function render() {
    sections.forEach(function (s, i) {
      s.classList.toggle('is-active', i === current);
    });
    chips.forEach(function (c) {
      var active = (c.getAttribute('href') || '').replace('#', '') === sections[current].id;
      c.classList.toggle('is-active', active);
      if (active) c.setAttribute('aria-current', 'true');
      else c.removeAttribute('aria-current');
    });
    [topNav, bottomNav].forEach(function (nav) {
      nav.querySelector('.pn-count').textContent = 'Project ' + (current + 1) + ' of ' + sections.length;
      nav.querySelector('.pn-title').textContent = titleOf(current);
    });
  }

  function go(i, scroll) {
    current = (i + sections.length) % sections.length;
    render();
    if (history.replaceState) {
      history.replaceState(null, '', '#' + sections[current].id);
    }
    if (scroll) {
      topNav.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Deep links (/projects#intake-crm) and chip clicks both arrive via the hash.
  function showFromHash(scroll) {
    var idx = indexOfId(location.hash.replace('#', ''));
    if (idx !== -1) go(idx, scroll);
  }

  window.addEventListener('hashchange', function () { showFromHash(true); });

  // Left/right arrow keys navigate, unless the user is typing in a field.
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (e.key === 'ArrowLeft') go(current - 1, false);
    if (e.key === 'ArrowRight') go(current + 1, false);
  });

  render();
  showFromHash(false);
})();
