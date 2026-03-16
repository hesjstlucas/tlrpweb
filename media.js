function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showPageStatus(message, type = "info") {
  const element = document.getElementById("media-page-status");
  if (!element) {
    return;
  }

  element.hidden = false;
  element.className = `page-note page-note-${type}`;
  element.textContent = message;
}

function readAuthMessage() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("auth");

  const messages = {
    success: ["Discord sign-in successful. Media publishing tools are now available.", "success"],
    denied: ["You signed in, but your account does not have permission to publish media.", "warning"],
    failed: ["Discord authentication failed. Try again or check your Vercel environment variables.", "error"],
    misconfigured: ["Discord OAuth is not configured yet. Add the required environment variables in Vercel.", "error"],
    "logged-out": ["You have been signed out of the media tools.", "info"]
  };

  return messages[status] || null;
}

function renderAuthShell(session) {
  const shell = document.getElementById("media-auth-shell");
  if (!shell) {
    return;
  }

  const config = session?.config || {};

  if (!session?.authenticated) {
    if (!config.discordConfigured) {
      shell.innerHTML = `
        <div class="admin-card-copy">
          <span class="section-kicker">Media permissions</span>
          <h2>Discord media publishing is not configured yet.</h2>
          <p>
            Add the Discord OAuth variables, a strong SESSION_SECRET, and either your owner ID or a guild plus allowed
            role ID in Vercel before sign-in can be enabled.
          </p>
        </div>
      `;
      return;
    }

    shell.innerHTML = `
      <div class="admin-card-copy">
        <span class="section-kicker">Media permissions</span>
        <h2>Sign in with Discord to manage gallery posts.</h2>
        <p>
          Only the configured owner account and members with the allowed Discord role can add new media items here.
        </p>
      </div>
      <div class="admin-card-actions">
        <a class="button button-primary" href="/api/auth/discord/login">Continue with Discord</a>
      </div>
    `;
    return;
  }

  if (!session.session?.authorized) {
    shell.innerHTML = `
      <div class="admin-card-copy">
        <span class="section-kicker">Signed in</span>
        <h2>${escapeHtml(session.session.displayName || session.session.username || "Discord user")}</h2>
        <p>
          Your account does not match the configured owner ID or allowed Discord role, so the gallery stays view-only.
        </p>
      </div>
      <div class="admin-card-actions">
        <a class="button button-secondary" href="/api/auth/logout">Log out</a>
      </div>
    `;
    return;
  }

  if (!config.storageConfigured) {
    shell.innerHTML = `
      <div class="admin-card-copy">
        <span class="section-kicker">Publishing access</span>
        <h2>Storage is not configured yet.</h2>
        <p>
          Your Discord access is valid, but live media publishing still needs GITHUB_REPOSITORY and GITHUB_TOKEN in
          Vercel so new entries can be written back to the repository.
        </p>
      </div>
      <div class="admin-card-actions">
        <a class="button button-secondary" href="/api/auth/logout">Log out</a>
      </div>
    `;
    return;
  }

  shell.innerHTML = `
    <div class="admin-card-copy">
      <span class="section-kicker">Publishing access</span>
      <h2>Post new media to the gallery.</h2>
      <p>
        Signed in as ${escapeHtml(session.session.displayName || session.session.username || "Authorized user")}.
        Add approved image or video links below.
      </p>
    </div>
    <form class="media-form" id="media-form">
      <label>
        <span>Title</span>
        <input maxlength="90" name="title" placeholder="Night patrol showcase" required type="text" />
      </label>
      <label>
        <span>Media URL</span>
        <input name="url" placeholder="https://..." required type="url" />
      </label>
      <label>
        <span>Media type</span>
        <select name="type">
          <option value="image">Image</option>
          <option value="video">Video</option>
        </select>
      </label>
      <label class="media-form-full">
        <span>Description</span>
        <textarea maxlength="240" name="description" placeholder="Short context about the screenshot or clip."></textarea>
      </label>
      <div class="admin-card-actions media-form-full">
        <button class="button button-primary" type="submit">Publish media</button>
        <a class="button button-secondary" href="/api/auth/logout">Log out</a>
      </div>
      <p class="muted-text media-form-full" id="media-form-status"></p>
    </form>
  `;

  const form = document.getElementById("media-form");
  const formStatus = document.getElementById("media-form-status");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formStatus.textContent = "Publishing media...";

    const formData = new FormData(form);
    const payload = {
      title: formData.get("title"),
      url: formData.get("url"),
      type: formData.get("type"),
      description: formData.get("description")
    };

    try {
      const response = await fetch("/api/media", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Media could not be published.");
      }

      form.reset();
      formStatus.textContent = "Media published. Refreshing gallery...";
      await loadMediaGallery();
      formStatus.textContent = "Media published successfully.";
    } catch (error) {
      formStatus.textContent = error.message;
    }
  });
}

