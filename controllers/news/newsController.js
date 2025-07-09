// ✅ newsController.js
const fs = require('fs');
const path = require('path');
const pool = require('../../db');

const createNewsPost = async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: 'Missing title or description' });
    }

    let imageNames = [];

    // Soporte para una o múltiples imágenes
    if (req.files && req.files.images) {
      const files = Array.isArray(req.files.images) ? req.files.images : [req.files.images];

      for (const file of files) {
        const ext = path.extname(file.name);
        const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}${ext}`;
        const uploadPath = path.join(__dirname, '../../public/uploads/news/', fileName);

        // Crear directorio si no existe
        fs.mkdirSync(path.dirname(uploadPath), { recursive: true });

        // Mover archivo
        await file.mv(uploadPath);
        imageNames.push(fileName);
      }
    }

    // Guardar post (guarda como array JSON en un solo campo)
    const result = await pool.query(
      `INSERT INTO news.news_posts (title, description, images)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [title, description, JSON.stringify(imageNames)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating post:', err);
    res.status(500).json({ message: 'Error creating post' });
  }
};
const getAllNews = async (req, res) => {
  const posts = await pool.query('SELECT * FROM news.news_posts ORDER BY created_at DESC');

  const fullPosts = await Promise.all(posts.rows.map(async post => {
    const commentsResult = await pool.query(
      `SELECT c.id_comment, c.comment, c.created_at, con.name, c.parent_id
       FROM news.news_comments c
       LEFT JOIN contacts.contacts con ON c.id_contact = con.id_contact
       WHERE c.id_post = $1
       ORDER BY c.created_at ASC`,
      [post.id_post]
    );

    const commentsFlat = commentsResult.rows;

    // Armar árbol de comentarios anidados
    const map = {};
    commentsFlat.forEach(c => map[c.id_comment] = { ...c, replies: [] });

    const rootComments = [];
    commentsFlat.forEach(c => {
      if (c.parent_id) {
        map[c.parent_id].replies.push(map[c.id_comment]);
      } else {
        rootComments.push(map[c.id_comment]);
      }
    });

    return { ...post, comments: rootComments };
  }));

  res.json(fullPosts);
};
const likeNewsPost = async (req, res) => {
  try {
    const id = req.params.id;

    // Incrementa y devuelve el nuevo número de likes
    const result = await pool.query(
      `UPDATE news.news_posts
       SET likes = likes + 1
       WHERE id_post = $1
       RETURNING likes`,
      [id]
    );

    res.status(200).json({ message: 'Post liked successfully', likes: result.rows[0].likes });
  } catch (error) {
    console.error('Error liking post:', error);
    res.status(500).json({ error: 'Error liking post' });
  }
};
const commentOnPost = async (req, res) => {
console.log("commentOnPost");
  try {
    const id = req.params.id;
    const { comment, id_contact, parentId } = req.body;

    await pool.query(
       'INSERT INTO news.news_comments (id_post, comment, id_contact, parent_id) VALUES ($1, $2, $3, $4)',
      [id, comment,id_contact,parentId]
    );

    res.status(200).json({ message: 'Comment added successfully' }); // ✅ mejor que sendStatus
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Error adding comment' });
  }
};



module.exports = {
  createNewsPost,
  getAllNews,
  likeNewsPost,
  commentOnPost
};
