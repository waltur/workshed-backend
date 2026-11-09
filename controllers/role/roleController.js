const pool = require('../../db');

const getRoles = async (req, res) => {
  try {
    const result = await pool.query('SELECT id_role, role_name FROM auth.roles ORDER BY role_name');
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting roles:', err);
    res.status(500).json({ error: 'Failed to load roles' });
  }
};

const getAdminRoles = async (req, res) => {
  try {
    const userId = Number(req.user?.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({
        message: 'User not authenticated'
      });
    }

    // Verificar SuperAdmin directamente en la base de datos.
    const accessResult = await pool.query(
      `SELECT EXISTS (
        SELECT 1
        FROM auth.user_roles ur
        INNER JOIN auth.roles r
          ON r.id_role = ur.id_role
        WHERE ur.id_user = $1
          AND LOWER(TRIM(r.role_name)) = 'superadmin'
      ) AS is_super_admin`,
      [userId]
    );

    const isSuperAdmin =
      userId === 63 &&
      accessResult.rows[0].is_super_admin === true;

    let result;

    if (isSuperAdmin) {
      // SuperAdmin puede recibir todos los roles.
      result = await pool.query(
        `SELECT id_role, role_name
         FROM auth.roles
         ORDER BY role_name`
      );
    } else {
      // Committee y los demás no reciben SuperAdmin.
      result = await pool.query(
        `SELECT id_role, role_name
         FROM auth.roles
         WHERE LOWER(TRIM(role_name)) <> 'superadmin'
         ORDER BY role_name`
      );
    }

    return res.json(result.rows);

  } catch (err) {
    console.error('Error getting admin roles:', err);

    return res.status(500).json({
      error: 'Failed to load admin roles'
    });
  }
};

module.exports = { getRoles, getAdminRoles };