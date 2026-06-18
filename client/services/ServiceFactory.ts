/**
 * Service Factory - Single place to switch backends
 * 
 * To change backend:
 * 1. Create new implementation (e.g., SupabaseAuthService)
 * 2. Change the return statement in the getter
 * 3. That's it! No need to change code anywhere else
 */

import { FirebaseAuthService } from './implementations/FirebaseAuthService';
import { FirebaseDatabaseService } from './implementations/FirebaseDatabaseService';
import { IAuthService } from './interfaces/IAuthService';
import { IDatabaseService } from './interfaces/IDatabaseService';

class ServiceFactory {
  private static authService: IAuthService | null = null;
  private static databaseService: IDatabaseService | null = null;

  /**
   * Get Authentication Service
   * 
   * To switch from Firebase to Supabase:
   * return new SupabaseAuthService();
   */
  static getAuthService(): IAuthService {
    if (!this.authService) {
      this.authService = new FirebaseAuthService();
    }
    return this.authService;
  }

  /**
   * Get Database Service
   * 
   * To switch from Firestore to MongoDB:
   * return new MongoDBService();
   */
  static getDatabaseService(): IDatabaseService {
    if (!this.databaseService) {
      this.databaseService = new FirebaseDatabaseService();
    }
    return this.databaseService;
  }



  /**
   * Reset all services (useful for testing or logout)
   */
  static reset(): void {
    this.authService = null;
    this.databaseService = null;
  }
}

export default ServiceFactory;

/**
 * USAGE EXAMPLES:
 * 
 * // Instead of:
 * import { auth } from '../config/firebase';
 * const user = auth.currentUser;
 * 
 * // Use:
 * import ServiceFactory from '../services/ServiceFactory';
 * const authService = ServiceFactory.getAuthService();
 * const user = authService.getCurrentUser();
 * 
 * // Instead of:
 * import { db } from '../config/firebase';
 * const docRef = await addDoc(collection(db, 'posts'), data);
 * 
 * // Use:
 * const dbService = ServiceFactory.getDatabaseService();
 * const postId = await dbService.create('posts', data);
 * 
 * // Instead of:
 * import AgoraRTC from 'agora-rtc-sdk-ng';
 * const client = AgoraRTC.createClient(...);
 * 
 * // Use:
 * const streamService = ServiceFactory.getLiveStreamService();
 * await streamService.initialize(AGORA_APP_ID);
 */

