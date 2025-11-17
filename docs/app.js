// Theme toggle: base is dark, toggle to light
// Persist theme across pages using localStorage
const storedTheme = localStorage.getItem("theme");
if (storedTheme === "light") {
  document.body.classList.add("light");
}

const themeButton = document.getElementById("changeColorBtn");
if (themeButton) {
  themeButton.addEventListener("click", () => {
    document.body.classList.toggle("light");
    const isLight = document.body.classList.contains("light");
    localStorage.setItem("theme", isLight ? "light" : "dark");
  });
}

// Rotating posts bar
const posts = [
  "Building projects at the University of Pittsburgh.",
  "Interested in software engineering, data, and design.",
  "Always learning new technologies and tools."
];

const postsBar = document.getElementById("posts-bar");
if (postsBar && posts.length > 0) {
  let currentPost = 0;
  postsBar.textContent = posts[currentPost];

  setInterval(() => {
    currentPost = (currentPost + 1) % posts.length;
    postsBar.textContent = posts[currentPost];
  }, 4000);
}

const projectsSection = document.getElementById("projects");
if (projectsSection) {
  projectsSection.addEventListener("click", () => {
    projectsSection.classList.toggle("fullscreen");
  });
}

// Projects preview cards on the home page
const projectList = document.getElementById("project-list");
if (projectList) {
  const projects = [
  {
    title: "Water Quality in the Netherlands",
    description: "Data analysis & statistical modeling project using Pandas libraries.",
    link: "water-quality.html"
  },
  {
    title: "Portfolio Website",
    description: "Personal portfolio website built with HTML, CSS, and JavaScript.",
    link: "port-website.html"
  }
];

projects.forEach((project) => {
  const item = document.createElement("div");
  item.className = "project-card";
  item.innerHTML = `
    <h3>${project.title}</h3>
    <p>${project.description}</p>
    <a href="${project.link}" target="_blank">View details</a>
  `;
  projectList.appendChild(item);
});
}
