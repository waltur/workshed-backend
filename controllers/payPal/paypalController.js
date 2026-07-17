const axios = require('axios');
const { getAccessToken } = require('../../services/paypalService');

const createOrder = async (req, res) => {

  try {

    const { amount } = req.body;

    const token = await getAccessToken();

    const response = await axios.post(
      `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'AUD',
              value: amount
            }
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    res.json(response.data);

  } catch (error) {
    console.error(error.response?.data || error);
    res.status(500).json({ error: 'Unable to create order' });
  }
};

const captureOrder = async (req, res) => {

  try {

    const { orderID } = req.body;

    const token = await getAccessToken();

    const response = await axios.post(
      `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders/${orderID}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const paypalData = response.data;
    console.log("========== PAYPAL RESPONSE ==========");
    console.dir(paypalData, { depth: null });
    console.log(JSON.stringify(paypalData, null, 2));
    console.log(
      paypalData.purchase_units[0].payments.captures[0]
    );
    console.log("====================================");

    if (paypalData.status !== 'COMPLETED') {
      return res.status(400).json({
        error: 'Payment not completed'
      });
    }

    const capture =
      paypalData.purchase_units[0]
      .payments
      .captures[0];
    if (!capture) {
         return res.status(400).json({
        error: 'Capture information not found.'
        });
    }
    /*await pool.query(
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
        membership_year
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,NOW(),$7)
      `,
      [
        id_contact,
        capture.amount.value,
        capture.amount.currency_code,
        'completed',
        paypalData.id,
        capture.id,
        new Date().getFullYear()
      ]
    );*/

    res.json({
      success: true,
        status: paypalData.status,
        orderID: paypalData.id,
        captureID: capture.id,
        amount: capture.amount.value,
        currency: capture.amount.currency_code
    });

  } catch (error) {

    console.error(error.response?.data || error);

    res.status(500).json({
      error: 'Capture failed'
    });
  }
};

module.exports = {
  createOrder, captureOrder
};