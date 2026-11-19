(() => {
  const slug = new URLSearchParams(location.search).get('slug');
  const title = document.getElementById('post-title');
  if (!slug) { title.textContent = 'Post not found'; return; }
  fetch('../data/blog-index.json').then(r => r.json()).then(posts => {
    const post = posts.find(p => p.slug === slug);
    if (!post) throw new Error('Post not found');
    document.title = `${post.title} — Anagh Venneti`;
    title.textContent = post.title;
    document.getElementById('post-category').textContent = post.category || 'Blog';
    document.getElementById('post-meta').textContent = post.date || '';
    const html = window.marked.parse(post.content || '');
    document.getElementById('post-body').innerHTML = window.DOMPurify.sanitize(html);
  }).catch(() => { title.textContent = 'Post not found'; document.getElementById('post-body').textContent = 'This post may have been moved or is not published.'; });
})();
