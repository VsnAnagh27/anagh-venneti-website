/* ============================================================
   home.js  —  Homepage dynamic content (featured pubs + metrics)
   ============================================================ */

(function () {
  const DATA_URL     = 'data/publications.json';
  const FEATURED_EL  = document.getElementById('featured-pubs');
  const METRICS_EL   = document.getElementById('home-metrics');

  async function loadData() {
    try {
      const res  = await fetch(DATA_URL);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();

      renderFeatured(data.publications || []);
      renderMetrics(data.metrics);
    } catch (e) {
      console.warn('home.js: could not load publications.json', e);
      if (FEATURED_EL) FEATURED_EL.innerHTML =
        `<p style="color:var(--text-muted);font-size:.85rem;padding:1rem 0;">Publications loading…</p>`;
    }
  }

  function renderFeatured(pubs) {
    if (!FEATURED_EL) return;
    const featured = pubs.filter(p => p.featured).slice(0, 3);
    if (!featured.length) {
      FEATURED_EL.innerHTML = `<p style="color:var(--text-muted);font-size:.85rem;">No featured publications yet.</p>`;
      return;
    }

    const html = featured.map(pub => {
      const authorStr = (pub.authors || []).map(a =>
        /venneti/i.test(a) ? `<strong style="color:var(--text-primary)">${a}</strong>` : a
      ).join(', ');

      const link = pub.arxiv_id
        ? `https://arxiv.org/abs/${pub.arxiv_id}`
        : pub.doi ? `https://doi.org/${pub.doi}` : '#';

      return `
        <a href="${link}" target="_blank" rel="noopener" class="featured-pub-card reveal">
          <div>
            <div class="fp-journal">${pub.journal || ''}${pub.year ? ' · ' + pub.year : ''}</div>
            <div class="fp-title">${pub.title}</div>
            <div class="fp-authors">${authorStr}</div>
          </div>
          <div class="fp-side">
            <span class="fp-year">${pub.year || ''}</span>
            ${pub.citations > 0 ? `<span class="fp-cites">${pub.citations} cites</span>` : ''}
            ${pub.first_author ? `<span class="tag tag-accent" style="font-size:.62rem;">First Author</span>` : ''}
          </div>
        </a>`;
    }).join('');

    FEATURED_EL.innerHTML = html;

    // Reveal animation
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.1 });
    FEATURED_EL.querySelectorAll('.reveal').forEach(el => obs.observe(el));
  }

  function renderMetrics(m) {
    if (!METRICS_EL || !m) return;
    METRICS_EL.innerHTML = `
      <div class="home-metric-grid">
        <div class="hm-item">
          <span class="hm-val">${m.total_papers || 0}</span>
          <span class="hm-lbl">Papers</span>
        </div>
        <div class="hm-item">
          <span class="hm-val">${m.total_citations || 0}</span>
          <span class="hm-lbl">Citations</span>
        </div>
        <div class="hm-item">
          <span class="hm-val">${m.h_index || 0}</span>
          <span class="hm-lbl">h-index</span>
        </div>
        <div class="hm-item">
          <span class="hm-val">${m.first_author_papers || 0}</span>
          <span class="hm-lbl">First Author</span>
        </div>
      </div>`;
  }

  loadData();
})();
