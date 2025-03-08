// main.js

// === Global Variables ===
let data = [];
let commits = [];
let filteredCommits = [];  // commits filtered by time
let selectedCommits = [];  // commits selected via brushing
let commitProgress = 100;  // slider value (0-100)
let timeScale;             // maps 0-100 slider to commit dates

// Variables for scrollytelling (commits narrative)
let NUM_ITEMS = 0;         // total commits count (or commit history length)
let ITEM_HEIGHT = 100;      // height for each narrative item (adjust as needed)
let VISIBLE_COUNT = 10;    // how many items to render at once
let totalHeight = 0;
const scrollContainer = d3.select("#scroll-container");
const spacer = d3.select("#spacer");
const itemsContainer = d3.select("#items-container");

// Scatterplot dimensions and margins
const width = 1200;
const height = 700;
const margin = { top: 20, right: 20, bottom: 40, left: 50 };

// === Data Loading and Initialization ===
document.addEventListener("DOMContentLoaded", () => {
  loadData().then(() => {
    // Create time scale after commits are processed
    timeScale = d3.scaleTime()
      .domain(d3.extent(commits, d => d.datetime))
      .range([0, 100]);
    updateTimeDisplay(); // sets filteredCommits & updates viz

    // Setup scrollytelling for commit narrative
    NUM_ITEMS = commits.length;
    totalHeight = (NUM_ITEMS - 1) * ITEM_HEIGHT;
    spacer.style("height", `${totalHeight}px`);

    // Attach scroll event for narrative rendering
    scrollContainer.on("scroll", () => {
      const scrollTop = scrollContainer.property("scrollTop");
      let startIndex = Math.floor(scrollTop / ITEM_HEIGHT);
      startIndex = Math.max(0, Math.min(startIndex, commits.length - VISIBLE_COUNT));
      renderItems(startIndex);
    });
  });
});

// Attach slider event
document.getElementById("timeSlider").addEventListener("input", updateTimeDisplay);

async function loadData() {
  data = await d3.csv("loc.csv", (row) => ({
    ...row,
    line: +row.line,
    depth: +row.depth,
    length: +row.length,
    date: new Date(row.date + "T00:00" + row.timezone),
    datetime: new Date(row.datetime)
  }));

  processCommits();
  displayStats();

  // Initially, show all commits in filteredCommits
  filteredCommits = commits;
  updateScatterplot(filteredCommits);
  displayCommitFiles();
}

function processCommits() {
  // Group rows by commit identifier
  commits = d3.groups(data, d => d.commit)
    .map(([commit, lines]) => {
      const first = lines[0];
      const { author, date, time, timezone, datetime } = first;
      let ret = {
        id: commit,
        url: "https://github.com/YOUR_ORG/YOUR_REPO/commit/" + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length
      };
      Object.defineProperty(ret, "lines", {
        value: lines,
        enumerable: false
      });
      return ret;
    });
}

function displayStats() {
  const dl = d3.select("#stats").append("dl").attr("class", "stats");
  dl.append("dt").html('Total <abbr title="Lines of Code">LOC</abbr>');
  dl.append("dd").text(data.length);

  dl.append("dt").text("Total commits");
  dl.append("dd").text(commits.length);

  const distinctFiles = d3.group(data, d => d.file).size;
  dl.append("dt").text("Number of files");
  dl.append("dd").text(distinctFiles);

  const maxDepth = d3.max(data, d => d.depth);
  dl.append("dt").text("Max depth");
  dl.append("dd").text(maxDepth);
}

// === Time Slider and Filtering ===
function updateTimeDisplay() {
  commitProgress = +document.getElementById("timeSlider").value;
  const commitMaxTime = timeScale.invert(commitProgress);
  d3.select("#selectedTime").text(commitMaxTime.toLocaleString("en", { dateStyle: "long", timeStyle: "short" }));
  
  // Filter commits whose datetime is <= commitMaxTime
  filteredCommits = commits.filter(d => d.datetime <= commitMaxTime);
  updateScatterplot(filteredCommits);
  displayCommitFiles();
}

