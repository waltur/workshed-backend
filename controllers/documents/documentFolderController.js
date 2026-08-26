const pool = require('../../db');


// =====================================================
// GET ALL FOLDERS
// =====================================================

const getAllFolders = async (req, res) => {

  try {

    const result = await pool.query(
      `
      SELECT
        id_folder,
        name,
        description,
        parent_id,
        is_active,
        created_at,
        updated_at
      FROM membership.document_folders
      ORDER BY name ASC
      `
    );

    return res.json({

      success: true,

      folders: result.rows

    });

  }
  catch (err) {

    console.error(
      'Error getting document folders:',
      err
    );

    return res.status(500).json({

      error:
        'Unable to get document folders.'

    });

  }

};


// =====================================================
// CREATE FOLDER
// =====================================================

const createFolder = async (req, res) => {

  try {

    const {

      name,
      description,
      parent_id

    } = req.body;


    // ---------------------------------------------
    // VALIDATE NAME
    // ---------------------------------------------

    if (!name || !name.trim()) {

      return res.status(400).json({

        error:
          'Folder name is required.'

      });

    }


    // ---------------------------------------------
    // INSERT
    // ---------------------------------------------

    const result = await pool.query(
      `
      INSERT INTO membership.document_folders
      (
        name,
        description,
        parent_id
      )
      VALUES
      (
        $1,
        $2,
        $3
      )
      RETURNING *
      `,
      [

        name.trim(),

        description || null,

        parent_id || null

      ]
    );


    return res.status(201).json({

      success: true,

      message:
        'Folder created successfully.',

      folder:
        result.rows[0]

    });

  }
  catch (err) {

    console.error(
      'Error creating document folder:',
      err
    );

    return res.status(500).json({

      error:
        'Unable to create document folder.'

    });

  }

};


// =====================================================
// UPDATE FOLDER
// =====================================================

const updateFolder = async (req, res) => {

  try {

    const id_folder =
      parseInt(
        req.params.id,
        10
      );


    const {

      name,
      description,
      parent_id

    } = req.body;


    if (!id_folder) {

      return res.status(400).json({

        error:
          'Invalid folder ID.'

      });

    }


    if (!name || !name.trim()) {

      return res.status(400).json({

        error:
          'Folder name is required.'

      });

    }


    // Prevent a folder from being its own parent

    if (
      parent_id &&
      Number(parent_id) === id_folder
    ) {

      return res.status(400).json({

        error:
          'A folder cannot be its own parent.'

      });

    }


    const result = await pool.query(
      `
      UPDATE membership.document_folders

      SET

        name = $1,

        description = $2,

        parent_id = $3,

        updated_at = CURRENT_TIMESTAMP

      WHERE id_folder = $4

      RETURNING *
      `,
      [

        name.trim(),

        description || null,

        parent_id || null,

        id_folder

      ]
    );


    if (!result.rows.length) {

      return res.status(404).json({

        error:
          'Folder not found.'

      });

    }


    return res.json({

      success: true,

      message:
        'Folder updated successfully.',

      folder:
        result.rows[0]

    });

  }
  catch (err) {

    console.error(
      'Error updating document folder:',
      err
    );

    return res.status(500).json({

      error:
        'Unable to update document folder.'

    });

  }

};


// =====================================================
// ACTIVATE / DEACTIVATE FOLDER
// =====================================================

const updateFolderStatus = async (req, res) => {

  try {

    const id_folder =
      parseInt(
        req.params.id,
        10
      );


    const {

      is_active

    } = req.body;


    if (!id_folder) {

      return res.status(400).json({

        error:
          'Invalid folder ID.'

      });

    }


    if (
      typeof is_active !== 'boolean'
    ) {

      return res.status(400).json({

        error:
          'is_active must be boolean.'

      });

    }


    const result = await pool.query(
      `
      UPDATE membership.document_folders

      SET

        is_active = $1,

        updated_at = CURRENT_TIMESTAMP

      WHERE id_folder = $2

      RETURNING *
      `,
      [

        is_active,

        id_folder

      ]
    );


    if (!result.rows.length) {

      return res.status(404).json({

        error:
          'Folder not found.'

      });

    }


    return res.json({

      success: true,

      message:
        is_active
          ? 'Folder activated.'
          : 'Folder deactivated.',

      folder:
        result.rows[0]

    });

  }
  catch (err) {

    console.error(
      'Error updating folder status:',
      err
    );

    return res.status(500).json({

      error:
        'Unable to update folder status.'

    });

  }

};


// =====================================================
// DELETE FOLDER
// =====================================================

const deleteFolder = async (req, res) => {

  try {

    const id_folder =
      parseInt(
        req.params.id,
        10
      );


    if (!id_folder) {

      return res.status(400).json({

        error:
          'Invalid folder ID.'

      });

    }


    const result = await pool.query(
      `
      DELETE FROM membership.document_folders

      WHERE id_folder = $1

      RETURNING *
      `,
      [id_folder]
    );


    if (!result.rows.length) {

      return res.status(404).json({

        error:
          'Folder not found.'

      });

    }


    return res.json({

      success: true,

      message:
        'Folder deleted successfully.'

    });

  }
  catch (err) {

    console.error(
      'Error deleting document folder:',
      err
    );

    return res.status(500).json({

      error:
        'Unable to delete document folder.'

    });

  }

};


module.exports = {

  getAllFolders,

  createFolder,

  updateFolder,

  updateFolderStatus,

  deleteFolder

};