
const pool = require('../db');

const SUPER_ADMIN_USER_ID = 63;

const normalize = value =>
  String(value ?? '').trim().toLowerCase();

const authorize = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const authenticatedUserId = Number(req.user?.id);

      if (
        !Number.isSafeInteger(authenticatedUserId) ||
        authenticatedUserId <= 0
      ) {
        return res.status(401).json({
          message: 'User not authenticated'
        });
      }

      const result = await pool.query(
        `
        SELECT r.role_name
        FROM auth.user_roles ur
        INNER JOIN auth.roles r
          ON r.id_role = ur.id_role
        WHERE ur.id_user = $1
        `,
        [authenticatedUserId]
      );

      const userRoles = result.rows.map(
        row => row.role_name
      );

      const isSuperAdmin =
        authenticatedUserId === SUPER_ADMIN_USER_ID &&
        userRoles.some(
          role => normalize(role) === 'superadmin'
        );

      // Solo la cuenta 63 con el rol SuperAdmin
      // recibe acceso administrativo global.
      if (isSuperAdmin) {
        req.user.roles = userRoles;
        return next();
      }

      // Ninguna otra cuenta puede usar SuperAdmin
      // como permiso de acceso.
      if (
        allowedRoles.some(
          role => normalize(role) === 'superadmin'
        )
      ) {
        return res.status(403).json({
          message: 'Access denied'
        });
      }

      const hasPermission = userRoles.some(
        userRole =>
          allowedRoles.some(
            allowedRole =>
              normalize(userRole) === normalize(allowedRole)
          )
      );

      if (!hasPermission) {
        return res.status(403).json({
          message: 'Access denied'
        });
      }

      req.user.roles = userRoles;

      return next();

    } catch (error) {
      console.error('Authorization error:', error);

      return res.status(500).json({
        message: 'Authorization error'
      });
    }
  };
};

module.exports = authorize;

