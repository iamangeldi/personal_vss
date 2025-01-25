console.log("IT’S ALIVE!");

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// Add navigation menu dynamically (Step 3)
let pages = [
  { url: "", title: "Home" },
  { url: "projects/", title: "Projects" },
  { url: "contact/", title: "Contact" },
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

// Add the dark mode switcher at the top of the body
document.body.insertAdjacentHTML(
  'afterbegin',
  `
  <label class="color-scheme">
    Theme:
    <select>
      <option value="light dark">Automatic</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>
`);

// Function to set the color scheme and update the <select> element
function setColorScheme(colorScheme) {
  // Apply the selected color scheme to the root element
  document.documentElement.style.setProperty("color-scheme", colorScheme);

  // Update the <select> element to reflect the current color scheme
  const select = document.querySelector(".color-scheme select");
  if (select) select.value = colorScheme;
}

// Get the <select> element
const select = document.querySelector(".color-scheme select");

// Load the saved color scheme preference from localStorage, if available
if ("colorScheme" in localStorage) {
  setColorScheme(localStorage.colorScheme);
}

// Add an event listener to save and apply the user's preference
select.addEventListener("input", function (event) {
  const newScheme = event.target.value;

  // Save the user's preference to localStorage
  localStorage.colorScheme = newScheme;

  // Apply the selected color scheme
  setColorScheme(newScheme);
});
