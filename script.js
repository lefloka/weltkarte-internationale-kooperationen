/* ==========================================
   INTERAKTIVE WELTKARTE
   Dezente Kreise mit Hover und Auswahl
========================================== */

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 510;

const COLORS = {
    neutral: "#DDE4E8",
    active: "#399A91",
    selected: "#244B60",
    hover: "#286F70"
};

const MARKER_OPACITY = 0.32;
const HOVER_OPACITY = 1;
const SELECTED_OPACITY = 1;


let worldData = null;
let selectedCountry = null;
let activeFilters = {};
let mapPath = null;
let radiusScale = null;
let countryCounts = new Map();

// ==========================================
// ZOOM-STEUERUNG
// ==========================================

let zoomBehavior = null;
let mapGroup = null;

const ZOOM_MIN = 1;
const ZOOM_MAX = 8;
const ZOOM_STEP = 1.4;


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
    if (Array.isArray(project.themes) && project.themes.length) {
        return project.themes.join(", ");
    }

    return project.theme || "Noch nicht zugeordnet";
}

function getCountryDisplayName(code) {
    if (!worldData) return code;

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

        if (project.department) {
            departments.add(project.department);
        }

        (project.countries || []).forEach(code => {
            countries.add(code);
        });

        const theme = getProjectTheme(project);

        if (theme && theme !== "Noch nicht zugeordnet") {
            theme.split(",")
                .map(item => item.trim())
                .filter(Boolean)
                .forEach(item => themes.add(item));
        }
    });

    const yearFilter = document.getElementById("yearFilter");
    const departmentFilter =
        document.getElementById("departmentFilter");
    const countryFilter =
        document.getElementById("countryFilter");
    const themeFilter =
        document.getElementById("themeFilter");

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
        departmentFilter.add(new Option(department, department));
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

                <p>
                    <strong>Ansprechpartner:</strong>
                    ${escapeHTML(project.contactPerson || "Keine Angabe")}
                </p>


            </article>
        `;

    }).join("");
}


// ==========================================
// KREISGRÖSSEN
// ==========================================

function getMarkerRadius(feature) {

    const count = countryCounts.get(getCountryCode(feature)) || 1;

    return radiusScale(count);
}


// ==========================================
// MARKER ZURÜCKSETZEN
// ==========================================

function resetMarkerAppearance(selection) {

    selection
        .interrupt()
        .transition()
        .duration(180)
        .attr("r", getMarkerRadius)
        .attr("opacity", function(d) {
            return d === selectedCountry
                ? SELECTED_OPACITY
                : MARKER_OPACITY;
        })
        .attr("fill", function(d) {
            return d === selectedCountry
                ? COLORS.selected
                : COLORS.active;
        })
        .attr("stroke", function(d) {
            return d === selectedCountry
                ? COLORS.selected
                : "#FFFFFF";
        })
        .attr("stroke-width", function(d) {
            return d === selectedCountry ? 3 : 1.5;
        });
}


// ==========================================
// KREISE INTERAKTIV MACHEN
// ==========================================

function setupMarkerInteractions(markers, markerGroup) {

    markers

        .attr("tabindex", 0)
        .attr("role", "button")
        .attr("aria-label", feature =>
            `${getCountryName(feature)} auswählen`
        )

        // MOUSEOVER
        .on("mouseenter", function(event, feature) {

            const marker = d3.select(this);

            marker
                .interrupt()
                .raise()
                .transition()
                .duration(180)
                .attr("r", getMarkerRadius(feature) * 1.18)
                .attr("opacity", HOVER_OPACITY)
                .attr("fill", COLORS.hover)
                .attr("stroke", COLORS.selected)
                .attr("stroke-width", 3);

        })

        // MOUSEOUT
        .on("mouseleave", function(event, feature) {

            const marker = d3.select(this);

            marker
                .interrupt()
                .transition()
                .duration(180)
                .attr("r", getMarkerRadius(feature))
                .attr("opacity", function() {
                    return feature === selectedCountry
                        ? SELECTED_OPACITY
                        : MARKER_OPACITY;
                })
                .attr("fill", function() {
                    return feature === selectedCountry
                        ? COLORS.selected
                        : COLORS.active;
                })
                .attr("stroke", function() {
                    return feature === selectedCountry
                        ? COLORS.selected
                        : "#FFFFFF";
                })
                .attr("stroke-width", function() {
                    return feature === selectedCountry ? 3 : 1.5;
                });

        })

        // KLICK
        .on("click", function(event, feature) {

            event.stopPropagation();

            selectCountry(feature);

        })

        // TASTATUR: ENTER UND LEERTASTE
        .on("keydown", function(event, feature) {

            if (event.key === "Enter" || event.key === " ") {

                event.preventDefault();

                selectCountry(feature);
            }

        })

        // TOOLTIP
        .append("title")
        .text(feature => {

            const count =
                countryCounts.get(getCountryCode(feature));

            return `${getCountryName(feature)}: ${count} Kooperation(en)`;

        });
}


// ==========================================
// LAND AUSWÄHLEN
// ==========================================

function selectCountry(feature) {
    // Länderumrisse aktualisieren
    mapGroup.selectAll(".country")
        .classed("selected-country", d =>
            getCountryCode(d) === getCountryCode(feature)
        );
    selectedCountry = feature;

    const markerGroup = d3.select("#world-svg")
        .select(".marker-group");

    markerGroup
        .selectAll(".project-marker")
        .each(function(d) {

            const marker = d3.select(this);

            if (d === selectedCountry) {

                marker
                    .interrupt()
                    .classed("selected", true)
                    .raise()
                    .transition()
                    .duration(180)
                    .attr("opacity", SELECTED_OPACITY)
                    .attr("fill", COLORS.selected)
                    .attr("stroke", "#183746")
                    .attr("stroke-width", 3.5);

            } else {

                marker
                    .classed("selected", false);

                resetMarkerAppearance(marker);
            }

        });

    const projects = readFilters();

    showCountryInfo(feature, projects);

}


// ==========================================
// KARTE AKTUALISIEREN
// ==========================================

function updateMap() {

    const projects = readFilters();

    renderProjects(projects);

    // Länder neutral darstellen
    mapGroup.selectAll(".country") 
        .attr("fill", COLORS.neutral);

    // Projekte je Land zählen
    countryCounts = new Map();

    projects.forEach(project => {

        (project.countries || []).forEach(code => {

            countryCounts.set(
                code,
                (countryCounts.get(code) || 0) + 1
            );

        });

    });

    const counts = [...countryCounts.values()];
    const maxCount = Math.max(1, ...counts);

    radiusScale = d3.scaleSqrt()
        .domain([1, maxCount])
        .range([8, 23]);

    const markers = worldData.features.filter(feature =>
        countryCounts.has(getCountryCode(feature))
    );

    const markerGroup = mapGroup
        .selectAll(".marker-group")
        .data([null])
        .join("g")
        .attr("class", "marker-group");

    const circles = markerGroup
        .selectAll(".project-marker")
        .data(markers, feature => getCountryCode(feature))
        .join(
            enter => enter.append("circle"),
            update => update,
            exit => exit.remove()
        )
        .attr("class", feature =>
            feature === selectedCountry
                ? "project-marker selected"
                : "project-marker"
        )
        .attr("cx", feature => mapPath.centroid(feature)[0])
        .attr("cy", feature => mapPath.centroid(feature)[1])
        .attr("r", getMarkerRadius)
        .attr("opacity", feature =>
            feature === selectedCountry
                ? SELECTED_OPACITY
                : MARKER_OPACITY
        )
        .attr("fill", feature =>
            feature === selectedCountry
                ? COLORS.selected
                : COLORS.active
        )
        .attr("stroke", feature =>
            feature === selectedCountry
                ? COLORS.selected
                : "#FFFFFF"
        )
        .attr("stroke-width", feature =>
            feature === selectedCountry ? 3 : 1.5
        )
        .style("cursor", "pointer");

    setupMarkerInteractions(circles, markerGroup);

    // Ausgewähltes Land aktualisieren
    if (selectedCountry) {

        const currentFeature = worldData.features.find(
            feature =>
                getCountryCode(feature) ===
                getCountryCode(selectedCountry)
        );

        if (currentFeature) {

            selectedCountry = currentFeature;

            showCountryInfo(currentFeature, projects);

        } else {

            selectedCountry = null;

        }

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
        <div class="country-info-content selected-info">

            <p class="eyebrow">INTERNATIONALE KOOPERATION</p>

            <h2>${escapeHTML(name)}</h2>

            ${
                countryProjects.length
                ? `
                    <h3>Zugeordnete Projekte (${countryProjects.length})</h3>

                    <div class="project-grid">

                        ${countryProjects.map(project => `

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
                                    <strong>Partner:</strong>
                                    ${(project.partners || []).map(escapeHTML).join(", ") || "Keine Angabe"}
                                </p>

                                <p>
                                    <strong>Themen:</strong>
                                    ${escapeHTML(getProjectTheme(project))}
                                </p>

                                <p>
                                    <strong>Ansprechpartner:</strong>
                                    ${escapeHTML(project.contactPerson || "Keine Angabe")}
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
// MIT ZOOM UND VERSCHIEBEN
// ==========================================

function renderMap() {

    const svg = d3.select("#world-map")
        .html("")
        .append("svg")
        .attr("id", "world-svg")
        .attr("viewBox", `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`)
        .attr("role", "img")
        .attr("aria-label", "Interaktive Weltkarte");

    // Projektion erstellen
    const projection = d3.geoWinkel3()
        .fitExtent(
            [[15, 15], [MAP_WIDTH - 15, MAP_HEIGHT - 15]],
            worldData
        );

    mapPath = d3.geoPath().projection(projection);

    // Gemeinsame Gruppe für Länder und Projektkreise
    mapGroup = svg.append("g")
        .attr("class", "map-group");

    // Länder zeichnen und interaktiv machen
    mapGroup.selectAll(".country")
        .data(worldData.features)
        .join("path")
        .attr("class", feature =>
            feature === selectedCountry
                ? "country selected-country"
                : "country"
        )
        .attr("d", mapPath)
        .on("click", function(event, feature) {

            event.stopPropagation();

            selectCountry(feature);

        })
        .append("title")
        .text(feature => getCountryName(feature));

    // Zoom-Funktion aktivieren
    zoomBehavior = d3.zoom()
        .scaleExtent([ZOOM_MIN, ZOOM_MAX])
        .extent([[0, 0], [MAP_WIDTH, MAP_HEIGHT]])
        .on("zoom", function(event) {

            mapGroup.attr(
                "transform",
                event.transform
            );

        });

    svg.call(zoomBehavior);

    // Doppelklick-Zoom deaktivieren
    svg.on("dblclick.zoom", null);

    // Projektkreise ergänzen
    updateMap();

    // Zoom-Schaltflächen aktivieren
    setupZoomControls(svg);
}


// ==========================================
// ZOOM-SCHALTFLÄCHEN
// ==========================================

function setupZoomControls(svg) {

    // Vergrößern
    document.getElementById("zoomIn")
        .addEventListener("click", () => {

            svg.transition()
                .duration(300)
                .call(
                    zoomBehavior.scaleBy,
                    ZOOM_STEP
                );

        });

    // Verkleinern
    document.getElementById("zoomOut")
        .addEventListener("click", () => {

            svg.transition()
                .duration(300)
                .call(
                    zoomBehavior.scaleBy,
                    1 / ZOOM_STEP
                );

        });

    // Ansicht zurücksetzen
    document.getElementById("resetZoom")
        .addEventListener("click", () => {

            svg.transition()
                .duration(500)
                .call(
                    zoomBehavior.transform,
                    d3.zoomIdentity
                );

        });

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
            mapGroup.selectAll(".country")
                .classed("selected-country", false);
            document.getElementById("country-info").innerHTML = `
                <div class="info-placeholder">
                    <h2>Informationen</h2>
                    <p>Wähle ein Land auf der Karte aus.</p>
                </div>
            `;

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

        checkCountryCodes();
        

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

function checkCountryCodes() {

    console.log("=== GEOJSON-LÄNDERCHECK ===");

    worldData.features.forEach(feature => {

        const p = feature.properties || {};

        console.log({
            name: getCountryName(feature),
            ISO_A3: p.ISO_A3,
            ADM0_A3: p.ADM0_A3,
            SOV_A3: p.SOV_A3,
            verwendeterCode: getCountryCode(feature)
        });

    });

}

startApplication();

