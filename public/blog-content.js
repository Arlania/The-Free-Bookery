const dynamicBlogList = document.querySelector(".author-blogs .blog-column-content");
const newsletterList = document.querySelector("[data-newsletter-list]");
const newsletterOpen = document.querySelector("[data-newsletter-open]");
const newsletterModal = document.querySelector("#newsletter-modal");
const newsletterForm = document.querySelector("[data-newsletter-form]");

function contentDate(value) {
  const date = new Date(String(value || "").replace(" ", "T") + "Z");
  return Number.isNaN(date.valueOf()) ? "" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function renderBlogPost(post) {
  const article = document.createElement("article");
  article.className = "blog-post-card is-dynamic";
  article.dataset.blogCategory = post.category || "Author Notes";
  const initials = String(post.author || "FB").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  article.innerHTML = `<div class="blog-post-profile"><div class="blog-post-avatar" aria-hidden="true"></div><strong class="blog-post-author"></strong></div><div class="blog-post-body"><header class="blog-post-header"><div><h2></h2><div class="blog-post-meta"><time></time></div></div><span class="blog-post-category"></span></header><div class="blog-post-text"></div></div>`;
  article.querySelector(".blog-post-avatar").textContent = initials;
  article.querySelector(".blog-post-author").textContent = post.author;
  article.querySelector("h2").textContent = post.title;
  article.querySelector("time").textContent = contentDate(post.publishedAt);
  article.querySelector(".blog-post-category").textContent = post.category || "Author Notes";
  const text = article.querySelector(".blog-post-text");
  if (post.summary) { const summary = document.createElement("p"); summary.textContent = post.summary; text.append(summary); }
  String(post.body || "").split(/\n\s*\n/).filter(Boolean).forEach((paragraph) => { const p = document.createElement("p"); p.textContent = paragraph; text.append(p); });
  return article;
}

function renderNewsletter(post) {
  const article = document.createElement("article");
  article.className = "newsletter-card";
  const title = document.createElement("h3"); title.textContent = post.title;
  const date = document.createElement("time"); date.textContent = contentDate(post.publishedAt);
  const summary = document.createElement("p"); summary.textContent = post.summary || post.body;
  article.append(title, date, summary);
  return article;
}

async function loadPublishedContent() {
  const response = await fetch("/api/content?limit=50");
  if (!response.ok) return;
  const result = await response.json();
  const blogs = result.content.filter((item) => item.type === "blog");
  const newsletters = result.content.filter((item) => item.type === "newsletter");
  dynamicBlogList.querySelectorAll(".blog-post-card.is-dynamic").forEach((card) => card.remove());
  blogs.reverse().forEach((post) => dynamicBlogList.prepend(renderBlogPost(post)));
  newsletterList.replaceChildren(...newsletters.map(renderNewsletter));
  if (!newsletters.length) { const empty = document.createElement("p"); empty.className = "newsletter-empty"; empty.textContent = "No newsletters published yet."; newsletterList.append(empty); }
}

async function showAdminNewsletterControl() {
  const response = await fetch("/api/account");
  if (!response.ok) return;
  const account = await response.json();
  newsletterOpen.hidden = account.role !== "admin";
}

function setNewsletterModal(open) {
  newsletterModal.classList.toggle("is-open", open);
  newsletterModal.setAttribute("aria-hidden", String(!open));
}

newsletterOpen.addEventListener("click", () => setNewsletterModal(true));
newsletterModal.querySelector(".modal-close").addEventListener("click", () => setNewsletterModal(false));
newsletterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(newsletterForm);
  const message = newsletterForm.querySelector("[data-content-message]");
  const button = newsletterForm.querySelector('button[type="submit"]');
  message.textContent = "Publishing…"; button.disabled = true;
  const response = await fetch("/api/admin/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "newsletter", title: data.get("title"), summary: data.get("summary"), body: data.get("body") }) });
  const result = await response.json().catch(() => ({}));
  button.disabled = false;
  if (!response.ok) { message.textContent = result.error || "Newsletter could not be published."; return; }
  newsletterForm.reset(); setNewsletterModal(false); await loadPublishedContent();
});

loadPublishedContent();
showAdminNewsletterControl();
