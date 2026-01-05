import { API_URL } from "../scripts/general.js";

const templatesGrid = document.getElementById("templatesGrid");
const setupStatus = document.getElementById("setupStatus");

// Define available hosting templates
const templates = [
  {
    id: "aws",
    name: "Amazon AWS",
    icon: "☁️",
    description: "Enterprise-grade hosting with S3, CloudFront, and IAM roles",
    features: ["Scalable storage", "Global CDN", "Cost-effective", "Production-ready"],
    recommended: true,
    setupPath: "/artist/setup.html"
  },
  {
    id: "gcp",
    name: "Google Cloud",
    icon: "🔵",
    description: "Google Cloud Storage with Cloud CDN delivery",
    features: ["Fast deployment", "Easy management", "Integrated analytics"],
    coming: true,
    setupPath: "/artist/setup-gcp.html"
  },
  {
    id: "azure",
    name: "Microsoft Azure",
    icon: "🟦",
    description: "Azure Storage with content delivery network",
    features: ["Enterprise integration", "Strong security", "Hybrid support"],
    coming: true,
    setupPath: "/artist/setup-azure.html"
  },
  {
    id: "self-hosted",
    name: "Self-Hosted",
    icon: "🖥️",
    description: "Use your own server or storage solution",
    features: ["Full control", "Custom configuration", "No vendor lock-in"],
    coming: true,
    setupPath: "/artist/setup-self-hosted.html"
  }
];

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
