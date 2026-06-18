/**
 * Service Provider
 * Central export point for all services
 * Change implementations here to swap providers
 */

// Import implementations
import { FirebaseStorageService } from './implementations/FirebaseStorageService';
import { GoogleMapsService } from './implementations/GoogleMapsService';

// Import interfaces
import { IMapService } from './interfaces/IMapService';

// ==================== SERVICE INSTANCES ====================

// Lazy initialization to avoid blocking app startup
let _mapService: IMapService | null = null;
let _storageService: FirebaseStorageService | null = null;

/**
 * Map Service
 * Current: Google Maps
 * To swap: Replace with new MapboxService(), AppleMapsService(), etc.
 */
export const mapService: IMapService = {
  geocodeAddress: async (address: string) => {
    if (!_mapService) _mapService = new GoogleMapsService();
    return _mapService.geocodeAddress(address);
  },
  reverseGeocode: async (latitude: number, longitude: number) => {
    if (!_mapService) _mapService = new GoogleMapsService();
    return _mapService.reverseGeocode(latitude, longitude);
  },
  searchPlaces: async (query: string, region?: { latitudeDelta: number; longitudeDelta: number; latitude: number; longitude: number }) => {
    if (!_mapService) _mapService = new GoogleMapsService();
    return _mapService.searchPlaces(query, region);
  },
  getPlaceDetails: async (placeId: string) => {
    if (!_mapService) _mapService = new GoogleMapsService();
    return _mapService.getPlaceDetails(placeId);
  },
  getAutocompleteSuggestions: async (input: string) => {
    if (!_mapService) _mapService = new GoogleMapsService();
    return _mapService.getAutocompleteSuggestions(input);
  },
  getNearbyPlaces: async (latitude: number, longitude: number, radiusMeters: number, keyword?: string) => {
    if (!_mapService) _mapService = new GoogleMapsService();
    return _mapService.getNearbyPlaces(latitude, longitude, radiusMeters, keyword);
  },
  calculateDistance: async (origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }) => {
    if (!_mapService) _mapService = new GoogleMapsService();
    return _mapService.calculateDistance(origin, destination);
  },
  getDirections: async (origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }, mode?: 'driving' | 'walking' | 'transit') => {
    if (!_mapService) _mapService = new GoogleMapsService();
    return _mapService.getDirections(origin, destination, mode);
  },
  getApiKey: () => {
    if (!_mapService) _mapService = new GoogleMapsService();
    return _mapService.getApiKey();
  },
  getProvider: () => {
    if (!_mapService) _mapService = new GoogleMapsService();
    return _mapService.getProvider();
  },
  isConfigured: () => {
    if (!_mapService) _mapService = new GoogleMapsService();
    return _mapService.isConfigured();
  },
};

/**
 * Streaming Service
 * Current: Zeegocloud
 * To swap: Replace with new TwilioService(), AWSIVSService(), etc.
 */


/**
 * Storage Service
 * Current: Firebase Storage
 * To swap: Replace with new S3StorageService(), CloudinaryService(), etc.
 */
export const getStorageService = () => {
  if (!_storageService) {
    _storageService = new FirebaseStorageService();
  }
  return _storageService;
};

// For backwards compatibility


export const storageService = {
  uploadImage: async (uri: string, path: string) => getStorageService().uploadImage(uri, path),
  uploadVideo: async (uri: string, path: string) => getStorageService().uploadVideo(uri, path),
  uploadFile: async (uri: string, path: string, contentType: string = 'application/octet-stream') => getStorageService().uploadFile(uri, path, contentType),
  deleteFile: async (path: string) => getStorageService().deleteFile(path),
  uploadMultipleImages: async (uris: string[], basePath: string) => getStorageService().uploadMultipleImages(uris, basePath),
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Initialize all services
 */
export async function initializeServices(): Promise<void> {
  try {
    console.log('Initializing services...');
    
    // Services will initialize lazily when first used
    
    console.log('All services ready for lazy initialization');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    throw error;
  }
}

/**
 * Cleanup all services
 */
export async function cleanupServices(): Promise<void> {
  try {
    console.log('Cleaning up services...');
    
    // Reset instances
    _mapService = null;
    _storageService = null;
    
    console.log('All services cleaned up successfully');
  } catch (error) {
    console.error('Failed to cleanup services:', error);
    throw error;
  }
}

// ==================== EXPORTS ====================

export { IMapService };
