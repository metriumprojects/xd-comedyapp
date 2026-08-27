const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { resolveUserIdentifiers } = require('../src/utils/userUtils');
const { 
  enrichPostsWithUserData, 
  escapeRegExp, 
  formatLocationLabel 
} = require('../utils/postHelpers');
const { notificationQueue } = require('../services/queue');
const { verifyToken, optionalAuth } = require('../src/middleware/authMiddleware');
const postService = require('../services/postService');
const logger = require('../src/utils/logger');
const cacheMiddleware = require('../src/middleware/cacheMiddleware');
const validate = require('../src/middleware/validateMiddleware');
const { logEvent } = require('../src/services/analyticsService');
const { createPostSchema, updatePostSchema } = require('../src/validations/postValidation');

// Helper to resolve post by both ObjectId and custom String ID
function resolvePostQuery(postId) {
  const cleanId = String(postId).split('-loop')[0];
  const or = [{ id: cleanId }];
  if (mongoose.Types.ObjectId.isValid(cleanId)) {
    or.unshift({ _id: new mongoose.Types.ObjectId(cleanId) });
  }
  return { $or: or };
}

// Helper to resolve viewer/requester user ID from auth token, query params, or headers
function getViewerId(req) {
  return req.userId || req.query?.requesterUserId || req.query?.viewerId || req.query?.userId || req.headers?.['x-user-id'] || null;
}

// --- Basic CRUD ---

/**
 * GET / - Get all posts (generic list) (Requires Auth & Cached)
 */
router.get('/', verifyToken, cacheMiddleware(300), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20'), 100);
    const skip = parseInt(req.query.skip || '0');
    const viewerId = getViewerId(req);

    const enriched = await postService.getEnrichedPosts({}, { skip, limit, viewerId });
    
    // Log feed view for analytics
    logEvent('FEED_VIEWED', { count: enriched.length, skip, limit }, viewerId);
    
    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Feed & Discovery Routes ---


/**
 * GET /feed - Optimized personalized feed with mixed randomization
 * Page 1: Recent posts (last 6h) + randomized discovery posts
 * Page 2+: Cursor-based pagination for deep scroll efficiency
 */
router.get('/feed', optionalAuth, async (req, res, next) => {
  try {
    const currentUserId = getViewerId(req);
    let viewerVariants = [];
    
    if (currentUserId) {
      const { candidates } = await resolveUserIdentifiers(currentUserId);
      viewerVariants = candidates.map(id => String(id));
    }

    const limit = Math.min(parseInt(req.query.limit || '20'), 100);
    const skip = parseInt(req.query.skip || '0');
    const cursor = req.query.cursor || null;
    const cursorDate = req.query.cursorDate || null;
    
    const Post = mongoose.model('Post');
    const Group = mongoose.model('Group');

    // 0. Exclude posts the viewer has reported
    let reportedPostIds = [];
    if (viewerVariants.length > 0) {
      try {
        const Report = mongoose.model('Report');
        const reports = await Report.find({
          reporterId: { $in: viewerVariants },
          targetType: 'post',
        }).select('targetId').lean();
        reportedPostIds = reports
          .map(r => String(r.targetId))
          .filter(id => mongoose.Types.ObjectId.isValid(id));
      } catch (e) {}
    }
    const reportedObjectIds = reportedPostIds.map(id => new mongoose.Types.ObjectId(id));

    // 1. Build visibility query
    let viewerGroups = [];
    if (viewerVariants.length > 0) {
      viewerGroups = await Group.find({ members: { $in: viewerVariants } }).lean();
    }

    const authorGroupTypes = {};
    const viewerGroupIds = [];
    viewerGroups.forEach(g => {
      viewerGroupIds.push(String(g._id));
      const authorId = String(g.userId);
      if (!authorGroupTypes[authorId]) authorGroupTypes[authorId] = new Set();
      authorGroupTypes[authorId].add(g.type);
    });

    const authorsWithFriendsGroup = Object.keys(authorGroupTypes).filter(id => authorGroupTypes[id].has('friends'));
    const authorsWithFamilyGroup = Object.keys(authorGroupTypes).filter(id => authorGroupTypes[id].has('family'));

    const visibilityQuery = {
      $or: [
        { isPrivate: { $ne: true } }, 
        { visibility: 'Everyone' },   
        { userId: { $in: viewerVariants } }, 
        { allowedFollowers: { $in: [...viewerVariants, ...viewerGroupIds] } } 
      ]
    };

    if (viewerVariants.length > 0) {
      if (authorsWithFriendsGroup.length > 0) {
        visibilityQuery.$or.push({ 
          userId: { $in: authorsWithFriendsGroup }, 
          visibility: { $in: ['Friends', 'friends'] } 
        });
      }
      if (authorsWithFamilyGroup.length > 0) {
        visibilityQuery.$or.push({ 
          userId: { $in: authorsWithFamilyGroup }, 
          visibility: { $in: ['Family', 'family'] } 
        });
      }
    }

    // Combine visibility + reported-post exclusion into base query
    const baseConditions = [visibilityQuery];
    if (reportedObjectIds.length > 0) {
      baseConditions.push({ _id: { $nin: reportedObjectIds } });
    }
    const baseQuery = baseConditions.length === 1 ? baseConditions[0] : { $and: baseConditions };

    // 2. Mixed feed strategy
    const isFirstPage = !cursor && skip === 0;

    if (isFirstPage) {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
      const recentQuery = { 
        $and: [
          baseQuery, 
          { 
            $or: [
              { createdAt: { $gte: sixHoursAgo } },
              { updatedAt: { $gte: sixHoursAgo } }
            ] 
          }
        ] 
      };
      
      const recentPosts = await postService.getEnrichedPosts(recentQuery, {
        limit: Math.min(limit, 5),
        sort: { updatedAt: -1, createdAt: -1 },
        viewerId: currentUserId
      });

      const remainingSlots = limit - recentPosts.length;
      let discoveryPosts = [];

      if (remainingSlots > 0) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        // Exclude recent posts AND reported posts from discovery to prevent duplicates
        const recentIds = recentPosts.map(p => p._id || p.id).filter(Boolean);
        const excludeIds = [...new Set([
          ...recentIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(String),
          ...reportedPostIds
        ])];
        const excludeObjectIds = excludeIds
          .filter(id => mongoose.Types.ObjectId.isValid(id))
          .map(id => new mongoose.Types.ObjectId(id));

        const discoveryQuery = {
          $and: [
            baseQuery,
            { createdAt: { $gte: thirtyDaysAgo } },
            ...(excludeObjectIds.length > 0 ? [{ _id: { $nin: excludeObjectIds } }] : [])
          ]
        };

        discoveryPosts = await postService.getEnrichedPosts(discoveryQuery, {
          limit: remainingSlots,
          viewerId: currentUserId,
          randomize: true
        });
      }

      // Deduplicate: with very few posts, $sample can still return overlaps
      const seenIds = new Set();
      const finalPosts = [...recentPosts, ...discoveryPosts].filter(p => {
        const id = String(p._id || p.id || '');
        if (!id || seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
      });

      const lastPost = finalPosts.length > 0 ? finalPosts[finalPosts.length - 1] : null;
      const nextCursor = lastPost ? (lastPost._id || lastPost.id) : null;
      const nextCursorDate = lastPost?.createdAt || null;

      res.json({ 
        success: true, 
        data: finalPosts,
        cursor: nextCursor ? String(nextCursor) : null,
        cursorDate: nextCursorDate
      });
    } else {
      const finalPosts = await postService.getEnrichedPosts(baseQuery, { 
        skip: cursor ? 0 : skip, 
        limit, 
        viewerId: currentUserId,
        cursor,
        cursorDate
      });

      const lastPost = finalPosts.length > 0 ? finalPosts[finalPosts.length - 1] : null;

      res.json({ 
        success: true, 
        data: finalPosts,
        cursor: lastPost ? String(lastPost._id || lastPost.id) : null,
        cursorDate: lastPost?.createdAt || null
      });
    }
  } catch (err) {
    next(err);
  }
});

// GET /recommended - Randomized discovery feed (excludes already-seen posts)
router.get('/recommended', optionalAuth, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20'), 50);
    const viewerId = getViewerId(req);
    const excludeIdsRaw = req.query.excludeIds || '';
    
    // Build exclude list from comma-separated IDs
    const excludeObjectIds = excludeIdsRaw
      .split(',')
      .map(id => id.trim())
      .filter(id => id && mongoose.Types.ObjectId.isValid(id))
      .map(id => new mongoose.Types.ObjectId(id));

    // Also exclude posts the viewer has reported
    if (viewerId) {
      try {
        let viewerVariants = [viewerId];
        try {
          const { resolveUserIdentifiers } = require('../src/utils/userUtils');
          const { candidates } = await resolveUserIdentifiers(viewerId);
          viewerVariants = candidates.map(id => String(id));
        } catch {}
        const Report = mongoose.model('Report');
        const reports = await Report.find({
          reporterId: { $in: viewerVariants },
          targetType: 'post',
        }).select('targetId').lean();
        reports.forEach(r => {
          const id = String(r.targetId);
          if (mongoose.Types.ObjectId.isValid(id)) {
            excludeObjectIds.push(new mongoose.Types.ObjectId(id));
          }
        });
      } catch {}
    }

    // Scope to last 30 days for relevance
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const matchQuery = {
      $and: [
        {
          $or: [
            { isPrivate: { $ne: true } },
            { visibility: 'Everyone' }
          ]
        },
        { createdAt: { $gte: thirtyDaysAgo } },
        ...(excludeObjectIds.length > 0 ? [{ _id: { $nin: excludeObjectIds } }] : [])
      ]
    };

    const finalPosts = await postService.getEnrichedPosts(matchQuery, {
      limit,
      viewerId,
      randomize: true
    });

    res.json({ success: true, data: finalPosts });
  } catch (err) {
    next(err);
  }
});

