require("dotenv").config({
  path: `.env.${process.env.NODE_ENV}`,
})
const stripe = require("stripe")(process.env.GATSBY_STRIPE_SECRET_KEY)
const countryCodes = require("country-codes-list")
const fetch = require("node-fetch")

exports.handler = async ({ body, headers }) => {
  try {
    // check the webhook to make sure it’s valid
    const stripeEvent = stripe.webhooks.constructEvent(
      body,
      headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    )

    // only do stuff if this is a successful Stripe Checkout purchase
    if (stripeEvent.type === "payment_intent.succeeded") {
      const auth = Buffer.from(process.env.PRINTFUL_API_KEY).toString("base64")
      const countryCodesList = countryCodes.customList(
        "countryCode",
        "[{countryCode} ]{countryNameEn}"
      )
      const eventObject = stripeEvent.data.object
      const email = eventObject.receipt_email
      const { variant_id, quantity } = eventObject.metadata
      const shippingDetails = eventObject.shipping
      const { name, phone, address } = shippingDetails
      const { city, country, line1, line2, postal_code, state } = address
      const country_code = Object.keys(countryCodesList).filter(key =>
        countryCodesList[key].includes(country)
      )[0]

      fetch("https://api.printful.com/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          recipient: {
            name,
            address1: line1,
            address2: line2,
            city,
            state_code: state.toUpperCase(),
            state_name: state,
            country_code,
            country_name: country,
            zip: postal_code,
            phone,
            email,
          },
          items: [
            {
              variant_id,
              quantity,
              files: [
                {
                  url: "https://i.pinimg.com/originals/5a/30/20/5a3020152be9cc7487e6312b609a73a2.jpg",
                },
              ],
            },
          ],
          confirm: false,
        }),
      })
        .then(res => res.json())
        .then(data => console.log(data))
        .catch(error => console.log(error))
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    }
  } catch (err) {
    console.log(`Stripe webhook failed with ${err}`)

    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    }
  }
}
