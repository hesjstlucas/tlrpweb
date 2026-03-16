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

function hidePageStatus() {
  const element = document.getElementById("applications-page-status");
  if (!element) {
    return;
  }

  element.hidden = true;
  element.textContent = "";
  element.className = "page-note";
}

function readAuthMessage() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("auth");

  const messages = {
    success: ["Discord sign-in successful. Staff permissions are loaded for the application tools.", "success"],
    denied: ["You signed in successfully, but your Discord roles only allow the public application view on this page.", "warning"],
    failed: ["Discord authentication failed. Try again or check the website configuration.", "error"],
    misconfigured: ["Discord authentication is not fully configured yet. Add the required Vercel variables first.", "error"],
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
  const value = String(status || "pending").trim().toLowerCase();

  if (value === "accepted") {
    return "Accepted";
  }

  if (value === "denied") {
    return "Denied";
  }

  return "Pending";
}

function formatDate(value) {
  if (!value) {
    return "Unknown date";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Unknown date" : parsed.toLocaleString();
}

function createQuestionId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `question-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getDefaultQuestions() {
  return [
    {
      label: "Why do you want this position?",
      placeholder: "Tell staff why you want to join this part of TLRP.",
      type: "long",
      required: true
    },
    {
      label: "What is your current availability?",
      placeholder: "Example: Weeknights after 6 PM EST and most weekends.",
      type: "short",
      required: true
    },
    {
      label: "What experience should staff know about?",
      placeholder: "Roleplay, department, or leadership experience.",
      type: "long",
      required: true
    }
  ];
}

function createQuestionEditor(question = {}) {
  const wrapper = document.createElement("article");
  wrapper.className = "question-editor";
  wrapper.dataset.questionId = question.id || createQuestionId();

  wrapper.innerHTML = `
    <div class="question-editor-top">
      <strong>Application question</strong>
      <button class="button button-secondary builder-remove-question" type="button">Remove</button>
    </div>
    <div class="question-editor-grid">
      <label>
        <span>Prompt</span>
        <input maxlength="100" name="label" placeholder="Example: Why should we choose you?" type="text" value="${escapeHtml(
          question.label || ""
        )}" />
      </label>
      <label>
        <span>Placeholder</span>
        <input maxlength="140" name="placeholder" placeholder="Optional helper text for players." type="text" value="${escapeHtml(
          question.placeholder || ""
        )}" />
      </label>
      <label>
        <span>Answer type</span>
        <select name="type">
          <option value="short"${question.type === "long" ? "" : " selected"}>Short answer</option>
          <option value="long"${question.type === "long" ? " selected" : ""}>Paragraph</option>
        </select>
      </label>
    </div>
    <label class="checkbox-row">
      <input name="required" type="checkbox"${question.required === false ? "" : " checked"} />
      <span>Require an answer before the player can submit.</span>
    </label>
  `;

  wrapper.querySelector(".builder-remove-question").addEventListener("click", () => {
    const container = wrapper.parentElement;
    if (container && container.children.length <= 1) {
      showPageStatus("Each application form needs at least one question.", "warning");
      return;
    }

    wrapper.remove();
  });

  return wrapper;
}

function collectQuestions(container) {
  return [...container.querySelectorAll(".question-editor")].map((element) => ({
    id: element.dataset.questionId || createQuestionId(),
    label: element.querySelector('[name="label"]').value.trim(),
    placeholder: element.querySelector('[name="placeholder"]').value.trim(),
    type: element.querySelector('[name="type"]').value,
    required: element.querySelector('[name="required"]').checked
  }));
}

function renderQuestionEditors(container, questions = []) {
  container.innerHTML = "";
  const source = questions.length ? questions : getDefaultQuestions();
  source.forEach((question) => {
    container.appendChild(createQuestionEditor(question));
  });
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
            Add the Discord OAuth values, guild ID, Directive+ role IDs, and Management+ role IDs before the staff-side
            application tools can be used here.
          </p>
        </div>
      `;
      return;
    }

    shell.innerHTML = `
      <div class="admin-card-copy">
        <span class="section-kicker">Application permissions</span>
        <h2>Sign in with Discord to build forms or review submissions.</h2>
        <p>
          Directive+ creates the public forms. Management+ reads the submitted applications and updates the final
          status.
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
        <h2>The application roles are not configured yet.</h2>
        <p>
          Add the Directive+ and Management+ role IDs, or use the owner ID override, before the staff tools can unlock
          here.
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
          Your account is logged in, but it does not match the configured Directive+ or Management+ roles, so this page
          stays public-view only for you.
        </p>
      </div>
      <div class="admin-card-actions">
        <a class="button button-secondary" href="${links.logout}">Log out</a>
      </div>
    `;
    return;
  }

  const permissionChips = [
    canCreate ? '<span class="permission-chip">Directive+ Form Builder</span>' : "",
    canManage ? '<span class="permission-chip">Management+ Review Queue</span>' : "",
    !config.storageConfigured ? '<span class="permission-chip permission-chip-warning">Storage Not Ready</span>' : "",
    !config.botConfigured && canManage
      ? '<span class="permission-chip permission-chip-warning">DM Token Missing</span>'
      : ""
  ]
    .filter(Boolean)
    .join("");

  const builderSection = canCreate
    ? `
      <section class="admin-subsection">
        <div class="admin-subsection-copy">
          <h3>Create a new application form</h3>
          <p>
            Build the player-facing application here. Once you publish it, the site creates a large public application
            button that opens the hidden form page in a new tab.
          </p>
        </div>
        <form class="media-form" id="application-builder-form">
          <label>
            <span>Form title</span>
            <input maxlength="90" name="title" placeholder="Law Enforcement Application" required type="text" />
          </label>
          <label>
            <span>Department</span>
            <input maxlength="60" name="department" placeholder="Law Enforcement" required type="text" />
          </label>
          <label class="media-form-full">
            <span>Button overview</span>
            <textarea maxlength="240" name="overview" placeholder="This short text appears on the big public application button." required></textarea>
          </label>
          <label class="media-form-full">
            <span>Form intro</span>
            <textarea maxlength="1800" name="intro" placeholder="Explain requirements, expectations, activity, interview info, or anything else players should read before applying." required></textarea>
          </label>
          <div class="media-form-full builder-panel">
            <div class="builder-toolbar">
              <div class="admin-subsection-copy">
                <h3>Form questions</h3>
                <p>Create the questions players must answer before they submit.</p>
              </div>
              <button class="button button-secondary" id="application-builder-add-question" type="button">Add Question</button>
            </div>
            <div class="builder-questions" id="application-builder-questions"></div>
          </div>
          <div class="admin-card-actions media-form-full">
            <button class="button button-primary" type="submit"${config.storageConfigured ? "" : " disabled"}>Publish Application Form</button>
          </div>
          <p class="muted-text media-form-full" id="application-builder-status"></p>
        </form>
      </section>
    `
    : "";

  const manageSection = canManage
    ? `
      <section class="admin-subsection">
        <div class="admin-subsection-copy">
          <h3>Management review access</h3>
          <p>
            Scroll down to the private review queue to read submitted forms, leave a staff note, and set the final
            status to accepted, denied, or pending.
          </p>
        </div>
      </section>
    `
    : "";

  shell.innerHTML = `
    <div class="admin-card-copy">
      <span class="section-kicker">Application staff access</span>
      <h2>Build forms for players and manage the review queue from one place.</h2>
      <p>
        Signed in as ${escapeHtml(session.session.displayName || session.session.username || "Authorized user")}. Public
        forms go to the player section below, while submitted applications stay in the private management queue.
      </p>
      <div class="permissions-row">${permissionChips}</div>
    </div>
    <div class="admin-card-stack">
      ${builderSection}
      ${manageSection}
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

  if (!config.botConfigured && canManage) {
    showPageStatus(
      "Management review works, but Discord applicant DMs will not send until DISCORD_BOT_TOKEN is added in Vercel.",
      "warning"
    );
  }

  if (!canCreate) {
    return;
  }

  const builderForm = document.getElementById("application-builder-form");
  const questionContainer = document.getElementById("application-builder-questions");
  const addQuestionButton = document.getElementById("application-builder-add-question");
  const builderStatus = document.getElementById("application-builder-status");

  renderQuestionEditors(questionContainer);

  addQuestionButton.addEventListener("click", () => {
    questionContainer.appendChild(createQuestionEditor({ required: true }));
  });

  builderForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    builderStatus.textContent = "Publishing application form...";

    const formData = new FormData(builderForm);
    const questions = collectQuestions(questionContainer);

    if (!questions.length) {
      builderStatus.textContent = "Add at least one question before publishing.";
      return;
    }

    const payload = {
      title: formData.get("title"),
      department: formData.get("department"),
      overview: formData.get("overview"),
      intro: formData.get("intro"),
      questions
    };

    try {
      const response = await fetch("/api/application-forms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Application form could not be published.");
      }

      builderForm.reset();
      renderQuestionEditors(questionContainer);
      builderStatus.textContent = "Application form published. Refreshing public buttons...";
      await loadApplicationForms();
      builderStatus.textContent = "Application form published successfully.";
    } catch (error) {
      builderStatus.textContent = error.message;
    }
  });
}

function renderApplicationForms(items) {
  const list = document.getElementById("application-portals-list");
  if (!list) {
    return;
  }

  if (!items.length) {
    list.innerHTML = `
      <article class="empty-card">
        <h3>No live applications yet.</h3>
        <p>Directive+ can publish the first player-facing application form from the staff tools above.</p>
      </article>
    `;
    return;
  }

  list.innerHTML = items
    .map(
      (item) => `
        <a class="application-portal-card" href="apply.html?id=${encodeURIComponent(item.id)}" target="_blank" rel="noreferrer">
          <div class="application-portal-copy">
            <span class="section-kicker">${escapeHtml(item.department || "Application")}</span>
            <h3>${escapeHtml(item.title || "Open Application")}</h3>
            <p>${escapeHtml(item.overview || "Open this application form to read the details and apply.")}</p>
            <div class="application-meta">
              <span>Discord login required</span>
              <span>Published ${escapeHtml(formatDate(item.createdAt))}</span>
            </div>
          </div>
          <div class="application-portal-side">
            <span class="status-pill status-pill-accepted">Open Form</span>
            <strong>Open hidden application page</strong>
          </div>
        </a>
      `
    )
    .join("");
}

function renderReviewQueue(items, session) {
  const list = document.getElementById("applications-list");
  if (!list) {
    return;
  }

  const links = getApplicationsAuthLinks();
  const permissions = session?.session?.permissions || {};
  const canManage = Boolean(permissions.applicationManage && session?.config?.storageConfigured);

  if (!session?.authenticated) {
    list.innerHTML = `
      <article class="empty-card locked-card">
        <h3>Management queue locked.</h3>
        <p>Management+ needs to sign in with Discord before the submitted applications can be reviewed here.</p>
        <div class="admin-card-actions">
          <a class="button button-primary" href="${links.login}">Sign in with Discord</a>
        </div>
      </article>
    `;
    return;
  }

  if (!canManage) {
    list.innerHTML = `
      <article class="empty-card locked-card">
        <h3>Management+ only.</h3>
        <p>Your account is signed in, but it does not have the Management+ role needed to open the private application queue.</p>
      </article>
    `;
    return;
  }

  if (!items.length) {
    list.innerHTML = `
      <article class="empty-card">
        <h3>No submitted applications yet.</h3>
        <p>Player submissions will show up here once someone fills out one of the live application forms.</p>
      </article>
    `;
    return;
  }

  list.innerHTML = items
    .map((item) => {
      const formTitle = item.formTitle || item.position || item.department || "Application";
      const applicantName = item.applicantName || item.createdBy || "Applicant";
      const applicantUsername = item.applicantUsername || item.applicantDiscord || "Unknown Discord";
      const submittedAt = item.submittedAt || item.createdAt;
      const answerList =
        Array.isArray(item.answers) && item.answers.length
          ? item.answers
              .map(
                (answer) => `
                  <article class="application-answer-item">
                    <strong>${escapeHtml(answer.label || "Question")}</strong>
                    <p>${escapeHtml(answer.value || "No answer provided.")}</p>
                  </article>
                `
              )
              .join("")
          : `
              <article class="application-answer-item">
                <strong>Legacy submission</strong>
                <p>${escapeHtml(item.summary || "This record was created before the form builder workflow.")}</p>
              </article>
            `;

      return `
        <article class="application-card" data-application-id="${escapeHtml(item.id)}">
          <div class="application-card-top">
            <div>
              <span class="mini-label">Submitted application</span>
              <h3>${escapeHtml(formTitle)}</h3>
            </div>
            <span class="status-pill status-pill-${escapeHtml(normalizeStatus(item.status))}">${escapeHtml(
              statusLabel(item.status)
            )}</span>
          </div>
          <div class="application-meta">
            <span>${escapeHtml(item.department || "Department pending")}</span>
            <span>${escapeHtml(applicantName)}</span>
            <span>${escapeHtml(applicantUsername)}</span>
            <span>${escapeHtml(formatDate(submittedAt))}</span>
          </div>
          <div class="application-answer-list">
            ${answerList}
          </div>
          ${
            item.reviewedBy || item.decisionNote
              ? `
                <div class="application-decision">
                  <strong>Latest review</strong>
                  <p>${escapeHtml(item.decisionNote || `${statusLabel(item.status)} by ${item.reviewedBy || "Management"}.`)}</p>
                  <span class="muted-text">Updated ${escapeHtml(formatDate(item.reviewedAt))} by ${escapeHtml(
                    item.reviewedBy || "Management"
                  )}</span>
                </div>
              `
              : ""
          }
          <div class="application-review">
            <label>
              <span>Decision note</span>
              <textarea class="application-review-note" maxlength="300" placeholder="Optional note that will be saved and sent in the applicant's DM.">${escapeHtml(
                item.decisionNote || ""
              )}</textarea>
            </label>
            <div class="admin-card-actions">
              <button class="button button-secondary application-action" data-action="pending" type="button">Pending</button>
              <button class="button button-primary application-action" data-action="accepted" type="button">Accept</button>
              <button class="button button-secondary application-action" data-action="denied" type="button">Deny</button>
            </div>
            <p class="muted-text application-review-status"></p>
          </div>
        </article>
      `;
    })
    .join("");

  list.querySelectorAll(".application-action").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest(".application-card");
      const noteField = card.querySelector(".application-review-note");
      const statusField = card.querySelector(".application-review-status");
      const id = card.dataset.applicationId;
      const nextStatus = button.dataset.action;

      statusField.textContent = `Saving ${statusLabel(nextStatus).toLowerCase()} decision...`;

      try {
        const response = await fetch("/api/applications", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            id,
            status: nextStatus,
            decisionNote: noteField ? noteField.value : ""
          })
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Application decision could not be saved.");
        }

        if (result.warning) {
          showPageStatus(result.warning, "warning");
        }

        statusField.textContent = "Decision saved. Refreshing review queue...";
        await loadReviewQueue(session);
      } catch (error) {
        statusField.textContent = error.message;
      }
    });
  });
}

function normalizeStatus(value) {
  const status = String(value || "pending").trim().toLowerCase();
  return ["accepted", "denied", "pending"].includes(status) ? status : "pending";
}

async function loadApplicationForms() {
  const list = document.getElementById("application-portals-list");
  if (!list) {
    return;
  }

  try {
    const response = await fetch("/api/application-forms", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load application forms.");
    }

    const payload = await response.json();
    renderApplicationForms(Array.isArray(payload.items) ? payload.items : []);
  } catch (error) {
    list.innerHTML = `
      <article class="empty-card">
        <h3>Unable to load application forms.</h3>
        <p>${escapeHtml(error.message)}</p>
      </article>
    `;
  }
}

async function loadReviewQueue(session) {
  const list = document.getElementById("applications-list");
  if (!list) {
    return;
  }

  const permissions = session?.session?.permissions || {};
  if (!session?.authenticated || !permissions.applicationManage) {
    renderReviewQueue([], session);
    return;
  }

  try {
    const response = await fetch("/api/applications", { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Failed to load application submissions.");
    }

    renderReviewQueue(Array.isArray(payload.items) ? payload.items : [], session);
  } catch (error) {
    list.innerHTML = `
      <article class="empty-card">
        <h3>Unable to load the management queue.</h3>
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
      storageConfigured: true,
      botConfigured: false
    }
  };

  try {
    const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
    session = await sessionResponse.json();
  } catch {
    showPageStatus(
      "Discord permissions could not be checked right now. Public application buttons are still available below.",
      "warning"
    );
  }

  renderAuthShell(session);
  await Promise.all([loadApplicationForms(), loadReviewQueue(session)]);
}

document.addEventListener("DOMContentLoaded", loadApplicationsPage);
