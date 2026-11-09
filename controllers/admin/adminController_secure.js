
const pool = require('../../db');
const bcrypt = require('bcrypt');

const SUPER_ADMIN_USER_ID = 63;
const SUPER_ADMIN_ROLE_NAME = 'SuperAdmin';
const COMMITTEE_ROLE_NAME = 'Committee';

const normalize = value =>
  String(value ?? '').trim().toLowerCase();

const isValidId = value =>
  (typeof value === 'number' ||
    (typeof value === 'string' && /^\d+$/.test(value.trim()))) &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) > 0;

const getUserRoles = async (userId, db = pool) => {
  const result = await db.query(
    `
    SELECT r.role_name
    FROM auth.user_roles ur
    INNER JOIN auth.roles r
      ON r.id_role = ur.id_role
    WHERE ur.id_user = $1
    `,
    [Number(userId)]
  );

  return result.rows.map(row => row.role_name);
};

const hasRole = (roles, roleName) =>
  roles.some(role => normalize(role) === normalize(roleName));

const isSuperAdminAccount = async (userId, db = pool) => {
  if (Number(userId) !== SUPER_ADMIN_USER_ID) {
    return false;
  }

  const roles = await getUserRoles(userId, db);

  return hasRole(roles, SUPER_ADMIN_ROLE_NAME);
};

/**
 * Comprueba los permisos usando los roles actuales de la BD.
 * Las rutas también deben utilizar verifyToken.
 */
const getAdminAccess = async (req, res) => {
  if (!isValidId(req.user?.id)) {
    res.status(401).json({
      message: 'Authentication required'
    });

    return null;
  }

  const userId = Number(req.user.id);
  const roles = await getUserRoles(userId);

  const isSuperAdmin =
    userId === SUPER_ADMIN_USER_ID &&
    hasRole(roles, SUPER_ADMIN_ROLE_NAME);

  if (
    !isSuperAdmin &&
    !hasRole(roles, COMMITTEE_ROLE_NAME)
  ) {
    res.status(403).json({
      message: 'Access denied'
    });

    return null;
  }

  return { isSuperAdmin, roles, userId };
};

/**
 * Impide administrar la cuenta 63 y cualquier cuenta
 * que tenga el rol SuperAdmin.
 */
const rejectProtectedTarget = async (userId, res, db = pool) => {
  const roles = await getUserRoles(userId, db);

  const protectedTarget =
    Number(userId) === SUPER_ADMIN_USER_ID ||
    hasRole(roles, SUPER_ADMIN_ROLE_NAME);

  if (protectedTarget) {
    res.status(403).json({
      message:
        'This account is protected and cannot be changed through user administration'
    });

    return true;
  }

  return false;
};

/**
 * Valida los ID de rol contra la base de datos.
 * No confía en nombres de roles enviados por Angular.
 * Ninguna operación general puede asignar SuperAdmin.
 */

const getValidatedRoleIds = async (
  requestedRoles,
  db = pool,
  canAssignSuperAdmin = false
) => {
  if (!Array.isArray(requestedRoles)) {
    const error = new Error('Roles must be provided as an array');
    error.statusCode = 400;
    throw error;
  }

  const roleIds = [];

  for (const value of requestedRoles) {
    const roleId =
      typeof value === 'number'
        ? value
        : typeof value === 'string' && /^\d+$/.test(value.trim())
          ? Number(value)
          : NaN;

    if (!Number.isSafeInteger(roleId) || roleId <= 0) {
      const error = new Error('Invalid role ID');
      error.statusCode = 400;
      throw error;
    }

    if (!roleIds.includes(roleId)) {
      roleIds.push(roleId);
    }
  }

  if (roleIds.length === 0) {
    return [];
  }

  const result = await db.query(
    `
      SELECT id_role, role_name
      FROM auth.roles
      WHERE id_role = ANY($1::integer[])
    `,
    [roleIds]
  );

  if (result.rows.length !== roleIds.length) {
    const error = new Error('One or more roles do not exist');
    error.statusCode = 400;
    throw error;
  }

  const hasSuperAdmin = result.rows.some(
    row => normalize(row.role_name) === normalize(SUPER_ADMIN_ROLE_NAME)
  );

  if (hasSuperAdmin && !canAssignSuperAdmin) {
    const error = new Error(
      'Only the primary SuperAdmin can assign the SuperAdmin role'
    );
    error.statusCode = 403;
    throw error;
  }

  return result.rows.map(row => Number(row.id_role));
};


