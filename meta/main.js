let data = [];
let commits = [];
let brushSelection = null;

// 1) Load CSV & Process
async function loadData() {
  data = await d3.csv("loc.csv", (row) => ({
    ...row,
    line: +row.line,
    depth: +row.depth,
    length: +row.length,
    date: new Date(row.date + "T00:00" + row.timezone),
    datetime: new Date(row.datetime),
  }));

  processCommits();
  displayStats();
  createScatterplot();
}

function processCommits() {
  commits = d3.groups(data, (d) => d.commit).map(([commit, lines]) => {
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
      totalLines: lines.length,
    };
    Object.defineProperty(ret, "lines", {
      value: lines,
      enumerable: false,
    });
    return ret;
  });
}

// 2) Display summary stats
function displayStats() {
  const dl = d3.select("#stats").append("dl").attr("class", "stats");

  // Total LOC
  dl.append("dt").html('Total <abbr title="Lines of Code">LOC</abbr>');
  dl.append("dd").text(data.length);

  // Total commits
  dl.append("dt").text("Total commits");
  dl.append("dd").text(commits.length);

  // Example: Distinct files
  const distinctFiles = d3.group(data, (d) => d.file).size;
  dl.append("dt").text("Number of files");
  dl.append("dd").text(distinctFiles);

  // Example: Max depth
  const maxDepth = d3.max(data, (d) => d.depth);
  dl.append("dt").text("Max depth");
  dl.append("dd").text(maxDepth);
}

// 3) Scatterplot
const width = 1000;
const height = 600;
const margin = { top: 10, right: 10, bottom: 30, left: 40 };

function createScatterplot() {
  const svg = d3
    .select("#chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("overflow", "visible");

  const xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([margin.left, width - margin.right])
    .nice();

  const yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([height - margin.bottom, margin.top]);

  // Gridlines
  const gridlines = svg
    .append("g")
    .attr("class", "gridlines")
    .attr("transform", `translate(${margin.left},0)`);

  gridlines.call(
    d3
      .axisLeft(yScale)
      .tickFormat("")
      .tickSize(-(width - margin.left - margin.right))
  );

  // Axes
  const xAxis = d3.axisBottom(xScale);
  svg
    .append("g")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(xAxis);

  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, "0") + ":00");
  svg.append("g").attr("transform", `translate(${margin.left},0)`).call(yAxis);

  // Dot size scale
  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3
    .scaleSqrt()
    .domain([minLines, maxLines])
    .range([2, 30]);

  // Sort commits so bigger circles draw first
  const sortedCommits = d3.sort(commits, (a, b) => d3.descending(a.totalLines, b.totalLines));

  const dotsG = svg.append("g").attr("class", "dots");
  dotsG
    .selectAll("circle")
    .data(sortedCommits)
    .join("circle")
    .attr("cx", (d) => xScale(d.datetime))
    .attr("cy", (d) => yScale(d.hourFrac))
    .attr("r", (d) => rScale(d.totalLines))
    .attr("fill", "steelblue")
    .style("fill-opacity", 0.7)
    .on("mouseenter", (event, d) => {
      d3.select(event.currentTarget).style("fill-opacity", 1);
      updateTooltipContent(d);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on("mousemove", (event) => {
      updateTooltipPosition(event);
    })
    .on("mouseleave", (event) => {
      d3.select(event.currentTarget).style("fill-opacity", 0.7);
      updateTooltipContent({});
      updateTooltipVisibility(false);
    });

  // Brush
  const brush = d3
    .brush()
    .extent([
      [0, 0],
      [width, height],
    ])
    .on("start brush end", brushed);

  svg.call(brush);
  // Raise dots above overlay
  svg.selectAll(".dots, .overlay ~ *").raise();
}

function brushed(event) {
  brushSelection = event.selection;
  updateSelection();
  updateSelectionCount();
  updateLanguageBreakdown();
}

function isCommitSelected(commit) {
  if (!brushSelection) return false;
  const [[x0, y0], [x1, y1]] = brushSelection;
  const cx = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([margin.left, width - margin.right])
    .nice()(commit.datetime);
  const cy = d3
    .scaleLinear()
    .domain([0, 24])
    .range([height - margin.bottom, margin.top])(commit.hourFrac);

  return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
}

function updateSelection() {
  d3.selectAll("circle").classed("selected", (d) => isCommitSelected(d));
}

function updateSelectionCount() {
  const selectedCommits = brushSelection
    ? commits.filter(isCommitSelected)
    : [];
  document.getElementById("selection-count").textContent = `${
    selectedCommits.length || "No"
  } commits selected`;
}

function updateLanguageBreakdown() {
  const container = document.getElementById("language-breakdown");
  container.innerHTML = "";
  const selectedCommits = brushSelection
    ? commits.filter(isCommitSelected)
    : [];
  if (!selectedCommits.length) return;

  let lines = [];
  selectedCommits.forEach((c) => {
    lines = lines.concat(c.lines);
  });

  // Group by d.type
  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type
  );

  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format(".1~%")(proportion);
    container.innerHTML += `
      <dt>${language}</dt>
      <dd>${count} lines (${formatted})</dd>
    `;
  }
}

// Tooltip logic
function updateTooltipContent(commit) {
  const linkEl = document.getElementById("commit-link");
  const dateEl = document.getElementById("commit-date");
  const authorEl = document.getElementById("commit-author");
  const linesEl = document.getElementById("commit-lines");

  if (!commit.id) {
    linkEl.href = "";
    linkEl.textContent = "";
    dateEl.textContent = "";
    authorEl.textContent = "";
    linesEl.textContent = "";
    return;
  }

  linkEl.href = commit.url;
  linkEl.textContent = commit.id.slice(0, 7);
  dateEl.textContent = commit.datetime?.toLocaleString();
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

// Run loadData once DOM is ready
document.addEventListener("DOMContentLoaded", loadData);
