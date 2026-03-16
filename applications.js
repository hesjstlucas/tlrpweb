function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showPageStatus(message, type = "info") {
  const element = document.getElementById("applications-page-status");
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
    success: ["Discord sign-in successful. Your application permissions are now loaded.", "success"],
    denied: ["You signed in, but your account does not have application tracker permissions.", "warning"],
    failed: ["Discord authentication failed. Try again or check your Vercel environment variables.", "error"],
    misconfigured: ["Application permissions are not configured yet. Add the required Discord variables in Vercel.", "error"],
    "logged-out": ["You have been signed out of the application tools.", "info"]
  };

  return messages[status] || null;
}

function getApplicationsAuthLinks() {
  return {
    login: "/api/auth/discord/login?next=/applications.html",
    logout: "/api/auth/logout?next=/applications.html"
  };
}

function statusLabel(status) {
  if (status === "accepted") {
    return "Accepted";
  }

  if (status === "denied") {
    return "Denied";
  }

  return "Pending";
}

function formatDate(value) {
  if (!value) {
    return "Unknown date";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Unknown date" : parsed.toLocaleDateString();
}

function renderAuthShell(session) {
  const shell = document.getElementById("applications-auth-shell");
  if (!shell) {
    return;
  }

  const config = session?.config || {};
  const permissions = session?.session?.permissions || {};
  const links = getApplicationsAuthLinks();
  const canCreate = Boolean(permissions.applicationCreate);
  const canManage = Boolean(permissions.applicationManage);
  const hasApplicationAccessConfig = Boolean(
    config.ownerConfigured || config.applicationCreatorConfigured || config.applicationManagerConfigured
  );

  if (!session?.authenticated) {
    if (!config.discordConfigured || !hasApplicationAccessConfig) {
      shell.innerHTML = `
        <div class="admin-card-copy">
          <span class="section-kicker">Application permissions</span>
          <h2>Discord application access is not configured yet.</h2>
          <p>
            Add the Discord OAuth variables, a strong SESSION_SECRET, your guild ID, and the Directive+ plus
            Management+ role IDs in Vercel before staff sign-in can be enabled here.
          </p>
        </div>
      `;
      return;
    }

    shell.innerHTML = `
      <div class="admin-card-copy">
        <span class="section-kicker">Application permissions</span>
        <h2>Sign in with Discord to use the application tools.</h2>
        <p>
          Directive+ can publish the large public application buttons. Management+ can still review tracker records
          below.
        </p>
      </div>
      <div class="admin-card-actions">
        <a class="button button-primary" href="${links.login}">Continue with Discord</a>
      </div>
    `;
    return;
  }

  if (!hasApplicationAccessConfig) {
    shell.innerHTML = `
      <div class="admin-card-copy">
        <span class="section-kicker">Application permissions</span>
        <h2>The tracker roles are not configured yet.</h2>
        <p>
          Add your Directive+ and Management+ role IDs, or use the owner ID override, before this page can hand out
          application permissions through Discord.
        </p>
      </div>
      <div class="admin-card-actions">
        <a class="button button-secondary" href="${links.logout}">Log out</a>
      </div>
    `;
    return;
  }

  if (!canCreate && !canManage) {
    shell.innerHTML = `
      <div class="admin-card-copy">
        <span class="section-kicker">Signed in</span>
        <h2>${escapeHtml(session.session.displayName || session.session.username || "Discord user")}</h2>
        <p>
          Your account is signed in, but it does not match the configured Directive+ or Management+ role IDs, so this
          page stays view-only for you.
        </p>
      </div>
      <div class="admin-card-actions">
        <a class="button button-secondary" href="${links.logout}">Log out</a>
      </div>
    `;
    return;
  }

  const permissionChips = [
    canCreate ? '<span class="permission-chip">Directive+ Publish Access</span>' : "",
    canManage ? '<span class="permission-chip">Management+ Review Access</span>' : "",
    !config.storageConfigured ? '<span class="permission-chip permission-chip-warning">Storage Not Ready</span>' : ""
  ]
    .filter(Boolean)
    .join("");

  const publishSection = canCreate
    ? `
      <section class="admin-subsection">
        <div class="admin-subsection-copy">
          <h3>Publish a public application button</h3>
          <p>
            Create a large application card for players to click. It will appear in the Current Applications section
            above and open its own page on TLRPX in a new tab.
          </p>
        </div>
        <form class="media-form" id="application-post-form">
          <label>
            <span>Application title</span>
            <input maxlength="90" name="title" placeholder="Law Enforcement Application" required type="text" />
          </label>
          <label>
            <span>Department</span>
            <input maxlength="60" name="department" placeholder="Law Enforcement" required type="text" />
          </label>
          <label class="media-form-full">
            <span>Short overview</span>
            <textarea maxlength="240" name="overview" placeholder="Short text for the big button players see on the applications page." required></textarea>
          </label>
          <label class="media-form-full">
            <span>Full details</span>
            <textarea maxlength="2500" name="details" placeholder="Full application page details, requirements, expectations, and how the process works." required></textarea>
          </label>
          <label class="media-form-full">
            <span>Apply link</span>
            <input name="applyLink" placeholder="https://discord.gg/... or https://forms.google.com/..." type="url" />
          </label>
          <div class="admin-card-actions media-form-full">
            <button class="button button-primary" type="submit"${config.storageConfigured ? "" : " disabled"}>Publish Application Button</button>
          </div>
          <p class="muted-text media-form-full" id="application-post-status"></p>
        </form>
      </section>
    `
    : "";

  const trackerSection = canCreate
    ? `
      <section class="admin-subsection">
        <div class="admin-subsection-copy">
          <h3>Create a staff tracker record</h3>
          <p>
            Use this to log incoming applications for the internal review list below, separate from the public
            application buttons.
          </p>
        </div>
        <form class="media-form" id="applications-form">
          <label>
            <span>Applicant name</span>
            <input maxlength="80" name="applicantName" placeholder="Lucas" required type="text" />
          </label>
          <label>
            <span>Discord username or ID</span>
            <input maxlength="80" name="applicantDiscord" placeholder="@hesjstlucas or 1234567890" required type="text" />
          </label>
          <label>
            <span>Department</span>
            <input maxlength="60" name="department" placeholder="Law Enforcement" required type="text" />
          </label>
          <label>
            <span>Position</span>
            <input maxlength="70" name="position" placeholder="Deputy" required type="text" />
          </label>
          <label class="media-form-full">
            <span>Reference link</span>
            <input name="referenceLink" placeholder="https://forms.google.com/... or ticket link" type="url" />
          </label>
          <label class="media-form-full">
            <span>Summary</span>
            <textarea maxlength="600" name="summary" placeholder="Quick summary of the application and anything staff should know." required></textarea>
          </label>
          <div class="admin-card-actions media-form-full">
            <button class="button button-secondary" type="submit"${config.storageConfigured ? "" : " disabled"}>Create Tracker Record</button>
          </div>
          <p class="muted-text media-form-full" id="applications-form-status"></p>
        </form>
      </section>
    `
    : "";

  shell.innerHTML = `
    <div class="admin-card-copy">
      <span class="section-kicker">Application access</span>
      <h2>Publish public buttons and manage the staff-side review flow.</h2>
      <p>
        Signed in as ${escapeHtml(session.session.displayName || session.session.username || "Authorized user")}. Use
        the public button publisher for players and the tracker below for internal review.
      </p>
      <div class="permissions-row">${permissionChips}</div>
    </div>
    <div class="admin-card-stack">
      ${publishSection}
      ${trackerSection}
    </div>
    <div class="admin-card-actions">
      <a class="button button-secondary" href="${links.logout}">Log out</a>
    </div>
  `;

  if (!config.storageConfigured) {
    showPageStatus(
      "Discord permissions are working, but application writes still need GITHUB_REPOSITORY and GITHUB_TOKEN in Vercel.",
      "warning"
    );
    return;
  }

  const postForm = document.getElementById("application-post-form");
  if (postForm) {
    const postStatus = document.getElementById("application-post-status");
    postForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      postStatus.textContent = "Publishing application page...";

      const formData = new FormData(postForm);
      const payload = {
        title: formData.get("title"),
        department: formData.get("department"),
        overview: formData.get("overview"),
        details: formData.get("details"),
        applyLink: formData.get("applyLink")
      };

      try {
        const response = await fetch("/api/application-posts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Application page could not be published.");
        }

        postForm.reset();
        postStatus.textContent = "Application page published. Refreshing buttons...";
        await loadApplicationPortals();
        postStatus.textContent = "Application page published successfully.";
      } catch (error) {
        postStatus.textContent = error.message;
      }
    });
  }

  const trackerForm = document.getElementById("applications-form");
  if (trackerForm) {
    const trackerStatus = document.getElementById("applications-form-status");

    trackerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      trackerStatus.textContent = "Creating application record...";

      const formData = new FormData(trackerForm);
      const payload = {
        applicantName: formData.get("applicantName"),
        applicantDiscord: formData.get("applicantDiscord"),
        department: formData.get("department"),
        position: formData.get("position"),
        referenceLink: formData.get("referenceLink"),
        summary: formData.get("summary")
      };

      try {
        const response = await fetch("/api/applications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Application record could not be created.");
        }

        trackerForm.reset();
        trackerStatus.textContent = "Tracker record created. Refreshing tracker...";
        await loadApplications(session);
        trackerStatus.textContent = "Tracker record created successfully.";
      } catch (error) {
        trackerStatus.textContent = error.message;
      }
    });
  }
}

