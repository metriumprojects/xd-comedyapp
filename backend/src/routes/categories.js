const express = require('express');
const router = express.Router();
const Category = require('../models/Category');

const DEFAULT_CATEGORIES = [
  { name: 'Stand Up', image: 'https://images.pexels.com/photos/2810816/pexels-photo-2810816.jpeg?auto=compress&cs=tinysrgb&w=150' },
  { name: 'Memes', image: 'https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg?auto=compress&cs=tinysrgb&w=150' },
  { name: 'Pranks', image: 'https://images.pexels.com/photos/1006073/pexels-photo-1006073.jpeg?auto=compress&cs=tinysrgb&w=150' },
  { name: 'Comics', image: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=150' },
  { name: 'Street pranks', image: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=150' }
];

// Get all categories
router.get('/', async (req, res) => {
  try {
    let categories = await Category.find().sort({ createdAt: 1 });
    if (!categories || categories.length === 0) {
      categories = await Category.insertMany(DEFAULT_CATEGORIES);
    }
    res.json({ success: true, data: categories || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, data: DEFAULT_CATEGORIES });
  }
});

module.exports = router;
