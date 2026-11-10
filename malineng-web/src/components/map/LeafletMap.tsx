"use client";

import "leaflet/dist/leaflet.css";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { Map as LMap, LayerGroup } from "leaflet";
import { categoryColor, categoryIconPath, type Place } from "@/lib/places";

export interface MapHandle {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  getView: () => { lat: number; lng: number; zoom: number } | null;
}

export interface LatLng {
  lat: number;
  lng: number;
}

interface Props {
  center: { lat: number; lng: number; zoom: number };
  places?: Place[];
  selectedId?: string | null;
  onSelect?: (p: Place) => void;
  /** Called after the map stops moving (used by the "pick a location" screen). */
  onMoveEnd?: (view: { lat: number; lng: number; zoom: number }) => void;
  /** Tap on empty map: add a corner while drawing, otherwise close the place card. */
  onMapClick?: (lat: number, lng: number) => void;
  /** Barangay boundary (dashed outline and name). */
  boundary?: LatLng[];
  /** Corners being drawn by the Super Admin. */
  draft?: LatLng[];
  /** The person's own position (blue dot). */
  userPos?: LatLng | null;
  className?: string;
}

const MAP_STYLE_KEY = "malineng-map-style";
const CLUSTER_PX = 46;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Round pin with the category icon inside (plain HTML, no image files to host). */
function pinHtml(category: string, selected: boolean): string {
  const size = selected ? 46 : 36;
  const color = categoryColor(category);
  return `<span style="position:relative;display:block;width:${size}px;height:${size}px;">
    <span style="position:absolute;left:50%;bottom:-6px;margin-left:-6px;width:12px;height:12px;background:${color};transform:rotate(45deg);border-radius:2px;"></span>
    <span style="position:absolute;inset:0;border-radius:999px;background:${color};border:3px solid #fff;box-shadow:0 6px 12px -2px rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;">
      <svg width="${selected ? 22 : 17}" height="${selected ? 22 : 17}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${categoryIconPath(category)}"></path></svg>
    </span></span>`;
}

function clusterHtml(n: number): string {
  return `<span style="display:flex;width:44px;height:44px;border-radius:999px;background:#0B2B57;color:#fff;border:4px solid rgba(255,255,255,.9);box-shadow:0 6px 12px -2px rgba(15,23,42,.4);align-items:center;justify-content:center;font:800 15px system-ui,sans-serif;">${n}</span>`;
}

/**
 * Leaflet map: free, no API key. Leaflet touches `window`, so it is loaded inside the effect
 * (safe for the static export build). Clean CARTO streets (falls back to OpenStreetMap), satellite with
 * place names, round icon pins that group into numbers when crowded, and the barangay boundary.
 */