function renderApplicationPortals(items) {
  const list = document.getElementById("application-portals-list");
  if (!list) {
    return;
  }

  if (!items.length) {
    list.innerHTML = `
      <article class="empty-card">
        <h3>No public applications posted yet.</h3>
        <p>Directive+ can publish the first large application button from the staff tools above.</p>
      </article>
    `;
    return;
  }

  list.innerHTML = items
    .map(
      (item) => `
        <a class="application-portal-card" href="application-detail.html?id=${encodeURIComponent(item.id)}" target="_blank" rel="noreferrer">
          <div class="application-portal-copy">
            <span class="section-kicker">${escapeHtml(item.department || "Application")}</span>
            <h3>${escapeHtml(item.title || "Open Application")}</h3>
            <p>${escapeHtml(item.overview || "Open this application page to read the full details.")}</p>
            <div class="application-meta">
              <span>Published by ${escapeHtml(item.createdBy || "Directive")}</span>
              <span>${escapeHtml(formatDate(item.createdAt))}</span>
            </div>
          </div>
          <div class="application-portal-side">
            <span class="status-pill status-pill-accepted">Open Application</span>
            <strong>Open in new tab</strong>
          </div>
        </a>
      `
    )
    .join("");
}

function renderApplications(items, session) {
  const list = document.getElementById("applications-list");
  if (!list) {
    return;
  }

  const permissions = session?.session?.permissions || {};
  const canManage = Boolean(permissions.applicationManage && session?.config?.storageConfigured);

  if (!items.length) {
    list.innerHTML = `
      <article class="empty-card">
        <h3>No tracker records yet.</h3>
        <p>Directive+ can create the first internal tracker record from the staff tools above.</p>
      </article>
    `;
    return;
  }

  list.innerHTML = items
    .map(
      (item) => `
        <article class="application-card" data-application-id="${escapeHtml(item.id)}">
          <div class="application-card-top">
            <div>
              <span class="mini-label">Tracker Record</span>
              <h3>${escapeHtml(item.applicantName)}</h3>
            </div>
            <span class="status-pill status-pill-${escapeHtml(item.status || "pending")}">${escapeHtml(
              statusLabel(item.status)
            )}</span>
          </div>
          <div class="application-meta">
            <span>${escapeHtml(item.department || "Department pending")}</span>
            <span>${escapeHtml(item.position || "Position pending")}</span>
            <span>${escapeHtml(item.applicantDiscord || "Discord unknown")}</span>
          </div>
          <p>${escapeHtml(item.summary || "No summary provided.")}</p>
          <div class="application-meta">
            <span>Created by ${escapeHtml(item.createdBy || "Staff")}</span>
            <span>${escapeHtml(formatDate(item.createdAt))}</span>
          </div>
          ${
            item.referenceLink
              ? `<a class="inline-link" href="${escapeHtml(item.referenceLink)}" target="_blank" rel="noreferrer">Open reference link</a>`
              : ""
          }
          ${
            item.reviewedBy || item.decisionNote
              ? `
                <div class="application-decision">
                  <strong>Review</strong>
                  <p>${
                    item.decisionNote
                      ? escapeHtml(item.decisionNote)
                      : `Reviewed by ${escapeHtml(item.reviewedBy || "Management")} on ${escapeHtml(formatDate(item.reviewedAt))}.`
                  }</p>
                  ${
                    item.reviewedBy
                      ? `<span class="muted-text">Reviewed by ${escapeHtml(item.reviewedBy)} on ${escapeHtml(
                          formatDate(item.reviewedAt)
                        )}</span>`
                      : ""
                  }
                </div>
              `
              : ""
          }
          ${
            canManage && item.status === "pending"
              ? `
                <div class="application-review">
                  <label>
                    <span>Decision note</span>
                    <textarea class="application-review-note" maxlength="300" placeholder="Optional note for the final decision."></textarea>
                  </label>
                  <div class="admin-card-actions">
                    <button class="button button-primary application-action" data-action="accepted" type="button">Accept</button>
                    <button class="button button-secondary application-action" data-action="denied" type="button">Deny</button>
                  </div>
                  <p class="muted-text application-review-status"></p>
                </div>
              `
              : ""
          }
        </article>
      `
    )
    .join("");

  if (!canManage) {
    return;
  }

  list.querySelectorAll(".application-action").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest(".application-card");
      const noteField = card.querySelector(".application-review-note");
      const statusField = card.querySelector(".application-review-status");
      const id = card.dataset.applicationId;
      const status = button.dataset.action;

      statusField.textContent = `${status === "accepted" ? "Accepting" : "Denying"} application...`;

      try {
        const response = await fetch("/api/applications", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            id,
            status,
            decisionNote: noteField ? noteField.value : ""
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Application decision could not be saved.");
        }

        statusField.textContent = "Decision saved. Refreshing tracker...";
        await loadApplications(session);
      } catch (error) {
        statusField.textContent = error.message;
      }
    });
  });
}

