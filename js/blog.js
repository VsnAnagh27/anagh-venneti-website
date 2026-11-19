(() => {
  const host = document.getElementById('blog-post-list');
  if (!host) return;
  fetch('../data/blog-index.json').then(r => { if (!r.ok) throw new Error('Blog index unavailable'); return r.json(); })
    .then(posts => {
      if (!posts.length) return;
      host.replaceChildren();
      posts.forEach(post => {
        const article = document.createElement('article');
        article.style.cssText = 'padding:1rem 0;border-bottom:1px solid var(--border-subtle)';
        const meta = document.createElement('p');
        meta.style.cssText = 'font: .68rem var(--font-mono);color:var(--text-muted);margin:0 0 .4rem';
        meta.textContent = [post.date, post.category].filter(Boolean).join(' · ');
        const title = document.createElement('h2');
        title.style.cssText = 'font:1.1rem var(--font-serif);margin:0 0 .35rem';
        const link = document.createElement('a'); link.href = `blog-post.html?slug=${encodeURIComponent(post.slug)}`; link.textContent = post.title; title.append(link);
        const summary = document.createElement('p'); summary.style.cssText = 'font-size:.88rem;color:var(--text-secondary);margin:0'; summary.textContent = post.summary || '';
        article.append(meta,title,summary); host.append(article);
      });
    }).catch(() => {});
})();
