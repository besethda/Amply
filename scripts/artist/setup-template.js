import { API_URL } from "../general.js";
import { getAllProviders } from "./provider-config.js";

const templatesGrid = document.getElementById("templatesGrid");
const setupStatus = document.getElementById("setupStatus");

// Use provider configuration from provider-config.js
const templates = getAllProviders().map(provider => ({
  id: provider.id,
  name: provider.name,
  icon: provider.icon,
  description: provider.description,
  features: [provider.storage, provider.cdn, "Easy setup"],
  recommended: provider.id === "aws",
  setupPath: provider.id === "aws" ? "/artist/setup.html" : `/artist/setup-${provider.id}.html`,
  coming: !provider.supported
}));

// Render template cards
function renderTemplates() {
  templatesGrid.innerHTML = templates
    .map((template) => {
      const comingSoonClass = template.coming ? "coming-soon" : "";
      const recommendedBadge = template.recommended ? '<span class="recommended-badge">Recommended</span>' : "";
      const comingSoonBadge = template.coming ? '<span class="coming-soon-badge">Coming Soon</span>' : "";

      return `
        <div class="template-card ${comingSoonClass}" data-template-id="${template.id}">
          <div class="template-icon">${template.icon}</div>
          <div class="template-content">
            <h3>${template.name}</h3>
            ${recommendedBadge}
            ${comingSoonBadge}
            <p>${template.description}</p>
            <ul class="features-list">
              ${template.features.map((f) => `<li>✓ ${f}</li>`).join("")}
            </ul>
          </div>
          <button 
            class="select-template-btn" 
            data-template-id="${template.id}"
            ${template.coming ? "disabled" : ""}
          >
            ${template.coming ? "Coming Soon" : "Select"}
          </button>
        </div>
      `;
    })
    .join("");

  // Add event listeners
  document.querySelectorAll(".select-template-btn:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const templateId = e.target.dataset.templateId;
      selectTemplate(templateId);
    });
  });
}

function selectTemplate(templateId) {
  const template = templates.find((t) => t.id === templateId);
  if (!template) return;

  setupStatus.textContent = `Selected: ${template.name}`;
  setupStatus.style.color = "#6cf";

  // Store selected template
  localStorage.setItem("selectedTemplate", templateId);

  // Redirect to appropriate setup page
  setTimeout(() => {
    window.location.href = template.setupPath;
  }, 500);
}

// Initialize
renderTemplates();
