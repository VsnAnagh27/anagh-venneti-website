/* ============================================================
   dashboard.js  —  Research analytics dashboard
   Reads data/publications.json and renders Chart.js charts,
   metric cards, publication timeline, and journal table.
   ============================================================ */

(function () {
  const DATA_URL = '../data/publications.json';

  // ── Chart.js global defaults ─────────────────────────────
  Chart.defaults.color         = '#5a5856';
  Chart.defaults.borderColor   = 'rgba(255,255,255,0.05)';
  Chart.defaults.font.family   = "'JetBrains Mono', monospace";
  Chart.defaults.font.size     = 11;
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  Chart.defaults.plugins.legend.labels.padding  = 16;
  Chart.defaults.plugins.tooltip.backgroundColor = '#17171c';
  Chart.defaults.plugins.tooltip.borderColor     = 'rgba(255,255,255,0.09)';
  Chart.defaults.plugins.tooltip.borderWidth     = 1;
  Chart.defaults.plugins.tooltip.padding         = 10;
  Chart.defaults.plugins.tooltip.titleColor      = '#e8e6e0';
  Chart.defaults.plugins.tooltip.bodyColor       = '#9a9893';

  const ACCENT   = '#c4a97d';
  const ACCENT2  = '#7eb8c9';
  const MUTED    = '#5a5856';
  const SURFACE  = '#111114';

  const TOPIC_COLORS = [
    '#c4a97d', '#7eb8c9', '#a89070', '#6a9fb0',
    '#b89060', '#5a8fa0', '#d4b98d', '#8ec8d9',
    '#987850', '#4a7f90',
  ];

  // ── Load data ────────────────────────────────────────────
  async function init() {
    try {
      const res  = await fetch(DATA_URL);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      const pubs = data.publications || [];

      renderUpdated(data.last_updated);
      renderMetrics(data, pubs);
      renderPubsPerYear(pubs);
      renderJournalChart(pubs);
      renderTopics(pubs);
      renderAuthorship(pubs);
      renderTimeline(pubs);
      renderJournalTable(pubs);
    } catch (e) {
      console.error('dashboard.js load error:', e);
      document.getElementById('metric-cards').innerHTML =
        `<p style="color:var(--text-muted);font-family:var(--font-mono);font-size:.75rem;padding:2rem;">
          Could not load publications.json. Run the fetch script or check the data file.</p>`;
    }
  }

  // ── Updated date ─────────────────────────────────────────
  function renderUpdated(ts) {
    const el = document.getElementById('last-updated-date');
    if (!el || !ts) return;
    const d = new Date(ts);
    el.textContent = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ── Metric cards ─────────────────────────────────────────
  function renderMetrics(data, pubs) {
    const el = document.getElementById('metric-cards');
    if (!el) return;

    const m = data.metrics || {};
    const totalPapers = pubs.length;
    const firstAuthor = pubs.filter(p => p.first_author).length;
    const totalCites  = typeof m.total_citations === 'number' ? m.total_citations : '—';
    const hIndex      = typeof m.h_index === 'number' ? m.h_index : '—';
    const i10Index    = typeof m.i10_index === 'number' ? m.i10_index : '—';
    // Unique journals
    const journals = new Set(pubs.map(p => p.journal).filter(Boolean));
    const years    = pubs.map(p => p.year).filter(Boolean);
    const span     = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : '—';

    const cards = [
      { val: totalPapers, lbl: 'Total Papers',        sub: `${span}`, accent: ACCENT  },
      { val: firstAuthor, lbl: 'First Author',         sub: `${Math.round(firstAuthor/totalPapers*100)||0}% of output`, accent: ACCENT },
      { val: totalCites,  lbl: 'Total Citations',      sub: m.note ? 'Scholar' : 'Google Scholar', accent: ACCENT2 },
      { val: hIndex,      lbl: 'h-index',              sub: 'impact metric', accent: ACCENT2 },
      { val: i10Index,    lbl: 'i10-index',            sub: '≥10 citations', accent: ACCENT2 },
      { val: journals.size, lbl: 'Journals',           sub: 'distinct venues', accent: MUTED },
    ];

    el.innerHTML = cards.map(c => `
      <div class="metric-card" style="--card-accent:${c.accent}">
        <div class="mc-val">${c.val}</div>
        <div class="mc-lbl">${c.lbl}</div>
        <div class="mc-sub">${c.sub}</div>
      </div>`).join('');
  }

  // ── Publications per year (bar) ───────────────────────────
  function renderPubsPerYear(pubs) {
    const yearCounts = {};
    pubs.forEach(p => { if (p.year) yearCounts[p.year] = (yearCounts[p.year] || 0) + 1; });
    const years  = Object.keys(yearCounts).sort();
    const counts = years.map(y => yearCounts[y]);

    const ctx = document.getElementById('chart-pubs-year');
    if (!ctx) return;

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: years,
        datasets: [{
          label: 'Publications',
          data: counts,
          backgroundColor: years.map(() => 'rgba(196,169,125,0.25)'),
          borderColor: ACCENT,
          borderWidth: 1,
          borderRadius: 2,
          hoverBackgroundColor: 'rgba(196,169,125,0.4)',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, color: MUTED },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
          x: { ticks: { color: MUTED }, grid: { display: false } }
        }
      }
    });
  }

  // ── Publications by journal (horizontal bar) ──────────────
  function renderJournalChart(pubs) {
    const jCounts = {};
    pubs.forEach(p => {
      const j = p.journal || 'Unknown';
      jCounts[j] = (jCounts[j] || 0) + 1;
    });
    const sorted = Object.entries(jCounts).sort((a,b) => b[1]-a[1]);
    const labels = sorted.map(([j]) => j.replace('Physical Review', 'Phys. Rev.')
                                         .replace('Nuclear Physics', 'Nucl. Phys.')
                                         .replace('Astrophysical Journal', 'ApJ')
                                         .replace('Monthly Notices of the Royal Astronomical Society', 'MNRAS')
                                         .replace('Journal of Cosmology and Astroparticle Physics', 'JCAP'));
    const counts = sorted.map(([,c]) => c);

    const ctx = document.getElementById('chart-journals');
    if (!ctx) return;

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Papers',
          data: counts,
          backgroundColor: 'rgba(126,184,201,0.2)',
          borderColor: ACCENT2,
          borderWidth: 1,
          borderRadius: 2,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { stepSize: 1, color: MUTED },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
          y: {
            ticks: { color: '#9a9893', font: { size: 10 } },
            grid: { display: false }
          }
        }
      }
    });
  }

  // ── Topic distribution (donut) ────────────────────────────
  function renderTopics(pubs) {
    const topicCounts = {};
    pubs.forEach(p => {
      (p.topics || []).forEach(t => {
        topicCounts[t] = (topicCounts[t] || 0) + 1;
      });
    });
    const sorted = Object.entries(topicCounts).sort((a,b) => b[1]-a[1]).slice(0, 8);
    const labels = sorted.map(([t]) => t);
    const counts = sorted.map(([,c]) => c);

    const ctx = document.getElementById('chart-topics');
    if (!ctx) return;

    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: counts,
          backgroundColor: TOPIC_COLORS.map(c => c + '40'),
          borderColor: TOPIC_COLORS,
          borderWidth: 1,
          hoverOffset: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'right',
            labels: { boxWidth: 8, padding: 12, font: { size: 10 } }
          }
        }
      }
    });
  }

  // ── Authorship split (donut) ──────────────────────────────
  function renderAuthorship(pubs) {
    const first = pubs.filter(p => p.first_author).length;
    const coaut = pubs.length - first;

    const ctx = document.getElementById('chart-authorship');
    if (!ctx) return;

    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['First Author', 'Co-author'],
        datasets: [{
          data: [first, coaut],
          backgroundColor: [ACCENT + '40', ACCENT2 + '30'],
          borderColor: [ACCENT, ACCENT2],
          borderWidth: 1,
          hoverOffset: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 8, padding: 16 }
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.raw} paper${ctx.raw !== 1 ? 's' : ''}`
            }
          }
        }
      }
    });
  }

  // ── Publication timeline ──────────────────────────────────
  function renderTimeline(pubs) {
    const el = document.getElementById('pub-timeline');
    if (!el) return;

    const byYear = {};
    pubs.forEach(p => {
      const yr = p.year || 'In Press';
      if (!byYear[yr]) byYear[yr] = [];
      byYear[yr].push(p);
    });

    let html = '';
    Object.keys(byYear).sort((a,b) => b - a).forEach(yr => {
      const items = byYear[yr].map(pub => {
        const authorStr = (pub.authors || []).map(a =>
          /venneti/i.test(a) ? `<strong style="color:var(--text-primary)">${a}</strong>` : a
        ).join(', ');
        const doi_link = pub.doi
          ? `<a class="ti-doi-link" href="https://doi.org/${pub.doi}" target="_blank" rel="noopener">DOI ↗</a>`
          : '';
        return `
          <div class="timeline-item ${pub.first_author ? 'first-author' : ''} reveal">
            <div class="ti-body">
              <div class="ti-journal">${pub.journal || ''}</div>
              <div class="ti-title">${pub.title}</div>
              <div class="ti-authors">${authorStr}</div>
            </div>
            <div class="ti-meta">
              ${pub.first_author ? '<span class="tag tag-accent" style="font-size:.6rem;">First Author</span>' : ''}
              ${doi_link}
            </div>
          </div>`;
      }).join('');

      html += `
        <div class="timeline-year-section">
          <div class="timeline-year-label"><span>${yr}</span></div>
          <div class="timeline-items">${items}</div>
        </div>`;
    });

    el.innerHTML = html;

    // Reveal
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.08 });
    el.querySelectorAll('.reveal').forEach(el => obs.observe(el));
  }

  // ── Journal summary table ─────────────────────────────────
  function renderJournalTable(pubs) {
    const el = document.getElementById('journal-table');
    if (!el) return;

    const jData = {};
    pubs.forEach(p => {
      const j = p.journal || 'Unknown';
      if (!jData[j]) jData[j] = { count: 0, firstAuthor: 0 };
      jData[j].count++;
      if (p.first_author) jData[j].firstAuthor++;
    });

    const sorted = Object.entries(jData).sort((a,b) => b[1].count - a[1].count);
    const maxCount = sorted[0]?.[1].count || 1;

    const header = `
      <div class="jt-row jt-header">
        <span>Journal</span>
        <span style="text-align:center">Papers</span>
        <span>Volume</span>
      </div>`;

    const rows = sorted.map(([journal, d]) => {
      const pct = (d.count / maxCount) * 100;
      return `
        <div class="jt-row reveal">
          <div class="jt-name">${journal}</div>
          <div class="jt-count">${d.count}</div>
          <div class="jt-bar-cell">
            <div class="jt-bar" style="width:${pct}%; max-width:120px;"></div>
            <span style="font-family:var(--font-mono);font-size:.65rem;color:var(--text-muted);">${d.firstAuthor > 0 ? d.firstAuthor + ' FA' : ''}</span>
          </div>
        </div>`;
    }).join('');

    el.innerHTML = header + rows;

    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.1 });
    el.querySelectorAll('.reveal').forEach(el => obs.observe(el));
  }

  // ── Init ─────────────────────────────────────────────────
  init();
})();
