/* ============================================================
   notes.js  —  Research Notes page
   - Loads data/notes-index.json
   - Renders note cards with search + category filter
   - Opens note in modal, fetching .md file, rendering with
     marked.js (Markdown) + KaTeX (math) + highlight.js (code)
   ============================================================ */

(function () {
  const INDEX_URL  = '../data/notes-index.json';
  const NOTES_DIR  = '../data/notes/';

  const LIST_EL    = document.getElementById('notes-list');
  const FILTER_EL  = document.getElementById('cat-filters');
  const SIDEBAR_CATS = document.getElementById('sidebar-cats');
  const SIDEBAR_RECENT = document.getElementById('sidebar-recent');
  const SEARCH_EL  = document.getElementById('notes-search');
  const MODAL      = document.getElementById('note-modal');
  const MODAL_BODY = document.getElementById('modal-body');
  const MODAL_CLOSE = document.getElementById('modal-close');
  const MODAL_OVERLAY = document.getElementById('modal-overlay');

  let allNotes    = [];
  let activeCategory = 'all';
  let searchQuery    = '';

  // ── Configure marked ──────────────────────────────────────
  if (typeof marked !== 'undefined') {
    marked.setOptions({
      gfm: true,
      breaks: false,
      headerIds: true,
    });
  }

  // ── Load data ─────────────────────────────────────────────
  async function init() {
    try {
      const res  = await fetch(INDEX_URL);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      allNotes   = data.notes || [];

      renderCategoryFilters(data.categories || {});
      renderSidebarCats(data.categories || {});
      renderSidebarRecent(allNotes);
      renderList();
    } catch (e) {
      console.error('notes.js:', e);
      LIST_EL.innerHTML = `
        <div style="padding:3rem 0; color:var(--text-muted); font-family:var(--font-mono); font-size:.8rem;">
          Notes index not found. Run <code>python scripts/build_notes.py</code> to generate it.
        </div>`;
    }
  }

  // ── Category filter buttons ────────────────────────────────
  function renderCategoryFilters(categories) {
    if (!FILTER_EL) return;
    const catHtml = Object.entries(categories).map(([slug, meta]) =>
      `<button class="cat-btn" data-cat="${slug}">${meta.label} <span style="opacity:.5;">(${meta.count})</span></button>`
    ).join('');
    FILTER_EL.innerHTML = `<button class="cat-btn active" data-cat="all">All</button>` + catHtml;

    FILTER_EL.querySelectorAll('.cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        FILTER_EL.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = btn.dataset.cat;
        renderList();
      });
    });
  }

  // ── Sidebar categories ─────────────────────────────────────
  function renderSidebarCats(categories) {
    if (!SIDEBAR_CATS) return;
    SIDEBAR_CATS.innerHTML = Object.entries(categories).map(([slug, meta]) => `
      <div class="sidebar-cat-item" data-cat="${slug}">
        <span>${meta.label}</span>
        <span>${meta.count}</span>
      </div>`).join('');

    SIDEBAR_CATS.querySelectorAll('.sidebar-cat-item').forEach(item => {
      item.addEventListener('click', () => {
        activeCategory = item.dataset.cat;
        if (FILTER_EL) {
          FILTER_EL.querySelectorAll('.cat-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.cat === activeCategory);
          });
        }
        renderList();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  // ── Sidebar recent ─────────────────────────────────────────
  function renderSidebarRecent(notes) {
    if (!SIDEBAR_RECENT) return;
    const recent = [...notes].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);
    const html = recent.map(n => `
      <div class="sidebar-recent-item" data-note-id="${n.id}" style="
        padding:.6rem 0; border-bottom:1px solid var(--border-subtle);
        cursor:pointer; transition:color .15s;">
        <div style="font-size:.78rem;color:var(--text-secondary);line-height:1.4;
          font-family:var(--font-serif);">${n.title}</div>
        <div style="font-family:var(--font-mono);font-size:.62rem;color:var(--text-muted);
          margin-top:.25rem;">${formatDate(n.date)}</div>
      </div>`).join('');
    SIDEBAR_RECENT.innerHTML = `
      <span class="label" style="display:block;margin-bottom:1rem;">Recent</span>
      ${html}`;

    SIDEBAR_RECENT.querySelectorAll('.sidebar-recent-item').forEach(item => {
      item.addEventListener('mouseenter', () => item.style.color = 'var(--text-accent)');
      item.addEventListener('mouseleave', () => item.style.color = '');
      item.addEventListener('click', () => {
        const note = allNotes.find(n => n.id === item.dataset.noteId);
        if (note) openModal(note);
      });
    });
  }

  // ── Filter + search ────────────────────────────────────────
  function getFiltered() {
    return allNotes.filter(note => {
      const matchCat = activeCategory === 'all' || note.category === activeCategory;
      const q = searchQuery.toLowerCase();
      const matchSearch = !q ||
        note.title.toLowerCase().includes(q) ||
        (note.excerpt || '').toLowerCase().includes(q) ||
        (note.tags || []).some(t => t.toLowerCase().includes(q));
      return matchCat && matchSearch;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  // ── Render note card ───────────────────────────────────────
  function renderCard(note, index) {
    const tags = (note.tags || []).slice(0, 4).map(t =>
      `<span class="tag">${t}</span>`).join('');
    const catLabel = note.category.replace(/-/g, ' ');

    return `
      <div class="note-card reveal" data-note-id="${note.id}"
           style="transition-delay:${Math.min(index * 0.05, 0.3)}s">
        <div class="note-card-inner">
          <div class="note-date-col">
            <span class="note-date">${formatDate(note.date)}</span>
            ${note.reading_time ? `<span style="font-family:var(--font-mono);font-size:.62rem;color:var(--text-muted);margin-top:.2rem;">${note.reading_time} min</span>` : ''}
          </div>
          <div class="note-body">
            <div class="note-cat">${catLabel}</div>
            <div class="note-title">${note.title}</div>
            <p class="note-excerpt">${note.excerpt || ''}</p>
            <div class="note-tags">${tags}</div>
          </div>
        </div>
      </div>`;
  }

  // ── Render note list ───────────────────────────────────────
  function renderList() {
    const notes = getFiltered();
    if (!notes.length) {
      LIST_EL.innerHTML = `<p style="color:var(--text-muted);font-size:.85rem;padding:2rem 0;font-style:italic;">No notes match this filter.</p>`;
      return;
    }
    LIST_EL.innerHTML = notes.map((n, i) => renderCard(n, i)).join('');

    // Reveal observer
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.08 });
    LIST_EL.querySelectorAll('.reveal').forEach(el => obs.observe(el));

    // Click to open modal
    LIST_EL.querySelectorAll('.note-card').forEach(card => {
      card.addEventListener('click', () => {
        const note = allNotes.find(n => n.id === card.dataset.noteId);
        if (note) openModal(note);
      });
    });
  }

  // ── Modal ──────────────────────────────────────────────────
  async function openModal(note) {
    MODAL.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    MODAL_BODY.innerHTML = `
      <div class="note-prose">
        <h1>${note.title}</h1>
        <div class="note-prose-meta">
          <span class="tag tag-accent">${(note.category || '').replace(/-/g,' ')}</span>
          <span style="font-family:var(--font-mono);font-size:.7rem;color:var(--text-muted);">${formatDate(note.date)}</span>
          ${note.reading_time ? `<span style="font-family:var(--font-mono);font-size:.7rem;color:var(--text-muted);">${note.reading_time} min read</span>` : ''}
        </div>
        <div class="loading-dots" style="padding:2rem 0;"><span></span><span></span><span></span></div>
      </div>`;

    try {
      const res = await fetch(NOTES_DIR + note.filename);
      if (!res.ok) throw new Error('Not found');
      let raw = await res.text();

      // Strip YAML front matter
      raw = raw.replace(/^---[\s\S]*?---\n/, '');

      // Parse markdown
      const html = typeof marked !== 'undefined'
        ? marked.parse(raw)
        : raw.replace(/\n/g, '<br>');

      MODAL_BODY.innerHTML = `
        <div class="note-prose">
          <h1>${note.title}</h1>
          <div class="note-prose-meta">
            <span class="tag tag-accent">${(note.category || '').replace(/-/g,' ')}</span>
            <span style="font-family:var(--font-mono);font-size:.7rem;color:var(--text-muted);">${formatDate(note.date)}</span>
            ${note.reading_time ? `<span style="font-family:var(--font-mono);font-size:.7rem;color:var(--text-muted);">${note.reading_time} min read</span>` : ''}
            <div class="note-tags" style="flex-wrap:wrap;display:flex;gap:.4rem;">
              ${(note.tags||[]).map(t=>`<span class="tag">${t}</span>`).join('')}
            </div>
          </div>
          ${html}
        </div>`;

      // Syntax highlighting
      if (typeof hljs !== 'undefined') {
        MODAL_BODY.querySelectorAll('pre code').forEach(el => {
          hljs.highlightElement(el);
        });
      }

      // Re-render KaTeX
      if (typeof renderMathInElement !== 'undefined') {
        renderMathInElement(MODAL_BODY, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$',  right: '$',  display: false },
          ],
          throwOnError: false,
        });
      }

    } catch (e) {
      MODAL_BODY.innerHTML = `
        <div class="note-prose">
          <h1>${note.title}</h1>
          <p style="color:var(--text-muted);padding:2rem 0;">
            Note file not found: <code>${note.filename}</code>.<br>
            Add the markdown file to <code>data/notes/</code> and rebuild.
          </p>
        </div>`;
    }

    // Scroll to top of modal
    MODAL.querySelector('.note-modal-panel').scrollTop = 0;
  }

  function closeModal() {
    MODAL.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  MODAL_CLOSE.addEventListener('click', closeModal);
  MODAL_OVERLAY.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  // ── Search ────────────────────────────────────────────────
  if (SEARCH_EL) {
    SEARCH_EL.addEventListener('input', () => {
      searchQuery = SEARCH_EL.value.trim();
      renderList();
    });
  }

  // ── Helpers ───────────────────────────────────────────────
  function formatDate(str) {
    if (!str) return '';
    const d = new Date(str);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ── Init ──────────────────────────────────────────────────
  init();
})();
