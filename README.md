# TelanganaMaps

TelanganaMaps is a React + Vite navigation app focused on route planning, traffic insights, and travel tools for Telangana.

This version runs as a standalone app without Lovable-specific services and without a Google Maps API key for the core route-planning flow.

## Core stack

- `Leaflet` + `OpenStreetMap` tiles for the map
- `Nominatim` for place search and geocoding
- `OSRM` for route generation
- `Open-Meteo` for weather conditions
- `localStorage` for saved routes on the device

## Development

- `npm install`
- `npm run dev`
- `npm run test`
- `npm run build`