const sendControllerError = (res, err, fallbackMessage) => {
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      message: err.message
    });
  }

  if (err.code === '23505') {
    return res.status(409).json({
      message: 'A record with this information already exists'
    });
  }

  console.error(fallbackMessage, err);

  return res.status(500).json({
    message: fallbackMessage
  });
};

/**
 * Lista usuarios.
 * Committee no ve cuentas protegidas.
 * El SuperAdmin principal puede consultar la lista completa.
 */
const getUsersWithRoles = async (req, res) => {
  try {
    const access = await getAdminAccess(req, res);
    if (!access) return;

    const result = await pool.query(
      `
      SELECT
        u.id_user,
        u.username,
        u.email,
        u.is_active,
        u.is_verified,
        c.name,
        m.photo_permission,
        m.community_preference,
        m.created_at,
        ms.membership_type,
        ms.start_date,
        ms.end_date,
        ms.status AS membership_status,
        ARRAY_REMOVE(
          ARRAY_AGG(DISTINCT r.role_name),
          NULL
        ) AS roles
      FROM auth.users u
      LEFT JOIN auth.user_roles ur
        ON ur.id_user = u.id_user
      LEFT JOIN auth.roles r
        ON r.id_role = ur.id_role
      LEFT JOIN contacts.contacts c
        ON c.id_contact = u.id_contact
      LEFT JOIN membership.membership_forms m
        ON m.id_contact = c.id_contact
      LEFT JOIN membership.memberships ms
        ON ms.id_contact = c.id_contact
       AND ms.status = 'active'
      WHERE (
        $1::boolean = TRUE
        OR (
          u.id_user <> $2
          AND NOT EXISTS (
            SELECT 1
            FROM auth.user_roles protected_ur
            INNER JOIN auth.roles protected_r
              ON protected_r.id_role = protected_ur.id_role
            WHERE protected_ur.id_user = u.id_user
              AND LOWER(TRIM(protected_r.role_name)) =
                  LOWER($3)
          )
        )
      )
      GROUP BY
        u.id_user,
        u.username,
        u.email,
        u.is_active,
        u.is_verified,
        c.name,
        m.photo_permission,
        m.community_preference,
        m.created_at,
        ms.membership_type,
        ms.start_date,
        ms.end_date,
        ms.status
      ORDER BY u.id_user DESC
      `,
      [
        access.isSuperAdmin,
        SUPER_ADMIN_USER_ID,
        SUPER_ADMIN_ROLE_NAME
      ]
    );

    return res.json(result.rows);
  } catch (err) {
    return sendControllerError(
      res,
      err,
      'Failed to load users'
    );
  }
};

/**
 * Obtiene un usuario por ID conservando los datos
 * de membresía, pagos e intereses de voluntariado.
 */
