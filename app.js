// Change theme example
document.getElementById("changeColorBtn").addEventListener("click", () => {
    document.body.classList.toggle("dark");
});

// Example of adding projects dynamically
const projects = [
    { title: "Project 1", description: "Blank, will add soon!" },
    { title: "Project 2", description: "Blank, will add soon!" }
];

const list = document.getElementById("project-list");

projects.forEach(project => {
    const item = document.createElement("div");
    item.innerHTML = `<h3>${project.title}</h3><p>${project.description}</p>`;
    list.appendChild(item);
});
