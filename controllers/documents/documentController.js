const pool = require('../../db');
const supabase = require('../../services/supabase');

// =====================================================
// SUPABASE DOCUMENT PATH
// =====================================================

const getDocumentStoragePath = (fileUrl) => {

  if (!fileUrl) {
    return null;
  }

  // ---------------------------------------------------
  // DOCUMENTOS NUEVOS
  // Ya guardamos directamente el path:
  //
  // membership/documento-v1.0-123456.pdf
  // ---------------------------------------------------

  if (
    !fileUrl.startsWith('http://') &&
    !fileUrl.startsWith('https://')
  ) {
    return fileUrl;
  }

  // ---------------------------------------------------
  // DOCUMENTOS ANTIGUOS
  // Actualmente tienen:
  //
  // https://xxx.supabase.co/storage/v1/object/public/documents/...
  // ---------------------------------------------------

  const marker =
    '/storage/v1/object/public/documents/';

  const index =
    fileUrl.indexOf(marker);

  if (index !== -1) {

    return fileUrl.substring(
      index + marker.length
    );

  }

  return null;

};
// =====================================================
// GET MY DOCUMENTS
// =====================================================

// =====================================================
// GET MY DOCUMENTS
// =====================================================

// =====================================================
// GET MY DOCUMENTS
// =====================================================

const getMyDocuments = async (req, res) => {

  try {

    const id_user = req.user.id;
    const id_contact = req.user.contact_id;

    if (!id_user) {

      return res.status(400).json({
        error: 'User ID not found.'
      });

    }

    console.log('getMyDocuments');
    console.log('id_user:', id_user);
    console.log('id_contact:', id_contact);


    // =================================================
    // OBTENER ROLES DEL USUARIO
    // =================================================

    const rolesResult = await pool.query(
      `
      SELECT LOWER(r.role_name) AS role_name

      FROM auth.user_roles ur

      INNER JOIN auth.roles r
        ON r.id_role = ur.id_role

      WHERE ur.id_user = $1
      `,
      [id_user]
    );


    const roles = rolesResult.rows.map(
      row => row.role_name
    );


    // =================================================
    // DETERMINAR AUDIENCE
    // =================================================

    const audiences = ['everyone'];


    if (
      roles.includes('participant(member)') ||
      roles.includes('member')
    ) {

      audiences.push('member');

    }


    if (
      roles.includes('volunteer')
    ) {

      audiences.push('volunteer');

    }


    if (
      roles.includes('staff')
    ) {

      audiences.push('staff');

    }


    if (
      roles.includes('admin')
    ) {

      audiences.push('admin');

    }


    // =================================================
    // OBTENER DOCUMENTOS
    // =================================================

    const result = await pool.query(
      `
      SELECT

        d.id_document,
        d.title,
        d.description,
        d.document_type,
        d.file_url,
        d.version,
        d.audience,
        d.requires_acceptance,
        d.is_active,
        d.created_at,
        d.updated_at,

        COALESCE(
          uda.accepted,
          FALSE
        ) AS accepted,

        uda.accepted_at,

        uda.document_version AS accepted_version

      FROM membership.documents d

      LEFT JOIN membership.user_document_acceptances uda

        ON uda.id_document = d.id_document

        AND uda.id_user = $1

      WHERE

        d.is_active = TRUE

        AND d.audience = ANY($2::text[])

      ORDER BY

        CASE
          WHEN d.requires_acceptance = TRUE
          THEN 0
          ELSE 1
        END,

        d.created_at DESC

      `,
      [
        id_user,
        audiences
      ]
    );


    // =================================================
    // GENERAR SIGNED URL
    // =================================================

    const documents = await Promise.all(

      result.rows.map(async (document) => {

        const storagePath =
          getDocumentStoragePath(
            document.file_url
          );


        if (!storagePath) {

          console.warn(
            'Unable to determine storage path:',
            document.file_url
          );

          return {
            ...document,
            file_url: null
          };

        }


        const {
          data,
          error
        } = await supabase.storage
          .from('documents')
          .createSignedUrl(
            storagePath,
            300
          );


        if (error) {

          console.error(
            'Supabase signed URL error:',
            error
          );

          return {
            ...document,
            file_url: null
          };

        }


        return {

          ...document,

          file_url:
            data?.signedUrl || null

        };

      })

    );


    // =================================================
    // RESPONSE
    // =================================================

    return res.json({

      success: true,

      documents

    });

  }
  catch (err) {

    console.error(
      'Error getting user documents:',
      err
    );

    return res.status(500).json({

      error: 'Unable to get documents.'

    });

  }

};
// =====================================================
// ACCEPT DOCUMENT
// =====================================================