export const LeafletMap = forwardRef<MapHandle, Props>(function LeafletMap(
  { center, places = [], selectedId, onSelect, onMoveEnd, onMapClick, boundary, draft, userPos, className = "" },
  ref,
) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const pins = useRef<LayerGroup | null>(null);
  const shapes = useRef<LayerGroup | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const cbs = useRef({ onSelect, onMoveEnd, onMapClick });
  cbs.current = { onSelect, onMoveEnd, onMapClick };
  const latest = useRef({ places, selectedId, boundary, draft, userPos });
  latest.current = { places, selectedId, boundary, draft, userPos };

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lng, zoom) => map.current?.flyTo([lat, lng], zoom ?? map.current.getZoom(), { duration: 0.6 }),
    getView: () => {
      const m = map.current;
      if (!m) return null;
      const c = m.getCenter();
      return { lat: c.lat, lng: c.lng, zoom: m.getZoom() };
    },
  }));

  const drawPins = () => {
    const leaflet = L.current;
    const m = map.current;
    const group = pins.current;
    if (!leaflet || !m || !group) return;
    group.clearLayers();
    const { places: list, selectedId: sel } = latest.current;

    // Greedy grouping by screen distance: pins closer than CLUSTER_PX become one numbered circle.
    const clusters: { x: number; y: number; items: Place[] }[] = [];
    for (const p of list) {
      const pt = m.latLngToContainerPoint([p.lat, p.lng]);
      const near = p.id === sel ? undefined : clusters.find((c) => c.items[0].id !== sel && Math.hypot(c.x - pt.x, c.y - pt.y) < CLUSTER_PX);
      if (near) near.items.push(p);
      else clusters.push({ x: pt.x, y: pt.y, items: [p] });
    }

    for (const c of clusters) {
      if (c.items.length > 1) {
        const lat = c.items.reduce((a, p) => a + p.lat, 0) / c.items.length;
        const lng = c.items.reduce((a, p) => a + p.lng, 0) / c.items.length;
        leaflet
          .marker([lat, lng], { icon: leaflet.divIcon({ className: "", html: clusterHtml(c.items.length), iconSize: [44, 44], iconAnchor: [22, 22] }), keyboard: true, title: `${c.items.length} lugar` })
          .on("click", () => m.fitBounds(leaflet.latLngBounds(c.items.map((p) => [p.lat, p.lng] as [number, number])), { padding: [70, 70], maxZoom: 19 }))
          .addTo(group);
        continue;
      }
      const p = c.items[0];
      const selected = p.id === sel;
      const size = selected ? 46 : 36;
      leaflet
        .marker([p.lat, p.lng], {
          icon: leaflet.divIcon({ className: "", html: pinHtml(p.category, selected), iconSize: [size, size], iconAnchor: [size / 2, size + 4] }),
          title: p.name,
          alt: p.name,
          zIndexOffset: selected ? 1000 : 0,
          keyboard: true,
        })
        .on("click", () => cbs.current.onSelect?.(p))
        .bindTooltip(escapeHtml(p.name), { direction: "top", offset: [0, -(size + 6)] })
        .addTo(group);
    }
  };

  const drawShapes = () => {
    const leaflet = L.current;
    const group = shapes.current;
    if (!leaflet || !group) return;
    group.clearLayers();
    const { boundary: b, draft: d, userPos: u } = latest.current;
    if (b && b.length >= 3) {
      const ring = b.map((q) => [q.lat, q.lng] as [number, number]);
      leaflet.polygon(ring, { color: "#1F5FAE", weight: 2.5, dashArray: "8 6", fillColor: "#1F5FAE", fillOpacity: 0.06, interactive: false }).addTo(group);
      const c = leaflet.latLngBounds(ring).getCenter();
      leaflet
        .marker(c, { interactive: false, keyboard: false, icon: leaflet.divIcon({ className: "", html: '<span style="display:block;white-space:nowrap;transform:translate(-50%,-50%);font:800 13px system-ui,sans-serif;letter-spacing:.16em;color:#0B2B57;text-shadow:0 0 5px #fff,0 0 5px #fff,0 0 5px #fff;">MALINENG</span>', iconSize: [0, 0] }) })
        .addTo(group);
    }
    if (d && d.length) {
      const ring = d.map((q) => [q.lat, q.lng] as [number, number]);
      if (d.length >= 3) leaflet.polygon(ring, { color: "#D4AF37", weight: 3, fillColor: "#D4AF37", fillOpacity: 0.15, interactive: false }).addTo(group);
      else leaflet.polyline(ring, { color: "#D4AF37", weight: 3, interactive: false }).addTo(group);
      ring.forEach((pt, i) =>
        leaflet.circleMarker(pt, { radius: i === 0 ? 8 : 6, color: "#fff", weight: 2, fillColor: i === 0 ? "#0B2B57" : "#D4AF37", fillOpacity: 1, interactive: false }).addTo(group),
      );
    }
    if (u) {
      leaflet.circleMarker([u.lat, u.lng], { radius: 16, stroke: false, fillColor: "#1F5FAE", fillOpacity: 0.18, interactive: false }).addTo(group);
      leaflet.circleMarker([u.lat, u.lng], { radius: 7, color: "#fff", weight: 3, fillColor: "#1F5FAE", fillOpacity: 1, interactive: false }).addTo(group);
    }
  };

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const leaflet = await import("leaflet");
      if (cancelled || !el.current || map.current) return;
      L.current = leaflet;
      const m = leaflet.map(el.current, { zoomControl: false, attributionControl: true }).setView([center.lat, center.lng], center.zoom);

      // Base layers (all free, no key). Streets: CARTO Voyager, with OpenStreetMap as the fallback if it fails to load.
      const carto = leaflet.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 20,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      });
      const osm = leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 20,
        maxNativeZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      });
      const satellite = leaflet.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 20,
        maxNativeZoom: 18,
        attribution: "Tiles &copy; Esri, Maxar, Earthstar Geographics",
      });
      const labels = leaflet.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20, maxNativeZoom: 18, opacity: 0.95 });

      let street = carto;
      let errors = 0;
      carto.on("tileerror", () => {
        errors += 1;
        if (errors === 6 && street === carto && m.hasLayer(carto)) {
          m.removeLayer(carto);
          street = osm;
          osm.addTo(m);
        }
      });

      let saved: string | null = null;
      try {
        saved = localStorage.getItem(MAP_STYLE_KEY);
      } catch {
        // Storage blocked: start on the street map.
      }
      let useSatellite = saved === "satellite";
      const show = () => {
        [carto, osm, satellite, labels].forEach((l) => m.hasLayer(l) && m.removeLayer(l));
        if (useSatellite) {
          satellite.addTo(m);
          labels.addTo(m);
        } else street.addTo(m);
      };
      show();
      leaflet.control.zoom({ position: "bottomleft" }).addTo(m);

      // One button flips between the street map and satellite (stacks above the zoom buttons).
      const StyleControl = leaflet.Control.extend({
        onAdd() {
          const btn = leaflet.DomUtil.create("button", "") as HTMLButtonElement;
          btn.type = "button";
          btn.style.cssText = "background:#fff;border:0;border-radius:12px;padding:9px 13px;font:700 13px system-ui,sans-serif;color:#0B2B57;box-shadow:0 4px 12px rgba(15,23,42,.25);cursor:pointer;margin-bottom:8px";
          const paint = () => {
            btn.textContent = useSatellite ? "🗺️ Mapa" : "🛰️ Satellite (bahay)";
            btn.setAttribute("aria-label", useSatellite ? "Ipakita ang karaniwang mapa" : "Ipakita ang satellite para makita ang mga bahay");
          };
          paint();
          leaflet.DomEvent.disableClickPropagation(btn);
          btn.onclick = () => {
            useSatellite = !useSatellite;
            show();
            try {
              localStorage.setItem(MAP_STYLE_KEY, useSatellite ? "satellite" : "street");
            } catch {
              // Not saved; it still works for this visit.
            }
            paint();
          };
          return btn;
        },
      });
      new StyleControl({ position: "bottomleft" }).addTo(m);

      shapes.current = leaflet.layerGroup().addTo(m);
      pins.current = leaflet.layerGroup().addTo(m);
      m.on("moveend", () => {
        const c = m.getCenter();
        cbs.current.onMoveEnd?.({ lat: c.lat, lng: c.lng, zoom: m.getZoom() });
      });
      m.on("zoomend", drawPins);
      m.on("click", (e) => cbs.current.onMapClick?.(e.latlng.lat, e.latlng.lng));
      map.current = m;
      drawShapes();
      drawPins();
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // Only on mount: later center changes go through flyTo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(drawPins, [places, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(drawShapes, [boundary, draft, userPos]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className={`z-0 ${className}`} role="application" aria-label="Mapa ng Barangay Malineng" />;
});
