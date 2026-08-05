import { useEffect, useRef } from "react";

export interface MapPin {
  id: string;
  name: string;
  status: string;
  lat: number;
  lng: number;
  rentSummary: string | null;
  apartmentRatingsScore: number | null;
  mapsUrl: string | null;
}

export const STATUS_COLORS: Record<string, string> = {
  to_visit: "#f59e0b",
  visited: "#3b82f6",
  applied: "#10b981",
  rejected: "#9ca3af",
};

/* global window, document */
type GoogleNS = any;

let mapsLoader: Promise<GoogleNS> | null = null;

function loadGoogleMaps(apiKey: string): Promise<GoogleNS> {
  const w = window as any;
  if (w.google?.maps?.Map) return Promise.resolve(w.google);
  if (mapsLoader) return mapsLoader;
  mapsLoader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.async = true;
    script.onload = () => {
      if (w.google?.maps?.Map) resolve(w.google);
      else reject(new Error("Google Maps script loaded but google.maps is missing"));
    };
    script.onerror = () => {
      mapsLoader = null;
      reject(new Error("failed to load Google Maps script"));
    };
    document.head.appendChild(script);
  });
  return mapsLoader;
}

export function MapView({
  apiKey,
  pins,
  onOpen,
  onError,
}: {
  apiKey: string;
  pins: MapPin[];
  onOpen: (id: string) => void;
  onError: (message: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoRef = useRef<any>(null);
  const fittedCountRef = useRef(0);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  useEffect(() => {
    let cancelled = false;
    void loadGoogleMaps(apiKey)
      .then((google) => {
        if (cancelled || !containerRef.current) return;
        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(containerRef.current, {
            center: { lat: 39.5, lng: -98.35 },
            zoom: 4,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          });
          infoRef.current = new google.maps.InfoWindow();
        }
        renderMarkers(google);
      })
      .catch((err: Error) => onError(err.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  function renderMarkers(google: GoogleNS) {
    const map = mapRef.current;
    if (!map) return;
    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    for (const pin of pins) {
      const position = { lat: pin.lat, lng: pin.lng };
      const marker = new google.maps.Marker({
        map,
        position,
        title: pin.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: STATUS_COLORS[pin.status] ?? "#f59e0b",
          fillOpacity: 0.95,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      marker.addListener("click", () => {
        const content = document.createElement("div");
        content.style.cssText = "font: 13px/1.5 system-ui, sans-serif; max-width: 240px; color: #111;";
        const title = document.createElement("div");
        title.textContent = pin.name;
        title.style.cssText = "font-weight: 600; cursor: pointer; text-decoration: underline; margin-bottom: 2px;";
        title.addEventListener("click", () => onOpenRef.current(pin.id));
        content.appendChild(title);
        const meta = document.createElement("div");
        const bits: string[] = [];
        if (pin.rentSummary) bits.push(pin.rentSummary);
        if (pin.apartmentRatingsScore != null) bits.push(`AR ${pin.apartmentRatingsScore.toFixed(1)}/5`);
        meta.textContent = bits.join(" · ");
        content.appendChild(meta);
        if (pin.mapsUrl) {
          const link = document.createElement("a");
          link.href = pin.mapsUrl;
          link.target = "_blank";
          link.rel = "noreferrer";
          link.textContent = "Open in Google Maps";
          link.style.cssText = "color: #1a73e8;";
          content.appendChild(link);
        }
        infoRef.current?.setContent(content);
        infoRef.current?.open({ map, anchor: marker });
      });
      markersRef.current.push(marker);
      bounds.extend(position);
    }

    if (pins.length > 0 && fittedCountRef.current !== pins.length) {
      fittedCountRef.current = pins.length;
      if (pins.length === 1) {
        map.setCenter(bounds.getCenter());
        map.setZoom(14);
      } else {
        map.fitBounds(bounds, 48);
      }
    }
  }

  useEffect(() => {
    const google = (window as any).google;
    if (google?.maps?.Map && mapRef.current) renderMarkers(google);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins]);

  return <div ref={containerRef} className="h-[26rem] w-full rounded-b-xl" />;
}
