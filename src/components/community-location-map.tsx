"use client";

import { useEffect, useRef, useState } from "react";
import { MapPinned } from "lucide-react";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";

interface CommunityLocationMapProps {
  latitude: string;
  longitude: string;
  onLocationChange: (latitude: string, longitude: string) => void;
}

export function CommunityLocationMap({
  latitude,
  longitude,
  onLocationChange,
}: CommunityLocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<MapLibreMarker | null>(null);
  const onLocationChangeRef = useRef(onLocationChange);
  const initialLocationRef = useRef({ latitude, longitude });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let active = true;

    void import("maplibre-gl")
      .then(({ Map, Marker, NavigationControl, setWorkerUrl }) => {
        if (!active || !containerRef.current) return;
        setWorkerUrl("/maplibre-gl-worker.mjs");
        const initialLongitude = Number(initialLocationRef.current.longitude);
        const initialLatitude = Number(initialLocationRef.current.latitude);
        const hasLocation = Number.isFinite(initialLongitude) && Number.isFinite(initialLatitude) && initialLocationRef.current.latitude !== "";
        const map = new Map({
          center: hasLocation ? [initialLongitude, initialLatitude] : [100.5018, 13.7563],
          cooperativeGestures: true,
          container: containerRef.current,
          style: "https://tiles.openfreemap.org/styles/liberty",
          zoom: hasLocation ? 14 : 5.1,
        });
        map.addControl(new NavigationControl({ showCompass: false }), "top-right");
        map.on("load", () => setStatus("ready"));
        map.on("click", (event) => {
          const nextLongitude = event.lngLat.lng.toFixed(6);
          const nextLatitude = event.lngLat.lat.toFixed(6);
          if (!markerRef.current) {
            const markerElement = document.createElement("span");
            markerElement.className = "community-map__marker";
            markerElement.setAttribute("aria-hidden", "true");
            markerRef.current = new Marker({ element: markerElement })
              .setLngLat(event.lngLat)
              .addTo(map);
          } else markerRef.current.setLngLat(event.lngLat);
          onLocationChangeRef.current(nextLatitude, nextLongitude);
        });
        if (hasLocation) {
          const markerElement = document.createElement("span");
          markerElement.className = "community-map__marker";
          markerElement.setAttribute("aria-hidden", "true");
          markerRef.current = new Marker({ element: markerElement })
            .setLngLat([initialLongitude, initialLatitude])
            .addTo(map);
        }
        mapRef.current = map;
      })
      .catch(() => setStatus("error"));

    return () => {
      active = false;
      markerRef.current?.remove();
      mapRef.current?.remove();
      markerRef.current = null;
      mapRef.current = null;
    };
  }, []); // Map is initialized once; coordinate updates are handled below.

  useEffect(() => {
    const map = mapRef.current;
    const nextLatitude = Number(latitude);
    const nextLongitude = Number(longitude);
    if (!map || !Number.isFinite(nextLatitude) || !Number.isFinite(nextLongitude) || !latitude) return;

    void import("maplibre-gl").then(({ Marker }) => {
      if (!markerRef.current) {
        const markerElement = document.createElement("span");
        markerElement.className = "community-map__marker";
        markerElement.setAttribute("aria-hidden", "true");
        markerRef.current = new Marker({ element: markerElement })
          .setLngLat([nextLongitude, nextLatitude])
          .addTo(map);
      } else markerRef.current.setLngLat([nextLongitude, nextLatitude]);
      map.flyTo({ center: [nextLongitude, nextLatitude], duration: 700, zoom: Math.max(map.getZoom(), 14) });
    });
  }, [latitude, longitude]);

  return (
    <div className="community-map">
      <div className="community-map__head">
        <div>
          <MapPinned aria-hidden="true" size={20} />
          <span>
            <strong>ปักหมุดพื้นที่โดยประมาณ</strong>
            <small>คลิกบนแผนที่เพื่อย้ายหมุด ไม่จำเป็นต้องเป็นตำแหน่งหลังคาจริง</small>
          </span>
        </div>
        {latitude ? <span className="community-map__status">เลือกพิกัดแล้ว</span> : null}
      </div>
      <div className="community-map__canvas" ref={containerRef}>
        {status === "loading" ? <p>กำลังโหลดแผนที่…</p> : null}
        {status === "error" ? <p>โหลดแผนที่ไม่สำเร็จ คุณยังเลือกพื้นที่จากรายการด้านบนได้</p> : null}
      </div>
      <p className="community-map__credit">
        Map tiles by OpenFreeMap · Data © OpenStreetMap contributors
      </p>
    </div>
  );
}
