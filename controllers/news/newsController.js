// ✅ newsController.js
const fs = require('fs');
const path = require('path');
const pool = require('../../db');
const supabase = require('../../services/supabase');

const createNewsPost = async (req, res) => {
  try {
    const { title, description } = req.body;
    let imageUrls = [];

    if (req.files?.images) {
      const files = Array.isArray(req.files.images)
        ? req.files.images
        : [req.files.images];

      for (const file of files) {
        const ext = file.name.split('.').pop();
        const fileName = `posts/${Date.now()}-${Math.random()}.${ext}`;

        const { error } = await supabase.storage
          .from('news')
          .upload(fileName, file.data, {
            contentType: file.mimetype,
            upsert: false
          });

        if (error) throw error;

        const { data } = supabase.storage
          .from('news')
          .getPublicUrl(fileName);

        imageUrls.push(data.publicUrl);
      }
    }

    const result = await pool.query(
      `INSERT INTO news.news_posts (title, description, images)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [title, description, JSON.stringify(imageUrls)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating post' });
  }
};
/*const getAllNews = async (req, res) => {
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
};*/

const getAllNews = async (req, res) => {
  const id_contact = req.user?.id_contact || null;

  const postsResult = await pool.query(`
    SELECT
      p.*,
      COUNT(l.id_like)::int AS likes,
      BOOL_OR(l.id_contact = $1) AS liked_by_me
    FROM news.news_posts p
    LEFT JOIN news.news_post_likes l ON l.id_post = p.id_post
    GROUP BY p.id_post
    ORDER BY p.created_at DESC
  `, [id_contact]);

  const fullPosts = await Promise.all(
    postsResult.rows.map(async post => {

      const commentsResult = await pool.query(
        `
        SELECT
          c.id_comment,
          c.comment,
          c.created_at,
          con.name,
          c.parent_id
        FROM news.news_comments c
        LEFT JOIN contacts.contacts con ON c.id_contact = con.id_contact
        WHERE c.id_post = $1
        ORDER BY c.created_at ASC
        `,
        [post.id_post]
      );

      const commentsFlat = commentsResult.rows;

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

      return {
        ...post,
        likes: post.likes || 0,
        liked_by_me: post.liked_by_me || false,
        comments: rootComments
      };
    })
  );

  res.json(fullPosts);
};
const likeNewsPost = async (req, res) => {
console.log("likeNewsPost");
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

const likePost = async (req, res) => {
console.log("likePost");
  const { id_post } = req.params;
   const id_contact = req.user.contact_id;

  if (!id_post || !id_contact) {
    return res.status(400).json({ error: 'Missing data' });
  }

  try {
    await pool.query(
      `
      INSERT INTO news.news_post_likes (id_post, id_contact)
      VALUES ($1, $2)
      ON CONFLICT (id_post, id_contact) DO NOTHING
      `,
      [id_post, id_contact]
    );

    const { rows } = await pool.query(
      `
      SELECT COUNT(*) AS likes
      FROM news.news_post_likes
      WHERE id_post = $1
      `,
      [id_post]
    );

    res.json({ likes: Number(rows[0].likes) });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to like post' });
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
  likePost,
  commentOnPost
};
