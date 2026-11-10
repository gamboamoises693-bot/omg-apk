"use client";

import "leaflet/dist/leaflet.css";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { Map as LMap, LayerGroup } from "leaflet";
import { categoryColor, type Place } from "@/lib/places";

const MAP_STYLE_KEY = "malineng-map-style";

export interface MapHandle {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  getView: () => { lat: number; lng: number; zoom: number } | null;
}

interface Props {
  center: { lat: number; lng: number; zoom: number };
  places?: Place[];
  selectedId?: string | null;
  onSelect?: (p: Place) => void;
  /** Called after the map stops moving (used by the "pick a location" screen). */
  onMoveEnd?: (view: { lat: number; lng: number; zoom: number }) => void;
  className?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Teardrop pin as plain HTML (no image files to host). */
function pinHtml(color: string, selected: boolean): string {
  const size = selected ? 34 : 26;
  return `<span style="display:block;width:${size}px;height:${size}px;border-radius:999px 999px 999px 0;transform:rotate(-45deg);background:${color};border:3px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.3)"></span>`;
}

/**
 * OpenStreetMap via Leaflet: free, no API key. Leaflet touches `window`,
 * so it is loaded inside the effect (safe for the static export build).
 */
export const LeafletMap = forwardRef<MapHandle, Props>(function LeafletMap({ center, places = [], selectedId, onSelect, onMoveEnd, className = "" }, ref) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const cbs = useRef({ onSelect, onMoveEnd });
  cbs.current = { onSelect, onMoveEnd };

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lng, zoom) => map.current?.flyTo([lat, lng], zoom ?? map.current.getZoom(), { duration: 0.6 }),
    getView: () => {
      const m = map.current;
      if (!m) return null;
      const c = m.getCenter();
      return { lat: c.lat, lng: c.lng, zoom: m.getZoom() };
    },
  }));

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const leaflet = await import("leaflet");
      if (cancelled || !el.current || map.current) return;
      L.current = leaflet;
      const m = leaflet.map(el.current, { zoomControl: false, attributionControl: true }).setView([center.lat, center.lng], center.zoom);
      // Two free base layers. OpenStreetMap has few houses mapped here, so satellite shows every roof.
      const street = leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 20,
        maxNativeZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      });
      const satellite = leaflet.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 20,
        // Past this zoom the satellite tiles are simply enlarged instead of showing grey squares.
        maxNativeZoom: 18,
        attribution: "Tiles &copy; Esri, Maxar, Earthstar Geographics",
      });
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(MAP_STYLE_KEY);
      } catch {
        // Storage blocked: fall back to the street map.
      }
      let useSatellite = saved === "satellite";
      (useSatellite ? satellite : street).addTo(m);
      leaflet.control.zoom({ position: "bottomleft" }).addTo(m);

      // One button that flips between the street map and satellite (stacks above the zoom buttons).
      const StyleControl = leaflet.Control.extend({
        onAdd() {
          const btn = leaflet.DomUtil.create("button", "") as HTMLButtonElement;
          btn.type = "button";
          btn.style.cssText = "background:#fff;border:2px solid rgba(0,0,0,.2);border-radius:10px;padding:8px 12px;font:600 13px system-ui,sans-serif;color:#0F3A70;box-shadow:0 2px 6px rgba(0,0,0,.2);cursor:pointer;margin-bottom:8px";
          const paint = () => {
            btn.textContent = useSatellite ? "🗺️ Mapa" : "🛰️ Satellite (bahay)";
            btn.setAttribute("aria-label", useSatellite ? "Ipakita ang karaniwang mapa" : "Ipakita ang satellite para makita ang mga bahay");
          };
          paint();
          leaflet.DomEvent.disableClickPropagation(btn);
          btn.onclick = () => {
            useSatellite = !useSatellite;
            m.removeLayer(useSatellite ? street : satellite);
            (useSatellite ? satellite : street).addTo(m);
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
      layer.current = leaflet.layerGroup().addTo(m);
      m.on("moveend", () => {
        const c = m.getCenter();
        cbs.current.onMoveEnd?.({ lat: c.lat, lng: c.lng, zoom: m.getZoom() });
      });
      map.current = m;
      // Draw pins that arrived before the map was ready.
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

  const drawPins = () => {
    const leaflet = L.current;
    const group = layer.current;
    if (!leaflet || !group) return;
    group.clearLayers();
    for (const p of places) {
      const selected = p.id === selectedId;
      const icon = leaflet.divIcon({
        className: "",
        html: pinHtml(categoryColor(p.category), selected),
        iconSize: [selected ? 34 : 26, selected ? 34 : 26],
        iconAnchor: [selected ? 17 : 13, selected ? 40 : 32],
      });
      leaflet
        .marker([p.lat, p.lng], { icon, title: p.name, alt: p.name, zIndexOffset: selected ? 1000 : 0, keyboard: true })
        .on("click", () => cbs.current.onSelect?.(p))
        .bindTooltip(escapeHtml(p.name), { direction: "top", offset: [0, -30] })
        .addTo(group);
    }
  };

  // Redraw when the pins or the selection change.
  useEffect(drawPins, [places, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className={`z-0 ${className}`} role="application" aria-label="Mapa ng Barangay Malineng" />;
});
