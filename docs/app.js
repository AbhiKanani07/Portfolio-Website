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
  "Prototyping data stories at the University of Pittsburgh.",
  "Building a sleep insights dashboard fed by Fitbit/Apple Health.",
  "Modeling how YouTube recommendations shape what I watch next."
];

const postsBar = document.getElementById("posts-bar");
if (postsBar && posts.length > 0) {
  let currentPost = 0;
  postsBar.textContent = posts[currentPost];

  setInterval(() => {
    postsBar.classList.add("is-fading");
    setTimeout(() => {
      currentPost = (currentPost + 1) % posts.length;
      postsBar.textContent = posts[currentPost];
      postsBar.classList.remove("is-fading");
    }, 240);
  }, 4600);
}

// Projects preview cards on the home page
const projectList = document.getElementById("project-list");
if (projectList) {
  const projects = [
  {
    title: "Sleep Pattern & Health Insights Dashboard",
    description: "Personal Fitbit/Apple Health pipeline turning nightly sleep into actionable trends and predictions.",
    link: "sleep-dashboard.html"
  },
  {
    title: "Water Quality in the Netherlands",
    description: "Spatial/seasonal analysis of Dutch water quality with NumPy/Pandas and decision-ready visuals.",
    link: "water-quality.html"
  },
  {
    title: "YouTube Recommendation Bias & Viewing Model",
    description: "Graph-based simulator using my watch history to study recommendation paths and viewing behavior.",
    link: "youtube-rec.html"
  }
];

projects.forEach((project) => {
  const item = document.createElement("div");
  item.className = "project-card";
  item.innerHTML = `
    <h3>${project.title}</h3>
    <p>${project.description}</p>
    <a href="${project.link}">View details</a>
  `;
  projectList.appendChild(item);
});
}
