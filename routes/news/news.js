const express = require('express');
const router = express.Router();
const newsController = require('../../controllers/news/newsController');

router.get('/', newsController.getAllNews);
router.post('/', newsController.createNewsPost);
router.post('/:id/like', newsController.likeNewsPost);
router.post('/:id/comment', newsController.commentOnPost);

module.exports = router;