const getUserById = async (req, res) => {
  try {
    const access = await getAdminAccess(req, res);
    if (!access) return;

    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: 'Invalid user ID'
      });
    }

    if (
      !access.isSuperAdmin &&
      await rejectProtectedTarget(id, res)
    ) {
      return;
    }

    const userResult = await pool.query(
      `
      SELECT
        c.name,
        c.phone_number,
        c.emergency_contact,
        c.photo_url,
        u.id_user,
        u.username,
        u.email,
        u.is_verified,
        u.is_active,
        u.id_contact,
        ARRAY_REMOVE(
          ARRAY_AGG(DISTINCT r.role_name),
          NULL
        ) AS roles
      FROM auth.users u
      LEFT JOIN auth.user_roles ur
        ON ur.id_user = u.id_user
      LEFT JOIN auth.roles r
        ON r.id_role = ur.id_role
      LEFT JOIN contacts.contacts c
        ON c.id_contact = u.id_contact
      WHERE u.id_user = $1
      GROUP BY
        u.id_user,
        c.name,
        c.phone_number,
        c.emergency_contact,
        c.photo_url
      `,
      [Number(id)]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];

    let job_roles = [];
    let membership = null;
    let payment = null;
    let paymentHistory = [];
    let paymentMemberships = [];

    if (user.id_contact) {
      const [
        jobRolesResult,
        membershipResult,
        paymentResult,
        paymentHistoryResult,
        paymentMembershipsResult
      ] = await Promise.all([
        pool.query(
          `
          SELECT id_job_role
          FROM contacts.contact_job_role
          WHERE id_contact = $1
          `,
          [user.id_contact]
        ),

        pool.query(
          `
          SELECT
            age_range,
            photo_permission,
            community_preference,
            wants_to_volunteer,
            acknowledged_rules,
            acknowledged_privacy,
            acknowledged_code_of_conduct,
            acknowledged_health_safety,
            volunteer_acknowledgement,
            created_at
          FROM membership.membership_forms
          WHERE id_contact = $1
          `,
          [user.id_contact]
        ),

        pool.query(
          `
          SELECT
            amount,
            currency,
            payment_status,
            payment_method,
            membership_year,
            paid_at,
            paypal_order_id,
            paypal_capture_id
          FROM membership.payments
          WHERE id_contact = $1
          ORDER BY paid_at DESC
          LIMIT 1
          `,
          [user.id_contact]
        ),

        pool.query(
          `
          SELECT
            id_payment,
            amount,
            currency,
            payment_status,
            payment_method,
            membership_year,
            paid_at
          FROM membership.payments
          WHERE id_contact = $1
          ORDER BY paid_at DESC
          `,
          [user.id_contact]
        ),

        pool.query(
          `
          SELECT
            membership_type,
            start_date,
            end_date,
            status AS membership_status
          FROM membership.memberships
          WHERE id_contact = $1
          `,
          [user.id_contact]
        )
      ]);

      job_roles = jobRolesResult.rows.map(
        row => row.id_job_role
      );

      membership = membershipResult.rows[0] || null;
      payment = paymentResult.rows[0] || null;
      paymentHistory = paymentHistoryResult.rows;
      paymentMemberships = paymentMembershipsResult.rows;
    }

    return res.json({
      id_user: user.id_user,
      username: user.username,
      name: user.name,
      phone_number: user.phone_number,
      email: user.email,
      is_active: user.is_active,
      is_verified: user.is_verified,
      roles: user.roles,
      emergency_contact: user.emergency_contact,
      photo_url: user.photo_url,
      job_roles,
      membership,
      payment,
      paymentHistory,
      paymentMemberships
    });
  } catch (err) {
    return sendControllerError(
      res,
      err,
      'Failed to get user'
    );
  }
};

/**
 * Crea un usuario y sus relaciones en una transacción.
 */
const createUser = async (req, res) => {
  try {
    const access = await getAdminAccess(req, res);

    if (!access) return;
  } catch (err) {
    return sendControllerError(
      res,
      err,
      'Failed to authorize user creation'
    );
  }
  const {
    name,
    phone_number,
    username,
    email,
    password,
    roles = [],
    job_roles = []
  } = req.body;

  if (
    !name ||
    !username ||
    !email ||
    !password ||
    !Array.isArray(job_roles)
  ) {
    return res.status(400).json({
      message: 'Required user fields are missing or invalid'
    });
  }

  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({
      message: 'Password must contain at least 8 characters'
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

 const validRoleIds = await getValidatedRoleIds(
   roles,
   client,
   false
 );

    const existing = await client.query(
      `
      SELECT 1
      FROM auth.users
      WHERE LOWER(email) = LOWER($1)
      `,
      [email]
    );

    if (existing.rowCount > 0) {
      await client.query('ROLLBACK');

      return res.status(409).json({
        error: 'Email is already in use'
      });
    }

    const contactResult = await client.query(
      `
      INSERT INTO contacts.contacts (
        name,
        email,
        phone_number,
        type
      )
      VALUES ($1, $2, $3, 'Person')
      RETURNING id_contact
      `,
      [name, email, phone_number || null]
    );

    const id_contact = contactResult.rows[0].id_contact;
    const hash = await bcrypt.hash(password, 10);

    const userResult = await client.query(
      `
      INSERT INTO auth.users (
        username,
        email,
        password_hash,
        is_active,
        id_contact,
        is_verified
      )
      VALUES ($1, $2, $3, '1', $4, TRUE)
      RETURNING id_user
      `,
      [username, email, hash, id_contact]
    );

    const userId = userResult.rows[0].id_user;

    for (const roleId of validRoleIds) {
      await client.query(
        `
        INSERT INTO auth.user_roles (id_user, id_role)
        VALUES ($1, $2)
        `,
        [userId, roleId]
      );
    }

    const volunteerRoleResult = await client.query(
      `
      SELECT id_role
      FROM auth.roles
      WHERE LOWER(TRIM(role_name)) = 'volunteer'
      `
    );

    const volunteerRoleId =
      volunteerRoleResult.rows[0]?.id_role;

    const isVolunteer =
      volunteerRoleId !== undefined &&
      validRoleIds.includes(Number(volunteerRoleId));

    if (isVolunteer) {
      for (const jobId of job_roles) {
        if (!isValidId(jobId)) {
          const error = new Error('Invalid job role ID');
          error.statusCode = 400;
          throw error;
        }

        await client.query(
          `
          INSERT INTO contacts.contact_job_role (
            id_contact,
            id_job_role
          )
          VALUES ($1, $2)
          `,
          [id_contact, Number(jobId)]
        );
      }
    }

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'User created successfully'
    });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }

    return sendControllerError(
      res,
      err,
      'Failed to create user'
    );
  } finally {
    client?.release();
  }
};

