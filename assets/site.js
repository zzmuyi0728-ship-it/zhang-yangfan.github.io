const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const escapeHTML = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const isSafeImagePath = (url = '') => /^(assets\/images\/|https?:\/\/)/.test(url);

const formatDate = (iso) => {
  if (!iso) return '';
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
};

const renderTags = (tags = []) => tags.map(tag => `<span class="tag">${escapeHTML(tag)}</span>`).join('');

const inline = (text) => escapeHTML(text)
  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.*?)\*/g, '<em>$1</em>')
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  .replace(/\[([^\]]+)\]\(([^\s)]+\.html(?:#[^\s)]+)?|mailto:[^\s)]+)\)/g, '<a href="$2">$1</a>');

const renderMarkdown = (markdown = '') => {
  const lines = markdown.split('\n');
  let html = '';
  let inList = false;
  let inQuote = false;

  const closeBlocks = () => {
    if (inList) { html += '</ul>'; inList = false; }
    if (inQuote) { html += '</blockquote>'; inQuote = false; }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { closeBlocks(); continue; }

    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      closeBlocks();
      const alt = imageMatch[1];
      const src = imageMatch[2].trim();
      if (isSafeImagePath(src)) {
        html += `<figure><img src="${escapeHTML(src)}" alt="${escapeHTML(alt)}"><figcaption>${escapeHTML(alt)}</figcaption></figure>`;
      }
      continue;
    }

    if (trimmed.startsWith('## ')) { closeBlocks(); html += `<h2>${inline(trimmed.slice(3))}</h2>`; continue; }
    if (trimmed.startsWith('### ')) { closeBlocks(); html += `<h3>${inline(trimmed.slice(4))}</h3>`; continue; }
    if (trimmed.startsWith('> ')) {
      if (inList) { html += '</ul>'; inList = false; }
      if (!inQuote) { html += '<blockquote>'; inQuote = true; }
      html += `<p>${inline(trimmed.slice(2))}</p>`;
      continue;
    }
    if (trimmed.startsWith('- ')) {
      if (inQuote) { html += '</blockquote>'; inQuote = false; }
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(trimmed.slice(2))}</li>`;
      continue;
    }
    closeBlocks();
    html += `<p>${inline(trimmed)}</p>`;
  }

  closeBlocks();
  return html;
};

async function loadPosts() {
  try {
    const response = await fetch('data/posts.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Cannot load posts.json');
    const posts = await response.json();
    return posts
      .filter(post => post.published !== false)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  } catch (error) {
    console.error(error);
    return [];
  }
}

function postItem(post) {
  return `<article class="post-item">
    <div class="post-date">${formatDate(post.date)}</div>
    <div>
      <h3 class="post-title"><a href="post.html?slug=${encodeURIComponent(post.slug)}">${escapeHTML(post.title)}</a></h3>
      <p class="post-excerpt">${escapeHTML(post.excerpt)}</p>
      <div class="tags">${renderTags(post.tags)}</div>
    </div>
  </article>`;
}

async function renderHome() {
  const target = $('#latest-posts');
  if (!target) return;
  const posts = await loadPosts();
  target.innerHTML = posts.length
    ? posts.slice(0, 5).map(postItem).join('')
    : '<div class="empty">还没有文章。请在 data/posts.json 中添加第一篇。</div>';
}

async function renderArchive() {
  const target = $('#archive-list');
  if (!target) return;
  const search = $('#search');
  const tagFilter = $('#tag-filter');
  const posts = await loadPosts();
  const tags = [...new Set(posts.flatMap(post => post.tags || []))].sort();
  tagFilter.innerHTML += tags.map(tag => `<option value="${escapeHTML(tag)}">${escapeHTML(tag)}</option>`).join('');

  const draw = () => {
    const keyword = search.value.trim().toLowerCase();
    const tag = tagFilter.value;
    const filtered = posts.filter(post => {
      const haystack = `${post.title} ${post.excerpt} ${(post.tags || []).join(' ')}`.toLowerCase();
      return (!keyword || haystack.includes(keyword)) && (!tag || (post.tags || []).includes(tag));
    });
    target.innerHTML = filtered.length
      ? filtered.map(postItem).join('')
      : '<div class="empty">没有找到匹配的文章。</div>';
  };

  search.addEventListener('input', draw);
  tagFilter.addEventListener('change', draw);
  draw();
}

async function renderPost() {
  const target = $('#post');
  if (!target) return;
  const slug = new URLSearchParams(window.location.search).get('slug');
  const posts = await loadPosts();
  const post = posts.find(item => item.slug === slug) || posts[0];

  if (!post) {
    target.innerHTML = '<a class="back-link" href="archive.html">← 返回文章列表</a><div class="empty">没有找到这篇文章。</div>';
    return;
  }

  document.title = `${post.title}｜张扬帆`;
  const cover = post.image && isSafeImagePath(post.image)
    ? `<figure class="cover-image"><img src="${escapeHTML(post.image)}" alt="${escapeHTML(post.image_alt || post.title)}"><figcaption>${escapeHTML(post.image_alt || '')}</figcaption></figure>`
    : '';

  target.innerHTML = `<a class="back-link" href="archive.html">← Back to Blog</a>
    <h1>${escapeHTML(post.title)}</h1>
    <div class="article-meta">${formatDate(post.date)}</div>
    <div class="tags">${renderTags(post.tags)}</div>
    ${cover}
    <div class="article-body">${renderMarkdown(post.body)}</div>`;
}

function setYear() {
  $$('#year').forEach(el => { el.textContent = new Date().getFullYear(); });
}

setYear();
renderHome();
renderArchive();
renderPost();