const acceptDocument = async (req, res) => {

  try {

    const id_user = req.user.id;

    const id_document =
      parseInt(req.params.id, 10);


    if (!id_user) {

      return res.status(400).json({
        error: 'User ID not found.'
      });

    }


    if (!id_document) {

      return res.status(400).json({
        error: 'Invalid document ID.'
      });

    }


    // =================================================
    // OBTENER DOCUMENTO
    // =================================================

    const documentResult = await pool.query(
      `
      SELECT

        id_document,
        version,
        requires_acceptance,
        is_active

      FROM membership.documents

      WHERE id_document = $1

      LIMIT 1
      `,
      [id_document]
    );


    if (documentResult.rows.length === 0) {

      return res.status(404).json({
        error: 'Document not found.'
      });

    }


    const document =
      documentResult.rows[0];


    if (!document.is_active) {

      return res.status(400).json({
        error: 'This document is no longer active.'
      });

    }


    if (!document.requires_acceptance) {

      return res.status(400).json({
        error: 'This document does not require acceptance.'
      });

    }


    // =================================================
    // GUARDAR ACEPTACIÓN
    // =================================================

    const result = await pool.query(
      `
      INSERT INTO membership.user_document_acceptances (

        id_user,
        id_document,
        accepted,
        accepted_at,
        document_version,
        ip_address

      )

      VALUES (

        $1,
        $2,
        TRUE,
        CURRENT_TIMESTAMP,
        $3,
        $4

      )

    ON CONFLICT (
      id_user,
      id_document,
      document_version
    )

      DO UPDATE SET

        accepted = TRUE,

        accepted_at = CURRENT_TIMESTAMP,

        document_version = EXCLUDED.document_version,

        ip_address = EXCLUDED.ip_address,

        updated_at = CURRENT_TIMESTAMP

      RETURNING *

      `,
      [
        id_user,
        id_document,
        document.version,
        req.ip
      ]
    );


    return res.json({

      success: true,

      message: 'Document accepted successfully.',

      acceptance: result.rows[0]

    });

  }
  catch (err) {

    console.error(
      'Error accepting document:',
      err
    );

    return res.status(500).json({

      error: 'Unable to accept document.'

    });

  }

};

// =====================================================
// LIST ALL DOCUMENTS
// =====================================================

// =====================================================
// LIST ALL DOCUMENTS
// =====================================================

const getAllDocuments = async (req, res) => {

  try {

    const result = await pool.query(`
     SELECT
       d.id_document,
       d.title,
       d.description,
       d.document_type,
       d.file_url,
       d.version,
       d.audience,
       d.requires_acceptance,
       d.is_active,
       d.id_folder,
       f.name AS folder_name,
       d.created_at,
       d.updated_at

     FROM membership.documents d

     LEFT JOIN membership.document_folders f
       ON f.id_folder = d.id_folder

     ORDER BY d.created_at DESC
    `);


    // =================================================
    // GENERAR SIGNED URLS
    // =================================================

    const documents = await Promise.all(

      result.rows.map(async (document) => {

        const storagePath =
          getDocumentStoragePath(
            document.file_url
          );


        if (!storagePath) {

          return {
            ...document,
            file_url: null
          };

        }


        const {
          data,
          error
        } = await supabase.storage
          .from('documents')
          .createSignedUrl(
            storagePath,
            300
          );


        if (error) {

          console.error(
            'Supabase signed URL error:',
            error
          );

          return {
            ...document,
            file_url: null
          };

        }


        return {

          ...document,

          file_url:
            data?.signedUrl || null

        };

      })

    );


    res.json(documents);

  }
  catch (err) {

    console.error(
      'Error getting documents:',
      err
    );

    res.status(500).json({
      error: 'Unable to get documents.'
    });

  }

};