/**
 * Actualiza usuario, roles y funciones de voluntariado
 * en una única transacción.
 */
const updateUser = async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({
      message: 'Invalid user ID'
    });
  }

  const {
    name,
    phone_number,
    username,
    email,
    roles = [],
    job_roles = []
  } = req.body;

  if (
    !name ||
    !username ||
    !email ||
    !Array.isArray(job_roles)
  ) {
    return res.status(400).json({
      message: 'Required user fields are missing or invalid'
    });
  }

  let client;

  try {
    const access = await getAdminAccess(req, res);
    if (!access) return;

    client = await pool.connect();
    await client.query('BEGIN');

    const targetResult = await client.query(
      `
      SELECT id_user, id_contact
      FROM auth.users
      WHERE id_user = $1
      FOR UPDATE
      `,
      [Number(id)]
    );

    if (targetResult.rowCount === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        message: 'User not found'
      });
    }

    const targetRoles = await getUserRoles(
      Number(id),
      client
    );

    if (
      Number(id) === SUPER_ADMIN_USER_ID ||
      hasRole(targetRoles, SUPER_ADMIN_ROLE_NAME)
    ) {
      await client.query('ROLLBACK');

      return res.status(403).json({
        message: 'This account is protected'
      });
    }

  const validRoleIds = await getValidatedRoleIds(
    roles,
    client,
    access.isSuperAdmin
  );

    const id_contact = targetResult.rows[0].id_contact;

    if (!id_contact) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        message: 'User does not have a linked contact'
      });
    }

    const existing = await client.query(
      `
      SELECT 1
      FROM auth.users
      WHERE LOWER(email) = LOWER($1)
        AND id_user <> $2
      `,
      [email, Number(id)]
    );

    if (existing.rowCount > 0) {
      await client.query('ROLLBACK');

      return res.status(409).json({
        message: 'Email is already in use'
      });
    }

    await client.query(
      `
      UPDATE auth.users
      SET username = $1, email = $2
      WHERE id_user = $3
      `,
      [username, email, Number(id)]
    );

    await client.query(
      `
      UPDATE contacts.contacts
      SET
        name = $1,
        phone_number = $2,
        email = $3
      WHERE id_contact = $4
      `,
      [name, phone_number || null, email, id_contact]
    );

    await client.query(
      `
      DELETE FROM auth.user_roles
      WHERE id_user = $1
      `,
      [Number(id)]
    );

    for (const roleId of validRoleIds) {
      await client.query(
        `
        INSERT INTO auth.user_roles (id_user, id_role)
        VALUES ($1, $2)
        `,
        [Number(id), roleId]
      );
    }

    const volunteerRoleResult = await client.query(
      `
      SELECT id_role
      FROM auth.roles
      WHERE LOWER(TRIM(role_name)) = 'volunteer'
      `
    );

    const volunteerRoleId =
      volunteerRoleResult.rows[0]?.id_role;

    const isVolunteer =
      volunteerRoleId !== undefined &&
      validRoleIds.includes(Number(volunteerRoleId));

    await client.query(
      `
      DELETE FROM contacts.contact_job_role
      WHERE id_contact = $1
      `,
      [id_contact]
    );

    if (isVolunteer) {
      for (const jobId of job_roles) {
        if (!isValidId(jobId)) {
          const error = new Error('Invalid job role ID');
          error.statusCode = 400;
          throw error;
        }

        await client.query(
          `
          INSERT INTO contacts.contact_job_role (
            id_contact,
            id_job_role
          )
          VALUES ($1, $2)
          `,
          [id_contact, Number(jobId)]
        );
      }
    }

    await client.query('COMMIT');

    return res.json({
      message: 'User updated successfully'
    });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }

    return sendControllerError(
      res,
      err,
      'Failed to update user'
    );
  } finally {
    client?.release();
  }
};

