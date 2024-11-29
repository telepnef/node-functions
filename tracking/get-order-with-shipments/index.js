"use strict";

import functions from "@google-cloud/functions-framework";
import { logErrorToGCP } from "./utils/GCPLogger.js";
import dotenv from "dotenv";
dotenv.config();

async function getOrder(orderId, orderNumber) {
  const requestUrl =
    orderId
      ? `/admin/api/2023-04/orders/${orderId}.json`
      : `/admin/api/2023-04/orders.json?name=${orderNumber}&status=any`;
  // Construct request URL
  const response = await fetch(
    `${
      process.env.HOST || "https://birdystaging.com/"
    }${requestUrl}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN,
      },
    }
  );
  let json = {};

  // Automatically parse JSON, don't parse html responses
  if (response.headers.get("content-type")?.includes("application/json")) {
    json = await response.json();
  }

  // Check for non-200 responses
  if (!response.ok) {
    const error = new Error(
      `Failed to get order from Shopify Admin API: HTTP ${response.status} ${response.statusText}`
    );
    error.response = json;
    error.response.statusCode = `${response.status}`;
    // Shopify supplied request id
    error.response.requestId = response.headers.get("x-request-id");
    throw error;
  }
  let order;
  if (orderNumber) {
    const { orders } = json;
    // Attempt to find the specific order in the response
    order = (orders && Array.isArray(orders)) ? orders.find(order => {
      return order.name == `#${orderNumber}`;
    }) : '';

    if (!order) {
      const error = new Error(
        `Order is undefined for Shopify order number: ${orderNumber}`
      );
      error.response = { orderNumber: orderNumber };
      throw error;
    }
  } else if (orderId) {
    order = json.order;

    if (!order) {
      const error = new Error(
        `Order is undefined for Shopify order id: ${orderId}`
      );
      error.response = { orderId: orderId };
      throw error;
    }
  }

  return order;
}

async function getOrderTransactions(id) {
  try {
    const response = await fetch(
      `${
        process.env.HOST || "https://birdystaging.com/"
      }/admin/api/2023-04/orders/${id}/transactions.json`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN,
        },
      }
    );
    const data = await response.json();

    return data.transactions;
  } catch (error) {
    console.error("Shopify :: Get Order Transactions :: Error:", error);
  }
}

async function getVariantDetails(id) {
  try {
    const response = await fetch(
      `${
        process.env.HOST || "https://birdystaging.com/"
      }/admin/api/2023-04/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN,
        },
        body: JSON.stringify({
          query: `
          query getProductImage {
            productVariant(id: "gid://shopify/ProductVariant/${id}") {
              image {
                url
              }
              product {
                handle
                images(first: 1) {
                  nodes {
                    url
                  }
                }
              }
            }
          }
        `,
        }),
      }
    );
    const { data } = await response.json();

    return {
      image_url: data?.productVariant?.image
        ? data?.productVariant?.image.url
        : data?.productVariant?.product?.images?.nodes[0]
          ? data?.productVariant?.product?.images?.nodes[0].url
          : null,
      handle: data?.productVariant?.product?.handle,
    };
  } catch (error) {
    console.error("Shopify :: Get Variant Image :: Error:", error);
  }
}

async function getTrackings(ids) {
  if (ids.length == 0 || !ids[0]) return;
  try {
    const response = await fetch(
      `https://api.aftership.com/v4/trackings?tracking_numbers=${ids.join(
        ","
      )}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "as-api-key": process.env.AFTERSHIP_API_KEY,
        },
      }
    );
    const { data } = await response.json();

    return data.trackings;
  } catch (error) {
    console.error("Aftership :: Get Trackings :: Error:", error);
  }
}

async function getUpdatedLineItems(line_items) {
  return line_items.map(async (item) => {
    const variant = await getVariantDetails(item.variant_id);
    return {
      ...item,
      image_url: variant.image_url,
      handle: variant.handle,
    };
  });
}

functions.http("main", async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");

  // Handle OPTIONS method for CORS preflight request
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "GET");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.set("Access-Control-Max-Age", "3600");
    res.status(204).send("");
    return;
  }

  try {
    // Check that the order number is present in the query params
    if (!req.query.number && !req.query.id) {
      throw new Error("Order number/id is missing in the request query");
    }

    // Attempt to get order with params
    let order = await getOrder(req.query.id, req.query.number);

    order = await getOrder(req.query.id, req.query.number);

    if (!order) {
      res.status(500).send({ status: 500, message: "We couldn't get the order" });
    }


    const transactions =
      req.query.email && order.email == req.query.email
        ? await getOrderTransactions(order.id)
        : "This authorized user doesn't have the order or it's a guest login";
    const trackings = await getTrackings(
      order.fulfillments.map((fulfillment) => fulfillment.tracking_number)
    );

    order.line_items = await Promise.all(
      await getUpdatedLineItems(order.line_items)
    );
    order.transactions = transactions
      ? transactions
      : "We couldn't get the order's transactions";
    order.shipments = trackings
      ? trackings
      : "The order doesn't have shipments yet";

    res.status(200).send({ status: 200, order });
  } catch (error) {
    // Log the error to GCP and also log to console for local visibility
    logErrorToGCP(process.env.GCP_PROJECT_ID, process.env.GCP_LOG_NAME, error);
    console.error(error);
    res
      .status(500)
      .send({ message: error.message, ...error.response, status: 500 });
  }
});