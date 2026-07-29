// Export all helpers from individual modules
export * from './archive';
export * from './comments';
export * from './conversation';
export { deleteStory } from './deleteStory';
export * from './follow';
export * from './highlights';
export * from './messages';
export * from './notification';
export * from './passport';
export * from './post';
export { updateUserSectionsOrder } from './updateUserSectionsOrder';
export * from './getUserSectionsSorted';
export * from './user';

import firebaseHelpersDefault from './core';

export default firebaseHelpersDefault;

// Named exports that live only in `core` (avoid duplicating `export *` modules above).
export {
  signInUser,
  signUpUser,
  getCurrentUser,
  getCurrentUserSync,
  getCurrentUid,
  getPassportTickets,
  uploadImage,
  deleteImage,
  getCategories,
  addUserSection,
  updateUserSection,
  deleteUserSection,
  getLocationVisitCount,
  getAllPosts,
  createPost,
  getFeedPosts,
  deletePost,
  likeComment,
  unlikeComment,
  getActiveStories,
  getUserStories,
  createStory,
  resolveNativeUri,
  addLikedStatusToPosts,
  getRegions,
  fetchMessages,
  toggleUserPrivacy,
  updatePost,
} from './core';

// Default categories
export const DEFAULT_CATEGORIES = [
  { name: 'Stand Up', image: 'https://images.pexels.com/photos/2810816/pexels-photo-2810816.jpeg?auto=compress&cs=tinysrgb&w=150' },
  { name: 'Memes', image: 'https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg?auto=compress&cs=tinysrgb&w=150' },
  { name: 'Pranks', image: 'https://images.pexels.com/photos/1006073/pexels-photo-1006073.jpeg?auto=compress&cs=tinysrgb&w=150' },
  { name: 'Comics', image: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=150' }
];

// Ensure default categories exist
export async function ensureDefaultCategories() {
  try {
    // Categories are now hardcoded, no backend call needed
    return { success: true, data: DEFAULT_CATEGORIES };
  } catch (error) {
    console.error('Error ensuring categories:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
