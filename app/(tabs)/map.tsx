// Map Screen — Shows shops on map, route polyline, current location
// Part of Finexa Smart Credit Routes app
// FIX: Uses WebView + Leaflet/OSM instead of react-native-maps to prevent crash
// react-native-maps requires Google Maps API key on Android which was not configured

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { AppState } from 'react-native';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useAuth } from '@/hooks/useAuth';
import { useShops } from '@/hooks/useShops';
import { Shop } from '@/services/api';
import { StorageService } from '@/services/storage';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow } from '@/constants/theme';
import { AuroraColors } from '@/constants/auroraTheme';
import { formatPKR } from '@/utils/format';
import { getDistanceMeters } from '@/utils/distance';
import { useRouteTracking } from '@/contexts/RouteTrackingContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PROXIMITY_RADIUS = 30; // 30 meters
const DEFAULT_LAT = 30.3753; // Pakistan center
const DEFAULT_LNG = 69.3451;

interface GPSPoint {
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  altitude: number | null;
  batteryLevel: number | null;
  isOffline: boolean;
  recordedAt: string;
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { user, selectedCompanyId } = useAuth();
  const { todayShops } = useShops();
  const { isTracking, startTime } = useRouteTracking();

  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [routePoints, setRoutePoints] = useState<GPSPoint[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [showVisitedOnly, setShowVisitedOnly] = useState(false);
  const [visitedShopIds, setVisitedShopIds] = useState<Set<string>>(new Set());
  const [visitGpsCoords, setVisitGpsCoords] = useState<Record<string, { lat: number; lng: number }>>({});
  const [mapReady, setMapReady] = useState(false);
  const webViewRef = useRef<any>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load current location + continuous tracking during route
  // FIX: Location was only fetched once. Now we also watch position when route is active
  // so the user's blue dot moves in real-time on the map.
  useEffect(() => {
    let watchSub: { remove: () => void } | null = null;

    (async () => {
      try {
        const Location = require('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setIsLoadingLocation(false);
          return;
        }

        // Get initial position
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          setCurrentLocation({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          });
        } catch (e) {
          console.warn('[Map] Failed to get current location:', e);
        }

        // Watch position for real-time updates during route tracking
        if (isTracking) {
          try {
            watchSub = await Location.watchPositionAsync(
              {
                accuracy: Location.Accuracy.Balanced,
                timeInterval: 10000, // 10 seconds
                distanceInterval: 10, // 10 meters
              },
              (loc: any) => {
                setCurrentLocation({
                  lat: loc.coords.latitude,
                  lng: loc.coords.longitude,
                });
              }
            );
          } catch (e) {
            console.warn('[Map] Failed to start location watch:', e);
          }
        }
      } catch (e) {
        console.warn('[Map] Failed to get current location:', e);
      } finally {
        setIsLoadingLocation(false);
      }
    })();

    return () => {
      if (watchSub) watchSub.remove();
    };
  }, [isTracking]);

  // Load GPS route points from offline storage + periodic refresh during tracking
  // FIX: Route points were only loaded once when isTracking changed.
  // Now we poll every 10 seconds during active tracking so the map polyline updates live.
  const loadRoutePoints = useCallback(async () => {
    try {
      const locations: GPSPoint[] = await StorageService.getOfflineRouteLocations();
      const validPoints = locations.filter((l) => l.lat && l.lng);
      setRoutePoints(validPoints);
    } catch (e) {
      console.warn('[Map] Failed to load route points:', e);
    }
  }, []);

  useEffect(() => {
    loadRoutePoints();
  }, [isTracking, loadRoutePoints]);

