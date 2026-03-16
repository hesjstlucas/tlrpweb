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
        <h2>Sign in with Discord to use the tracker tools.</h2>
        <p>
          Directive+ can create application records. Management+ can accept or deny pending records.
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
    canCreate ? '<span class="permission-chip">Directive+ Create Access</span>' : "",
    canManage ? '<span class="permission-chip">Management+ Review Access</span>' : "",
    !config.storageConfigured ? '<span class="permission-chip permission-chip-warning">Storage Not Ready</span>' : ""
  ]
    .filter(Boolean)
    .join("");

  const creationForm = canCreate
    ? `
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
          <button class="button button-primary" type="submit"${config.storageConfigured ? "" : " disabled"}>Create record</button>
          <a class="button button-secondary" href="${links.logout}">Log out</a>
        </div>
        <p class="muted-text media-form-full" id="applications-form-status"></p>
      </form>
    `
    : `
      <div class="admin-card-actions">
        <a class="button button-secondary" href="${links.logout}">Log out</a>
      </div>
    `;

  shell.innerHTML = `
    <div class="admin-card-copy">
      <span class="section-kicker">Application access</span>
      <h2>Manage the tracker with role-based permissions.</h2>
      <p>
        Signed in as ${escapeHtml(session.session.displayName || session.session.username || "Authorized user")}. Use
        the tracker to log new application entries and review decisions with the right staff roles.
      </p>
      <div class="permissions-row">${permissionChips}</div>
    </div>
    ${creationForm}
  `;

  if (!config.storageConfigured) {
    showPageStatus(
      "Discord permissions are working, but application writes still need GITHUB_REPOSITORY and GITHUB_TOKEN in Vercel.",
      "warning"
    );
    return;
  }

  const form = document.getElementById("applications-form");
  if (!form) {
    return;
  }

  const formStatus = document.getElementById("applications-form-status");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formStatus.textContent = "Creating application record...";

    const formData = new FormData(form);
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

      form.reset();
      formStatus.textContent = "Application record created. Refreshing tracker...";
      await loadApplications(session);
      formStatus.textContent = "Application record created successfully.";
    } catch (error) {
      formStatus.textContent = error.message;
    }
  });
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
        <h3>No application records yet.</h3>
        <p>Directive+ can create the first record once Discord permissions are configured.</p>
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
              <span class="mini-label">Application</span>
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
    showPageStatus("Discord permissions could not be checked right now. The tracker is still available below.", "warning");
    renderAuthShell(session);
  }

  await loadApplications(session);
}

document.addEventListener("DOMContentLoaded", loadApplicationsPage);
