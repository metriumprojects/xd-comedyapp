const mongoose = require('mongoose');

/**
 * Optimized Aggregation Pipeline for Posts
 * Handles:
 * 1. Visibility filtering
 * 2. Cursor-based pagination (falls back to skip for backward compat)
 * 3. Author data lookup
 * 4. Like status for viewer
 * 5. Saved status for viewer
 * 6. Comment count lookup (optimized — count only, no full fetch)
 * 7. Optional randomized mode via $sample
 */
async function getEnrichedPosts(query, { 
  skip = 0, 
  limit = 20, 
  sort = { createdAt: -1 }, 
  viewerId = null,
  cursor = null,       // Last post's _id for cursor-based pagination
  cursorDate = null,    // Last post's createdAt for cursor-based pagination
  randomize = false     // Use $sample for randomized discovery
}) {
  const Post = mongoose.model('Post');
  const viewerVariants = [];
  
  if (viewerId) {
    try {
      const { resolveUserIdentifiers } = require('../src/utils/userUtils');
      const { candidates } = await resolveUserIdentifiers(viewerId);
      candidates.forEach(id => viewerVariants.push(String(id)));
    } catch (e) {
      viewerVariants.push(String(viewerId));
    }
  }

  // Build the match stage — merge caller's query with cursor condition
  let matchQuery = { ...query };

  // 0. Exclude posts from blocked users (bilateral block filtering)
  if (viewerVariants.length > 0) {
    try {
      const User = mongoose.model('User');
      const viewerObjectIds = viewerVariants
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));

      const viewerUser = await User.findOne({
        $or: [
          ...(viewerObjectIds.length > 0 ? [{ _id: { $in: viewerObjectIds } }] : []),
          { firebaseUid: { $in: viewerVariants } },
          { uid: { $in: viewerVariants } }
        ]
      }).select('blockedUsers').lean();

      const directBlocked = viewerUser?.blockedUsers || [];

      // Bilateral: also find users who blocked the viewer
      const usersWhoBlockedViewer = await User.find({
        blockedUsers: { $in: viewerVariants }
      }).select('_id firebaseUid uid').lean();

      const allBlockedTargets = [
        ...directBlocked,
        ...usersWhoBlockedViewer.map(u => String(u._id)),
        ...usersWhoBlockedViewer.map(u => u.firebaseUid).filter(Boolean),
        ...usersWhoBlockedViewer.map(u => u.uid).filter(Boolean),
      ];

      if (allBlockedTargets.length > 0) {
        const blockedObjectIds = allBlockedTargets
          .filter(id => mongoose.Types.ObjectId.isValid(id))
          .map(id => new mongoose.Types.ObjectId(id));

        const blockedUsersDetails = await User.find({
          $or: [
            ...(blockedObjectIds.length > 0 ? [{ _id: { $in: blockedObjectIds } }] : []),
            { firebaseUid: { $in: allBlockedTargets } },
            { uid: { $in: allBlockedTargets } }
          ]
        }).select('_id firebaseUid uid').lean();

        const allResolved = new Set(allBlockedTargets.map(String));
        blockedUsersDetails.forEach(u => {
          if (u._id) allResolved.add(String(u._id));
          if (u.firebaseUid) allResolved.add(String(u.firebaseUid));
          if (u.uid) allResolved.add(String(u.uid));
        });

        const blockedList = Array.from(allResolved);
        if (blockedList.length > 0) {
          const blockCondition = { userId: { $nin: blockedList } };
          if (matchQuery.$and) {
            matchQuery.$and.push(blockCondition);
          } else {
            matchQuery = { $and: [matchQuery, blockCondition] };
          }
        }
      }
    } catch (e) {
      console.warn('[postService] Error resolving blocked users for query:', e.message);
    }
  }

  // Cursor-based pagination: use the last post's createdAt + _id to fetch next page
  // This avoids the O(N) cost of $skip for deep pagination
  if (cursor && cursorDate) {
    const cursorDateObj = new Date(cursorDate);
    const cursorIdObj = mongoose.Types.ObjectId.isValid(cursor) 
      ? new mongoose.Types.ObjectId(cursor) 
      : cursor;

    // For descending sort (default), get posts older than cursor
    // For ascending sort, get posts newer than cursor
    const isDescending = sort.createdAt === -1;
    const dateOp = isDescending ? '$lt' : '$gt';
    const idOp = isDescending ? '$lt' : '$gt';

    const cursorCondition = {
      $or: [
        { createdAt: { [dateOp]: cursorDateObj } },
        { 
          createdAt: cursorDateObj, 
          _id: { [idOp]: cursorIdObj } 
        }
      ]
    };

    // Merge cursor condition into existing $and or create one
    if (matchQuery.$and) {
      matchQuery.$and.push(cursorCondition);
    } else {
      matchQuery = { $and: [matchQuery, cursorCondition] };
    }
  }

  // Build pipeline stages
  const pipeline = [];

  if (randomize) {
    // Randomized mode: match first, then sample
    pipeline.push({ $match: matchQuery });
    pipeline.push({ $sample: { size: limit } });
  } else {
    // Standard mode: match → sort → paginate
    pipeline.push({ $match: matchQuery });
    pipeline.push({ $sort: sort });

    // Only use $skip if no cursor is provided (backward compat)
    if (!cursor && skip > 0) {
      pipeline.push({ $skip: skip });
    }
    pipeline.push({ $limit: limit });
  }

  // 1. Author Lookup (Supporting both string and ObjectId userId)
  pipeline.push({
    $lookup: {
      from: 'users',
      let: { authorId: '$userId' },
      pipeline: [
        {
          $match: {
            $expr: {
              $or: [
                { $eq: ['$_id', '$$authorId'] },
                { $eq: [{ $toString: '$_id' }, '$$authorId'] },
                { $eq: ['$firebaseUid', '$$authorId'] },
                { $eq: ['$uid', '$$authorId'] }
              ]
            }
          }
        },
        { $project: { displayName: 1, name: 1, avatar: 1, profilePicture: 1, photoURL: 1, isPrivate: 1, username: 1 } }
      ],
      as: 'author'
    }
  });
  pipeline.push({ $unwind: { path: '$author', preserveNullAndEmptyArrays: true } });

  // 2. Comment Count Lookup (OPTIMIZED: count only, not full document fetch)
  pipeline.push({
    $lookup: {
      from: 'comments',
      let: { pid: '$_id' },
      pipeline: [
        { $match: { $expr: { $eq: ['$postId', '$$pid'] } } },
        { $count: 'total' }
      ],
      as: 'commentCountResult'
    }
  });

  // 3. Saved Status Lookup
  pipeline.push({
    $lookup: {
      from: 'savedposts',
      let: { pid: '$_id' },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                {
                  $or: [
                    { $eq: ['$postId', '$$pid'] },
                    { $eq: ['$postId', { $toString: '$$pid' }] }
                  ]
                },
                { $in: ['$userId', viewerVariants] }
              ]
            }
          }
        },
        { $limit: 1 }
      ],
      as: 'savedStatus'
    }
  });

  // 4. Transform and Add Fields
  pipeline.push({
    $addFields: {
      isLiked: {
        $cond: {
          if: { $and: [ { $gt: [viewerVariants.length, 0] }, { $isArray: "$likes" } ] },
          then: { $gt: [ { $size: { $setIntersection: ["$likes", viewerVariants] } }, 0 ] },
          else: false
        }
      },
      isSaved: { $gt: [{ $size: '$savedStatus' }, 0] },
      commentCount: {
        $add: [
          { $ifNull: [{ $arrayElemAt: ['$commentCountResult.total', 0] }, 0] },
          { $ifNull: ["$commentsCount", 0] }
        ]
      },
      // Enrich the userId field with the author object for frontend
      authorData: { $ifNull: ["$author", { displayName: "User", name: "User", avatar: null }] }
    }
  });

  // 5. Clean up internal fields
  pipeline.push({ $project: { commentCountResult: 0, savedStatus: 0, author: 0 } });

  const posts = await Post.aggregate(pipeline);
  
  // Final pass in JS for complex formatting (media URLs, etc.)
  const { enrichPostsWithUserData } = require('../utils/postHelpers');
  return await enrichPostsWithUserData(posts, viewerId);
}

module.exports = {
  getEnrichedPosts
};
