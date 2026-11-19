/* Document access register. Visitors voluntarily provide their name before a document opens. */
(() => {
  const API = window.DOCUMENT_ACCESS_API || '/api/document-access';
  let pending = null;
  const overlay = document.createElement('div');
  overlay.id = 'document-access-dialog';
  overlay.hidden = true;
  overlay.innerHTML = `<div class="da-backdrop"></div><section class="da-panel" role="dialog" aria-modal="true" aria-labelledby="da-title"><button class="da-close" type="button" aria-label="Close">×</button><span class="label">Document access</span><h2 id="da-title">Before opening this document</h2><p>Please enter your name if you would like your access to be recorded. The name and access time will be stored for the site owner. You may continue without recording your name.</p><form id="da-form"><label for="da-name">Name</label><input id="da-name" name="name" maxlength="100" autocomplete="name" placeholder="Your name" required/><div class="da-actions"><button type="submit" class="btn btn-primary">Continue and record</button><button type="button" id="da-anon" class="btn">Continue without recording</button></div><p id="da-status" aria-live="polite"></p></form></section>`;
  const style = document.createElement('style');
  style.textContent = `#document-access-dialog[hidden]{display:none}#document-access-dialog{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:1rem;font-family:var(--font-sans,Arial)}.da-backdrop{position:absolute;inset:0;background:#0009}.da-panel{position:relative;width:min(100%,480px);background:var(--bg-primary,#fff);color:var(--text-primary,#222);border:1px solid var(--border-subtle,#ddd);padding:2rem;box-shadow:0 20px 70px #0004}.da-panel h2{font:1.35rem var(--font-serif,Georgia);margin:.8rem 0}.da-panel p{font-size:.88rem;line-height:1.6;color:var(--text-secondary,#555)}.da-panel label{display:block;font-size:.75rem;margin:1rem 0 .4rem}.da-panel input{width:100%;padding:.8rem;border:1px solid var(--border-subtle,#bbb);background:transparent;color:inherit;font:inherit}.da-actions{display:flex;flex-wrap:wrap;gap:.7rem;margin-top:1rem}.da-close{position:absolute;right:1rem;top:.8rem;border:0;background:none;font-size:1.5rem;cursor:pointer;color:inherit}#da-status{min-height:1.2em;margin-bottom:0}`;
  document.head.append(style); document.body.append(overlay);
  const form=overlay.querySelector('#da-form'), nameInput=overlay.querySelector('#da-name'), status=overlay.querySelector('#da-status');
  function close(){overlay.hidden=true;pending=null;}
  function open(url,doc){pending={url,doc};status.textContent='';nameInput.value='';overlay.hidden=false;nameInput.focus();}
  function go(){if(pending){const url=pending.url;close();window.open(url,'_blank','noopener');}}
  overlay.querySelector('.da-close').addEventListener('click',close);
  overlay.querySelector('.da-backdrop').addEventListener('click',close);
  overlay.querySelector('#da-anon').addEventListener('click',go);
  form.addEventListener('submit',async e=>{e.preventDefault();if(!pending)return;const name=nameInput.value.trim();if(!name){status.textContent='Please enter a name or continue without recording.';return;}
    const record={name,document:pending.doc,accessed_at:new Date().toISOString(),page:location.pathname};
    const popup=window.open('about:blank','_blank');
    try{const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(record)});if(!response.ok)throw new Error('The register could not be reached.');status.textContent='Access recorded.';const url=pending.url;close();if(popup)popup.location=url;else window.location.href=url;}
    catch(err){if(popup)popup.close();status.textContent='Could not record this visit. You can still continue without recording.';const anon=overlay.querySelector('#da-anon');anon.textContent='Continue without recording';}
  });
  document.addEventListener('click',e=>{const a=e.target.closest('a[data-doc-access]');if(!a)return;e.preventDefault();open(a.dataset.docUrl||a.href,a.dataset.docAccess);});
})();
