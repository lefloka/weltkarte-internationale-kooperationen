
/* =========================================
   PROJEKTDATEN UND FILTER
========================================= */

const STORAGE_KEY = "weltkartenProjekte";

let allProjects = [];
let filteredProjects = [];

// Einheitliches Datenformat herstellen
function normalizeProjects(projects) {
    return projects.map(project => ({
        ...project,
        countries: project.countries || [],
        partners: project.partners || [],
        theme: project.theme ||
            (Array.isArray(project.themes)
                ? project.themes.join(", ")
                : project.themes) ||
            "Noch nicht zugeordnet"
    }));
}

// Projektdaten laden
async function loadProjects() {
    try {
        // Zuerst lokalen Browserspeicher prüfen
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved) {
            const data = JSON.parse(saved);

            const storedProjects = Array.isArray(data)
                ? data
                : data.projects;

            if (Array.isArray(storedProjects)) {
                allProjects = normalizeProjects(storedProjects);
                filteredProjects = [...allProjects];
                return allProjects;
            }
        }

        // Falls noch keine lokalen Daten existieren:
        // projects.json laden
        const response = await fetch("data/projects.json");

        if (!response.ok) {
            throw new Error("Projektdaten konnten nicht geladen werden.");
        }

        const data = await response.json();

        allProjects = normalizeProjects(data.projects || []);
        filteredProjects = [...allProjects];

        return allProjects;

    } catch (error) {
        console.error("Fehler beim Laden der Projekte:", error);
        throw error;
    }
}

// Projekte filtern
function filterProjects(filters = {}) {

    filteredProjects = allProjects.filter(project => {

        if (
            filters.status &&
            filters.status !== "all" &&
            project.status !== filters.status
        ) return false;

        if (
            filters.year &&
            (
                (project.startYear != null &&
                    project.startYear > filters.year) ||
                (project.endYear != null &&
                    project.endYear < filters.year)
            )
        ) return false;

        if (
            filters.department &&
            filters.department !== "all" &&
            project.department !== filters.department
        ) return false;

        if (
            filters.country &&
            filters.country !== "all" &&
            !project.countries.includes(filters.country)
        ) return false;

        if (
            filters.theme &&
            filters.theme !== "all" &&
            !String(project.theme).toLowerCase()
                .includes(filters.theme.toLowerCase())
        ) return false;

        return true;
    });

    return filteredProjects;
}

function getProjects() {
    return filteredProjects;
}

function getProjectsByCountry(countryCode) {
    return filteredProjects.filter(project =>
        project.countries.includes(countryCode)
    );
}