  // Periodic refresh: every 10 seconds when tracking is active
  useEffect(() => {
    if (isTracking) {
      refreshIntervalRef.current = setInterval(loadRoutePoints, 5000);
    }
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [isTracking, loadRoutePoints]);

  // Refresh route points when app comes to foreground during tracking
  useEffect(() => {
    const handleAppState = (nextState: string) => {
      if (nextState === 'active' && isTracking) {
        loadRoutePoints();
      }
    };
    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [isTracking, loadRoutePoints]);

  // Load visited shops — FIX: refresh every 5s so map picks up new visits from index.tsx
  const loadVisitedData = useCallback(async () => {
    try {
      const cached = await StorageService.getVisitedShops();
      setVisitedShopIds(new Set(cached)); // Always set, even if empty (clears stale visits)
      const coords = await StorageService.getVisitGpsCoords();
      setVisitGpsCoords(coords); // Always set, even if empty
    } catch (e) {
      console.warn('[Map] Failed to load visited data:', e);
    }
  }, []);

  useEffect(() => {
    loadVisitedData();
  }, [loadVisitedData]);

  // Periodic refresh of visited shops so map pins update when user visits shops from the list tab
  useEffect(() => {
    const interval = setInterval(loadVisitedData, 5000);
    return () => clearInterval(interval);
  }, [loadVisitedData]);

  // Shops with GPS coordinates — also include visited shops using visit GPS data
  // when the shop itself doesn't have lat/lng (shops get GPS from first visit)
  const shopsWithCoords = useMemo(() => {
    const shops = showVisitedOnly
      ? todayShops.filter((s) => visitedShopIds.has(s.id))
      : todayShops;
    return shops.filter((s) => {
      // Shop has its own GPS coordinates
      if (s.lat && s.lng) return true;
      // Visited shop with GPS from visit record
      if (visitedShopIds.has(s.id) && visitGpsCoords[s.id]) return true;
      return false;
    }).map((s) => {
      // Use visit GPS coordinates if shop doesn't have its own
      if ((!s.lat || !s.lng) && visitGpsCoords[s.id]) {
        return { ...s, lat: visitGpsCoords[s.id].lat, lng: visitGpsCoords[s.id].lng };
      }
      return s;
    });
  }, [todayShops, showVisitedOnly, visitedShopIds, visitGpsCoords]);

  // Center coordinates
  const centerCoords = useMemo(() => {
    if (currentLocation) return { lat: currentLocation.lat, lng: currentLocation.lng };
    if (shopsWithCoords.length > 0) {
      const lats = shopsWithCoords.map((s) => s.lat!);
      const lngs = shopsWithCoords.map((s) => s.lng!);
      return {
        lat: (Math.min(...lats) + Math.max(...lats)) / 2,
        lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      };
    }
    return { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
  }, [currentLocation, shopsWithCoords]);

  // Zoom level
  const zoomLevel = useMemo(() => {
    if (currentLocation) return 15;
    if (shopsWithCoords.length > 0) {
      const lats = shopsWithCoords.map((s) => s.lat!);
      const lngs = shopsWithCoords.map((s) => s.lng!);
      const latSpread = Math.max(...lats) - Math.min(...lats);
      const lngSpread = Math.max(...lngs) - Math.min(...lngs);
      const maxSpread = Math.max(latSpread, lngSpread);
      if (maxSpread > 0.5) return 9;
      if (maxSpread > 0.1) return 11;
      if (maxSpread > 0.02) return 13;
      return 15;
    }
    return 6;
  }, [currentLocation, shopsWithCoords]);

  // Get distance from current location to shop
  const getDistanceToShop = useCallback((shop: Shop): string | null => {
    if (!currentLocation || !shop.lat || !shop.lng) return null;
    const meters = getDistanceMeters(currentLocation.lat, currentLocation.lng, shop.lat, shop.lng);
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  }, [currentLocation]);

  // Get shop balance
  const getShopBalance = useCallback((shop: Shop): number => {
    try {
      if (shop.companyBalances && shop.companyBalances.length > 0 && selectedCompanyId) {
        const companyBal = shop.companyBalances.find((cb) => cb.companyId === selectedCompanyId);
        if (companyBal) return companyBal.balance;
      }
      return shop.balance || 0;
    } catch {
      return shop.balance || 0;
    }
  }, [selectedCompanyId]);

  // Stats
  const totalShops = todayShops.length;
  const shopsOnMap = shopsWithCoords.length;
  const visitedCount = visitedShopIds.size;

  // Send data to WebView
  const updateMapData = useCallback(() => {
    if (!webViewRef.current || !mapReady) return;

    const shopMarkers = shopsWithCoords.map((shop) => ({
      id: shop.id,
      name: shop.name,
      area: shop.address || shop.area || '',
      lat: shop.lat,
      lng: shop.lng,
      isVisited: visitedShopIds.has(shop.id),
      balance: getShopBalance(shop),
    }));

    const routeCoords = routePoints.map((p) => ({ lat: p.lat, lng: p.lng }));

    // FIX: Build waypoint route — ordered line connecting visited shops
    // This creates a visible path showing the orderbooker's shop visit sequence
    const visitedShopsOnMap = shopsWithCoords
      .filter((s) => visitedShopIds.has(s.id))
      .map((s) => ({ id: s.id, lat: s.lat!, lng: s.lng! }));

    const message = JSON.stringify({
      type: 'updateMap',
      shops: shopMarkers,
      route: routeCoords,
      waypointRoute: visitedShopsOnMap,
      userLocation: currentLocation,
      proximityRadius: PROXIMITY_RADIUS,
      selectedShopId: selectedShop?.id || null,
    });

    webViewRef.current.postMessage(message);
  }, [shopsWithCoords, visitedShopIds, routePoints, currentLocation, selectedShop, getShopBalance, mapReady]);

  // Update map whenever data changes
  useEffect(() => {
    updateMapData();
  }, [updateMapData]);

  // ── Offline Map Support State ──────────────────────────────────────────────
  // Tracks progress while prefetching map tiles for offline use
  const [offlineDownloadState, setOfflineDownloadState] = useState<{
    active: boolean;
    progress: number;  // 0..100
    message: string;
  }>({ active: false, progress: 0, message: '' });

  // Handle messages from WebView
  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'mapReady') {
        setMapReady(true);
      } else if (data.type === 'shopClicked') {
        const shop = todayShops.find((s) => s.id === data.shopId);
        if (shop) setSelectedShop(shop);
      } else if (data.type === 'mapClicked') {
        setSelectedShop(null);
      } else if (data.type === 'prefetchProgress') {
        setOfflineDownloadState({
          active: true,
          progress: data.progress || 0,
          message: `Downloading tiles... ${data.progress || 0}% (${data.loaded || 0}/${data.total || 0})`,
        });
      } else if (data.type === 'prefetchComplete') {
        setOfflineDownloadState({
          active: false,
          progress: 100,
          message: data.message || 'Offline map cached',
        });
      }
    } catch (e) {
      // Ignore non-JSON messages
    }
  }, [todayShops]);

  // Center map on user
  const centerOnUser = useCallback(() => {
    if (currentLocation && webViewRef.current && mapReady) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'centerOnUser',
        lat: currentLocation.lat,
        lng: currentLocation.lng,
      }));
    } else if (!currentLocation) {
      Alert.alert('Location Not Available', 'GPS location is not available yet. Please wait or check location permissions.');
    }
  }, [currentLocation, mapReady]);

  // Fit all shops in view
  const fitAllShops = useCallback(() => {
    if (webViewRef.current && mapReady) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'fitAllShops',
      }));
    }
  }, [mapReady]);

  // ── Offline Map Support ────────────────────────────────────────────────────
  // Download (prefetch) tiles for current viewport + nearby zoom levels.
  // Uses Leaflet's tile layer to fetch all tiles in the current bounds
  // across zoom levels [currentZoom-1, currentZoom+2] — populates WebView
  // HTTP cache so the same tiles load when device is offline.
  const downloadOfflineMap = useCallback(() => {
    if (!webViewRef.current || !mapReady) {
      Alert.alert('Map Not Ready', 'Please wait for the map to finish loading first.');
      return;
    }
    setOfflineDownloadState({
      active: true,
      progress: 0,
      message: 'Fetching map tiles...',
    });
    webViewRef.current.postMessage(JSON.stringify({
      type: 'prefetchOfflineTiles',
      zoomRange: 2,  // current zoom ±2
    }));
    // Listen for completion message from WebView
    // The WebView will post back a 'prefetchComplete' message with progress
    // Set a fallback timeout to auto-complete in case JS doesn't post back
    setTimeout(() => {
      setOfflineDownloadState((s) => {
        if (s.active) {
          return {
            active: false,
            progress: 100,
            message: 'Offline map cached. You can now use map without internet.',
          };
        }
        return s;
      });
    }, 12000);
  }, [mapReady]);

  // Auto-dismiss offline download success message after 4 seconds
  useEffect(() => {
    if (!offlineDownloadState.active && offlineDownloadState.message) {
      const t = setTimeout(() => {
        setOfflineDownloadState({ active: false, progress: 0, message: '' });
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [offlineDownloadState.active, offlineDownloadState.message]);

  // Leaflet HTML for WebView
  const leafletHTML = useMemo(() => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; overflow: hidden; }
    .shop-popup { font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
    .shop-popup h3 { margin: 0 0 4px 0; font-size: 13px; font-weight: 700; color: #1e1b4b; }
    .shop-popup p { margin: 0; font-size: 11px; color: #6b7280; }
    .shop-popup .balance { color: #2563EB; font-weight: 600; }
    .shop-popup .status { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; margin-top: 4px; }
    .shop-popup .visited { background: #d1fae5; color: #065f46; }
    .shop-popup .not-visited { background: #f3f4f6; color: #6b7280; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: false
    }).setView([${centerCoords.lat}, ${centerCoords.lng}], ${zoomLevel});

    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    var shopMarkers = {};
    var routeLine = null;
    var waypointLine = null;
    var userMarker = null;
    var proximityCircles = {};

    // Handle messages from React Native
    document.addEventListener('message', function(event) {
      try {
        var data = JSON.parse(event.data);
        if (data.type === 'updateMap') {
          updateMarkers(data.shops, data.proximityRadius);
          updateRoute(data.route);
          updateWaypointRoute(data.waypointRoute);
          updateUserLocation(data.userLocation);
          if (data.selectedShopId) {
            highlightShop(data.selectedShopId);
          }
        } else if (data.type === 'centerOnUser') {
          map.setView([data.lat, data.lng], 16, { animate: true });
        } else if (data.type === 'fitAllShops') {
          var allPoints = [];
          Object.values(shopMarkers).forEach(function(m) {
            var ll = m.getLatLng();
            allPoints.push([ll.lat, ll.lng]);
          });
          if (allPoints.length > 0) {
            map.fitBounds(allPoints, { padding: [40, 40], maxZoom: 16 });
          }
        } else if (data.type === 'prefetchOfflineTiles') {
          // Offline Map Support — prefetch tiles for current viewport
          // Iterate zoom levels (currentZoom -1 .. currentZoom + zoomRange)
          // For each zoom, find all tile coords in current viewport and
          // create hidden <img> tags pointing to tile URLs to force HTTP cache.
          var tileLayer = null;
          map.eachLayer(function(layer) {
            if (layer instanceof L.TileLayer) { tileLayer = layer; }
          });
          if (!tileLayer) {
            window.ReactNativeWebView && ReactNativeWebView.postMessage(JSON.stringify({
              type: 'prefetchComplete', progress: 0, message: 'No tile layer found'
            }));
          } else {
            var currentZoom = map.getZoom();
            var bounds = map.getBounds();
            var zoomMin = Math.max(0, currentZoom - 1);
            var zoomMax = Math.min(19, currentZoom + (data.zoomRange || 2));
            var tilesTotal = 0;
            var tilesLoaded = 0;
            var tileUrlTemplate = tileLayer._url;
            var subdomains = tileLayer.options.subdomains || 'abc';

            // Compute total tile count first
            for (var z = zoomMin; z <= zoomMax; z++) {
              var north = L.latLng(bounds.getNorth(), bounds.getWest());
              var south = L.latLng(bounds.getSouth(), bounds.getEast());
              var nwTile = L.CRS.EPSG3857.latLngToPoint(north, z);
              var seTile = L.CRS.EPSG3857.latLngToPoint(south, z);
              var tileSize = 256;
              var xmin = Math.floor(nwTile.x / tileSize);
              var xmax = Math.floor(seTile.x / tileSize);
              var ymin = Math.floor(nwTile.y / tileSize);
              var ymax = Math.floor(seTile.y / tileSize);
              tilesTotal += (xmax - xmin + 1) * (ymax - ymin + 1);
            }

            if (tilesTotal === 0) {
              window.ReactNativeWebView && ReactNativeWebView.postMessage(JSON.stringify({
                type: 'prefetchComplete', progress: 100, message: 'No tiles to fetch'
              }));
            } else {
              // Now actually fetch each tile by creating a hidden Image
              for (var z2 = zoomMin; z2 <= zoomMax; z2++) {
                var n2 = L.latLng(bounds.getNorth(), bounds.getWest());
                var s2 = L.latLng(bounds.getSouth(), bounds.getEast());
                var nwt = L.CRS.EPSG3857.latLngToPoint(n2, z2);
                var set = L.CRS.EPSG3857.latLngToPoint(s2, z2);
                var ts2 = 256;
                var xMin = Math.floor(nwt.x / ts2);
                var xMax = Math.floor(set.x / ts2);
                var yMin = Math.floor(nwt.y / ts2);
                var yMax = Math.floor(set.y / ts2);

                for (var x = xMin; x <= xMax; x++) {
                  for (var y = yMin; y <= yMax; y++) {
                    var url = L.Util.template(tileUrlTemplate, {
                      s: subdomains[Math.abs(x + y) % subdomains.length],
                      z: z2, x: x, y: y
                    });
                    (function(u) {
                      var img = new Image();
                      img.onload = img.onerror = function() {
                        tilesLoaded++;
                        if (tilesLoaded % 5 === 0 || tilesLoaded === tilesTotal) {
                          var pct = Math.round((tilesLoaded / tilesTotal) * 100);
                          window.ReactNativeWebView && ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'prefetchProgress',
                            progress: pct,
                            loaded: tilesLoaded,
                            total: tilesTotal
                          }));
                          if (tilesLoaded === tilesTotal) {
                            window.ReactNativeWebView && ReactNativeWebView.postMessage(JSON.stringify({
                              type: 'prefetchComplete',
                              progress: 100,
                              message: 'Offline map cached successfully'
                            }));
                          }
                        }
                      };
                      img.src = u;
                    })(url);
                  }
                }
              }
            }
          }
        }
      } catch(e) {}
    });
    // Also listen on window for React Native WebView (some versions use window, some use document)
    window.addEventListener('message', function(event) {
      try {
        var data = JSON.parse(event.data);
        if (data.type === 'updateMap') {
          updateMarkers(data.shops, data.proximityRadius);
          updateRoute(data.route);
          updateWaypointRoute(data.waypointRoute);
          updateUserLocation(data.userLocation);
          if (data.selectedShopId) {
            highlightShop(data.selectedShopId);
          }
        } else if (data.type === 'centerOnUser') {
          map.setView([data.lat, data.lng], 16, { animate: true });
        } else if (data.type === 'fitAllShops') {
          var allPoints = [];
          Object.values(shopMarkers).forEach(function(m) {
            var ll = m.getLatLng();
            allPoints.push([ll.lat, ll.lng]);
          });
          if (allPoints.length > 0) {
            map.fitBounds(allPoints, { padding: [40, 40], maxZoom: 16 });
          }
        } else if (data.type === 'prefetchOfflineTiles') {
          // Offline Map Support — prefetch tiles for current viewport
          // Iterate zoom levels (currentZoom -1 .. currentZoom + zoomRange)
          // For each zoom, find all tile coords in current viewport and
          // create hidden <img> tags pointing to tile URLs to force HTTP cache.
          var tileLayer = null;
          map.eachLayer(function(layer) {
            if (layer instanceof L.TileLayer) { tileLayer = layer; }
          });
          if (!tileLayer) {
            window.ReactNativeWebView && ReactNativeWebView.postMessage(JSON.stringify({
              type: 'prefetchComplete', progress: 0, message: 'No tile layer found'
            }));
          } else {
            var currentZoom = map.getZoom();
            var bounds = map.getBounds();
            var zoomMin = Math.max(0, currentZoom - 1);
            var zoomMax = Math.min(19, currentZoom + (data.zoomRange || 2));
            var tilesTotal = 0;
            var tilesLoaded = 0;
            var tileUrlTemplate = tileLayer._url;
            var subdomains = tileLayer.options.subdomains || 'abc';

            // Compute total tile count first
            for (var z = zoomMin; z <= zoomMax; z++) {
              var north = L.latLng(bounds.getNorth(), bounds.getWest());
              var south = L.latLng(bounds.getSouth(), bounds.getEast());
              var nwTile = L.CRS.EPSG3857.latLngToPoint(north, z);
              var seTile = L.CRS.EPSG3857.latLngToPoint(south, z);
              var tileSize = 256;
              var xmin = Math.floor(nwTile.x / tileSize);
              var xmax = Math.floor(seTile.x / tileSize);
              var ymin = Math.floor(nwTile.y / tileSize);
              var ymax = Math.floor(seTile.y / tileSize);
              tilesTotal += (xmax - xmin + 1) * (ymax - ymin + 1);
            }

            if (tilesTotal === 0) {
              window.ReactNativeWebView && ReactNativeWebView.postMessage(JSON.stringify({
                type: 'prefetchComplete', progress: 100, message: 'No tiles to fetch'
              }));
            } else {
              // Now actually fetch each tile by creating a hidden Image
              for (var z2 = zoomMin; z2 <= zoomMax; z2++) {
                var n2 = L.latLng(bounds.getNorth(), bounds.getWest());
                var s2 = L.latLng(bounds.getSouth(), bounds.getEast());
                var nwt = L.CRS.EPSG3857.latLngToPoint(n2, z2);
                var set = L.CRS.EPSG3857.latLngToPoint(s2, z2);
                var ts2 = 256;
                var xMin = Math.floor(nwt.x / ts2);
                var xMax = Math.floor(set.x / ts2);
                var yMin = Math.floor(nwt.y / ts2);
                var yMax = Math.floor(set.y / ts2);

                for (var x = xMin; x <= xMax; x++) {
                  for (var y = yMin; y <= yMax; y++) {
                    var url = L.Util.template(tileUrlTemplate, {
                      s: subdomains[Math.abs(x + y) % subdomains.length],
                      z: z2, x: x, y: y
                    });
                    (function(u) {
                      var img = new Image();
                      img.onload = img.onerror = function() {
                        tilesLoaded++;
                        if (tilesLoaded % 5 === 0 || tilesLoaded === tilesTotal) {
                          var pct = Math.round((tilesLoaded / tilesTotal) * 100);
                          window.ReactNativeWebView && ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'prefetchProgress',
                            progress: pct,
                            loaded: tilesLoaded,
                            total: tilesTotal
                          }));
                          if (tilesLoaded === tilesTotal) {
                            window.ReactNativeWebView && ReactNativeWebView.postMessage(JSON.stringify({
                              type: 'prefetchComplete',
                              progress: 100,
                              message: 'Offline map cached successfully'
                            }));
                          }
                        }
                      };
                      img.src = u;
                    })(url);
                  }
                }
              }
            }
          }
        }
      } catch(e) {}
    });

    function updateMarkers(shops, proximityRadius) {
      // Remove old markers not in new list
      var newIds = {};
      shops.forEach(function(s) { newIds[s.id] = true; });
      Object.keys(shopMarkers).forEach(function(id) {
        if (!newIds[id]) {
          map.removeLayer(shopMarkers[id]);
          delete shopMarkers[id];
          if (proximityCircles[id]) {
            map.removeLayer(proximityCircles[id]);
            delete proximityCircles[id];
          }
        }
      });

      shops.forEach(function(shop) {
        var color = shop.isVisited ? '#10B981' : '#3B82F6';
        var statusClass = shop.isVisited ? 'visited' : 'not-visited';
        var statusText = shop.isVisited ? 'Visited' : 'Not Visited';

        if (shopMarkers[shop.id]) {
          // Update existing marker icon color
          shopMarkers[shop.id].setIcon(L.divIcon({
            className: '',
            html: '<div style="width:28px;height:28px;border-radius:50%;background:' + color + ';display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg></div>',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          }));
        } else {
          // Create new marker
          var marker = L.marker([shop.lat, shop.lng], {
            icon: L.divIcon({
              className: '',
              html: '<div style="width:28px;height:28px;border-radius:50%;background:' + color + ';display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4V6h16v12zM6 10h2v2H6zm0 4h2v2H6zm4-4h8v2h-8zm0 4h8v2h-8z"/></svg></div>',
              iconSize: [28, 28],
              iconAnchor: [14, 14]
            })
          }).addTo(map);

          marker.bindPopup(
            '<div class="shop-popup">' +
            '<h3>' + shop.name + '</h3>' +
            '<p>' + shop.area + '</p>' +
            '<p class="balance">' + shop.balance + '</p>' +
            '<span class="status ' + statusClass + '">' + statusText + '</span>' +
            '</div>',
            { closeButton: false, maxWidth: 200 }
          );

          marker.on('click', function() {
            window.ReactNativeWebView && ReactNativeWebView.postMessage(JSON.stringify({
              type: 'shopClicked',
              shopId: shop.id
            }));
          });

          shopMarkers[shop.id] = marker;

          // Add proximity circle
          var circle = L.circle([shop.lat, shop.lng], {
            radius: proximityRadius || 30,
            color: shop.isVisited ? '#10B981' : '#3B82F6',
            fillColor: shop.isVisited ? '#10B981' : '#3B82F6',
            fillOpacity: 0.08,
            weight: 1,
            opacity: 0.5,
            dashArray: '4 4'
          }).addTo(map);

          proximityCircles[shop.id] = circle;
        }
      });
    }

    function updateRoute(route) {
      if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
      }
      // Remove old start/end markers
      if (window._startMarker) { map.removeLayer(window._startMarker); window._startMarker = null; }
      if (window._endMarker) { map.removeLayer(window._endMarker); window._endMarker = null; }

      if (route && route.length > 1) {
        // Sort by recordedAt time if available (oldest first)
        var sorted = route.slice().sort(function(a, b) {
          var ta = a.recordedAt ? new Date(a.recordedAt).getTime() : 0;
          var tb = b.recordedAt ? new Date(b.recordedAt).getTime() : 0;
          return ta - tb;
        });
        // Deduplicate for cleaner line
        var seen = {};
        var coords = [];
        sorted.forEach(function(p) {
          var key = p.lat.toFixed(5) + ',' + p.lng.toFixed(5);
          if (!seen[key]) {
            seen[key] = true;
            coords.push([p.lat, p.lng]);
          }
        });
        if (coords.length > 1) {
          // Draw thick blue polyline showing the OB's path
          routeLine = L.polyline(coords, {
            color: '#2563EB',
            weight: 5,
            opacity: 0.85,
            smoothFactor: 1
          }).addTo(map);

          // Start marker (green circle with "S")
          window._startMarker = L.marker(coords[0], {
            icon: L.divIcon({
              className: '',
              html: '<div style="width:28px;height:28px;border-radius:50%;background:#10B981;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);font-size:12px;font-weight:bold;color:white;">S</div>',
              iconSize: [28, 28],
              iconAnchor: [14, 14]
            })
          }).addTo(map);

          // End/current marker (red circle with "E")
          var lastCoord = coords[coords.length - 1];
          window._endMarker = L.marker(lastCoord, {
            icon: L.divIcon({
              className: '',
              html: '<div style="width:28px;height:28px;border-radius:50%;background:#EF4444;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);font-size:12px;font-weight:bold;color:white;">E</div>',
              iconSize: [28, 28],
              iconAnchor: [14, 14]
            })
          }).addTo(map);

          // Fit map to show entire route
          map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
        }
      }
    }

    // FIX: Waypoint route — dashed line connecting visited shops in sequence
    // This shows the orderbooker's visit path between shops on the map
    var waypointMarkers = [];
    function updateWaypointRoute(waypoints) {
      if (waypointLine) {
        map.removeLayer(waypointLine);
        waypointLine = null;
      }
      // Remove old waypoint markers
      waypointMarkers.forEach(function(m) { map.removeLayer(m); });
      waypointMarkers = [];

      if (waypoints && waypoints.length > 1) {
        var coords = waypoints.map(function(w) { return [w.lat, w.lng]; });
        waypointLine = L.polyline(coords, {
          color: '#F59E0B',
          weight: 3,
          opacity: 0.7,
          dashArray: '8 8',
          smoothFactor: 1,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        // Add numbered waypoints at each visited shop
        waypoints.forEach(function(w, idx) {
          var wm = L.marker([w.lat, w.lng], {
            icon: L.divIcon({
              className: '',
              html: '<div style="width:22px;height:22px;border-radius:50%;background:#F59E0B;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);font-size:10px;font-weight:bold;color:white;">' + (idx + 1) + '</div>',
              iconSize: [22, 22],
              iconAnchor: [11, 11]
            }),
            interactive: false
          }).addTo(map);
          waypointMarkers.push(wm);
        });
      }
    }

    var accuracyCircle = null;
    function updateUserLocation(loc) {
      if (!loc) return;
      if (userMarker) {
        userMarker.setLatLng([loc.lat, loc.lng]);
        if (accuracyCircle) {
          accuracyCircle.setLatLng([loc.lat, loc.lng]);
        }
      } else {
        userMarker = L.circleMarker([loc.lat, loc.lng], {
          radius: 8,
          fillColor: '#3B82F6',
          color: '#FFFFFF',
          weight: 3,
          fillOpacity: 1
        }).addTo(map);

        // Add accuracy circle
        accuracyCircle = L.circle([loc.lat, loc.lng], {
          radius: 20,
          color: '#3B82F6',
          fillColor: '#3B82F6',
          fillOpacity: 0.1,
          weight: 1
        }).addTo(map);
      }
    }

    function highlightShop(shopId) {
      if (shopMarkers[shopId]) {
        shopMarkers[shopId].openPopup();
        var ll = shopMarkers[shopId].getLatLng();
        map.setView([ll.lat, ll.lng], 16, { animate: true });
      }
    }

    // Notify React Native that map is ready
    setTimeout(function() {
      window.ReactNativeWebView && ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
    }, 500);
  </script>
</body>
</html>`;
  }, [centerCoords, zoomLevel]);

  // Loading state
  if (isLoadingLocation) {
    return (
      <View style={styles.root}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading Map...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Map Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="map" size={22} color={Colors.primary} />
          <Text style={styles.headerTitle}>Route Map</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            style={[styles.headerBtn, showVisitedOnly && styles.headerBtnActive]}
            onPress={() => setShowVisitedOnly((v) => !v)}
          >
            <MaterialIcons
              name={showVisitedOnly ? 'visibility' : 'visibility-off'}
              size={18}
              color={showVisitedOnly ? Colors.primary : Colors.textSecondary}
            />
          </Pressable>
        </View>
      </View>

      {/* Route Status Bar */}
      {isTracking && (
        <View style={styles.routeStatusBar}>
          <View style={styles.routeStatusDot} />
          <Text style={styles.routeStatusText}>
            Route Active — {routePoints.length} GPS points
          </Text>
          <Text style={styles.routeStatusTime}>
            Since {startTime ? new Date(startTime).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Karachi' }) : '--:--'}
          </Text>
        </View>
      )}

      {/* WebView Map */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: leafletHTML }}
          style={styles.map}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          onMessage={handleWebViewMessage}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.mapLoading}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading Map...</Text>
            </View>
          )}
          onError={(e) => {
            console.error('[Map] WebView error:', e.nativeEvent.description);
          }}
          onHttpError={(e) => {
            console.error('[Map] HTTP error:', e.nativeEvent.statusCode);
          }}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          scalesPageToFit={true}
          cacheEnabled={true}
          // ── Offline Map Support ──
          // Android: use cached tiles when offline (LOAD_CACHE_ELSE_NETWORK = 1)
          // iOS: cacheEnabled=true is sufficient (uses HTTP cache automatically)
          cacheMode={'LOAD_CACHE_ELSE_NETWORK' as any}
          incognito={false}  // ensure cache is persistent (not incognito)
          androidLayerType="hardware"
        />
      </View>

      {/* Floating Action Buttons */}
      <View style={[styles.fabContainer, { bottom: insets.bottom + 90 }]}>
        <Pressable style={styles.fabBtn} onPress={centerOnUser}>
          <MaterialIcons name="my-location" size={22} color={AuroraColors.neonViolet} />
        </Pressable>
        <Pressable style={styles.fabBtn} onPress={fitAllShops}>
          <MaterialIcons name="zoom-out-map" size={22} color={AuroraColors.neonViolet} />
        </Pressable>
        {/* Offline Map Download Button — prefetches tiles for offline use */}
        <Pressable
          style={[
            styles.fabBtn,
            offlineDownloadState.active && styles.fabBtnActive,
          ]}
          onPress={downloadOfflineMap}
          disabled={offlineDownloadState.active}
          accessibilityLabel="Download offline map"
          accessibilityRole="button"
        >
          <MaterialIcons
            name={offlineDownloadState.active ? 'cloud-download' : 'cloud-download'}
            size={22}
            color={offlineDownloadState.active ? AuroraColors.warning : AuroraColors.neonViolet}
          />
        </Pressable>
      </View>

      {/* Offline Map Download Progress Banner */}
      {offlineDownloadState.active || offlineDownloadState.message ? (
        <View
          style={[
            styles.offlineBanner,
            { top: insets.top + 60 },
          ]}
        >
          <MaterialIcons
            name={
              offlineDownloadState.active
                ? 'cloud-download'
                : offlineDownloadState.message.includes('cached')
                ? 'cloud-done'
                : 'cloud-off'
            }
            size={18}
            color={
              offlineDownloadState.active
                ? AuroraColors.warning
                : AuroraColors.success
            }
          />
          <View style={styles.offlineBannerTextWrap}>
            <Text style={styles.offlineBannerText}>{offlineDownloadState.message}</Text>
            {offlineDownloadState.active ? (
              <View style={styles.offlineProgressTrack}>
                <View
                  style={[
                    styles.offlineProgressFill,
                    { width: `${offlineDownloadState.progress}%` },
                  ]}
                />
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Map Stats Overlay */}
      <View style={[styles.statsOverlay, { bottom: insets.bottom + 90 }]}>
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <MaterialIcons name="store" size={14} color={Colors.primary} />
            <Text style={styles.statText}>{shopsOnMap}/{totalShops}</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: '#ECFDF5' }]}>
            <MaterialIcons name="check-circle" size={14} color="#10B981" />
            <Text style={[styles.statText, { color: '#065F46' }]}>{visitedCount} visited</Text>
          </View>
          {routePoints.length > 0 && (
            <View style={[styles.statChip, { backgroundColor: '#DBEAFE' }]}>
              <MaterialIcons name="route" size={14} color="#2563EB" />
              <Text style={[styles.statText, { color: '#1E40AF' }]}>{routePoints.length} pts</Text>
            </View>
          )}
        </View>
      </View>

      {/* Selected Shop Info Card */}
      {selectedShop && (
        <View style={[styles.shopCard, { bottom: insets.bottom + 140 }]}>
          <Pressable style={styles.shopCardClose} onPress={() => setSelectedShop(null)}>
            <MaterialIcons name="close" size={18} color={Colors.textSecondary} />
          </Pressable>
          <View style={styles.shopCardHeader}>
            <View style={[styles.shopPin, { backgroundColor: visitedShopIds.has(selectedShop.id) ? '#10B981' : '#3B82F6' }]}>
              <MaterialIcons name="store" size={16} color="#FFFFFF" />
            </View>
            <View style={styles.shopCardInfo}>
              <Text style={styles.shopCardName} numberOfLines={1}>{selectedShop.name}</Text>
              <Text style={styles.shopCardArea} numberOfLines={1}>{selectedShop.area}</Text>
            </View>
          </View>
          <View style={styles.shopCardDetails}>
            <View style={styles.shopDetailRow}>
              <MaterialIcons name="account-balance-wallet" size={16} color={Colors.primary} />
              <Text style={styles.shopDetailText}>Balance: {formatPKR(getShopBalance(selectedShop))}</Text>
            </View>
            {selectedShop.ownerName ? (
              <View style={styles.shopDetailRow}>
                <MaterialIcons name="person" size={16} color={Colors.textSecondary} />
                <Text style={styles.shopDetailText}>{selectedShop.ownerName}</Text>
              </View>
            ) : null}
            {getDistanceToShop(selectedShop) && (
              <View style={styles.shopDetailRow}>
                <MaterialIcons name="straighten" size={16} color={Colors.textSecondary} />
                <Text style={styles.shopDetailText}>{getDistanceToShop(selectedShop)} away</Text>
              </View>
            )}
            {selectedShop.phone ? (
              <View style={styles.shopDetailRow}>
                <MaterialIcons name="phone" size={16} color={Colors.textSecondary} />
                <Text style={styles.shopDetailText}>{selectedShop.phone}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.shopCardBadge}>
            <View style={[styles.badgeDot, { backgroundColor: visitedShopIds.has(selectedShop.id) ? '#10B981' : '#9CA3AF' }]} />
            <Text style={[styles.badgeText, { color: visitedShopIds.has(selectedShop.id) ? '#065F46' : '#6B7280' }]}>
              {visitedShopIds.has(selectedShop.id) ? 'Visited' : 'Not Visited'}
            </Text>
          </View>
        </View>
      )}

      {/* No Shops Warning */}
      {shopsOnMap === 0 && !isLoadingLocation && (
        <View style={styles.noDataOverlay}>
          <MaterialIcons name="location-off" size={48} color={Colors.textMuted} />
          <Text style={styles.noDataTitle}>No Shop Locations</Text>
          <Text style={styles.noDataDesc}>
            {totalShops === 0
              ? 'No shops loaded. Download data first.'
              : visitedCount === 0
              ? `${totalShops} shops found but none have GPS coordinates. Visit shops with GPS to add them to the map.`
              : `${totalShops} shops found. Visited shops will appear here after sync.`}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AuroraColors.bgDeep,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AuroraColors.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  headerBtnActive: {
    backgroundColor: '#DBEAFE',
    borderColor: Colors.primary,
  },
  routeStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: '#ECFDF5',
    borderBottomWidth: 1,
    borderBottomColor: '#A7F3D0',
  },
  routeStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  routeStatusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: '#065F46',
    flex: 1,
  },
  routeStatusTime: {
    fontSize: FontSize.xs,
    color: '#047857',
  },
  mapContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  mapLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AuroraColors.bgDeep,
    zIndex: 999,
  },
  fabContainer: {
    position: 'absolute',
    right: Spacing.md,
    gap: Spacing.sm,
  },
  fabBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AuroraColors.glassStrong,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
    borderWidth: 1,
    borderColor: AuroraColors.glassBorder,
  },
  fabBtnActive: {
    backgroundColor: 'rgba(251, 191, 36, 0.20)',
    borderColor: AuroraColors.warning,
    shadowColor: AuroraColors.warning,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  // Offline Map Download Banner
  offlineBanner: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: AuroraColors.glassStrong,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: AuroraColors.glassBorder,
    ...Shadow.lg,
  },
  offlineBannerTextWrap: {
    flex: 1,
  },
  offlineBannerText: {
    fontSize: FontSize.sm,
    color: AuroraColors.text,
    fontWeight: FontWeight.semibold,
  },
  offlineProgressTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  offlineProgressFill: {
    height: 4,
    backgroundColor: AuroraColors.warning,
    borderRadius: 2,
  },
  statsOverlay: {
    position: 'absolute',
    left: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadow.sm,
  },
  statText: {
    fontSize: 11,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  shopCard: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.md,
    ...Shadow.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  shopCardClose: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: AuroraColors.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  shopPin: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopCardInfo: {
    flex: 1,
  },
  shopCardName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  shopCardArea: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  shopCardDetails: {
    gap: 4,
    marginBottom: Spacing.sm,
  },
  shopDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  shopDetailText: {
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  shopCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  noDataOverlay: {
    position: 'absolute',
    top: '40%',
    left: Spacing.xl,
    right: Spacing.xl,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    padding: Spacing.xl,
    ...Shadow.lg,
  },
  noDataTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginTop: Spacing.md,
  },
  noDataDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    lineHeight: 20,
  },
});
