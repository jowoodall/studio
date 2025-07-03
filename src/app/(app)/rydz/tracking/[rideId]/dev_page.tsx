// types/route.ts
export interface RouteWaypoint {
    id: string;
    address: string;
    position: { lat: number; lng: number };
    type: 'driver_start' | 'passenger_pickup' | 'event_destination';
    passengerId?: string;
    passengerName?: string;
    estimatedArrivalTime?: Date;
    estimatedDepartureTime?: Date;
    actualArrivalTime?: Date;
    actualDepartureTime?: Date;
  }
  
  export interface OptimizedRoute {
    waypoints: RouteWaypoint[];
    totalDistance: number;
    totalDuration: number;
    optimizedOrder: number[];
    polyline: string;
    bounds: google.maps.LatLngBounds;
  }
  
  export interface RouteOptimizationRequest {
    driverStartLocation: { address: string; position?: { lat: number; lng: number } };
    passengerPickups: Array<{
      id: string;
      address: string;
      position?: { lat: number; lng: number };
      passengerName: string;
    }>;
    eventDestination: { address: string; position?: { lat: number; lng: number } };
    departureTime: Date;
    bufferTimeMinutes?: number; // Time buffer for each pickup (default: 5 minutes)
  }
  
  // utils/routeOptimizer.ts
  import { RouteWaypoint, OptimizedRoute, RouteOptimizationRequest } from '@/types/route';
  
  export class RouteOptimizer {
    private geocoder: google.maps.Geocoder;
    private directionsService: google.maps.DirectionsService;
  
    constructor() {
      this.geocoder = new google.maps.Geocoder();
      this.directionsService = new google.maps.DirectionsService();
    }
  
    async optimizeRoute(request: RouteOptimizationRequest): Promise<OptimizedRoute> {
      try {
        // Step 1: Geocode all addresses if positions aren't provided
        const waypoints = await this.geocodeWaypoints(request);
        
        // Step 2: Calculate distance matrix between all points
        const distanceMatrix = await this.calculateDistanceMatrix(waypoints);
        
        // Step 3: Optimize the order of passenger pickups
        const optimizedOrder = this.optimizePickupOrder(waypoints, distanceMatrix);
        
        // Step 4: Calculate route with optimized order
        const route = await this.calculateOptimizedRoute(waypoints, optimizedOrder);
        
        // Step 5: Calculate estimated arrival times
        const routeWithTimes = this.calculateEstimatedTimes(route, request.departureTime, request.bufferTimeMinutes || 5);
        
        return routeWithTimes;
      } catch (error) {
        console.error('Route optimization failed:', error);
        throw new Error('Failed to optimize route. Please check addresses and try again.');
      }
    }
  
    private async geocodeWaypoints(request: RouteOptimizationRequest): Promise<RouteWaypoint[]> {
      const waypoints: RouteWaypoint[] = [];
      
      // Driver start location
      const driverLocation = await this.geocodeAddress(request.driverStartLocation.address);
      waypoints.push({
        id: 'driver_start',
        address: request.driverStartLocation.address,
        position: request.driverStartLocation.position || driverLocation,
        type: 'driver_start'
      });
  
      // Passenger pickup locations
      for (const pickup of request.passengerPickups) {
        const position = pickup.position || await this.geocodeAddress(pickup.address);
        waypoints.push({
          id: pickup.id,
          address: pickup.address,
          position,
          type: 'passenger_pickup',
          passengerId: pickup.id,
          passengerName: pickup.passengerName
        });
      }
  
      // Event destination
      const eventLocation = await this.geocodeAddress(request.eventDestination.address);
      waypoints.push({
        id: 'event_destination',
        address: request.eventDestination.address,
        position: request.eventDestination.position || eventLocation,
        type: 'event_destination'
      });
  
      return waypoints;
    }
  
    private async geocodeAddress(address: string): Promise<{ lat: number; lng: number }> {
      return new Promise((resolve, reject) => {
        this.geocoder.geocode({ address }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            const location = results[0].geometry.location;
            resolve({ lat: location.lat(), lng: location.lng() });
          } else {
            reject(new Error(`Geocoding failed for address: ${address}`));
          }
        });
      });
    }
  
    private async calculateDistanceMatrix(waypoints: RouteWaypoint[]): Promise<number[][]> {
      const service = new google.maps.DistanceMatrixService();
      const origins = waypoints.map(w => w.position);
      const destinations = waypoints.map(w => w.position);
  
      return new Promise((resolve, reject) => {
        service.getDistanceMatrix({
          origins,
          destinations,
          travelMode: google.maps.TravelMode.DRIVING,
          unitSystem: google.maps.UnitSystem.METRIC,
          avoidHighways: false,
          avoidTolls: false
        }, (response, status) => {
          if (status === 'OK' && response) {
            const matrix: number[][] = [];
            for (let i = 0; i < response.rows.length; i++) {
              matrix[i] = [];
              for (let j = 0; j < response.rows[i].elements.length; j++) {
                const element = response.rows[i].elements[j];
                if (element.status === 'OK') {
                  matrix[i][j] = element.duration.value; // Duration in seconds
                } else {
                  matrix[i][j] = Infinity;
                }
              }
            }
            resolve(matrix);
          } else {
            reject(new Error('Distance matrix calculation failed'));
          }
        });
      });
    }
  
    private optimizePickupOrder(waypoints: RouteWaypoint[], distanceMatrix: number[][]): number[] {
      const driverIndex = 0;
      const eventIndex = waypoints.length - 1;
      const pickupIndices = waypoints
        .map((_, index) => index)
        .filter(index => index !== driverIndex && index !== eventIndex);
  
      if (pickupIndices.length === 0) {
        return [driverIndex, eventIndex];
      }
  
      // Use nearest neighbor algorithm for pickup optimization
      const optimizedPickups = this.nearestNeighborOptimization(
        driverIndex,
        pickupIndices,
        eventIndex,
        distanceMatrix
      );
  
      return [driverIndex, ...optimizedPickups, eventIndex];
    }
  
    private nearestNeighborOptimization(
      startIndex: number,
      pickupIndices: number[],
      endIndex: number,
      distanceMatrix: number[][]
    ): number[] {
      if (pickupIndices.length === 0) return [];
      if (pickupIndices.length === 1) return pickupIndices;
  
      const unvisited = [...pickupIndices];
      const route = [];
      let currentIndex = startIndex;
  
      while (unvisited.length > 0) {
        let nearestIndex = -1;
        let shortestDistance = Infinity;
  
        for (const candidateIndex of unvisited) {
          const distance = distanceMatrix[currentIndex][candidateIndex];
          if (distance < shortestDistance) {
            shortestDistance = distance;
            nearestIndex = candidateIndex;
          }
        }
  
        if (nearestIndex !== -1) {
          route.push(nearestIndex);
          unvisited.splice(unvisited.indexOf(nearestIndex), 1);
          currentIndex = nearestIndex;
        } else {
          break;
        }
      }
  
      return route;
    }
  
    private async calculateOptimizedRoute(waypoints: RouteWaypoint[], optimizedOrder: number[]): Promise<OptimizedRoute> {
      const orderedWaypoints = optimizedOrder.map(index => waypoints[index]);
      const origin = orderedWaypoints[0].position;
      const destination = orderedWaypoints[orderedWaypoints.length - 1].position;
      const waypts = orderedWaypoints.slice(1, -1).map(wp => ({
        location: wp.position,
        stopover: true
      }));
  
      return new Promise((resolve, reject) => {
        this.directionsService.route({
          origin,
          destination,
          waypoints: waypts,
          travelMode: google.maps.TravelMode.DRIVING,
          optimizeWaypoints: false // We've already optimized
        }, (response, status) => {
          if (status === 'OK' && response) {
            const route = response.routes[0];
            let totalDistance = 0;
            let totalDuration = 0;
  
            route.legs.forEach(leg => {
              totalDistance += leg.distance?.value || 0;
              totalDuration += leg.duration?.value || 0;
            });
  
            resolve({
              waypoints: orderedWaypoints,
              totalDistance,
              totalDuration,
              optimizedOrder,
              polyline: route.overview_polyline,
              bounds: route.bounds
            });
          } else {
            reject(new Error('Route calculation failed'));
          }
        });
      });
    }
  
    private calculateEstimatedTimes(route: OptimizedRoute, departureTime: Date, bufferMinutes: number): OptimizedRoute {
      let currentTime = new Date(departureTime);
      
      const waypointsWithTimes = route.waypoints.map((waypoint, index) => {
        const updatedWaypoint = { ...waypoint };
        
        if (index === 0) {
          // Driver start location
          updatedWaypoint.estimatedArrivalTime = new Date(currentTime);
          updatedWaypoint.estimatedDepartureTime = new Date(currentTime);
        } else {
          // Calculate travel time from previous waypoint
          const legDuration = this.getLegDuration(route, index - 1);
          currentTime = new Date(currentTime.getTime() + legDuration * 1000);
          
          updatedWaypoint.estimatedArrivalTime = new Date(currentTime);
          
          // Add buffer time for pickups (not for final destination)
          if (waypoint.type === 'passenger_pickup') {
            currentTime = new Date(currentTime.getTime() + bufferMinutes * 60 * 1000);
          }
          
          updatedWaypoint.estimatedDepartureTime = new Date(currentTime);
        }
        
        return updatedWaypoint;
      });
  
      return {
        ...route,
        waypoints: waypointsWithTimes
      };
    }
  
    private getLegDuration(route: OptimizedRoute, legIndex: number): number {
      // This is a simplified calculation
      // In practice, you'd get this from the actual route calculation
      const totalDuration = route.totalDuration;
      const numberOfLegs = route.waypoints.length - 1;
      return totalDuration / numberOfLegs;
    }
  }
  
  // Enhanced InteractiveMap component with route visualization
  export interface RouteVisualizationProps {
    route?: OptimizedRoute;
    showRoute?: boolean;
    onWaypointClick?: (waypoint: RouteWaypoint) => void;
  }
  
  // utils/routeRenderer.ts
  export class RouteRenderer {
    private map: google.maps.Map;
    private directionsRenderer: google.maps.DirectionsRenderer;
    private waypointMarkers: google.maps.Marker[] = [];
  
    constructor(map: google.maps.Map) {
      this.map = map;
      this.directionsRenderer = new google.maps.DirectionsRenderer({
        suppressMarkers: true, // We'll use custom markers
        polylineOptions: {
          strokeColor: '#2563eb',
          strokeOpacity: 0.8,
          strokeWeight: 4
        }
      });
      this.directionsRenderer.setMap(map);
    }
  
    renderRoute(route: OptimizedRoute, onWaypointClick?: (waypoint: RouteWaypoint) => void) {
      this.clearRoute();
      
      // Create custom markers for each waypoint
      route.waypoints.forEach((waypoint, index) => {
        const marker = new google.maps.Marker({
          position: waypoint.position,
          map: this.map,
          title: waypoint.address,
          icon: this.getMarkerIcon(waypoint.type, index),
          zIndex: waypoint.type === 'event_destination' ? 1000 : 100
        });
  
        if (onWaypointClick) {
          marker.addListener('click', () => onWaypointClick(waypoint));
        }
  
        // Add info window
        const infoWindow = new google.maps.InfoWindow({
          content: this.createInfoWindowContent(waypoint, index)
        });
  
        marker.addListener('click', () => {
          infoWindow.open(this.map, marker);
        });
  
        this.waypointMarkers.push(marker);
      });
  
      // Render the route polyline
      this.renderPolyline(route);
      
      // Fit map to route bounds
      this.map.fitBounds(route.bounds);
    }
  
    private getMarkerIcon(type: RouteWaypoint['type'], index: number): google.maps.Icon {
      const baseUrl = 'https://maps.google.com/mapfiles/ms/icons/';
      
      switch (type) {
        case 'driver_start':
          return {
            url: baseUrl + 'green-dot.png',
            scaledSize: new google.maps.Size(32, 32)
          };
        case 'passenger_pickup':
          return {
            url: baseUrl + 'blue-dot.png',
            scaledSize: new google.maps.Size(32, 32)
          };
        case 'event_destination':
          return {
            url: baseUrl + 'red-dot.png',
            scaledSize: new google.maps.Size(40, 40)
          };
        default:
          return {
            url: baseUrl + 'purple-dot.png',
            scaledSize: new google.maps.Size(32, 32)
          };
      }
    }
  
    private createInfoWindowContent(waypoint: RouteWaypoint, index: number): string {
      const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      let content = `
        <div style="max-width: 250px;">
          <h3 style="margin: 0 0 8px 0; color: #1f2937;">${this.getWaypointTitle(waypoint, index)}</h3>
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">${waypoint.address}</p>
      `;
  
      if (waypoint.estimatedArrivalTime) {
        content += `<p style="margin: 0; font-size: 12px;"><strong>ETA:</strong> ${formatTime(waypoint.estimatedArrivalTime)}</p>`;
      }
  
      if (waypoint.estimatedDepartureTime && waypoint.type === 'passenger_pickup') {
        content += `<p style="margin: 0; font-size: 12px;"><strong>Departure:</strong> ${formatTime(waypoint.estimatedDepartureTime)}</p>`;
      }
  
      content += '</div>';
      return content;
    }
  
    private getWaypointTitle(waypoint: RouteWaypoint, index: number): string {
      switch (waypoint.type) {
        case 'driver_start':
          return 'Driver Start Location';
        case 'passenger_pickup':
          return `Pickup ${index}: ${waypoint.passengerName || 'Passenger'}`;
        case 'event_destination':
          return 'Event Destination';
        default:
          return 'Waypoint';
      }
    }
  
    private renderPolyline(route: OptimizedRoute) {
      // Use the encoded polyline from the route
      const decodedPath = google.maps.geometry.encoding.decodePath(route.polyline);
      
      const polyline = new google.maps.Polyline({
        path: decodedPath,
        geodesic: true,
        strokeColor: '#2563eb',
        strokeOpacity: 0.8,
        strokeWeight: 4
      });
  
      polyline.setMap(this.map);
    }
  
    clearRoute() {
      this.directionsRenderer.setDirections({ routes: [] } as google.maps.DirectionsResult);
      this.waypointMarkers.forEach(marker => marker.setMap(null));
      this.waypointMarkers = [];
    }
  
    destroy() {
      this.clearRoute();
      this.directionsRenderer.setMap(null);
    }
  }
  
  // Hook for using route optimization
  export function useRouteOptimization() {
    const [optimizer, setOptimizer] = useState<RouteOptimizer | null>(null);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null);
    const [error, setError] = useState<string | null>(null);
  
    useEffect(() => {
      if (typeof window !== 'undefined' && window.google) {
        setOptimizer(new RouteOptimizer());
      }
    }, []);
  
    const optimizeRoute = async (request: RouteOptimizationRequest) => {
      if (!optimizer) {
        setError('Route optimizer not initialized');
        return null;
      }
  
      setIsOptimizing(true);
      setError(null);
  
      try {
        const route = await optimizer.optimizeRoute(request);
        setOptimizedRoute(route);
        return route;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Route optimization failed';
        setError(errorMessage);
        return null;
      } finally {
        setIsOptimizing(false);
      }
    };
  
    return {
      optimizeRoute,
      isOptimizing,
      optimizedRoute,
      error,
      clearRoute: () => setOptimizedRoute(null),
      clearError: () => setError(null)
    };
  }