function getYoutubeEmbed(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      const videoId = parsed.searchParams.get("v");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
    }

    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.replace("/", "") ? `https://www.youtube.com/embed/${parsed.pathname.replace("/", "")}` : "";
    }
  } catch {
    return "";
  }

  return "";
}

function renderMediaPreview(item) {
  if (item.type === "video") {
    const youtubeEmbed = getYoutubeEmbed(item.url);

    if (youtubeEmbed) {
      return `<iframe class="media-embed" src="${escapeHtml(youtubeEmbed)}" title="${escapeHtml(
        item.title
      )}" allowfullscreen loading="lazy"></iframe>`;
    }

    return `<video class="media-video" controls preload="metadata" src="${escapeHtml(item.url)}"></video>`;
  }

  return `<img class="media-image" src="${escapeHtml(item.url)}" alt="${escapeHtml(item.title)}" loading="lazy" />`;
}

async function loadMediaGallery() {
  const gallery = document.getElementById("media-gallery");

  if (!gallery) {
    return;
  }

  try {
    const response = await fetch("/api/media", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load media.");
    }

    const payload = await response.json();
    const items = Array.isArray(payload.items) ? payload.items : [];

    if (!items.length) {
      gallery.innerHTML = `
        <article class="empty-card">
          <h3>No media posted yet.</h3>
          <p>Authorized users can start the gallery by signing in with Discord and publishing the first item.</p>
        </article>
      `;
      return;
    }

    gallery.innerHTML = items
      .map(
        (item) => `
          <article class="media-card">
            <div class="media-preview">
              ${renderMediaPreview(item)}
            </div>
            <div class="media-copy">
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.description || "No description provided.")}</p>
              <div class="media-meta">
                <span>Added by ${escapeHtml(item.addedBy || "Authorized User")}</span>
                <span>${escapeHtml(new Date(item.createdAt).toLocaleDateString())}</span>
              </div>
            </div>
          </article>
        `
      )
      .join("");
  } catch (error) {
    gallery.innerHTML = `
      <article class="empty-card">
        <h3>Unable to load media.</h3>
        <p>${escapeHtml(error.message)}</p>
      </article>
    `;
  }
}

async function loadMediaPage() {
  const authMessage = readAuthMessage();
  if (authMessage) {
    showPageStatus(authMessage[0], authMessage[1]);
  }

  try {
    const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
    const session = await sessionResponse.json();
    renderAuthShell(session);

    if (session?.authenticated && session?.session?.authorized && !session?.config?.storageConfigured) {
      showPageStatus(
        "Discord access works, but media posting still needs GitHub write variables in Vercel to save entries permanently.",
        "warning"
      );
    }
  } catch {
    showPageStatus("Discord permissions could not be checked right now. The gallery is still available below.", "warning");
    renderAuthShell({
      authenticated: false,
      session: null,
      config: {
        discordConfigured: true
      }
    });
  }

  await loadMediaGallery();
}

document.addEventListener("DOMContentLoaded", loadMediaPage);
