/* ============================================================
   publications.js  —  Dynamic publication list renderer
   ============================================================ */

(function () {
  const DATA_URL = '../data/publications.json';
  const PUB_LIST  = document.getElementById('pub-list');
  const PUB_COUNT = document.getElementById('pub-count');
  const FILTER_BTNS = document.querySelectorAll('[data-filter]');
  const SORT_SELECT = document.getElementById('sort-select');
  const STATS_EL    = document.getElementById('pub-stats');

  let allPubs = [];
  let activeFilter = 'all';
  let activeSort   = 'year-desc';

  // ── Fetch data ───────────────────────────────────────────────
  async function loadData() {
    try {
      const res  = await fetch(DATA_URL);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      allPubs = data.publications || [];
      renderStats(data.metrics, data.last_updated);
      renderList();
    } catch (e) {
      console.error('Failed to load publications:', e);
      PUB_LIST.innerHTML = `
        <div style="padding:2rem; color:var(--text-muted); font-family:var(--font-mono); font-size:.8rem;">
          Unable to load publications.json — ensure the data file exists.
        </div>`;
    }
  }

  // ── Stats bar ────────────────────────────────────────────────
  function renderStats(m, updated) {
    if (!STATS_EL || !m) return;
    const date = updated ? new Date(updated).toLocaleDateString('en-US', { year:'numeric', month:'short' }) : '—';
    STATS_EL.innerHTML = `
      <div class="pub-metric"><span class="metric-val">${m.total_papers || 0}</span><span class="metric-lbl">Papers</span></div>
      <div class="pub-metric"><span class="metric-val">${m.first_author_papers || 0}</span><span class="metric-lbl">First Author</span></div>
      <div class="pub-metric"><span class="metric-val">${m.total_citations || 0}</span><span class="metric-lbl">Citations</span></div>
      <div class="pub-metric"><span class="metric-val">${m.h_index || 0}</span><span class="metric-lbl">h-index</span></div>
      <div class="pub-metric"><span class="metric-val">${m.i10_index || 0}</span><span class="metric-lbl">i10-index</span></div>
      <div class="pub-stat-note">Updated ${date}</div>
    `;
  }

  // ── Filter & Sort ────────────────────────────────────────────
  function getFiltered() {
    let pubs = [...allPubs];

    if (activeFilter === 'first-author') {
      pubs = pubs.filter(p => p.first_author);
    } else if (activeFilter !== 'all') {
      pubs = pubs.filter(p => (p.topics || []).includes(activeFilter));
    }

    pubs.sort((a, b) => {
      if (activeSort === 'year-desc') return (b.year || 0) - (a.year || 0);
      if (activeSort === 'year-asc')  return (a.year || 0) - (b.year || 0);
      if (activeSort === 'cited')     return (b.citations || 0) - (a.citations || 0);
      return 0;
    });

    return pubs;
  }

  // ── Render a single publication card ─────────────────────────
  function renderPub(pub, index) {
    const topicTags = (pub.topics || []).map(t =>
      `<span class="tag">${t}</span>`).join('');

    const links = [];
    if (pub.arxiv_id)
      links.push(`<a class="icon-link" href="https://arxiv.org/abs/${pub.arxiv_id}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
        arXiv</a>`);
    if (pub.doi)
      links.push(`<a class="icon-link" href="https://doi.org/${pub.doi}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>
        DOI</a>`);
    if (pub.ads_id)
      links.push(`<a class="icon-link" href="https://ui.adsabs.harvard.edu/abs/${pub.ads_id}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        ADS</a>`);

    const isFirst = pub.first_author;
    const citeBadge = pub.citations > 0
      ? `<span class="cite-badge">${pub.citations} cite${pub.citations !== 1 ? 's' : ''}</span>`
      : '';

    const authorList = (pub.authors || []).map((a, i) => {
      const isMe = /venneti/i.test(a);
      return isMe ? `<strong style="color:var(--text-primary)">${a}</strong>` : a;
    }).join(', ');

    return `
      <article class="pub-card reveal ${isFirst ? 'pub-first-author' : ''}"
               style="animation-delay:${Math.min(index * 0.06, 0.5)}s">
        ${isFirst ? '<div class="pub-first-badge">First Author</div>' : ''}
        <div class="pub-card-inner">
          <div class="pub-meta-top">
            <span class="pub-year">${pub.year || '—'}</span>
            <span class="pub-journal">${pub.journal || ''}</span>
            ${citeBadge}
          </div>
          <h3 class="pub-title">${pub.title}</h3>
          <p class="pub-authors">${authorList}</p>
          ${pub.abstract ? `<p class="pub-abstract">${pub.abstract}</p>` : ''}
          <div class="pub-footer">
            <div class="pub-tags">${topicTags}</div>
            <div class="pub-links">${links.join('')}</div>
          </div>
        </div>
      </article>`;
  }

  // ── Group publications by year ───────────────────────────────
  function renderList() {
    const pubs = getFiltered();
    if (PUB_COUNT) PUB_COUNT.textContent = pubs.length;

    if (!pubs.length) {
      PUB_LIST.innerHTML = `<p style="color:var(--text-muted); padding:2rem 0; font-style:italic;">No publications match this filter.</p>`;
      return;
    }

    // Group by year
    const byYear = {};
    pubs.forEach(p => {
      const yr = p.year || 'In Press';
      if (!byYear[yr]) byYear[yr] = [];
      byYear[yr].push(p);
    });

    let html = '';
    let globalIndex = 0;
    Object.keys(byYear).sort((a, b) => b - a).forEach(yr => {
      html += `<div class="pub-year-group">
        <div class="pub-year-marker"><span>${yr}</span></div>
        <div class="pub-year-list">`;
      byYear[yr].forEach(pub => {
        html += renderPub(pub, globalIndex++);
      });
      html += `</div></div>`;
    });

    PUB_LIST.innerHTML = html;

    // Re-observe new elements
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.08 });
    PUB_LIST.querySelectorAll('.reveal').forEach(el => obs.observe(el));
  }

  // ── Filter buttons ───────────────────────────────────────────
  FILTER_BTNS.forEach(btn => {
    btn.addEventListener('click', () => {
      FILTER_BTNS.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderList();
    });
  });

  // ── Sort select ──────────────────────────────────────────────
  if (SORT_SELECT) {
    SORT_SELECT.addEventListener('change', () => {
      activeSort = SORT_SELECT.value;
      renderList();
    });
  }

  // ── Init ─────────────────────────────────────────────────────
  loadData();
})();
