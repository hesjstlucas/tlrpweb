function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showApplyStatus(message, type = "info") {
  const element = document.getElementById("apply-page-status");
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
    success: ["Discord sign-in successful. You can fill out the application form now.", "success"],
    failed: ["Discord authentication failed. Please try signing in again.", "error"],
    misconfigured: ["Discord sign-in is not configured correctly yet. Contact staff if this keeps happening.", "error"],
    denied: ["Discord sign-in worked, but this application page still requires a normal authenticated session to continue.", "warning"],
    "logged-out": ["You were logged out of this application form.", "info"]
  };

  return messages[status] || null;
}

function getFormId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id") || "";
}

function getFormAuthLinks(formId) {
  const next = `/apply.html?id=${encodeURIComponent(formId)}`;
  return {
    login: `/api/auth/discord/login?next=${encodeURIComponent(next)}`,
    logout: `/api/auth/logout?next=${encodeURIComponent(next)}`
  };
}

function formatDate(value) {
  if (!value) {
    return "Unknown date";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Unknown date" : parsed.toLocaleString();
}

function renderMissingForm() {
  const shell = document.getElementById("apply-shell");
  shell.innerHTML = `
    <article class="empty-card">
      <h3>Application not found.</h3>
      <p>Go back to the applications page and open one of the live application buttons.</p>
      <div class="admin-card-actions">
        <a class="button button-secondary" href="applications.html">Back to Applications</a>
      </div>
    </article>
  `;
}

function renderLoginGate(form, formId) {
  const shell = document.getElementById("apply-shell");
  const links = getFormAuthLinks(formId);

  shell.innerHTML = `
    <article class="detail-page-card">
      <div class="detail-page-copy">
        <span class="section-kicker">${escapeHtml(form.department || "Application")}</span>
        <h1>${escapeHtml(form.title || "Application Form")}</h1>
        <p class="detail-page-overview">${escapeHtml(
          form.overview || "Sign in with Discord to continue to the hidden application page."
        )}</p>
        <div class="detail-page-body">
          ${escapeHtml(form.intro || "Staff will review your answers after you submit this form.").replaceAll("\n", "<br />")}
        </div>
      </div>
      <aside class="detail-page-side">
        <article class="side-panel">
          <span class="mini-label">Discord required</span>
          <strong>Players must log in with Discord before they can submit this application.</strong>
        </article>
        <a class="button button-primary" href="${links.login}">Sign in with Discord</a>
        <a class="button button-secondary" href="applications.html">Back to Applications</a>
      </aside>
    </article>
  `;
}

function renderApplyForm(form, session, formId) {
  const shell = document.getElementById("apply-shell");
  const links = getFormAuthLinks(formId);
  const questions = Array.isArray(form.questions) ? form.questions : [];

  shell.innerHTML = `
    <article class="detail-page-card">
      <div class="detail-page-copy">
        <span class="section-kicker">${escapeHtml(form.department || "Application")}</span>
        <h1>${escapeHtml(form.title || "Application Form")}</h1>
        <p class="detail-page-overview">${escapeHtml(
          form.overview || "Complete the questions below and staff will review your submission."
        )}</p>
        <div class="application-meta">
          <span>Signed in as ${escapeHtml(session.displayName || session.username || "Discord user")}</span>
          <span>Form published ${escapeHtml(formatDate(form.createdAt))}</span>
        </div>
        <div class="detail-page-body">
          ${escapeHtml(form.intro || "Complete the form carefully before you submit.").replaceAll("\n", "<br />")}
        </div>
        <form class="media-form apply-form" id="apply-form">
          <div class="media-form-full apply-question-list">
            ${questions
              .map(
                (question) => `
                  <article class="apply-question" data-question-id="${escapeHtml(question.id)}" data-question-type="${escapeHtml(
                    question.type || "short"
                  )}">
                    <label>
                      <span>${escapeHtml(question.required === false ? "Optional question" : "Required question")}</span>
                      <strong>${escapeHtml(question.label || "Question")}</strong>
                      ${
                        question.type === "long"
                          ? `<textarea maxlength="1500" placeholder="${escapeHtml(
                              question.placeholder || ""
                            )}"${question.required === false ? "" : " required"}></textarea>`
                          : `<input maxlength="300" placeholder="${escapeHtml(question.placeholder || "")}" type="text"${
                              question.required === false ? "" : " required"
                            } />`
                      }
                    </label>
                  </article>
                `
              )
              .join("")}
          </div>
          <div class="admin-card-actions media-form-full">
            <button class="button button-primary" type="submit">Submit Application</button>
            <a class="button button-secondary" href="${links.logout}">Log out</a>
          </div>
          <p class="muted-text media-form-full" id="apply-form-status"></p>
        </form>
      </div>
      <aside class="detail-page-side">
        <article class="side-panel">
          <span class="mini-label">Before you submit</span>
          <strong>Take your time, answer every required question clearly, and make sure your Discord account is the one you want staff to contact.</strong>
        </article>
        <a class="button button-secondary" href="applications.html">Back to Applications</a>
      </aside>
    </article>
  `;

  const formElement = document.getElementById("apply-form");
  const statusElement = document.getElementById("apply-form-status");

  formElement.addEventListener("submit", async (event) => {
    event.preventDefault();
    statusElement.textContent = "Submitting your application...";

    const answers = [...formElement.querySelectorAll(".apply-question")].map((questionElement) => {
      const field = questionElement.querySelector("textarea, input");
      return {
        questionId: questionElement.dataset.questionId,
        value: field ? field.value : ""
      };
    });

    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          formId,
          answers
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Your application could not be submitted.");
      }

      shell.innerHTML = `
        <article class="detail-page-card">
          <div class="detail-page-copy">
            <span class="section-kicker">${escapeHtml(form.department || "Application")}</span>
            <h1>Application submitted.</h1>
            <p class="detail-page-overview">Your form is now in the Management+ review queue.</p>
            <div class="detail-page-body">
              Staff can now review your answers from the applications tab. If they update your status to accepted,
              denied, or pending, the website is set up to send you a Discord DM update.
            </div>
          </div>
          <aside class="detail-page-side">
            <article class="side-panel">
              <span class="mini-label">Submission received</span>
              <strong>Thank you for applying. Watch your Discord DMs for status updates from staff.</strong>
            </article>
            <a class="button button-secondary" href="applications.html">Back to Applications</a>
          </aside>
        </article>
      `;
      showApplyStatus("Your application was submitted successfully.", "success");
    } catch (error) {
      statusElement.textContent = error.message;
    }
  });
}

