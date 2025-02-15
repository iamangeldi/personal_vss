import { fetchJSON, renderProjects } from "../global.js";
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

let projects = [];
let data = [];          // Pie data: [{ label: "2023", value: 4 }, ...]
let selectedIndex = -1; // which wedge is selected, if any
let query = "";         // current text search

(async function init() {
  // 1. Fetch your projects
  projects = await fetchJSON("../lib/projects.json");
  // 2. Render them initially
  renderProjects(projects, document.querySelector(".projects"), "h2");
  // 3. Build initial pie data
  data = buildPieData(projects);
  // 4. Draw the pie chart up top
  renderPieChart(data);

  // 5. Wire up the search bar
  const searchInput = document.querySelector(".searchBar");
  searchInput.addEventListener("input", (e) => {
    query = e.target.value.toLowerCase();
    applyFilters();
  });
})();

/** Group projects by year, return array like [{ label: "2023", value: 4 }, ...] */
function buildPieData(projs) {
  let rolled = d3.rollups(
    projs,
    (v) => v.length,
    (d) => d.year
  );
  return rolled.map(([year, count]) => ({
    label: year,
    value: count,
  }));
}

function renderPieChart(dataArray) {
  const svg = d3.select("#projects-pie-plot");
  const legend = d3.select(".legend");

  // Clear old slices + legend
  svg.selectAll("path").remove();
  legend.selectAll("li").remove();

  if (!dataArray.length) return; // No data? Just stop.

  // Color scale
  let colors = d3.scaleOrdinal(d3.schemeTableau10);

  // Pie slice generator
  let sliceGenerator = d3.pie().value(d => d.value);
  let arcData = sliceGenerator(dataArray);

  // Arc generator
  let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);

  // Build the wedges
  arcData.forEach((slice, idx) => {
    let pathString = arcGenerator(slice);

    // Append each wedge <path>
    let path = svg.append("path")
      .attr("d", pathString)
      .attr("fill", colors(idx))
      .attr("class", idx === selectedIndex ? "selected" : null)
      .on("click", () => handleWedgeClick(idx, dataArray));

    // --- ADDING THE <title> FOR HOVER TOOLTIP ---
    // Gather all projects for this slice's year
    let thisYear = slice.data.label;  // e.g. "2023"
    let projectsInYear = projects.filter(p => p.year === thisYear);
    // Build a string of project titles
    let titles = projectsInYear.map(p => p.title).join(", ");
    
    // The <title> element is an SVG child that shows a default browser tooltip
    path.append("title")
      .text(() => {
        // Example format: "2023 (4 projects): MyProject1, MyProject2..."
        return `${thisYear} (${projectsInYear.length} projects)\n${titles}`;
      });
  });

  // Build the legend items
  dataArray.forEach((d, idx) => {
    legend.append("li")
      .attr("style", `--color:${colors(idx)}`)
      .attr("class", idx === selectedIndex ? "selected" : null)
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
      .on("click", () => handleWedgeClick(idx, dataArray));
  });
}

function handleWedgeClick(idx, dataArray) {
  // Toggle selection
  selectedIndex = (selectedIndex === idx) ? -1 : idx;
  applyFilters();
}

/** Re-apply search + wedge filters together */
function applyFilters() {
  let filtered = projects.filter((p) => {
    // search across all fields
    let str = Object.values(p).join(" ").toLowerCase();
    return str.includes(query);
  });

  // If wedge is selected, filter by that year
  if (selectedIndex !== -1 && data[selectedIndex]) {
    let year = data[selectedIndex].label;
    filtered = filtered.filter(p => p.year === year);
  }

  // Re-render project cards
  renderProjects(filtered, document.querySelector(".projects"), "h2");

  // Rebuild new data from the filtered projects
  let newData = buildPieData(filtered);

  // Re-render the pie chart to reflect filtered data
  renderPieChart(newData);
}
