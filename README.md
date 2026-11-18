# Hyderabad Through Time — GIS Day 2026

A multi-temporal, documentary-grade GIS web application built with **React, TypeScript, Vite, Tailwind CSS, Three.js/WebGL, GSAP, Framer Motion, and MapLibre GL JS** to explore Hyderabad's spatial transformation across **1990, 2000, 2010, 2020, and 2025**.

---

## Architecture & Data Sources

- **Basemaps:** Esri World Imagery, OpenStreetMap Standard (`ODbL`), and authenticated CARTO Dark Matter + Voyager Labels (`VITE_CARTO_API_KEY` via MapLibre `transformRequest`).
- **Official Administrative Boundaries:** Telangana Remote Sensing Applications Centre (TGRAC) `MapServer/45` (**GHMC**, Amber `#FFB547`) and `MapServer/52` (**HMDA**, Cyan `#00D5FF`), cached on the backend (`server/services/tgracService.ts`). Never substituted with OSM or approximate boundaries.
- **Dynamic Google Earth Engine Backend (`server/services/geeService.ts`):**
  - Authenticates server-side for project `pivotal-shield-455916-h2` using `GEE_SERVICE_ACCOUNT_EMAIL` and `GEE_PRIVATE_KEY` (never exposed to the frontend).
  - `GET /api/gee/imagery?year=2025&area=hmda` dynamically generates cloud-masked Landsat 5/8/9 median composites (`1990`, `2000`, `2010`, `2020`, `2025`) clipped to the selected HMDA/GHMC boundary.
  - `GET /api/gee/analytical?layer=ndvi|ndbi|ndwi|lulc|lst&area=hmda&year=2025` dynamically generates spectral indices, multi-index LULC, and Landsat Land Surface Temperature (`°C`) tiles on demand.
- **Live Vector & Search:** OpenStreetMap Overpass API (`natural=water`, `leisure=park`, `motorway|trunk`) and bounded Nominatim geocoding.

---

## Simplified Environment Variables (`.env`)

Copy `.env.example` to `.env`:

```env
# Frontend Basemap Key (Safe for browser; restrict to your domain)
VITE_CARTO_API_KEY=your_carto_api_key

# Backend Google Earth Engine Credentials (Server-side ONLY)
GEE_PROJECT_ID=pivotal-shield-455916-h2
GEE_SERVICE_ACCOUNT_EMAIL=
GEE_PRIVATE_KEY=
PORT=8787
```

No manual static GEE tile URLs are required.

---

## Local Development & Verification

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

`npm run dev` starts both the Express GIS backend (`:8787`) and the Vite frontend (`:5173`).