async function loadApplyPage() {
  const formId = getFormId();
  if (!formId) {
    showApplyStatus("No application form was selected.", "error");
    renderMissingForm();
    return;
  }

  const authMessage = readAuthMessage();
  if (authMessage) {
    showApplyStatus(authMessage[0], authMessage[1]);
  }

  const shell = document.getElementById("apply-shell");

  try {
    const [formResponse, sessionResponse] = await Promise.all([
      fetch(`/api/application-forms?id=${encodeURIComponent(formId)}`, { cache: "no-store" }),
      fetch("/api/auth/session", { cache: "no-store" }).catch(() => null)
    ]);

    const formPayload = await formResponse.json();
    if (!formResponse.ok || !formPayload.item) {
      throw new Error(formPayload.error || "This application form could not be found.");
    }

    const form = formPayload.item;
    document.title = `${form.title || "Apply"} | Tallahassee City Roleplay`;

    let sessionPayload = {
      authenticated: false,
      session: null
    };

    if (sessionResponse) {
      sessionPayload = await sessionResponse.json();
    }

    if (!sessionPayload.authenticated || !sessionPayload.session) {
      renderLoginGate(form, formId);
      return;
    }

    renderApplyForm(form, sessionPayload.session, formId);
  } catch (error) {
    shell.innerHTML = `
      <article class="empty-card">
        <h3>Unable to load application form.</h3>
        <p>${escapeHtml(error.message)}</p>
        <div class="admin-card-actions">
          <a class="button button-secondary" href="applications.html">Back to Applications</a>
        </div>
      </article>
    `;
    showApplyStatus("This application page could not be loaded.", "error");
  }
}

document.addEventListener("DOMContentLoaded", loadApplyPage);
