function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Unknown date" : parsed.toLocaleDateString();
}

async function loadApplicationDetail() {
  const status = document.getElementById("application-detail-status");
  const shell = document.getElementById("application-detail-shell");
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    status.textContent = "No application page was selected.";
    shell.innerHTML = `
      <article class="empty-card">
        <h3>Application page not found.</h3>
        <p>Go back to the applications page and open one of the current application buttons.</p>
      </article>
    `;
    return;
  }

  try {
    const response = await fetch(`/api/application-posts?id=${encodeURIComponent(id)}`, { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Application page could not be loaded.");
    }

    const item = payload.item;
    const title = item.title || "Open Application";
    const department = item.department || "Application";
    const overview = item.overview || "Review this opening and continue when you are ready to apply.";
    const details = item.details || "More details will be posted soon.";
    const createdBy = item.createdBy || "Directive";
    const detailsHtml = escapeHtml(details).replaceAll("\n", "<br />");

    document.title = `${title} | Tallahassee City Roleplay`;
    status.textContent = `Published ${formatDate(item.createdAt)}`;

    shell.innerHTML = `
      <article class="detail-page-card">
        <div class="detail-page-copy">
          <span class="section-kicker">${escapeHtml(department)}</span>
          <h1>${escapeHtml(title)}</h1>
          <p class="detail-page-overview">${escapeHtml(overview)}</p>
          <div class="application-meta">
            <span>Published by ${escapeHtml(createdBy)}</span>
            <span>${escapeHtml(formatDate(item.createdAt))}</span>
          </div>
          <div class="detail-page-body">
            ${detailsHtml}
          </div>
        </div>
        <aside class="detail-page-side">
          <article class="side-panel">
            <span class="mini-label">Application Page</span>
            <strong>Use this page as the public-facing info screen for players before they continue to apply.</strong>
          </article>
          ${
            item.applyLink
              ? `<a class="button button-primary" href="${escapeHtml(item.applyLink)}" target="_blank" rel="noreferrer">Continue to Apply</a>`
              : `<a class="button button-secondary" href="discord.html">Open Discord Page</a>`
          }
          <a class="button button-secondary" href="applications.html">Back to Applications</a>
        </aside>
      </article>
    `;
  } catch (error) {
    status.textContent = "This application page could not be loaded.";
    shell.innerHTML = `
      <article class="empty-card">
        <h3>Unable to load application.</h3>
        <p>${escapeHtml(error.message)}</p>
      </article>
    `;
  }
}

document.addEventListener("DOMContentLoaded", loadApplicationDetail);