// === Scatterplot with Brush, Transitions, and Filtering ===
function updateScatterplot(currentCommits) {
  d3.select("#chart").selectAll("svg").remove();
  const svg = d3.select("#chart")
    .append("svg")
    .attr("viewBox", [0, 0, width, height])
    .style("overflow", "visible");

  // If no commits in current filter, fallback to global domain
  let xDomain = d3.extent(currentCommits, d => d.datetime);
  if (!xDomain[0] || !xDomain[1]) {
    xDomain = d3.extent(commits, d => d.datetime);
  }
  const xScale = d3.scaleTime().domain(xDomain).range([margin.left, width - margin.right]).nice();
  const yScale = d3.scaleLinear().domain([0, 24]).range([height - margin.bottom, margin.top]);

  // Axes with larger text
  const xAxis = d3.axisBottom(xScale).ticks(8);
  svg.append("g")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(xAxis)
    .selectAll("text")
    .style("font-size", "16px");

  const yAxis = d3.axisLeft(yScale)
    .tickFormat(d => String(d % 24).padStart(2, "0") + ":00")
    .ticks(6);
  svg.append("g")
    .attr("transform", `translate(${margin.left}, 0)`)
    .call(yAxis)
    .selectAll("text")
    .style("font-size", "16px");

  // Gridlines for reference
  svg.append("g")
    .attr("class", "gridlines")
    .attr("transform", `translate(${margin.left},0)`)
    .call(
      d3.axisLeft(yScale)
        .tickFormat("")
        .tickSize(-(width - margin.left - margin.right))
    );

  // Scale for circle radii based on commit.totalLines
  let [minLines, maxLines] = d3.extent(currentCommits, d => d.totalLines);
  if (minLines == null || maxLines == null) { minLines = 0; maxLines = 1; }
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  // Sort commits so larger circles are drawn first
  const sorted = d3.sort(currentCommits, (a, b) => d3.descending(a.totalLines, b.totalLines));

  // Draw circles with .join() and CSS transitions (using @starting-style in CSS)
  const dotsG = svg.append("g").attr("class", "dots");
  dotsG.selectAll("circle")
    .data(sorted)
    .join("circle")
    .attr("cx", d => xScale(d.datetime))
    .attr("cy", d => yScale(d.hourFrac))
    .attr("r", d => rScale(d.totalLines))
    .attr("fill", "steelblue")
    .style("fill-opacity", 0.7)
    .on("mouseenter", (event, d) => {
      d3.select(event.currentTarget).classed("selected", isCommitSelected(d));
      updateTooltipContent(d);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on("mousemove", updateTooltipPosition)
    .on("mouseleave", (event, d) => {
      d3.select(event.currentTarget).classed("selected", isCommitSelected(d));
      updateTooltipContent({});
      updateTooltipVisibility(false);
    });

  // Brush for selection – update selectedCommits directly
  const brush = d3.brush()
    .extent([[0, 0], [width, height]])
    .on("start brush end", evt => brushed(evt, xScale, yScale));
  svg.call(brush);
  svg.selectAll(".dots, .overlay ~ *").raise();
}

// Brush handler: update selectedCommits without keeping a separate brushSelection variable
function brushed(evt, xScale, yScale) {
  const selection = evt.selection;
  if (!selection) {
    selectedCommits = [];
  } else {
    const [[x0, y0], [x1, y1]] = selection;
    selectedCommits = commits.filter(c => {
      const cx = xScale(c.datetime);
      const cy = yScale(c.hourFrac);
      return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
    });
  }
  updateSelection();
  updateSelectionCount();
  updateLanguageBreakdown();
}

function isCommitSelected(commit) {
  return selectedCommits.includes(commit);
}

function updateSelection() {
  d3.selectAll("circle").classed("selected", d => isCommitSelected(d));
}

function updateSelectionCount() {
  const count = selectedCommits.length;
  document.getElementById("selection-count").textContent =
    count ? `${count} commits selected` : "No commits selected";
}

function updateLanguageBreakdown() {
  const container = document.getElementById("language-breakdown");
  container.innerHTML = "";
  if (!selectedCommits.length) return;
  let lines = [];
  selectedCommits.forEach(c => { lines = lines.concat(c.lines); });
  const breakdown = d3.rollup(lines, v => v.length, d => d.type);
  for (const [lang, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format(".1~%")(proportion);
    container.innerHTML += `<dt>${lang}</dt><dd>${count} lines (${formatted})</dd>`;
  }
}

// === Tooltip Functions ===
function updateTooltipContent(commit) {
  const linkEl = document.getElementById("commit-link");
  const dateEl = document.getElementById("commit-date");
  const authorEl = document.getElementById("commit-author");
  const linesEl = document.getElementById("commit-lines");
  if (!commit || !commit.id) {
    linkEl.href = "";
    linkEl.textContent = "";
    dateEl.textContent = "";
    authorEl.textContent = "";
    linesEl.textContent = "";
    return;
  }
  linkEl.href = commit.url;
  linkEl.textContent = commit.id.slice(0, 7);
  dateEl.textContent = commit.datetime.toLocaleString();
  authorEl.textContent = commit.author;
  linesEl.textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
  document.getElementById("commit-tooltip").hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById("commit-tooltip");
  tooltip.style.left = event.clientX + 10 + "px";
  tooltip.style.top = event.clientY + 10 + "px";
}

// === Unit Visualization for File Sizes ===
function displayCommitFiles() {
  const lines = filteredCommits.flatMap(d => d.lines);
  const fileTypeColors = d3.scaleOrdinal(d3.schemeTableau10);
  let files = d3.groups(lines, d => d.file)
    .map(([name, lines]) => ({ name, lines }));
  // Sort files descending by number of lines
  files = d3.sort(files, d => -d.lines.length);
  d3.select(".files").selectAll("div").remove();
  const filesContainer = d3.select(".files")
    .selectAll("div")
    .data(files)
    .enter()
    .append("div");
  // Display filename and line count in <dt>
  filesContainer.append("dt")
    .html(d => `<code>${d.name}</code><small>${d.lines.length} lines</small>`);
  // For each file, display a dot per line in <dd>
  filesContainer.append("dd")
    .selectAll("div")
    .data(d => d.lines)
    .enter()
    .append("div")
    .attr("class", "line")
    .style("background", d => fileTypeColors(d.type));
}

// === Scrollytelling for Commits (Narrative) ===
function renderItems(startIndex) {
  itemsContainer.selectAll("div").remove();
  const endIndex = Math.min(startIndex + VISIBLE_COUNT, commits.length);
  const newCommitSlice = commits.slice(startIndex, endIndex);

  // Update the scatterplot to reflect the currently visible commits
  updateScatterplot(newCommitSlice);

  // Bind commit data to narrative items
  itemsContainer.selectAll("div")
    .data(newCommitSlice)
    .enter()
    .append("div")
    .attr("class", "item")
    .style("position", "absolute")
    .style("top", (_, idx) => `${idx * ITEM_HEIGHT}px`)
    .html((d, i) => `
      <p>
        On ${d.datetime.toLocaleString("en", { dateStyle: "full", timeStyle: "short" })}, I made 
        <a href="${d.url}" target="_blank">
          ${i > 0 ? "another glorious commit" : "my first commit, and it was glorious"}
        </a>. I edited ${d.totalLines} lines across ${d.lines ? d3.rollups(d.lines, v => v.length, d => d.file).length : 0} files.
        Then I reviewed all my changes and felt it was excellent.
      </p>
    `);
}