// =====================================================
// UPLOAD DOCUMENT
// =====================================================

const uploadDocument = async (req, res) => {

  try {

    console.log('================================');
    console.log('DOCUMENT UPLOAD');
    console.log('================================');

    console.log('BODY:', req.body);
    console.log('FILES:', req.files ? Object.keys(req.files) : null);


    // =====================================================
    // VALIDAR ARCHIVO
    // =====================================================

    if (!req.files || !req.files.file) {

      return res.status(400).json({
        error: 'Document file is required.'
      });

    }


    const file = req.files.file;


    console.log('FILE:', {
      name: file.name,
      mimetype: file.mimetype,
      size: file.size
    });


    // =====================================================
    // VALIDAR TIPO
    // =====================================================

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];


    if (!allowedTypes.includes(file.mimetype)) {

      return res.status(400).json({
        error: 'Only PDF, DOC and DOCX documents are allowed.'
      });

    }


    // =====================================================
    // VALIDAR TAMAÑO
    // =====================================================

    const MAX_SIZE =
      10 * 1024 * 1024;


    if (file.size > MAX_SIZE) {

      return res.status(400).json({
        error: 'Document too large. Maximum size is 10MB.'
      });

    }


    // =====================================================
    // DATOS DEL FORMULARIO
    // =====================================================

    const {
      title,
      description,
      document_type,
      version = '1.0',
      audience = 'everyone',
      requires_acceptance = false,
      id_folder = null
    } = req.body;


    if (!title || !title.trim()) {

      return res.status(400).json({
        error: 'Title is required.'
      });

    }


    if (!document_type) {

      return res.status(400).json({
        error: 'Document type is required.'
      });

    }


    // =====================================================
    // NOMBRE SEGURO
    // =====================================================

    const safeTitle = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');


    const safeVersion = String(version)
      .replace(/[^a-zA-Z0-9.-]/g, '-');


    const extension =
      file.name.includes('.')
        ? file.name.split('.').pop().toLowerCase()
        : 'pdf';


   const filePath =
     `${document_type}/${safeTitle}-v${safeVersion}-${Date.now()}.${extension}`;


    console.log('SUPABASE PATH:', filePath);


    // =====================================================
    // SUPABASE STORAGE
    // =====================================================

    const {
      error: uploadError
    } = await supabase.storage
      .from('documents')
      .upload(
        filePath,
        file.data,
        {
          contentType: file.mimetype,
          upsert: false
        }
      );


    if (uploadError) {

      console.error(
        'Supabase upload error:',
        uploadError
      );

      return res.status(500).json({
        error: 'Unable to upload document to storage.'
      });

    }


    // =====================================================
    // PUBLIC URL
    // =====================================================

    const {
      data: publicUrlData
    } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);


    const fileUrl =
      publicUrlData.publicUrl;


    console.log(
      'DOCUMENT URL:',
      fileUrl
    );

    // =====================================================
    // VALIDATE FOLDER
    // =====================================================

    let folderId = null;

    if (id_folder !== null && id_folder !== '') {

      folderId = parseInt(id_folder, 10);

      if (!folderId) {

        return res.status(400).json({
          error: 'Invalid folder.'
        });

      }

      const folderResult = await pool.query(
        `
        SELECT
          id_folder,
          is_active
        FROM membership.document_folders
        WHERE id_folder = $1
        LIMIT 1
        `,
        [folderId]
      );

      if (!folderResult.rows.length) {

        return res.status(400).json({
          error: 'Folder not found.'
        });

      }

      if (folderResult.rows[0].is_active === false) {

        return res.status(400).json({
          error: 'The selected folder is inactive.'
        });

      }

    }
    // =====================================================
    // SAVE DATABASE
    // =====================================================

    const result = await pool.query(
      `
      INSERT INTO membership.documents
      (
        title,
        description,
        document_type,
        file_url,
        version,
        audience,
        requires_acceptance,
        is_active,
        id_folder
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        TRUE,
        $8
      )
      RETURNING *
      `,
      [
        title.trim(),
        description || null,
        document_type,
        fileUrl,
        version,
        audience,
        requires_acceptance === true ||
        requires_acceptance === 'true',
        folderId
      ]
    );


    // =====================================================
    // RESPONSE
    // =====================================================

    return res.status(201).json({

      success: true,

      message:
        'Document uploaded successfully.',

      document:
        result.rows[0]

    });

  }
  catch (err) {

    console.error(
      'Error uploading document:',
      err
    );

    return res.status(500).json({

      error:
        'Unable to upload document.'

    });

  }

};


