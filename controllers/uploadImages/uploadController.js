const supabase = require('../../services/supabase');

const MAX_SIZE_MB = 2;
const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

const uploadProfilePhoto = async (req, res) => {
  try {
    const { imageBase64, fileName, folder } = req.body;

    if (!imageBase64 || !fileName) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    // 🔍 Extraer metadata del base64
    const matches = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Invalid image format' });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    // 🛑 Validar tipo
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return res.status(400).json({
        error: 'Invalid image type. Only JPG and PNG are allowed'
      });
    }

    // 📏 Validar tamaño
    const buffer = Buffer.from(base64Data, 'base64');
    const sizeInMB = buffer.length / (1024 * 1024);

    if (sizeInMB > MAX_SIZE_MB) {
      return res.status(400).json({
        error: 'Image too large. Max size is 2MB'
      });
    }

    const safeFolder = folder || 'profiles';
    const extension = mimeType.split('/')[1];
    const filePath = `${safeFolder}/${Date.now()}-${fileName}.${extension}`;

    const { error } = await supabase.storage
      .from('images')
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: true
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return res.status(500).json({ error: 'Failed to upload image' });
    }

    const { data } = supabase.storage
      .from('images')
      .getPublicUrl(filePath);

    res.json({ imageUrl: data.publicUrl });

  } catch (err) {
    console.error('Upload image error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
};

module.exports = { uploadProfilePhoto };
