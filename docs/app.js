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

// Typewriter for hero headline
const heroTitle = document.querySelector(".about-text h2");
const fullTitle = heroTitle ? heroTitle.textContent.trim() : "";
if (heroTitle && fullTitle) {
  heroTitle.textContent = "";
  const cursor = document.createElement("span");
  cursor.className = "cursor";
  heroTitle.appendChild(cursor);

  let i = 0;
  const typeNext = () => {
    if (i < fullTitle.length) {
      heroTitle.insertBefore(document.createTextNode(fullTitle.charAt(i)), cursor);
      i += 1;
      setTimeout(typeNext, 55);
    } else {
      setTimeout(() => {
        cursor.remove();
      }, 2000);
    }
  };

  // retrigger on page load (including when returning from another page)
  setTimeout(typeNext, 200);
}

const ROTATION_MS = 4600;
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

const postsBar = document.getElementById("posts-bar");
const projectList = document.getElementById("project-list");
let projectCards = [];

// Projects preview cards on the home page
if (projectList) {
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

  projectCards = Array.from(projectList.querySelectorAll(".project-card"));
}

// Unified rotation for posts bar and project highlights
if ((postsBar || projectCards.length) && projects.length > 0) {
  let activeIndex = 0;

  const setActive = (index) => {
    if (postsBar) {
      const text = `${projects[index].title} — ${projects[index].description}`;
      postsBar.textContent = text;
    }
    if (projectCards.length) {
      projectCards.forEach((card, i) => {
        card.classList.toggle("is-active", i === index);
      });
    }
  };

  // initial render
  setActive(activeIndex);

  setInterval(() => {
    if (postsBar) {
      postsBar.classList.add("is-fading");
    }
    setTimeout(() => {
      activeIndex = (activeIndex + 1) % projects.length;
      setActive(activeIndex);
      if (postsBar) {
        postsBar.classList.remove("is-fading");
      }
    }, 240);
  }, ROTATION_MS);
}
