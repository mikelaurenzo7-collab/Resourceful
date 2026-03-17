'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface MeasurementToolProps {
  address: string;
  attomGBA: number | null;
  onMeasurementComplete: (data: {
    measuredSqFt: number;
    source: 'map' | 'manual';
  }) => void;
}

export default function MeasurementTool({
  address,
  attomGBA,
  onMeasurementComplete,
}: MeasurementToolProps) {
  const [activeTab, setActiveTab] = useState<'map' | 'manual'>('map');
  const [manualSqFt, setManualSqFt] = useState('');
  const [measuredSqFt, setMeasuredSqFt] = useState<number | null>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);

  const discrepancy =
    attomGBA && measuredSqFt
      ? Math.abs(((measuredSqFt - attomGBA) / attomGBA) * 100)
      : null;

  // Check if Google Maps is loaded
  useEffect(() => {
    const check = () => {
      if (typeof google !== 'undefined' && google.maps?.drawing && google.maps?.geometry) {
        setMapsLoaded(true);
        return true;
      }
      return false;
    };
    if (check()) return;
    const interval = setInterval(() => {
      if (check()) clearInterval(interval);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handlePolygonComplete = useCallback(
    (polygon: google.maps.Polygon) => {
      // Remove previous polygon
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
      }
      polygonRef.current = polygon;

      // Calculate area in square meters, convert to square feet
      const areaM2 = google.maps.geometry.spherical.computeArea(
        polygon.getPath()
      );
      const areaSqFt = Math.round(areaM2 * 10.7639);

      setMeasuredSqFt(areaSqFt);
      onMeasurementComplete({ measuredSqFt: areaSqFt, source: 'map' });

      // Make polygon editable
      polygon.setEditable(true);

      // Recalculate on edit
      const recalc = () => {
        const newArea = google.maps.geometry.spherical.computeArea(
          polygon.getPath()
        );
        const newSqFt = Math.round(newArea * 10.7639);
        setMeasuredSqFt(newSqFt);
      };

      google.maps.event.addListener(polygon.getPath(), 'set_at', recalc);
      google.maps.event.addListener(polygon.getPath(), 'insert_at', recalc);
    },
    [onMeasurementComplete]
  );

  // Initialize map when tab is 'map' and Google Maps is ready
  useEffect(() => {
    if (activeTab !== 'map' || !mapsLoaded || !mapRef.current || mapInstanceRef.current) return;

    // Geocode the address to center the map
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      if (status !== 'OK' || !results?.[0]?.geometry?.location || !mapRef.current) {
        // Fallback to US center
        initMap({ lat: 39.8283, lng: -98.5795 }, 4);
        return;
      }

      const loc = results[0].geometry.location;
      initMap({ lat: loc.lat(), lng: loc.lng() }, 19);
    });
  }, [activeTab, mapsLoaded, address, handlePolygonComplete]);

  function initMap(center: { lat: number; lng: number }, zoom: number) {
    if (!mapRef.current) return;

    const map = new google.maps.Map(mapRef.current, {
      center,
      zoom,
      mapTypeId: 'satellite',
      tilt: 0,
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
    });
    mapInstanceRef.current = map;

    // Add Drawing Manager for polygon drawing
    const drawingManager = new google.maps.drawing.DrawingManager({
      drawingMode: google.maps.drawing.OverlayType.POLYGON,
      drawingControl: true,
      drawingControlOptions: {
        position: google.maps.ControlPosition.TOP_CENTER,
        drawingModes: [google.maps.drawing.OverlayType.POLYGON],
      },
      polygonOptions: {
        fillColor: '#d4a853',
        fillOpacity: 0.3,
        strokeColor: '#d4a853',
        strokeWeight: 2,
        editable: true,
        draggable: false,
      },
    });

    drawingManager.setMap(map);
    drawingManagerRef.current = drawingManager;

    google.maps.event.addListener(
      drawingManager,
      'polygoncomplete',
      handlePolygonComplete
    );
  }

  const handleManualSubmit = () => {
    const sqft = parseInt(manualSqFt);
    if (sqft > 0) {
      setMeasuredSqFt(sqft);
      onMeasurementComplete({ measuredSqFt: sqft, source: 'manual' });
    }
  };

  const resetPolygon = () => {
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }
    setMeasuredSqFt(null);
    // Re-enable drawing mode
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setDrawingMode(
        google.maps.drawing.OverlayType.POLYGON
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab selector */}
      <div className="flex rounded-lg border border-gold/15 overflow-hidden">
        <button
          onClick={() => setActiveTab('map')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'map'
              ? 'bg-gold/10 text-gold border-r border-gold/15'
              : 'text-cream/50 hover:text-cream/80 border-r border-gold/15'
          }`}
        >
          Map Measurement
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'manual'
              ? 'bg-gold/10 text-gold'
              : 'text-cream/50 hover:text-cream/80'
          }`}
        >
          Manual Entry
        </button>
      </div>

      {activeTab === 'map' ? (
        <div>
          {/* Map container */}
          <div className="rounded-xl border border-gold/15 bg-navy/40 overflow-hidden">
            {mapsLoaded ? (
              <div ref={mapRef} className="w-full aspect-video" />
            ) : (
              <div className="aspect-video flex flex-col items-center justify-center bg-navy-deep/60">
                <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-cream/40 text-sm">Loading satellite view...</p>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-4 card-premium rounded-lg p-4">
            <h4 className="text-sm font-medium text-cream mb-2">How to Measure</h4>
            <ol className="space-y-2 text-xs text-cream/50 leading-relaxed">
              <li className="flex gap-2">
                <span className="text-gold font-semibold">1.</span>
                Click on each corner of your building&apos;s footprint to place points
              </li>
              <li className="flex gap-2">
                <span className="text-gold font-semibold">2.</span>
                Close the polygon by clicking the first point again
              </li>
              <li className="flex gap-2">
                <span className="text-gold font-semibold">3.</span>
                The area will be calculated automatically in square feet
              </li>
              <li className="flex gap-2">
                <span className="text-gold font-semibold">4.</span>
                Drag the points to adjust. For multi-story, multiply by floors.
              </li>
            </ol>
          </div>

          {/* Measured area display */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-gold/10 bg-navy-deep/40 p-4 text-center">
              <p className="text-xs text-cream/40 uppercase tracking-wider mb-1">Footprint</p>
              <p className="font-display text-xl text-cream">
                {measuredSqFt ? `${measuredSqFt.toLocaleString()} sqft` : '\u2014'}
              </p>
            </div>
            <div className="rounded-lg border border-gold/10 bg-navy-deep/40 p-4 text-center">
              {measuredSqFt ? (
                <button
                  onClick={resetPolygon}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Reset &amp; Redraw
                </button>
              ) : (
                <>
                  <p className="text-xs text-cream/40 uppercase tracking-wider mb-1">Status</p>
                  <p className="font-display text-sm text-cream/30">Draw polygon to measure</p>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-cream/80 mb-2">
              Building Square Footage
            </label>
            <div className="flex gap-3">
              <input
                type="number"
                value={manualSqFt}
                onChange={(e) => setManualSqFt(e.target.value)}
                placeholder="e.g., 1850"
                className="flex-1 rounded-lg border border-gold/20 bg-navy-deep/60 px-4 py-3 text-cream placeholder:text-cream/30 focus:border-gold focus:ring-2 focus:ring-gold/15 focus:outline-none"
              />
              <button
                onClick={handleManualSubmit}
                className="rounded-lg bg-gold/10 border border-gold/30 px-6 py-3 text-sm font-medium text-gold hover:bg-gold/20 transition-colors"
              >
                Confirm
              </button>
            </div>
            <p className="mt-2 text-xs text-cream/30">
              Enter the total gross building area from your tax bill, survey, or listing.
            </p>
          </div>
        </div>
      )}

      {/* Cross-reference display */}
      {(attomGBA || measuredSqFt) && (
        <div className="card-premium rounded-xl p-5">
          <h4 className="text-sm font-medium text-cream mb-4">
            Square Footage Cross-Reference
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-cream/40 mb-1">ATTOM Data (Public Record)</p>
              <p className="font-display text-xl text-cream">
                {attomGBA ? `${attomGBA.toLocaleString()} sqft` : 'Pending'}
              </p>
            </div>
            <div>
              <p className="text-xs text-cream/40 mb-1">Your Measurement</p>
              <p className="font-display text-xl text-cream">
                {measuredSqFt ? `${measuredSqFt.toLocaleString()} sqft` : 'Pending'}
              </p>
            </div>
          </div>

          {discrepancy !== null && discrepancy > 5 && (
            <div className="mt-4 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-2">
              <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-400">
                  {discrepancy.toFixed(0)}% Discrepancy Detected
                </p>
                <p className="text-xs text-cream/40 mt-1">
                  A significant difference between recorded and measured square footage
                  may strengthen your appeal. This will be addressed in your report.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Address context */}
      <p className="text-xs text-cream/30 text-center">{address}</p>
    </div>
  );
}
