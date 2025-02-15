import { fetchJSON, renderProjects, fetchGitHubData } from "./global.js";

(async function init() {
  // ----- Render Latest Projects (first 3) -----
  const projects = await fetchJSON("./lib/projects.json");
  const latestProjects = projects.slice(0, 3);
  const projectsContainer = document.querySelector(".projects");
  if (projectsContainer) {
    renderProjects(latestProjects, projectsContainer, "h2");
  }

  // ----- Fetch and Display GitHub Stats -----
  // Replace 'iamangeldi' with your GitHub username if needed
  const githubData = await fetchGitHubData("iamangeldi");
  const profileStats = document.querySelector("#profile-stats");
  if (profileStats && githubData) {
    profileStats.innerHTML = `
      <dl>
        <dt>Public Repos:</dt><dd>${githubData.public_repos}</dd>
        <dt>Public Gists:</dt><dd>${githubData.public_gists}</dd>
        <dt>Followers:</dt><dd>${githubData.followers}</dd>
        <dt>Following:</dt><dd>${githubData.following}</dd>
      </dl>
    `;
  }
})();
