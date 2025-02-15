console.log("IT’S ALIVE!");

// Helper function to select multiple elements
function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

/* ----------------- Navigation & Dark Mode ----------------- */

let pages = [
  { url: "", title: "Home" },
  { url: "projects/", title: "Projects" },
  { url: "contact/", title: "Contact" },
  { url: "meta/", title: "Meta Analysis" },  // <-- Added Meta Analysis page
  { url: "https://github.com/iamangeldi", title: "GitHub Profile" },
];

const ARE_WE_HOME = document.documentElement.classList.contains("home");

let nav = document.createElement("nav");
document.body.prepend(nav);

for (let p of pages) {
  let url = p.url;
  let title = p.title;
  url = !ARE_WE_HOME && !url.startsWith("http") ? "../" + url : url;
  let a = document.createElement("a");
  a.href = url;
  a.textContent = title;
  a.classList.toggle(
    "current",
    a.host === location.host && a.pathname === location.pathname
  );
  a.toggleAttribute("target", a.host !== location.host);
  nav.append(a);
}

document.body.insertAdjacentHTML(
  "afterbegin",
  `
  <label class="color-scheme">
    Theme:
    <select>
      <option value="light dark">Automatic</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>
`
);

function setColorScheme(colorScheme) {
  document.documentElement.style.setProperty("color-scheme", colorScheme);
  const select = document.querySelector(".color-scheme select");
  if (select) select.value = colorScheme;
}

const select = document.querySelector(".color-scheme select");
if ("colorScheme" in localStorage) {
  setColorScheme(localStorage.colorScheme);
}
select.addEventListener("input", function (event) {
  const newScheme = event.target.value;
  localStorage.colorScheme = newScheme;
  setColorScheme(newScheme);
});

/* ----------------- Reusable Functions ----------------- */

// Fetch JSON data from a given URL
export async function fetchJSON(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching or parsing JSON data:", error);
  }
}

// Render projects into a given container with a dynamic heading level
export function renderProjects(projects, containerElement, headingLevel = "h2") {
  // Clear existing content
  containerElement.innerHTML = "";

  // If there are no projects, show a placeholder message
  if (!projects || projects.length === 0) {
    containerElement.innerHTML = "<p>No projects available.</p>";
    return;
  }

  projects.forEach((project) => {
    const article = document.createElement("article");
    article.innerHTML = `
      <${headingLevel}>${project.title}</${headingLevel}>
      <img src="${project.image}" alt="${project.title}">
      <p>${project.description}</p>
      ${project.year ? `<p><strong>Year:</strong> ${project.year}</p>` : ""}
    `;
    containerElement.appendChild(article);
  });
}

// Fetch GitHub profile data for a given username
export async function fetchGitHubData(username) {
  return await fetchJSON(`https://api.github.com/users/${username}`);
}