// --- Location Routes ---

// GET /hashtags - Search for unique hashtags
router.get('/hashtags', async (req, res) => {
  try {
    const q = (req.query.q || '').trim().replace(/^#/, ''); // Remove leading # if present
    const limit = Math.min(parseInt(req.query.limit || '20'), 50);
    const Post = mongoose.model('Post');

    // Use aggregation to find unique hashtags and their counts
    const results = await Post.aggregate([
      { $unwind: '$hashtags' }, // Split hashtags array into individual rows
      { 
        $match: { 
          hashtags: new RegExp('^' + escapeRegExp(q), 'i'), // Match starts with query
          $or: [{ isPrivate: { $ne: true } }, { visibility: 'Everyone' }] // Only public
        } 
      },
      { $group: { _id: { $toLower: '$hashtags' }, count: { $sum: 1 }, original: { $first: '$hashtags' } } },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);

    const data = results.map(r => ({
      name: r.original || r._id,
      count: r.count
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('[GET /hashtags] Error:', err);
    res.json({ success: false, error: err.message, data: [] });
  }
});

// GET /hashtags/posts - Get all posts for a specific hashtag (No looping)
router.get('/hashtags/posts', async (req, res) => {
  try {
    const tag = (req.query.hashtag || '').trim().replace(/^#/, '');
    if (!tag) return res.json({ success: true, data: [] });

    const limit = Math.min(parseInt(req.query.limit || '50'), 100);
    const skip = parseInt(req.query.skip || '0');
    const Post = mongoose.model('Post');

    const query = {
      hashtags: new RegExp('^' + escapeRegExp(tag) + '$', 'i'), // Match exact hashtag
      $or: [{ isPrivate: { $ne: true } }, { visibility: 'Everyone' }]
    };

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'displayName name avatar profilePicture photoURL isPrivate')
      .lean();

    const viewerId = getViewerId(req);
    const enriched = await enrichPostsWithUserData(posts, viewerId);
    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /locations/suggest - Autocomplete for locations
router.get('/locations/suggest', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ success: true, data: [] });

    const limit = Math.min(parseInt(req.query.limit || '10'), 25);
    const Post = mongoose.model('Post');
    const regex = new RegExp(escapeRegExp(q), 'i');

    const results = await Post.aggregate([
      { $match: { $or: [{ location: regex }, { 'locationData.name': regex }] } },
      { $group: { _id: { $ifNull: ['$locationData.name', '$location'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);

    const data = results.map(r => ({
      name: formatLocationLabel(r._id),
      count: r.count
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.json({ success: true, data: [] });
  }
});

// GET /by-location - Get posts filtered by location name or keys
router.get('/by-location', optionalAuth, async (req, res) => {
  try {
    const location = (req.query.location || '').trim();
    const limit = Math.min(parseInt(req.query.limit || '20'), 100);
    const skip = parseInt(req.query.skip || '0');
    const viewerId = getViewerId(req);

    if (!location) {
      return res.json({ success: true, data: [] });
    }

    const Post = mongoose.model('Post');
    
    // PRODUCTION-GRADE ISO REGION MAPPING
    const regionISO = {
      europe: ['FR', 'DE', 'IT', 'ES', 'GB', 'UK', 'PT', 'GR', 'CH', 'NL', 'BE', 'AT', 'TR', 'SE', 'NO', 'DK', 'FI', 'IE', 'PL', 'CZ', 'HU', 'RO', 'BG', 'HR', 'UA', 'RU', 'ME', 'AL', 'RS', 'BA', 'SI', 'IS', 'MC', 'MT', 'LU', 'LI', 'AD', 'SM', 'VA', 'EE', 'LV', 'LT'],
      americas: ['US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'VE', 'EC', 'BO', 'PY', 'UY', 'CU', 'JM', 'CR', 'PA', 'GT', 'HN', 'SV', 'NI', 'DO', 'HT', 'PR'],
      asia: ['CN', 'JP', 'TH', 'VN', 'SG', 'HK', 'IN', 'PK', 'AE', 'SA', 'KR', 'ID', 'MY', 'PH', 'TW', 'IL', 'QA', 'KW', 'OM', 'JO', 'LB', 'KH', 'LA', 'MM', 'NP', 'LK', 'BD'],
      africa: ['EG', 'MA', 'ZA', 'KE', 'NG', 'DZ', 'TN', 'ET', 'GH', 'TZ', 'UG', 'SN', 'CI', 'AO', 'CM', 'ET', 'ZW'],
      oceania: ['AU', 'NZ', 'FJ', 'PG', 'SB', 'VU', 'NC', 'PF']
    };

    // Split search query into parts (e.g. "Paris, France" -> ["paris", "france"])
    const parts = location.split(',').map(p => p.trim()).filter(p => p.length > 2);
    const normalizedLocs = parts.map(p => p.toLowerCase());
    if (location.length > 2 && !normalizedLocs.includes(location.toLowerCase())) {
      normalizedLocs.push(location.toLowerCase());
    }

    const conditions = [];
    
    // PRODUCTION-GRADE COUNTRY-TO-ISO MAPPING
    const countryToISO = {
      'france': 'FR', 'germany': 'DE', 'italy': 'IT', 'spain': 'ES', 'united kingdom': 'GB', 'uk': 'GB', 'usa': 'US', 'united states': 'US',
      'pakistan': 'PK', 'india': 'IN', 'uae': 'AE', 'dubai': 'AE'
    };

    const countryAliases = {
      'united states': ['usa', 'us', 'america', 'united states of america'],
      'usa': ['united states', 'us', 'america'],
      'united kingdom': ['uk', 'gb', 'great britain'],
      'uk': ['united kingdom', 'gb', 'great britain'],
      'uae': ['united arab emirates', 'dubai', 'abu dhabi'],
      'pakistan': ['pk', 'islamabad', 'karachi', 'lahore']
    };

    const famousPlacesMap = {
      'europe': ['eiffel tower', 'louvre', 'colosseum', 'big ben', 'arc de triomphe', 'pisa', 'sagrada familia'],
      'france': ['eiffel tower', 'louvre', 'arc de triomphe', 'notre dame', 'versailles'],
      'uk': ['big ben', 'london eye', 'stonehenge', 'buckingham palace']
    };

    // Process each search term
    normalizedLocs.forEach(loc => {
      const regex = new RegExp(escapeRegExp(loc), 'i');
      
      // 1. Direct matches (String based)
      conditions.push({ locationKeys: { $in: [loc] } });
      conditions.push({ location: regex });
      conditions.push({ 'locationData.name': regex });
      conditions.push({ 'locationData.address': regex });
      conditions.push({ 'locationData.city': regex });
      conditions.push({ 'locationData.country': regex });

      // 2. Alias Support: If searching 'United States', also search 'USA', 'US'
      const aliases = countryAliases[loc] || [];
      aliases.forEach(alias => {
        const aRegex = new RegExp(escapeRegExp(alias), 'i');
        conditions.push({ location: aRegex });
        conditions.push({ 'locationData.address': aRegex });
        conditions.push({ locationKeys: { $in: [alias.toLowerCase()] } });
      });

      // 3. Famous Places Fallback: e.g. Eiffel Tower -> France/Europe
      const places = famousPlacesMap[loc] || [];
      places.forEach(place => {
        const pRegex = new RegExp(escapeRegExp(place), 'i');
        conditions.push({ location: pRegex });
        conditions.push({ 'locationData.name': pRegex });
        conditions.push({ 'locationData.address': pRegex });
      });

      // 4. ISO Hierarchy (If searching a region like 'europe')
      if (regionISO[loc]) {
        const codes = regionISO[loc];
        const allCases = [...codes, ...codes.map(c => c.toLowerCase())];
        conditions.push({ 'locationData.countryCode': { $in: allCases } });
        
        // IMPORTANT: Also search for country names AND major cities across ALL fields
        const regionCountryNames = {
          europe: [
            'france', 'germany', 'italy', 'spain', 'uk', 'united kingdom', 'portugal', 'greece', 'turkey', 'croatia', 'montenegro', 'switzerland', 'netherlands', 'belgium', 'austria', 'russia', 'poland',
            'paris', 'berlin', 'rome', 'madrid', 'london', 'lisbon', 'athens', 'istanbul', 'amsterdam', 'vienna', 'warsaw', 'prague', 'budapest',
            'marseille', 'lyon', 'nice', 'toulouse', 'milan', 'barcelona', 'munich', 'hamburg', 'manchester', 'birmingham'
          ],
          americas: [
            'usa', 'united states', 'canada', 'mexico', 'brazil', 'argentina', 'chile', 'colombia',
            'new york', 'los angeles', 'miami', 'toronto', 'vancouver', 'mexico city', 'sao paulo', 'rio de janeiro'
          ],
          asia: [
            'china', 'japan', 'thailand', 'india', 'pakistan', 'uae', 'saudi arabia', 'vietnam', 'singapore',
            'tokyo', 'beijing', 'shanghai', 'bangkok', 'delhi', 'mumbai', 'karachi', 'lahore', 'islamabad', 'dubai', 'abu dhabi', 'seoul'
          ]
        };
        const names = regionCountryNames[loc] || [];
        names.forEach(n => {
          const nRegex = new RegExp(escapeRegExp(n), 'i');
          // Deep scan every field for each country in the region
          conditions.push({ location: nRegex });
          conditions.push({ 'locationData.name': nRegex });
          conditions.push({ 'locationData.address': nRegex });
          conditions.push({ 'locationData.city': nRegex });
          conditions.push({ 'locationData.country': nRegex });
          conditions.push({ locationKeys: { $in: [n.toLowerCase()] } });
        });
      }

      // 3. Country-to-ISO: If searching a country (e.g. 'france')
      if (countryToISO[loc]) {
        const code = countryToISO[loc];
        conditions.push({ 'locationData.countryCode': { $in: [code, code.toLowerCase()] } });
      }
    });

    const query = {
      $and: [
        { $or: conditions.length > 0 ? conditions : [{ location: new RegExp(escapeRegExp(location), 'i') }] },
        { 
          $or: [
            { isPrivate: { $ne: true } },
            { visibility: 'Everyone' },
            { visibility: { $exists: false } },
            { visibility: null }
          ] 
        }
      ]
    };

    logger.info(`[Search] Location: "${location}", Query Conditions: ${conditions.length}`);

    // PERFORMANCE UPGRADE: Use Aggregation Pipeline to handle Search + Author + Stats + SavedStatus in ONE DB Roundtrip
    const viewerVariants = viewerId ? [String(viewerId)] : [];
    if (viewerId) {
      try {
        const { candidates } = await require('../src/utils/userUtils').resolveUserIdentifiers(viewerId);
        candidates.forEach(id => { if (!viewerVariants.includes(String(id))) viewerVariants.push(String(id)); });
      } catch (e) {}
    }
    const viewerStrings = viewerVariants.map(String);

    const aggregatePipeline = [
      { $match: query },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      
      // Lookup Comment count
      {
        $lookup: {
          from: 'comments',
          let: { pId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$postId', '$$pId'] } } },
            { $count: 'count' }
          ],
          as: 'commentData'
        }
      },

      // Lookup Saved Status
      {
        $lookup: {
          from: 'savedposts',
          let: { pId: '$_id' },
          pipeline: [
            { 
              $match: { 
                $expr: { 
                  $and: [
                    { $eq: ['$postId', '$$pId'] },
                    { $in: ['$userId', viewerStrings] }
                  ]
                } 
              } 
            },
            { $limit: 1 }
          ],
          as: 'savedStatus'
        }
      },

      // Project final fields to match enrichPostsWithUserData output
      {
        $addFields: {
          commentCount: { 
            $add: [
              { $ifNull: [{ $arrayElemAt: ['$commentData.count', 0] }, 0] },
              { $size: { $ifNull: ['$comments', []] } } // Legacy inline
            ]
          },
          isSaved: { $gt: [{ $size: '$savedStatus' }, 0] },
          likeCount: { 
            $cond: { 
              if: { $isArray: '$likes' }, 
              then: { $size: '$likes' }, 
              else: { $ifNull: ['$likesCount', 0] } 
            }
          },
          isLiked: {
            $cond: {
              if: { $isArray: '$likes' },
              then: { $anyElementTrue: { $map: { input: '$likes', as: 'l', in: { $in: [{ $toString: '$$l' }, viewerStrings] } } } },
              else: false
            }
          }
        }
      }
    ];

    const posts = await Post.aggregate(aggregatePipeline);
    const enriched = await enrichPostsWithUserData(posts, viewerId);

    logger.info(`[Search] Found ${enriched.length} posts for "${location}" (Optimized & Enriched)`);
    res.json({ success: true, data: enriched });
  } catch (err) {
    logger.error('[GET /by-location] Error: %s', err.message);
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

// GET /location-count - Get total number of unique locations
router.get('/location-count', async (req, res) => {
  try {
    const Post = mongoose.model('Post');
    const count = await Post.distinct('locationData.name').then(arr => arr.length);
    res.json({ success: true, data: { count } });
  } catch (err) {
    res.json({ success: true, data: { count: 0 } });
  }
});

// GET /locations/meta - Get metadata for a location (visit counts, etc.)
router.get('/locations/meta', async (req, res) => {
  try {
    const location = (req.query.location || '').trim();
    if (!location) return res.status(400).json({ success: false, error: 'location required' });

    const Post = mongoose.model('Post');
    const regex = new RegExp(escapeRegExp(location), 'i');

    const query = {
      $or: [
        { locationKeys: { $in: [location.toLowerCase(), location] } },
        { location: regex },
        { 'locationData.name': regex }
      ]
    };

    const count = await Post.countDocuments(query);
    const verifiedCount = await Post.countDocuments({ ...query, 'locationData.verified': true });

    res.json({
      success: true,
      data: {
        location,
        visits: count,
        postCount: count,
        verifiedVisits: verifiedCount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Post CRUD & Actions ---

// POST / - Create post
router.post('/', verifyToken, validate(createPostSchema), async (req, res) => {
  try {
    const Post = mongoose.model('Post');
    // Whitelist fields to prevent mass assignment vulnerability
    const allowed = [
      'content', 'caption', 'imageUrl', 'mediaUrls', 'mediaType', 'thumbnailUrl',
      'aspectRatio', 'location', 'locationData', 'locationKeys', 'category',
      'hashtags', 'mentions', 'taggedUserIds', 'isPrivate', 'visibility', 'allowedFollowers',
      'subscriptionTierId'
    ];
    const postData = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) postData[f] = req.body[f]; });
    // Always use authenticated userId from token, NEVER trust body.userId
    postData.userId = req.userId;
    const post = new Post(postData);
    await post.save();
    res.status(201).json({ success: true, data: post });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /podium - Get rankings for creators and videos based on weekly/monthly/all-time timeframes
router.get('/podium', optionalAuth, async (req, res, next) => {
  try {
    const type = (req.query.type || 'creators').toLowerCase(); // 'creators' or 'videos'
    const timeframe = (req.query.timeframe || 'weekly').toLowerCase(); // 'weekly', 'monthly', 'all'
    const limit = Math.min(parseInt(req.query.limit || '20'), 50);

    const Post = mongoose.model('Post');
    const User = mongoose.model('User');

    // 1. Calculate Date range based on timeframe
    let dateFilter = {};
    if (timeframe === 'weekly') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      dateFilter = { createdAt: { $gte: oneWeekAgo } };
    } else if (timeframe === 'monthly') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
      dateFilter = { createdAt: { $gte: oneMonthAgo } };
    }

    // 2. Base query: public posts only, must be videos
    const matchQuery = {
      mediaType: 'video',
      $or: [
        { isPrivate: { $ne: true } },
        { visibility: 'Everyone' }
      ],
      ...dateFilter
    };

    if (type === 'videos') {
      // Get top videos ranked by laughCount
      const topPosts = await Post.find(matchQuery)
        .sort({ laughCount: -1, createdAt: -1 })
        .limit(limit)
        .populate('userId', 'displayName name userName avatar profilePicture photoURL')
        .lean();

      // For each top post, we want to enrich it with total stats of the creator
      const enrichedPosts = await Promise.all(topPosts.map(async (post, idx) => {
        const creatorId = String(post.userId?._id || post.userId?.id || post.userId || '');
        
        let totalLaughs = 0;
        let totalVideos = 0;
        
        if (creatorId) {
          const userVideos = await Post.find({ userId: creatorId, mediaType: 'video' }).select('laughCount').lean();
          totalVideos = userVideos.length;
          totalLaughs = userVideos.reduce((sum, p) => sum + (p.laughCount || 0), 0);
        }

        const creatorName = post.userId?.displayName || post.userId?.name || 'Anonymous';
        const creatorUsername = post.userId?.userName || 'user';
        const creatorAvatar = post.userId?.avatar || post.userId?.profilePicture || post.userId?.photoURL || null;

        return {
          id: post._id || post.id,
          thumbnailUrl: post.thumbnailUrl || post.mediaUrls?.[0] || null,
          mediaUrl: post.mediaUrls?.[0] || null,
          caption: post.caption || post.content || '',
          laughCount: post.laughCount || 0,
          viewsCount: post.viewsCount || 0,
          likesCount: post.likesCount || post.likes?.length || 0,
          rank: idx + 1,
          creator: {
            id: creatorId,
            name: creatorName,
            username: creatorUsername,
            avatar: creatorAvatar,
            totalLaughs,
            totalVideos
          }
        };
      }));

      return res.json({ success: true, data: enrichedPosts });
    } else {
      // Get top creators: Group video posts by userId, sum laughCount
      const pipeline = [
        { $match: matchQuery },
        {
          $group: {
            _id: '$userId',
            totalLaughs: { $sum: '$laughCount' },
            totalVideos: { $sum: 1 }
          }
        },
        { $sort: { totalLaughs: -1 } },
        { $limit: limit }
      ];

      const rankedCreators = await Post.aggregate(pipeline);

      const enrichedCreators = await Promise.all(rankedCreators.map(async (item, idx) => {
        const creatorId = item._id;
        
        // Find user details
        let userDetail = null;
        if (mongoose.Types.ObjectId.isValid(creatorId)) {
          userDetail = await User.findById(creatorId).select('displayName name userName avatar profilePicture photoURL').lean();
        } else {
          userDetail = await User.findOne({ 
            $or: [{ firebaseUid: creatorId }, { uid: creatorId }, { _id: mongoose.Types.ObjectId.isValid(creatorId) ? new mongoose.Types.ObjectId(creatorId) : null }] 
          }).select('displayName name userName avatar profilePicture photoURL').lean();
        }

        // Find their funniest video (highest laughCount)
        const funniestVideo = await Post.findOne({ userId: creatorId, mediaType: 'video' })
          .sort({ laughCount: -1, createdAt: -1 })
          .lean();

        const name = userDetail?.displayName || userDetail?.name || 'Anonymous';
        const username = userDetail?.userName || 'user';
        const avatar = userDetail?.avatar || userDetail?.profilePicture || userDetail?.photoURL || null;

        return {
          creator: {
            id: creatorId,
            name,
            username,
            avatar
          },
          totalLaughs: item.totalLaughs,
          totalVideos: item.totalVideos,
          rank: idx + 1,
          funniestVideo: funniestVideo ? {
            id: funniestVideo._id || funniestVideo.id,
            thumbnailUrl: funniestVideo.thumbnailUrl || funniestVideo.mediaUrls?.[0] || null,
            mediaUrl: funniestVideo.mediaUrls?.[0] || null,
            caption: funniestVideo.caption || funniestVideo.content || '',
            laughCount: funniestVideo.laughCount || 0,
            viewsCount: funniestVideo.viewsCount || 0,
            likesCount: funniestVideo.likesCount || funniestVideo.likes?.length || 0
          } : null
        };
      }));

      return res.json({ success: true, data: enrichedCreators });
    }
  } catch (err) {
    next(err);
  }
});

// GET /search - Search posts with text and filters
router.get('/search', optionalAuth, async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const filter = (req.query.filter || 'videos').toLowerCase();
    const category = req.query.category;
    const limit = Math.min(parseInt(req.query.limit || '20'), 100);
    const skip = parseInt(req.query.skip || '0');
    const viewerId = getViewerId(req);

    const Post = mongoose.model('Post');
    const dbQuery = {};

    // 1. Text Search or Regex search on caption, location, category
    if (q) {
      const escaped = escapeRegExp(q);
      const regex = new RegExp(escaped, 'i');
      dbQuery.$or = [
        { caption: regex },
        { location: regex },
        { category: regex },
        { hashtags: { $in: [q.replace(/^#/, '')] } }
      ];
    }

    // 2. Category filter
    if (category) {
      dbQuery.category = category;
    }

    // 3. Pill filter
    let sort = { createdAt: -1 };
    if (filter === 'image') {
      dbQuery.mediaType = { $ne: 'video' };
    } else if (filter === 'laugh') {
      sort = { laughCount: -1, createdAt: -1 };
    } else if (filter === 'tomato') {
      sort = { tomatoCount: -1, createdAt: -1 };
    } else if (filter === 'location') {
      // Filter only posts with location values
      dbQuery.location = { $exists: true, $ne: '' };
    }
    // 'videos' and 'posts' filters: no mediaType constraint — returns all matching posts

    // Visibility filter (only public posts)
    dbQuery.$and = dbQuery.$and || [];
    dbQuery.$and.push({
      $or: [
        { isPrivate: { $ne: true } },
        { visibility: 'Everyone' }
      ]
    });

    const enriched = await postService.getEnrichedPosts(dbQuery, { skip, limit, sort, viewerId });
    res.json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
});

// POST /:postId/rate - Persist laugh or tomato rating
router.post('/:postId/rate', verifyToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { type, active } = req.body;
    const userId = String(req.userId);

    if (type !== 'laugh' && type !== 'tomato') {
      return res.status(400).json({ success: false, error: 'Invalid rate type' });
    }

    const Post = mongoose.model('Post');
    const post = await Post.findOne(resolvePostQuery(postId));
    if (!post) return res.status(404).json({ success: false, error: 'Post not found' });

    // Ensure array fields exist
    if (!Array.isArray(post.laughedBy)) post.laughedBy = [];
    if (!Array.isArray(post.tomatoedBy)) post.tomatoedBy = [];

    let update = {};
    if (type === 'laugh') {
      if (active) {
        update.$addToSet = { laughedBy: userId };
        update.$pull = { tomatoedBy: userId };
      } else {
        update.$pull = { laughedBy: userId };
      }
    } else if (type === 'tomato') {
      if (active) {
        update.$addToSet = { tomatoedBy: userId };
        update.$pull = { laughedBy: userId };
      } else {
        update.$pull = { tomatoedBy: userId };
      }
    }

    const updatedPost = await Post.findOneAndUpdate(
      resolvePostQuery(postId),
      update,
      { new: true }
    );

    if (!updatedPost) return res.status(404).json({ success: false, error: 'Post not found' });

    // Maintain counts in Mongoose fields
    updatedPost.laughCount = Array.isArray(updatedPost.laughedBy) ? updatedPost.laughedBy.length : 0;
    updatedPost.tomatoCount = Array.isArray(updatedPost.tomatoedBy) ? updatedPost.tomatoedBy.length : 0;
    await updatedPost.save();

    // Broadcast reaction update to all connected socket clients in real-time
    try {
      const io = req.app ? req.app.get('io') : null;
      if (io) {
        io.emit('postReactionUpdated', {
          postId: String(updatedPost._id),
          laughCount: updatedPost.laughCount,
          tomatoCount: updatedPost.tomatoCount
        });
      }
    } catch (err) {
      console.warn('Socket reaction emit error:', err.message);
    }

    res.json({
      success: true,
      data: {
        _id: updatedPost._id,
        laughCount: updatedPost.laughCount,
        tomatoCount: updatedPost.tomatoCount,
        hasLaughed: Array.isArray(updatedPost.laughedBy) && updatedPost.laughedBy.some(id => String(id) === String(userId)),
        hasTomatoed: Array.isArray(updatedPost.tomatoedBy) && updatedPost.tomatoedBy.some(id => String(id) === String(userId))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- In-Memory Smart View Counter Batcher ---
const pendingViewCounts = new Map(); // postId -> accumulated view increments

// Flush accumulated views to MongoDB in 1 bulk write operation every 5 seconds
setInterval(async () => {
  if (pendingViewCounts.size === 0) return;

  const entries = Array.from(pendingViewCounts.entries());
  pendingViewCounts.clear();

  try {
    const Post = mongoose.model('Post');
    const bulkOps = entries.map(([postId, increment]) => ({
      updateOne: {
        filter: { _id: postId },
        update: { $inc: { viewsCount: increment } }
      }
    }));

    await Post.bulkWrite(bulkOps, { ordered: false });
  } catch (err) {
    console.warn('[ViewBatcher] Error flushing views to DB:', err.message);
  }
}, 5000);

/**
 * POST /api/posts/:id/view
 * Record a real video/post view (In-Memory Batching)
 */
router.post('/:id/view', optionalAuth, async (req, res) => {
  try {
    const postId = req.params.id;
    const cleanId = String(postId).split('-loop')[0];
    if (!cleanId || !mongoose.Types.ObjectId.isValid(cleanId)) {
      return res.status(400).json({ success: false, error: 'Invalid post ID' });
    }

    // Accumulate view in RAM buffer
    const current = pendingViewCounts.get(cleanId) || 0;
    pendingViewCounts.set(cleanId, current + 1);

    res.json({ success: true, postId: cleanId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


/**
 * GET /search - Search posts with text queries and filter types
 */
router.get('/search', optionalAuth, async (req, res, next) => {
  try {
    const currentUserId = req.userId || null;
    const q = (req.query.q || '').trim();
    const filter = (req.query.filter || 'posts').toLowerCase();
    const limit = Math.min(parseInt(req.query.limit || '30'), 100);
    const skip = parseInt(req.query.skip || '0');

    // 1. Build visibility query first (to ensure user only sees what they are allowed to)
    let viewerVariants = [];
    if (currentUserId) {
      const { candidates } = await resolveUserIdentifiers(currentUserId);
      viewerVariants = candidates.map(id => String(id));
    }

    const Group = mongoose.model('Group');
    let viewerGroups = [];
    if (viewerVariants.length > 0) {
      viewerGroups = await Group.find({ members: { $in: viewerVariants } }).lean();
    }

    const authorGroupTypes = {};
    const viewerGroupIds = [];
    viewerGroups.forEach(g => {
      viewerGroupIds.push(String(g._id));
      const authorId = String(g.userId);
      if (!authorGroupTypes[authorId]) authorGroupTypes[authorId] = new Set();
      authorGroupTypes[authorId].add(g.type);
    });

    const authorsWithFriendsGroup = Object.keys(authorGroupTypes).filter(id => authorGroupTypes[id].has('friends'));
    const authorsWithFamilyGroup = Object.keys(authorGroupTypes).filter(id => authorGroupTypes[id].has('family'));

    const visibilityQuery = {
      $or: [
        { isPrivate: { $ne: true } }, 
        { visibility: 'Everyone' },   
        { userId: { $in: viewerVariants } }, 
        { allowedFollowers: { $in: [...viewerVariants, ...viewerGroupIds] } } 
      ]
    };

    if (viewerVariants.length > 0) {
      if (authorsWithFriendsGroup.length > 0) {
        visibilityQuery.$or.push({ 
          userId: { $in: authorsWithFriendsGroup }, 
          visibility: { $in: ['Friends', 'friends'] } 
        });
      }
      if (authorsWithFamilyGroup.length > 0) {
        visibilityQuery.$or.push({ 
          userId: { $in: authorsWithFamilyGroup }, 
          visibility: { $in: ['Family', 'family'] } 
        });
      }
    }

    // 2. Build query conditions based on search string q and filter
    const queryConditions = [visibilityQuery];

    if (q) {
      const safeQ = escapeRegExp(q);
      const regex = new RegExp(safeQ, 'i');

      if (filter === 'location') {
        // Location tab: only search location-related fields
        queryConditions.push({
          $or: [
            { location: regex },
            { 'locationData.name': regex },
            { 'locationData.city': regex },
            { 'locationData.country': regex }
          ]
        });
      } else {
        // General posts, laugh, or tomato search: search caption, content, location, hashtags
        const orConditions = [
          { caption: regex },
          { content: regex },
          { location: regex },
          { 'locationData.name': regex },
          { hashtags: regex }
        ];

        // If it starts with #, also support matching exact hashtag
        if (q.startsWith('#')) {
          const tag = q.slice(1);
          orConditions.push({ hashtags: new RegExp('^' + escapeRegExp(tag) + '$', 'i') });
        }

        queryConditions.push({ $or: orConditions });
      }
    }

    const finalQuery = { $and: queryConditions };

    // 3. Determine sorting and mediaType filter based on filter
    let sort = { createdAt: -1 }; // Default: newest first
    
    if (filter === 'videos') {
      queryConditions.push({ mediaType: 'video' });
    } else if (filter === 'image') {
      queryConditions.push({ mediaType: { $ne: 'video' } });
    } else if (filter === 'laugh') {
      sort = { laughCount: -1, createdAt: -1 };
    } else if (filter === 'tomato') {
      sort = { tomatoCount: -1, createdAt: -1 };
    }

    // 4. Fetch enriched posts
    const posts = await postService.getEnrichedPosts(finalQuery, {
      skip,
      limit,
      sort,
      viewerId: currentUserId
    });

    res.json({ success: true, data: posts });
  } catch (err) {
    next(err);
  }
});

// GET /:postId - Detail
router.get('/:postId', optionalAuth, async (req, res) => {
  try {
    const viewerId = getViewerId(req);
    const query = resolvePostQuery(req.params.postId);

    const enriched = await postService.getEnrichedPosts(query, { limit: 1, viewerId });

    if (!enriched || enriched.length === 0) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    res.json({ success: true, data: enriched[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH / :postId - Edit (requires auth + ownership)
router.patch('/:postId', verifyToken, validate(updatePostSchema), async (req, res) => {
  try {
    const Post = mongoose.model('Post');
    const post = await Post.findOne(resolvePostQuery(req.params.postId));
    if (!post) return res.status(404).json({ success: false, error: 'Post not found' });

    // Ownership check: allow if userId matches any known variant
    const { candidates } = await resolveUserIdentifiers(req.userId);
    const postOwner = String(post.userId || '');
    const isOwner = candidates.map(String).includes(postOwner);
    if (!isOwner) return res.status(403).json({ success: false, error: 'Forbidden: not your post' });

    // Whitelist editable fields
    const editable = ['content', 'caption', 'mediaUrls', 'mediaType', 'location', 'locationData', 'locationKeys',
      'category', 'hashtags', 'mentions', 'taggedUserIds', 'isPrivate', 'visibility',
      'allowedFollowers', 'thumbnailUrl', 'aspectRatio', 'subscriptionTierId'];
    const updateData = { updatedAt: new Date() };
    editable.forEach(f => { if (req.body[f] !== undefined) updateData[f] = req.body[f]; });

    const updated = await Post.findOneAndUpdate(
      resolvePostQuery(req.params.postId),
      { $set: updateData },
      { new: true }
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /:postId - Delete (requires auth + ownership)
router.delete('/:postId', verifyToken, async (req, res) => {
  try {
    const Post = mongoose.model('Post');
    const post = await Post.findOne(resolvePostQuery(req.params.postId));
    if (!post) return res.status(404).json({ success: false, error: 'Post not found' });

    // Ownership check
    const { candidates } = await resolveUserIdentifiers(req.userId);
    const postOwner = String(post.userId || '');
    const isOwner = candidates.map(String).includes(postOwner);
    if (!isOwner) return res.status(403).json({ success: false, error: 'Forbidden: not your post' });

    await Post.deleteOne(resolvePostQuery(req.params.postId));
    res.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /:postId/react - Add/Update Emoji Reaction
router.post('/:postId/react', verifyToken, async (req, res) => {
  try {
    const { userName, userAvatar, emoji } = req.body;
    const userId = req.userId;
    const Post = mongoose.model('Post');
    await Post.updateOne(
      resolvePostQuery(req.params.postId),
      { $pull: { reactions: { userId: String(userId) } } }
    );
    const post = await Post.findOneAndUpdate(
      resolvePostQuery(req.params.postId),
      { 
        $push: { 
          reactions: { 
            userId: String(userId), 
            userName: userName || 'User', 
            userAvatar: userAvatar || '', 
            emoji: emoji || '❤️', 
            createdAt: new Date() 
          } 
        } 
      },
      { new: true }
    );
    if (!post) return res.status(404).json({ success: false, error: 'Post not found' });
    res.json({ success: true, data: post });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:postId/like', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { userName } = req.body;
    const Post = mongoose.model('Post');
    
    // 1. Resolve all user ID variants
    const { canonicalId, candidates } = await resolveUserIdentifiers(userId);
    
    // 2. Check if already liked using any known variant
    const existingPost = await Post.findOne(resolvePostQuery(req.params.postId));
    if (!existingPost) return res.status(404).json({ success: false, error: 'Post not found' });

    // Use candidates to check if ANY of the user's IDs are in the likes array
    const alreadyLiked = Array.isArray(existingPost.likes) && existingPost.likes.some(l => {
      const lid = String(l?._id || l?.id || l || '');
      return candidates.includes(lid);
    });
    
    if (alreadyLiked) {
      // If already liked, just return success without incrementing
      return res.json({ success: true, data: existingPost, message: 'Already liked' });
    }

    // 3. Add canonicalId to ensure consistency in the database
    const post = await Post.findOneAndUpdate(
      resolvePostQuery(req.params.postId),
      { $addToSet: { likes: canonicalId }, $inc: { likesCount: 1 } },
      { new: true }
    );

    if (post && String(post.userId) !== String(canonicalId)) {
      const User = mongoose.model('User');
      const sender = await User.findById(canonicalId).select('displayName name').lean();
      const senderName = sender?.displayName || sender?.name || 'Someone';

      notificationQueue.add('postLike', {
        userId: post.userId,
        senderId: canonicalId,
        title: 'New Like! ❤️',
        body: `${senderName} liked your post`,
        data: { postId: post._id, type: 'LIKE', screen: 'home' }
      }).catch(() => {});
    }

    res.json({ success: true, data: post });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /:postId/like - Unlike
router.delete('/:postId/like', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { candidates } = await resolveUserIdentifiers(userId);
    const Post = mongoose.model('Post');
    
    // Pull any known ID variant from the likes array
    const post = await Post.findOneAndUpdate(
      resolvePostQuery(req.params.postId),
      { $pull: { likes: { $in: candidates } }, $inc: { likesCount: -1 } },
      { new: true }
    );
    
    if (post && post.likesCount < 0) {
      post.likesCount = 0;
      await post.save();
    }
    res.json({ success: true, data: post });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /:postId/comments - Get comments for a specific post
router.get('/:postId/comments', optionalAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    const viewerId = req.userId || null;
    
    const Post = mongoose.model('Post');
    const Comment = mongoose.model('Comment');
    
    // Resolve post
    const post = await Post.findOne(resolvePostQuery(postId)).lean();

    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    // Fetch comments
    const comments = await Comment.find({ 
      postId: { $in: [String(post._id), String(post.id)].filter(Boolean) } 
    }).sort({ createdAt: -1 }).lean();

    // Enrich comments with author data
    const User = mongoose.model('User');
    const enriched = await Promise.all(comments.map(async (c) => {
      const author = await User.findOne({
        $or: [
          { _id: mongoose.Types.ObjectId.isValid(c.userId) ? new mongoose.Types.ObjectId(c.userId) : null },
          { firebaseUid: c.userId },
          { uid: c.userId }
        ].filter(q => q._id !== null || q.firebaseUid || q.uid)
      }).select('displayName name avatar photoURL profilePicture').lean();

      return {
        ...c,
        userName: author?.displayName || author?.name || 'Anonymous',
        userAvatar: author?.avatar || author?.photoURL || author?.profilePicture || null
      };
    }));

    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /:postId/share - Increment share count
router.post('/:postId/share', optionalAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    const Post = mongoose.model('Post');
    
    const post = await Post.findOneAndUpdate(
      resolvePostQuery(postId),
      { $inc: { shareCount: 1 } },
      { new: true }
    );
    
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    
    res.json({ success: true, shareCount: post.shareCount, data: post });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

