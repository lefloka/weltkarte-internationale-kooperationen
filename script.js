

/* ==========================================
   INTERAKTIVE WELTKARTE
========================================== */

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 510;

const COLORS = {
    neutral: "#DDE4E8",
    active: "#399A91",
    inactive: "#D9A45B",
    multiple: "#7189A5",
    selected: "#244B60"
};

let worldData = null;
let selectedCountry = null;
let activeFilters = {};

// HTML-Elemente
const mapContainer = document.getElementById("world-map");
const projectResults = document.getElementById("projectResults");
const projectCount = document.getElementById("projectCount");


// ==========================================
// HILFSFUNKTIONEN
// ==========================================

function getCountryCode(feature) {
    const p = feature.properties || {};

    return p.ISO_A3 ||
           p.ADM0_A3 ||
           p.SOV_A3 ||
           "";
}

function getCountryName(feature) {
    const p = feature.properties || {};

    return p.ADMIN ||
           p.NAME ||
           p.NAME_EN ||
           "Unbekanntes Land";
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function getProjectTheme(project) {
    if (Array.isArray(project.themes)) {
        return project.themes.join(", ");
    }

    return project.theme || "Noch nicht zugeordnet";
}

function getCountryDisplayName(code) {
    const feature = worldData.features.find(
        item => getCountryCode(item) === code
    );

    return feature ? getCountryName(feature) : code;
}


// ==========================================
// FILTER AUSLESEN
// ==========================================

function readFilters() {
    const yearValue =
        document.getElementById("yearFilter").value;

    activeFilters = {
        status: document.getElementById("statusFilter").value,
        year: yearValue === "all" ? null : Number(yearValue),
        department: document.getElementById("departmentFilter").value,
        country: document.getElementById("countryFilter").value,
        theme: document.getElementById("themeFilter").value
    };

    return filterProjects(activeFilters);
}


// ==========================================
// FILTER OPTIONEN ERSTELLEN
// ==========================================

function populateFilters() {

    const projects = allProjects;

    const years = new Set();
    const departments = new Set();
    const countries = new Set();
    const themes = new Set();

    projects.forEach(project => {

        // Laufzeiten
        if (project.startYear && project.endYear) {
            for (
                let year = Number(project.startYear);
                year <= Number(project.endYear);
                year++
            ) {
                years.add(year);
            }
        } else {
            if (project.startYear) years.add(Number(project.startYear));
            if (project.endYear) years.add(Number(project.endYear));
        }

        // Abteilungen
        if (project.department) {
            departments.add(project.department);
        }

        // Länder
        (project.countries || []).forEach(code => {
            countries.add(code);
        });

        // Thematische Schlagworte
        const theme = getProjectTheme(project);

        if (theme && theme !== "Noch nicht zugeordnet") {
            themes.add(theme);
        }
    });

    const yearFilter = document.getElementById("yearFilter");
    const departmentFilter =
        document.getElementById("departmentFilter");
    const countryFilter =
        document.getElementById("countryFilter");
    const themeFilter =
        document.getElementById("themeFilter");

    // Vorhandene dynamische Optionen entfernen
    [
        yearFilter,
        departmentFilter,
        countryFilter,
        themeFilter
    ].forEach(select => {
        while (select.options.length > 1) {
            select.remove(1);
        }
    });

    [...years].sort((a, b) => a - b).forEach(year => {
        yearFilter.add(new Option(year, year));
    });

    [...departments].sort().forEach(department => {
        departmentFilter.add(
            new Option(department, department)
        );
    });

    [...countries].sort().forEach(code => {
        countryFilter.add(
            new Option(getCountryDisplayName(code), code)
        );
    });

    [...themes].sort().forEach(theme => {
        themeFilter.add(new Option(theme, theme));
    });
}


// ==========================================
// PROJEKTE ANZEIGEN
// ==========================================

function renderProjects(projects) {

    projectCount.textContent =
        projects.length +
        (projects.length === 1 ? " Projekt" : " Projekte");

    if (projects.length === 0) {
        projectResults.innerHTML = `
            <p class="empty-results">
                Für diese Filterauswahl wurden keine Projekte gefunden.
            </p>
        `;
        return;
    }

    projectResults.innerHTML = projects.map(project => {

        const countries = (project.countries || []).map(
            getCountryDisplayName
        );

        return `
            <article class="project-card">

                <span class="project-status ${escapeHTML(project.status)}">
                    ${project.status === "active" ? "Aktiv" : "Inaktiv"}
                </span>

                <h3>${escapeHTML(project.name)}</h3>

                <p>
                    <strong>Laufzeit:</strong>
                    ${escapeHTML(project.startYear || "–")}
                    –
                    ${escapeHTML(project.endYear || "–")}
                </p>

                <p>
                    <strong>Abteilung:</strong>
                    ${escapeHTML(project.department || "Keine Angabe")}
                </p>

                <p>
                    <strong>Länder:</strong>
                    ${countries.map(escapeHTML).join(", ") || "Keine Angabe"}
                </p>

                <p>
                    <strong>Partner:</strong>
                    ${(project.partners || []).map(escapeHTML).join(", ") || "Noch keine Angaben"}
                </p>

                <p>
                    <strong>Themen:</strong>
                    ${escapeHTML(getProjectTheme(project))}
                </p>

                <p>${escapeHTML(project.description || "")}</p>

            </article>
        `;

    }).join("");
}


// ==========================================
// KARTENFARBEN
// ==========================================

function getCountryColor(code, projects) {

    const assigned = projects.filter(project =>
        (project.countries || []).includes(code)
    );

    if (assigned.length === 0) {
        return COLORS.neutral;
    }

    const hasActive = assigned.some(
        project => project.status === "active"
    );

    const hasInactive = assigned.some(
        project => project.status === "inactive"
    );

    if (hasActive && hasInactive) {
        return COLORS.multiple;
    }

    if (assigned.length > 1) {
        return COLORS.multiple;
    }

    return hasActive
        ? COLORS.active
        : COLORS.inactive;
}


function updateMap() {

    const projects = readFilters();

    renderProjects(projects);

    d3.select("#world-svg")
        .selectAll(".country")
        .transition()
        .duration(200)
        .attr("fill", feature => {

            const code = getCountryCode(feature);

            return getCountryColor(code, projects);
        });

    if (selectedCountry) {
        showCountryInfo(selectedCountry, projects);
    }
}


// ==========================================
// LÄNDERINFORMATIONEN
// ==========================================

function showCountryInfo(feature, projects) {

    const code = getCountryCode(feature);
    const name = getCountryName(feature);

    const countryProjects = projects.filter(project =>
        (project.countries || []).includes(code)
    );

    const info = document.getElementById("country-info");

    info.innerHTML = `
        <div class="country-info-content">

            <p class="eyebrow">INTERNATIONALE KOOPERATION</p>

            <h2>${escapeHTML(name)}</h2>

            ${
                countryProjects.length
                ? `
                    <h3>Zugeordnete Projekte (${countryProjects.length})</h3>

                    <div class="project-grid">

                        ${countryProjects.map(project => `
                            <article class="project-card">

                                <h3>${escapeHTML(project.name)}</h3>

                                <p>
                                    Status:
                                    ${project.status === "active" ? "Aktiv" : "Inaktiv"}
                                </p>

                                <p>
                                    Laufzeit:
                                    ${escapeHTML(project.startYear || "–")}
                                    –
                                    ${escapeHTML(project.endYear || "–")}
                                </p>

                                <p>
                                    Abteilung:
                                    ${escapeHTML(project.department || "Keine Angabe")}
                                </p>

                                <p>
                                    Themen:
                                    ${escapeHTML(getProjectTheme(project))}
                                </p>

                                <p>
                                    ${escapeHTML(project.description || "")}
                                </p>

                            </article>
                        `).join("")}

                    </div>
                `
                : `
                    <p>
                        Für dieses Land sind mit der aktuellen
                        Filterauswahl keine Projekte hinterlegt.
                    </p>
                `
            }

        </div>
    `;
}


// ==========================================
// WELTKARTE ZEICHNEN
// ==========================================

function renderMap() {

    const svg = d3.select("#world-map")
        .html("")
        .append("svg")
        .attr("id", "world-svg")
        .attr("viewBox", `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`)
        .attr("role", "img")
        .attr("aria-label", "Interaktive Weltkarte");

    const projection = d3.geoWinkel3()
        .fitExtent(
            [[15, 15], [MAP_WIDTH - 15, MAP_HEIGHT - 15]],
            worldData
        );

    const path = d3.geoPath().projection(projection);

    svg.selectAll(".country")
        .data(worldData.features)
        .join("path")
        .attr("class", "country")
        .attr("d", path)
        .attr("fill", COLORS.neutral)
        .attr("stroke", "#FFFFFF")
        .attr("stroke-width", 0.7)
        .on("click", function(event, feature) {

            selectedCountry = feature;

            svg.selectAll(".country")
                .classed("selected", false);

            d3.select(this).classed("selected", true);

            showCountryInfo(feature, readFilters());
        })
        .append("title")
        .text(feature => getCountryName(feature));

    updateMap();
}


// ==========================================
// FILTER AKTIVIEREN
// ==========================================

function setupFilterEvents() {

    document.querySelectorAll(".filter-group select")
        .forEach(select => {
            select.addEventListener("change", updateMap);
        });

    document.getElementById("resetFilters")
        .addEventListener("click", () => {

            document.getElementById("statusFilter").value = "all";
            document.getElementById("yearFilter").value = "all";
            document.getElementById("departmentFilter").value = "all";
            document.getElementById("countryFilter").value = "all";
            document.getElementById("themeFilter").value = "all";

            selectedCountry = null;

            document.getElementById("country-info").innerHTML = `
                <div class="info-placeholder">
                    <h2>Informationen</h2>
                    <p>Wähle ein Land auf der Karte aus.</p>
                </div>
            `;

            d3.select("#world-svg")
                .selectAll(".country")
                .classed("selected", false);

            updateMap();
        });
}


// ==========================================
// ANWENDUNG STARTEN
// ==========================================

async function startApplication() {

    try {

        mapContainer.innerHTML =
            "<p>Weltkarte wird geladen ...</p>";

        await loadProjects();

        const response = await fetch("maps/world.geojson");

        if (!response.ok) {
            throw new Error("Die Weltkarte konnte nicht geladen werden.");
        }

        worldData = await response.json();

        if (!worldData.features || !worldData.features.length) {
            throw new Error("Die GeoJSON-Datei enthält keine Länder.");
        }

        populateFilters();
        setupFilterEvents();
        renderMap();

    } catch (error) {

        console.error(error);

        mapContainer.innerHTML = `
            <p class="map-error">
                Die Anwendung konnte nicht vollständig geladen werden.

                Bitte prüfe die Dateien und starte die Anwendung
                über einen lokalen Webserver.

                <br><br>

                Fehler: ${escapeHTML(error.message)}
            </p>
        `;
    }
}


// ==========================================
// START
// ==========================================

startApplication();
