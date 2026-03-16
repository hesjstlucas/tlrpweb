function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function loadChainOfCommand() {
  const container = document.getElementById("chain-groups");
  const note = document.getElementById("chain-updated-note");

  try {
    const response = await fetch("data/chain-of-command.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load the chain of command.");
    }

    const data = await response.json();
    const sections = Array.isArray(data.sections) ? data.sections : [];

    note.textContent = data.updatedAt
      ? `Last updated: ${new Date(data.updatedAt).toLocaleDateString()}`
      : "Managed from the protected chain-of-command data file.";

    if (!sections.length) {
      container.innerHTML = `
        <article class="empty-card">
          <h3>No chain of command listed yet.</h3>
          <p>Add sections to data/chain-of-command.json when the structure is ready.</p>
        </article>
      `;
      return;
    }

    container.innerHTML = sections
      .map((section) => {
        const members = Array.isArray(section.members) ? section.members : [];

        return `
          <article class="command-card">
            <h3>${escapeHtml(section.title || "Command Group")}</h3>
            <div class="command-list">
              ${members
                .map(
                  (member) => `
                    <div class="command-member">
                      <strong>${escapeHtml(member.role || "Role")}</strong>
                      <span>${escapeHtml(member.name || "Open")}</span>
                    </div>
                  `
                )
                .join("")}
            </div>
          </article>
        `;
      })
      .join("");
  } catch (error) {
    note.textContent = "The chain of command could not be loaded right now.";
    container.innerHTML = `
      <article class="empty-card">
        <h3>Unable to load the chain of command.</h3>
        <p>${escapeHtml(error.message)}</p>
      </article>
    `;
  }
}

document.addEventListener("DOMContentLoaded", loadChainOfCommand);