// =====================================================
// UPDATE DOCUMENT
// =====================================================

const updateDocument = async (req, res) => {

  try {

    const { id } = req.params;

    const {
      title,
      description,
      document_type,
      version,
      audience,
      requires_acceptance,
      id_folder
    } = req.body;

        let folderId = null;

        if (id_folder !== null && id_folder !== undefined && id_folder !== '') {

          folderId = parseInt(id_folder, 10);

          if (!folderId) {

            return res.status(400).json({
              error: 'Invalid folder.'
            });

          }

          const folderResult = await pool.query(
            `
            SELECT
              id_folder,
              is_active
            FROM membership.document_folders
            WHERE id_folder = $1
            LIMIT 1
            `,
            [folderId]
          );

          if (!folderResult.rows.length) {

            return res.status(400).json({
              error: 'Folder not found.'
            });

          }

          if (folderResult.rows[0].is_active === false) {

            return res.status(400).json({
              error: 'The selected folder is inactive.'
            });

          }

        }

 const result = await pool.query(
   `
   UPDATE membership.documents

   SET
     title = COALESCE($1, title),
     description = COALESCE($2, description),
     document_type = COALESCE($3, document_type),
     version = COALESCE($4, version),
     audience = COALESCE($5, audience),
     requires_acceptance =
       COALESCE($6, requires_acceptance),
     id_folder = $7,
     updated_at = CURRENT_TIMESTAMP

   WHERE id_document = $8

   RETURNING *
   `,
   [
     title,
     description,
     document_type,
     version,
     audience,
     requires_acceptance,
     folderId,
     id
   ]
 );


    if (!result.rows.length) {

      return res.status(404).json({
        error: 'Document not found.'
      });

    }


    res.json({

      message: 'Document updated successfully.',

      document: result.rows[0]

    });

  } catch (err) {

    console.error(
      'Error updating document:',
      err
    );

    res.status(500).json({
      error: 'Unable to update document.'
    });

  }

};


// =====================================================
// ACTIVATE / DEACTIVATE
// =====================================================

const updateDocumentStatus = async (req, res) => {

  try {

    const { id } = req.params;

    const {
      is_active
    } = req.body;


    if (typeof is_active !== 'boolean') {

      return res.status(400).json({
        error: 'is_active must be boolean.'
      });

    }


    const result = await pool.query(
      `
      UPDATE membership.documents

      SET
        is_active = $1,
        updated_at = CURRENT_TIMESTAMP

      WHERE id_document = $2

      RETURNING *
      `,
      [
        is_active,
        id
      ]
    );


    if (!result.rows.length) {

      return res.status(404).json({
        error: 'Document not found.'
      });

    }


    res.json({

      message: is_active
        ? 'Document activated.'
        : 'Document deactivated.',

      document: result.rows[0]

    });

  } catch (err) {

    console.error(
      'Error updating document status:',
      err
    );

    res.status(500).json({
      error: 'Unable to update document status.'
    });

  }

};



module.exports = {
  getMyDocuments,
  acceptDocument,
  getAllDocuments,
  uploadDocument,
  updateDocument,
  updateDocumentStatus
};