/**
 * Autoriza la operación y protege la cuenta objetivo.
 */
const authorizeUserModification = async (req, res) => {
  const access = await getAdminAccess(req, res);

  if (!access) {
    return null;
  }

  const { id } = req.params;

  if (!isValidId(id)) {
    res.status(400).json({
      message: 'Invalid user ID'
    });

    return null;
  }

  const target = await pool.query(
    `
    SELECT id_user
    FROM auth.users
    WHERE id_user = $1
    `,
    [Number(id)]
  );

  if (target.rowCount === 0) {
    res.status(404).json({
      message: 'User not found'
    });

    return null;
  }

  if (await rejectProtectedTarget(id, res)) {
    return null;
  }

  return {
    access,
    userId: Number(id)
  };
};

const setUserFlag = async (
  req,
  res,
  column,
  value,
  successMessage,
  errorMessage
) => {
  let client;

  try {
    const authorization =
      await authorizeUserModification(req, res);

    if (!authorization) return;

    client = await pool.connect();
    await client.query('BEGIN');

    // Revalidar la cuenta protegida dentro de la transacción.
    const target = await client.query(
      `
      SELECT id_user
      FROM auth.users
      WHERE id_user = $1
      FOR UPDATE
      `,
      [authorization.userId]
    );

    if (target.rowCount === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        message: 'User not found'
      });
    }

    const targetRoles = await getUserRoles(
      authorization.userId,
      client
    );

    if (
      authorization.userId === SUPER_ADMIN_USER_ID ||
      hasRole(targetRoles, SUPER_ADMIN_ROLE_NAME)
    ) {
      await client.query('ROLLBACK');

      return res.status(403).json({
        message: 'This account is protected'
      });
    }

    // column procede únicamente de las funciones internas.
    await client.query(
      `UPDATE auth.users SET ${column} = $1 WHERE id_user = $2`,
      [value, authorization.userId]
    );

    await client.query('COMMIT');

    return res.json({
      message: successMessage
    });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }

    return sendControllerError(res, err, errorMessage);
  } finally {
    client?.release();
  }
};

const deactivateUser = async (req, res) =>
  setUserFlag(
    req, res, 'is_active', '0',
    'User deactivated',
    'Failed to deactivate user'
  );

const activateUser = async (req, res) =>
  setUserFlag(
    req, res, 'is_active', '1',
    'User activated',
    'Failed to activate user'
  );

const notVerifiedMail = (req, res) =>
  setUserFlag(
    req,
    res,
    'is_verified',
    false,
    'Email marked as not verified',
    'Failed to update email verification'
  );

const verifiedMail = (req, res) =>
  setUserFlag(
    req,
    res,
    'is_verified',
    true,
    'Email verified successfully',
    'Failed to verify email'
  );

module.exports = {
  getUsersWithRoles,
  getUsers: getUsersWithRoles,
  getUserById,
  getUser: getUserById,
  createUser,
  updateUser,
  deactivateUser,
  activateUser,
  notVerifiedMail,
  verifiedMail,
  getAdminAccess,
  authorizeUserModification,
  getUserRoles,
  hasRole,
  isSuperAdminAccount
};