async function loadApplicationPortals() {
  const list = document.getElementById("application-portals-list");
  if (!list) {
    return;
  }

  try {
    const response = await fetch("/api/application-posts", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load application pages.");
    }

    const payload = await response.json();
    renderApplicationPortals(Array.isArray(payload.items) ? payload.items : []);
  } catch (error) {
    list.innerHTML = `
      <article class="empty-card">
        <h3>Unable to load public applications.</h3>
        <p>${escapeHtml(error.message)}</p>
      </article>
    `;
  }
}

async function loadApplications(session) {
  const list = document.getElementById("applications-list");
  if (!list) {
    return;
  }

  try {
    const response = await fetch("/api/applications", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load applications.");
    }

    const payload = await response.json();
    renderApplications(Array.isArray(payload.items) ? payload.items : [], session);
  } catch (error) {
    list.innerHTML = `
      <article class="empty-card">
        <h3>Unable to load applications.</h3>
        <p>${escapeHtml(error.message)}</p>
      </article>
    `;
  }
}

async function loadApplicationsPage() {
  const authMessage = readAuthMessage();
  if (authMessage) {
    showPageStatus(authMessage[0], authMessage[1]);
  }

  let session = {
    authenticated: false,
    session: null,
    config: {
      discordConfigured: true,
      storageConfigured: true
    }
  };

  try {
    const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
    session = await sessionResponse.json();
    renderAuthShell(session);
  } catch {
    showPageStatus("Discord permissions could not be checked right now. The public application pages are still available below.", "warning");
    renderAuthShell(session);
  }

  await Promise.all([loadApplicationPortals(), loadApplications(session)]);
}

document.addEventListener("DOMContentLoaded", loadApplicationsPage);
