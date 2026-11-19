/* ============================================================
   projects.js  —  Fetches GitHub repos for the Projects page
   ============================================================ */

(function () {
  const GITHUB_USER = 'anaghvenneti';
  const GRID_EL     = document.getElementById('repo-grid');
  const STATUS_EL   = document.getElementById('repo-status');

  // Language → colour mapping
  const LANG_COLORS = {
    'Python':              '#3572A5',
    'Jupyter Notebook':    '#DA5B0B',
    'Fortran':             '#4d41b1',
    'Shell':               '#89e051',
    'JavaScript':          '#f1e05a',
    'HTML':                '#e34c26',
    'CSS':                 '#563d7c',
  };

  function langClass(lang) {
    return lang ? 'lang-' + lang.toLowerCase().replace(/\s+/g, '') : 'lang-default';
  }
  function langColor(lang) {
    return LANG_COLORS[lang] || '#5a5856';
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const now  = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = Math.floor((now - then) / 1000);
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    const days = Math.floor(diff/86400);
    if (days < 30)    return `${days}d ago`;
    if (days < 365)   return `${Math.floor(days/30)}mo ago`;
    return `${Math.floor(days/365)}y ago`;
  }

  function renderRepo(repo, index) {
    const langDot = repo.language
      ? `<span class="repo-lang-dot" style="background:${langColor(repo.language)};"></span>
         <span>${repo.language}</span>`
      : '';

    return `
      <a class="repo-card reveal" style="animation-delay:${Math.min(index*0.06, 0.4)}s"
         href="${repo.html_url}" target="_blank" rel="noopener">
        <div class="repo-card-top">
          <span class="repo-name">${repo.name}</span>
          <div class="repo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </div>
        </div>
        <div class="repo-desc">${repo.description || 'No description provided.'}</div>
        <div class="repo-meta">
          <span class="repo-lang">${langDot}</span>
          ${repo.stargazers_count > 0 ? `
            <span class="repo-stars">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:12px;height:12px;">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              ${repo.stargazers_count}
            </span>` : ''}
          <span class="repo-updated">${timeAgo(repo.pushed_at)}</span>
        </div>
      </a>`;
  }

  async function fetchRepos() {
    try {
      const url = `https://api.github.com/users/${GITHUB_USER}/repos?sort=pushed&per_page=12&type=public`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      });

      if (res.status === 403) {
        // Rate-limited
        throw new Error('rate_limit');
      }
      if (!res.ok) throw new Error(res.status);

      const repos = await res.json();
      const filtered = repos
        .filter(r => !r.fork)
        .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));

      if (!filtered.length) {
        GRID_EL.innerHTML = `<p style="color:var(--text-muted);font-size:.85rem;grid-column:1/-1;">No public repositories found.</p>`;
        if (STATUS_EL) STATUS_EL.textContent = '';
        return;
      }

      GRID_EL.innerHTML = filtered.map((r, i) => renderRepo(r, i)).join('');
      if (STATUS_EL) STATUS_EL.textContent = `${filtered.length} repositories · updated live`;

      // Reveal animation
      const obs = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
        });
      }, { threshold: 0.08 });
      GRID_EL.querySelectorAll('.reveal').forEach(el => obs.observe(el));

    } catch (err) {
      const isRateLimit = err.message === 'rate_limit';
      GRID_EL.innerHTML = `
        <div style="grid-column:1/-1; padding:2rem; text-align:center;">
          <p style="font-family:var(--font-mono);font-size:.78rem;color:var(--text-muted);">
            ${isRateLimit
              ? 'GitHub API rate limit reached. Repository list will appear after a few minutes, or visit GitHub directly.'
              : 'Could not load repositories from GitHub API.'}
          </p>
          <a class="btn" href="https://github.com/${GITHUB_USER}" target="_blank" rel="noopener"
             style="margin-top:1.25rem; display:inline-flex;">
            View on GitHub ↗
          </a>
        </div>`;
      if (STATUS_EL) STATUS_EL.textContent = '';
    }
  }

  if (GRID_EL) fetchRepos();
})();
