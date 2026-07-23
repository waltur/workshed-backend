const pool = require('../../db');

const getMembersReport = async (req, res) => {

    try {

        //------------------------------------------------------
        // SUMMARY
        //------------------------------------------------------

        const summaryResult = await pool.query(`

        WITH payments_summary AS (

            SELECT
                id_contact,
                MAX(CASE WHEN payment_status = 'completed' THEN 1 ELSE 0 END) AS paid_member,
                SUM(CASE WHEN payment_status = 'completed' THEN amount ELSE 0 END) AS membership_revenue
            FROM membership.payments
            GROUP BY id_contact

        ),

        roles_summary AS (

            SELECT
                ur.id_user,
                MAX(CASE WHEN r.role_name = 'Volunteer' THEN 1 ELSE 0 END) AS volunteer
            FROM auth.user_roles ur
            INNER JOIN auth.roles r
                ON r.id_role = ur.id_role
            GROUP BY ur.id_user

        ),

        forms_summary AS (

            SELECT
                id_contact,
                MAX(CASE WHEN wants_to_volunteer THEN 1 ELSE 0 END) AS wants_to_volunteer,
                MAX(CASE WHEN photo_permission THEN 1 ELSE 0 END) AS photo_permission,
                MAX(CASE WHEN community_preference = 'Newsletter' THEN 1 ELSE 0 END) AS newsletter_member,
                MAX(CASE WHEN community_preference = 'WhatsApp' THEN 1 ELSE 0 END) AS whatsapp_member
            FROM membership.membership_forms
            GROUP BY id_contact

        )

        SELECT

            COUNT(*) AS total_members,

            SUM(CASE WHEN u.is_active = '1' THEN 1 ELSE 0 END) AS active_members,

            SUM(CASE WHEN u.is_active = '0' THEN 1 ELSE 0 END) AS inactive_members,

            SUM(CASE WHEN u.is_verified THEN 1 ELSE 0 END) AS verified_members,

            COALESCE(SUM(rs.volunteer),0) AS volunteers,

            COALESCE(SUM(ps.paid_member),0) AS paid_members,

            COALESCE(SUM(fs.wants_to_volunteer),0) AS wants_to_volunteer,

            COALESCE(SUM(fs.photo_permission),0) AS photo_permission,

            COALESCE(SUM(fs.newsletter_member),0) AS newsletter_members,

            COALESCE(SUM(fs.whatsapp_member),0) AS whatsapp_members,

            COALESCE(SUM(ps.membership_revenue),0) AS membership_revenue

        FROM auth.users u

        LEFT JOIN payments_summary ps
            ON ps.id_contact = u.id_contact

        LEFT JOIN roles_summary rs
            ON rs.id_user = u.id_user

        LEFT JOIN forms_summary fs
            ON fs.id_contact = u.id_contact;

        `);

        //------------------------------------------------------
        // MEMBERS
        //------------------------------------------------------

        const membersResult = await pool.query(`

            SELECT

                u.id_user,
                c.name,
                u.username,
                u.email,
                c.phone_number,
                c.photo_url,
                u.is_active,
                u.is_verified,

                ARRAY_REMOVE(
                    ARRAY_AGG(DISTINCT r.role_name),
                    NULL
                ) AS roles,

                MAX(p.payment_status) AS payment_status,

                MAX(p.amount) AS membership_amount,

                MAX(p.currency) AS currency,

                MAX(p.paid_at) AS paid_at,

                MAX(m.start_date) AS membership_start,

                MAX(m.end_date) AS membership_end,

                MAX(m.status) AS membership_status
                ,

                COUNT(DISTINCT CASE
                    WHEN mf.wants_to_volunteer
                    THEN u.id_user
                END) AS wants_to_volunteer,

                COUNT(DISTINCT CASE
                    WHEN mf.photo_permission
                    THEN u.id_user
                END) AS photo_permission,

                COUNT(DISTINCT CASE
                    WHEN mf.community_preference='Newsletter'
                    THEN u.id_user
                END) AS newsletter_members,

                COUNT(DISTINCT CASE
                    WHEN mf.community_preference='WhatsApp'
                    THEN u.id_user
                END) AS whatsapp_members

            FROM auth.users u

            LEFT JOIN contacts.contacts c
                ON c.id_contact = u.id_contact

            LEFT JOIN auth.user_roles ur
                ON ur.id_user = u.id_user

            LEFT JOIN auth.roles r
                ON r.id_role = ur.id_role

            LEFT JOIN membership.payments p
                ON p.id_contact = u.id_contact

            LEFT JOIN membership.memberships m
            ON m.id_contact = u.id_contact
            AND m.status = 'active'

            LEFT JOIN membership.membership_forms mf
            ON mf.id_contact=u.id_contact

            GROUP BY

                u.id_user,
                u.username,
                u.email,
                u.is_active,
                u.is_verified,
                c.name,
                c.phone_number,
                c.photo_url

            ORDER BY c.name ASC;

        `);

        //------------------------------------------------------
        // AGE DISTRIBUTION
        //------------------------------------------------------

        const ageDistributionResult = await pool.query(`

            SELECT

                age_range AS name,

                COUNT(*)::int AS value

            FROM membership.membership_forms

            GROUP BY age_range

            ORDER BY age_range;

        `);

        //------------------------------------------------------
        // COMMUNITY PREFERENCE
        //------------------------------------------------------

        const communityPreferenceResult = await pool.query(`

            SELECT

                community_preference AS name,

                COUNT(*)::int AS value

            FROM membership.membership_forms

            GROUP BY community_preference

            ORDER BY community_preference;

        `);
        //------------------------------------------------------
        // PAYMENT STATUS
        //------------------------------------------------------

    const paymentStatusResult = await pool.query(`

        SELECT

            payment_status AS name,

            COUNT(*)::int AS value

        FROM membership.payments

        GROUP BY payment_status

        ORDER BY payment_status;

    `);

    //------------------------------------------------------
    // REVENUE BY YEAR
    //------------------------------------------------------

    const revenueByYearResult = await pool.query(`

        SELECT

            membership_year::text AS name,

            SUM(amount)::numeric(10,2) AS value

        FROM membership.payments

        WHERE payment_status='completed'

        GROUP BY membership_year

        ORDER BY membership_year;

    `);

        res.json({

              summary: summaryResult.rows[0],

              members: membersResult.rows,

              charts:{

                  ageDistribution:
                      ageDistributionResult.rows,

                  communityPreference:
                      communityPreferenceResult.rows,

                  paymentStatus:
                      paymentStatusResult.rows,

                  revenueByYear:
                      revenueByYearResult.rows

              }

        });

    }
    catch (err) {

        console.error(err);

        res.status(500).json({

            error: 'Unable to generate report.'

        });

    }

};

module.exports = {

    getMembersReport

};