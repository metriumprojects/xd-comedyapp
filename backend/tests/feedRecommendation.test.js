const {
  calculateGravityScore,
  applyCreatorAntiStacking,
  getUserCategoryAffinity
} = require('../services/feedRecommendationService');

describe('Feed Recommendation Service', () => {
  describe('calculateGravityScore', () => {
    it('should assign a higher score to a high-engagement post than a zero-engagement post', () => {
      const now = Date.now();
      const highEngagementPost = {
        createdAt: new Date(now - 1000 * 60 * 60), // 1 hour ago
        likesCount: 150,
        commentsCount: 25,
        shareCount: 10,
        viewsCount: 2000,
        laughCount: 40
      };

      const lowEngagementPost = {
        createdAt: new Date(now - 1000 * 60 * 60), // 1 hour ago
        likesCount: 0,
        commentsCount: 0,
        shareCount: 0,
        viewsCount: 5,
        laughCount: 0
      };

      const scoreHigh = calculateGravityScore(highEngagementPost, new Set(), now);
      const scoreLow = calculateGravityScore(lowEngagementPost, new Set(), now);

      expect(scoreHigh).toBeGreaterThan(scoreLow);
      expect(scoreHigh).toBeGreaterThan(10);
    });

    it('should apply recency decay so a newer post with equal engagement scores higher than an old post', () => {
      const now = Date.now();
      const newPost = {
        createdAt: new Date(now - 1000 * 60 * 60 * 2), // 2 hours ago
        likesCount: 50,
        commentsCount: 10
      };

      const oldPost = {
        createdAt: new Date(now - 1000 * 60 * 60 * 24 * 14), // 14 days ago
        likesCount: 50,
        commentsCount: 10
      };

      const scoreNew = calculateGravityScore(newPost, new Set(), now);
      const scoreOld = calculateGravityScore(oldPost, new Set(), now);

      expect(scoreNew).toBeGreaterThan(scoreOld);
    });

    it('should give a category affinity boost to posts matching user preferred categories', () => {
      const now = Date.now();
      const preferredCategories = new Set(['pranks', 'stand up']);

      const matchingPost = {
        createdAt: new Date(now - 1000 * 60 * 60),
        category: 'Pranks',
        likesCount: 20,
        commentsCount: 5
      };

      const nonMatchingPost = {
        createdAt: new Date(now - 1000 * 60 * 60),
        category: 'Politics',
        likesCount: 20,
        commentsCount: 5
      };

      const scoreMatching = calculateGravityScore(matchingPost, preferredCategories, now);
      const scoreNonMatching = calculateGravityScore(nonMatchingPost, preferredCategories, now);

      // Matching should receive ~1.5x boost
      expect(scoreMatching).toBeGreaterThan(scoreNonMatching);
    });
  });

  describe('applyCreatorAntiStacking', () => {
    it('should re-order posts so consecutive posts from the same creator are separated', () => {
      const posts = [
        { id: '1', userId: 'author_A', title: 'A1' },
        { id: '2', userId: 'author_A', title: 'A2' },
        { id: '3', userId: 'author_B', title: 'B1' },
        { id: '4', userId: 'author_C', title: 'C1' },
        { id: '5', userId: 'author_A', title: 'A3' }
      ];

      const unstacked = applyCreatorAntiStacking(posts);

      expect(unstacked.length).toEqual(posts.length);

      // Check that no two adjacent posts have the same author
      for (let i = 1; i < unstacked.length; i++) {
        const prevAuthor = unstacked[i - 1].userId;
        const currentAuthor = unstacked[i].userId;
        expect(currentAuthor).not.toEqual(prevAuthor);
      }
    });

    it('should handle small lists or lists with single creator gracefully', () => {
      const singlePost = [{ id: '1', userId: 'author_A' }];
      expect(applyCreatorAntiStacking(singlePost)).toEqual(singlePost);

      const empty = [];
      expect(applyCreatorAntiStacking(empty)).toEqual(empty);
    });
  });

  describe('getUserCategoryAffinity', () => {
    it('should return an empty set when viewerId is null or undefined', async () => {
      const res = await getUserCategoryAffinity(null);
      expect(res).toBeInstanceOf(Set);
      expect(res.size).toEqual(0);
    });
  });
});
