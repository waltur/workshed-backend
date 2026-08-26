const axios = require('axios');
const { getAccessToken } = require('../../services/paypalService');
const pool = require('../../db');

const createOrder = async (req, res) => {

  try {

    const { amount } = req.body;

    const token = await getAccessToken();
    const now = new Date();
    const currentYear = now.getFullYear();
    const membershipName = `Annual Membership ${currentYear}`;
    const validUntil =  `31 January ${currentYear + 1}`;
    const invoiceId = `WS-${new Date().getFullYear()}-${Date.now()}`;
    const handlingFee = Number(process.env.MEMBERSHIP_HANDLING_FEE);
    const total = Number(amount) + handlingFee;

    const response = await axios.post(
      `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders`,
      {
        intent: "CAPTURE",

        purchase_units: [
          {

            reference_id: "membership",

            invoice_id: invoiceId,

            description: `Annual Membership ${currentYear} - The Workshed Inner West Inc.`,

            amount: {

              currency_code: "AUD",

              value: total.toFixed(2),

              breakdown: {

                item_total: {

                  currency_code: "AUD",

                  value: Number(amount).toFixed(2)

                },

                handling: {

                  currency_code: "AUD",

                  value: handlingFee.toFixed(2)

                }

              }

            },

            items: [
              {

                name: membershipName,

                description: `Membership valid until ${validUntil}`,

                sku: `MEMBERSHIP-${currentYear}`,

                quantity: "1",

                category: "DIGITAL_GOODS",

                unit_amount: {

                  currency_code: "AUD",

                  value: Number(amount).toFixed(2)

                }

              }
            ]

          }
        ]

      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json(response.data);

  } catch (error) {

    console.error(error.response?.data || error);

    res.status(500).json({
      error: "Unable to create order"
    });

  }

};
const captureRegistrationOrder = async (req, res) => {

  const client = await pool.connect();

  try {

    const {
      orderID
    } = req.body;


    // ============================================
    // VALIDAR ORDER ID
    // ============================================

    if (!orderID) {

      return res.status(400).json({
        error: 'PayPal order ID is required'
      });

    }


    console.log('====================================');
    console.log('NEW USER MEMBERSHIP PAYMENT');
    console.log('PayPal Order:', orderID);
    console.log('====================================');


    // ============================================
    // PAYPAL ACCESS TOKEN
    // ============================================

    const token =
      await getAccessToken();


    // ============================================
    // CAPTURE PAYPAL
    // ============================================

    const response =
      await axios.post(
        `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders/${orderID}/capture`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );


    const paypalData =
      response.data;


    console.log(
      '========== PAYPAL REGISTRATION RESPONSE =========='
    );

    console.dir(
      paypalData,
      { depth: null }
    );

    console.log(
      '=================================================='
    );


    // ============================================
    // VALIDAR ESTADO
    // ============================================

    if (
      paypalData.status !== 'COMPLETED'
    ) {

      return res.status(400).json({
        error: 'Payment not completed',
        status: paypalData.status
      });

    }


    // ============================================
    // OBTENER CAPTURE
    // ============================================

    const capture =
      paypalData
        .purchase_units?.[0]
        ?.payments?.captures?.[0];


    if (!capture) {

      return res.status(400).json({
        error: 'Capture information not found'
      });

    }


    const captureID =
      capture.id;


    const paypalOrderID =
      paypalData.id;


    const amount =
      Number(
        capture.amount.value
      );


    const currency =
      capture.amount.currency_code;


    // ============================================
    // VALIDAR CURRENCY
    // ============================================

    if (currency !== 'AUD') {

      return res.status(400).json({
        error: 'Invalid payment currency'
      });

    }


    // ============================================
    // VALIDAR MONTO
    // ============================================

    const MEMBERSHIP_AMOUNT =
      Number(
        process.env.MEMBERSHIP_AMOUNT || 1
      );

    const handlingFee =
      Number(
        process.env.MEMBERSHIP_HANDLING_FEE || 0
      );

    const expectedAmount =
      MEMBERSHIP_AMOUNT +
      handlingFee;


    if (
      Math.abs(
        amount - expectedAmount
      ) > 0.01
    ) {

      console.error(
        'Invalid PayPal amount:',
        {
          received: amount,
          expected: expectedAmount
        }
      );

      return res.status(400).json({
        error: 'Invalid payment amount'
      });

    }


    // ============================================
    // EVITAR PAGO DUPLICADO
    // ============================================

    const existingPayment =
      await client.query(
        `
        SELECT
          id_payment,
          id_contact,
          payment_status
        FROM membership.payments
        WHERE paypal_capture_id = $1
           OR paypal_order_id = $2
        `,
        [
          captureID,
          paypalOrderID
        ]
      );


    if (
      existingPayment.rows.length > 0
    ) {

      return res.status(409).json({
        error:
          'This PayPal payment has already been processed'
      });

    }


    // ============================================
    // NO GUARDAMOS MEMBERSHIP TODAVÍA
    // ============================================
    //
    // Aquí solamente confirmamos que PayPal
    // capturó correctamente el pago.
    //
    // El register() será quien:
    //
    // CONTACT
    // USER
    // ROLES
    // PAYMENT
    // MEMBERSHIP
    //
    // ============================================


    return res.json({

      success: true,

      status:
        paypalData.status,

      orderID:
        paypalOrderID,

      captureID,

      amount,

      currency

    });


  } catch (error) {

    console.error(
      'Registration PayPal capture error:',
      error.response?.data ||
      error.message ||
      error
    );


    return res.status(
      error.response?.status || 500
    ).json({

      error:
        error.response?.data?.message ||
        'Membership payment failed'

    });


  } finally {

    client.release();

  }

};

const captureOrder = async (req, res) => {

  const client = await pool.connect();

  try {

    const { orderID } = req.body;

    if (!orderID) {
      return res.status(400).json({
        error: 'PayPal order ID is required'
      });
    }

    // ============================================
    // USUARIO AUTENTICADO
    // ============================================

    const id_contact = req.user?.contact_id;
    const id_user = req.user?.id;

    if (!id_contact) {
      return res.status(401).json({
        error: 'User contact information not found'
      });
    }

    console.log('====================================');
    console.log('MEMBERSHIP PAYMENT');
    console.log('User:', id_user);
    console.log('Contact:', id_contact);
    console.log('PayPal Order:', orderID);
    console.log('====================================');


    // ============================================
    // PAYPAL ACCESS TOKEN
    // ============================================

    const token = await getAccessToken();


    // ============================================
    // CAPTURE PAYPAL
    // ============================================

    const response = await axios.post(
      `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders/${orderID}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );


    const paypalData = response.data;


    console.log(
      '========== PAYPAL RESPONSE =========='
    );

    console.dir(
      paypalData,
      { depth: null }
    );

    console.log(
      '===================================='
    );


    // ============================================
    // VALIDAR ESTADO
    // ============================================

    if (paypalData.status !== 'COMPLETED') {

      return res.status(400).json({
        error: 'Payment not completed',
        status: paypalData.status
      });

    }


    // ============================================
    // OBTENER CAPTURE
    // ============================================

    const capture =
      paypalData.purchase_units?.[0]
        ?.payments?.captures?.[0];


    if (!capture) {

      return res.status(400).json({
        error: 'Capture information not found'
      });

    }


    const captureID = capture.id;
    const paypalOrderID = paypalData.id;

    const amount =
      Number(capture.amount.value);

    const currency =
      capture.amount.currency_code;


    // ============================================
    // EVITAR PAGO DUPLICADO
    // ============================================

    const existingPayment = await client.query(
      `
      SELECT
        id_payment,
        id_contact,
        payment_status
      FROM membership.payments
      WHERE paypal_capture_id = $1
         OR paypal_order_id = $2
      `,
      [
        captureID,
        paypalOrderID
      ]
    );


    if (existingPayment.rows.length > 0) {

      console.log(
        'Payment already exists:',
        existingPayment.rows[0]
      );

      return res.status(409).json({
        error: 'This PayPal payment has already been processed'
      });

    }


    // ============================================
    // FECHAS DE MEMBRESÍA
    // ============================================

    const startDate = new Date();

    const endDate = new Date(startDate);

    endDate.setFullYear(
      endDate.getFullYear() + 1
    );


    // ============================================
    // TRANSACCIÓN
    // ============================================

    await client.query('BEGIN');


    // ============================================
    // GUARDAR PAYMENT
    // ============================================

    const paymentResult = await client.query(
      `
      INSERT INTO membership.payments
      (
        id_contact,
        amount,
        currency,
        payment_status,
        paypal_order_id,
        paypal_capture_id,
        paid_at,
        membership_year,
        payment_provider,
        payment_type,
        payment_method,
        created_by
      )
      VALUES
      (
        $1,
        $2,
        $3,
        'completed',
        $4,
        $5,
        NOW(),
        EXTRACT(YEAR FROM CURRENT_DATE),
        'paypal',
        'membership',
        'paypal',
        $6
      )
      RETURNING id_payment
      `,
      [
        id_contact,
        amount,
        currency,
        paypalOrderID,
        captureID,
        id_user
      ]
    );


    const id_payment =
      paymentResult.rows[0].id_payment;


    console.log(
      'Payment saved:',
      id_payment
    );


    // ============================================
    // CREAR MEMBERSHIP
    // ============================================

    const membershipResult = await client.query(
      `
      INSERT INTO membership.memberships
      (
        id_contact,
        id_payment,
        membership_type,
        start_date,
        end_date,
        status
      )
      VALUES
      (
        $1,
        $2,
        'Annual',
        $3,
        $4,
        'active'
      )
      RETURNING
        id_membership,
        start_date,
        end_date,
        status
      `,
      [
        id_contact,
        id_payment,
        startDate,
        endDate
      ]
    );


    const membership =
      membershipResult.rows[0];

    // ============================================
    // AGREGAR ROL MEMBER
    // ============================================

    const memberRoleResult = await client.query(
      `
      SELECT id_role
      FROM auth.roles
      WHERE (role_name) = 'Participant(member)'
      LIMIT 1
      `
    );

    if (!memberRoleResult.rows.length) {

      throw new Error(
        'Member role not found'
      );

    }

    const memberRoleId =
      memberRoleResult.rows[0].id_role;


    // ============================================
    // VERIFICAR SI YA TIENE MEMBER
    // ============================================

    const existingMemberRole =
      await client.query(
        `
        SELECT 1
        FROM auth.user_roles
        WHERE id_user = $1
          AND id_role = $2
        LIMIT 1
        `,
        [
          id_user,
          memberRoleId
        ]
      );


    // ============================================
    // INSERTAR MEMBER SI NO EXISTE
    // ============================================

    if (!existingMemberRole.rows.length) {

      await client.query(
        `
        INSERT INTO auth.user_roles
        (
          id_user,
          id_role
        )
        VALUES
        (
          $1,
          $2
        )
        `,
        [
          id_user,
          memberRoleId
        ]
      );

      console.log(
        '✅ Member role added to user:',
        id_user
      );

    } else {

      console.log(
        'ℹ️ User already has Member role:',
        id_user
      );

    }

    console.log(
      'Membership created:',
      membership
    );


    // ============================================
    // COMMIT
    // ============================================

    await client.query('COMMIT');


    // ============================================
    // RESPUESTA
    // ============================================

    res.json({

      success: true,

      status: paypalData.status,

      orderID: paypalOrderID,

      captureID,

      amount,

      currency,

      paymentID: id_payment,

      membership: {

        id_membership:
          membership.id_membership,

        start_date:
          membership.start_date,

        end_date:
          membership.end_date,

        status:
          membership.status

      }

    });


  } catch (error) {

    // ============================================
    // ROLLBACK
    // ============================================

    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error(
        'Rollback error:',
        rollbackError
      );
    }


    console.error(
      'Membership payment error:',
      error.response?.data || error
    );


    res.status(500).json({
      error: 'Membership payment failed'
    });


  } finally {

    client.release();

  }

};

module.exports = {
  createOrder, captureOrder, captureRegistrationOrder
};