const throng = require('throng');
const fetch = require("node-fetch");
const PORT = process.env.PORT || 3000;
const WORKERS = 4;

throng({
  master, start,
  count: WORKERS,
  lifetime: Infinity
});

function master() {
  console.log('Started master')

  process.once('beforeExit', () => {
    console.log('Master cleanup.')
  })
}

function start(id, disconnect) {

  console.log(`Started worker ${ id }`);
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  function shutdown() {
    console.log(`Worker ${ id } cleanup.`);
    disconnect();

  }

const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const crypto = require('crypto');
const cookie = require('cookie');
const nonce = require('nonce')();
const querystring = require("querystring");
const fetch = require('node-fetch');
const dotenv = require('dotenv').config();
const aftership = process.env.AFTERSHIP_STAGING;
const zendesk = process.env.ZENDESK_STAGING;
const shopify = process.env.ACCESS_TOKEN_STAGING;
const apiKey = process.env.SHOPIFY_KEY_STAGING;
const apiSecret = process.env.SHOPIFY_SECRET_STAGING;
const scopes = 'read_orders, read_products, read_customers';
const forwardingAddress = "https://3dd4-70-107-175-174.ngrok.io";

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/shopify', (req, res) => {
  const shop = req.query.shop;
  if (shop) {
    const state = nonce();
    const redirectUri = forwardingAddress + '/auth/callback';
    const installUrl = 'https://' + shop +
      '/admin/oauth/authorize?client_id=' + apiKey +
      '&scope=' + scopes +
      '&state=' + state +
      '&redirect_uri=' + redirectUri;

    res.cookie('state', state);
    res.redirect(installUrl);
  } else {
    return res.status(400).send('Missing shop parameter. Please add ?shop=your-development-shop.myshopify.com to your request');
  }
});

app.get('/auth/callback', (req, res) => {
  // console.log(req);
  const { shop, hmac, code, state } = req.query;
  const stateCookie = cookie.parse(req.headers.cookie).state;

  // console.log(req.headers);
  // console.log(state);
  // console.log(stateCookie);
/*
  if (state !== stateCookie) {
    return res.status(403).send('Request origin cannot be verified');
  }
*/
  if (shop && hmac && code) {
    // DONE: Validate request is from Shopify
    const map = Object.assign({}, req.query);
    delete map['signature'];
    delete map['hmac'];
    const message = querystring.stringify(map);
    const providedHmac = Buffer.from(hmac, 'utf-8');
    const generatedHash = Buffer.from(
      crypto
        .createHmac('sha256', apiSecret)
        .update(message)
        .digest('hex'),
        'utf-8'
      );
    let hashEquals = false;

    try {
      hashEquals = crypto.timingSafeEqual(generatedHash, providedHmac)
    } catch (e) {
      hashEquals = false;
    };

    if (!hashEquals) {
      return res.status(400).send('HMAC validation failed');
    }

    // DONE: Exchange temporary code for a permanent access token
    const accessTokenRequestUrl = 'https://' + shop + '/admin/oauth/access_token';
    const requestBody = querystring.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      code,
    });
    // console.log('CODE');
    // console.log(code);
    fetch(accessTokenRequestUrl, { method: 'POST', headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(requestBody),
        },
        body: requestBody })
    .then(res => res.json()).then((response) => {
    //  console.log(response);
      const accessToken = response.access_token;
      // UNCOMMENT THIS LINE TO SEE THE ACCESS TOKEN LOGGED TO CONSOLE
    //  console.log('ACCESS TOKEN');
  //  console.log(accessToken);
      // DONE: Use access token to make API call to 'shop' endpoint
      const shopRequestUrl = 'https://' + shop + '/admin/api/2020-04/shop.json';
      const shopRequestHeaders = {
        'X-Shopify-Access-Token': accessToken,
      };

      fetch(shopRequestUrl, { method: 'GET', headers: shopRequestHeaders })
      .then((shopResponse) => {
    //    console.log(shopResponse);
        res.status.end();
      })
      .catch((error) => {
    //    console.log(error);
        res.status(error.statusCode).end();
      });
    })
    .catch((error) => {
  //    console.log(error);
      res.status(error.statusCode).end();
    });

  } else {
    res.status(400).send('Required parameters missing');
  }
});

const getProducts = arr => {
  return new Promise(resolve => {
  let graphqlbody = ``;
  arr.forEach((id,index) => {
    graphqlbody += `product${index+1}: product(id: "gid://shopify/Product/${id}") {
      title
      featuredImage {
          src
      }
      handle
      productType
      tags
  }`
});
let graphql = JSON.stringify({
  query: `{${graphqlbody}}`
});

console.log(graphql)

  fetch(`https://birdy-grey-test-store.myshopify.com/admin/api/2022-04/graphql.json`, {
    method: 'POST',
    headers: {'X-Shopify-Access-Token': shopify, "Content-Type": "application/json"},
    body: graphql
  }).then(res => res.json()).then(response => {
    console.log(response);
    resolve(response);
  }).catch(err => {
    console.log(err);
    resolve(false);
  })
});
}
const updateCustomer = customer => {
  return new Promise(resolve => {
    let graphqlbody = `mutation customerUpdate($input: CustomerInput!) {
        customerUpdate(input: $input) {
          customer {
            id
            firstName
            lastName
            email
            note
            addresses(first: 3) {
              id
              address1
              address2
              city
              company
              country
              province
              firstName
              lastName
              zip
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
    let graphql = JSON.stringify({
      query: graphqlbody,
      variables: {
        input: {
          ...customer
        }
      }
    });

    fetch(`https://birdy-grey-test-store.myshopify.com/admin/api/2022-04/graphql.json`, {
      method: 'POST',
      headers: {'X-Shopify-Access-Token': shopify, "Content-Type": "application/json"},
      body: graphql
    }).then(res => res.json()).then(response => {
      console.log(response.data.customerUpdate);
      resolve(response);
    }).catch(err => {
      console.log(err);
      resolve(false);
    });
  });
};

const updateCustomerNewsletter = customer => {
  return new Promise(resolve => {
    let graphqlbody = `mutation customerEmailMarketingConsentUpdate($input: CustomerEmailMarketingConsentUpdateInput!) {
      customerEmailMarketingConsentUpdate(input: $input) {
        customer {
          id
          firstName
          lastName
          emailMarketingConsent {
            marketingState
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
    let graphql = JSON.stringify({
      query: graphqlbody,
      variables: {
        input: {
          ...customer
        }
      }
    });

    fetch(`https://birdy-grey-test-store.myshopify.com/admin/api/2022-04/graphql.json`, {
      method: 'POST',
      headers: {'X-Shopify-Access-Token': shopify, "Content-Type": "application/json"},
      body: graphql
    }).then(res => res.json()).then(response => {
      console.log(response.data);
      resolve(response);
    }).catch(err => {
      console.log(err);
      resolve(false);
    });
  });
};

const getCustomer = id => {
  return new Promise(resolve => {
    let graphqlBody = `Customer: customer(id: "gid://shopify/Customer/${id}") {
      id
      firstName
      lastName
      note
      emailMarketingConsent {
        marketingState
      }
      addresses(first: 3) {
        id
        address1
        address2
        city
        company
        country
        province
        firstName
        lastName
        zip
      }
    }`
    let graphql = JSON.stringify({
      query: `{${graphqlBody}}`
    });

    fetch(`https://birdy-grey-test-store.myshopify.com/admin/api/2022-04/graphql.json`, {
      method: 'POST',
      headers: {'X-Shopify-Access-Token': shopify, "Content-Type": "application/json"},
      body: graphql
    }).then(res => res.json()).then(response => {
      console.log(response.data.Customer);
      resolve(response);
    }).catch(err => {
      console.log(err);
      resolve(false);
    })
  });
};

const getZendeskForm = (id) => {
  return new Promise(resolve => {
    fetch(`https://birdygrey.zendesk.com/api/v2/ticket_forms/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${zendesk}`,
      }
    }).then(res => res.json()).then(response => {
      resolve(response);
    }).catch(err => {
      console.log(err);
      resolve(false);
    })
  });
}
const getZendeskField = (id) => {
  return new Promise(resolve => {
    fetch(`https://birdygrey.zendesk.com/api/v2/ticket_fields/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${zendesk}`,
      }
    }).then(res => res.json()).then(response => {
      resolve(response);
    }).catch(err => {
      console.log(err);
      resolve(false);
    })
  });
}

const getOrder = id => {
  return new Promise(resolve => {
  //  console.log(id);
  //  console.log(shopify);
  console.log(id);
    fetch(`https://birdy-grey-test-store.myshopify.com/admin/api/2022-01/orders.json?name=${id}&status=any`, {
      method: 'GET',
      headers: {'X-Shopify-Access-Token': shopify}
    }).then(res => res.json()).then(response => {
  //    console.log('SHOPIFY RESPONSE');
      resolve(response);
    }).catch(err => {
      resolve(false);
    })
  });
}

const getTracking = tracking => {
  return new Promise(resolve => {
    fetch(`https://api.aftership.com/v4/trackings?tracking_numbers=${tracking}`, {
      method: 'GET',
      headers: {'aftership-api-key': aftership, 'Content-Type': 'application/json'}
    }).then(res => res.json()).then(response => {
      resolve(response);
    }).catch(err => {
      resolve(false);
    })
  });
}

const verifyShopify = data => {
return new Promise(resolve => {
if (!data || data == 'undefined') {
  console.log('FAILED!');
  resolve(false);
  return;
}
// console.log(data);
let query = data.query;
if (!data.query || !data.query.shop) {
  if (data.headers.referer == 'undefined' || data.headers.referer == undefined) {
    resolve(false);
    return;
  }
  let string = data.headers.referer.split('?');
  query = querystring.decode(string[1]);
}
let parameters = [];
  for (let key in query) {
    if (key != 'signature') {
      parameters.push(`${key}=${query[key]}`);
    }
  }
  var message = parameters.sort().join('');
  var digest = crypto.createHmac('sha256', apiSecret).update(message).digest('hex');
  resolve(digest === query.signature);
})
}

app.post('/get-tracking', (request, response) => {
  setTimeout(() => {
  verifyShopify(request).then(verify => {
    if (verify == false) {
      console.log('INVALID REQUEST');
      return response.json({status:403, message:"This request is invalid"});
    }
    getTracking(request.body.tracking).then(tracking => {
      if (tracking == false) {
        console.log('COULD NOT GET THE TRACKING');
        return response.json({status:500, message:"We couldn't get the tracking"});
      }
      if (tracking.data.trackings.length < 1) {
        console.log('NO TRACKINGS FOUND');
        return response.json({status:200, message:"We didn't find any trackings"})
      }
      if (!tracking.data.trackings[0].emails.includes(request.body.email)) {
        console.log('MISMATCH');
      }
      // console.log(tracking.data.trackings[0]);
      let num = null;
      if (tracking.data.trackings.length > 0) {
        num = tracking.data.trackings[0];
      }
      getOrder(num.order_number).then(order => {
        if (order == false) {
          console.log('SENDING TRACKING');
          return response.json(num);
        }
        num.shop_order = order;
        console.log(order);
        let products = [];


        order.orders[0].line_items.forEach(item => {
          products.push(item.product_id);
        });

        getProducts(products).then(items => {
          num.products = items;
          return response.json(num);
        });

      })
    })
  })
}, 500);
});

app.post('/update-customer', (request, response) => {
  setTimeout(() => {
    verifyShopify(request).then(verify => {
      if (verify === false) {
        console.log('INVALID REQUEST');
        return response.json({status:403, message:"This request is invalid"});
      }
      updateCustomer(request.body.customer).then(customer => {
        if (customer === false) {
          console.log('COULD NOT UPDATE THE CUSTOMER');
          return response.json({status:500, message:"We couldn't update the customer"});
        }
        if (customer.data.customerUpdate === false) {
          console.log('NO CUSTOMER FOUND');
          return response.json({status:500, message:"We couldn't update the customer"});
        }
        else {
          return response.json(customer.data);
        }
      });
    });
  }, 500);
});

app.post('/update-customer-newsletter', (request, response) => {
  setTimeout(() => {
    verifyShopify(request).then(verify => {
      if (verify === false) {
        console.log('INVALID REQUEST');
        return response.json({status:403, message:"This request is invalid"});
      }
      updateCustomerNewsletter(request.body.customer).then(customer => {
        if (customer === false) {
          console.log('COULD NOT UPDATE THE CUSTOMER EMAIL MARKETING CONSENT');
          return response.json({status:500, message:"We couldn't update the customer"});
        }
        if (customer.data.customerEmailMarketingConsentUpdate === false) {
          console.log('NO CUSTOMER FOUND');
          return response.json({status:500, message:"We couldn't update the customer"});
        }
        else {
          return response.json(customer.data);
        }
      });
    });
  }, 500);
});

app.post('/get-tracking/get-order', (request, response) => {

  setTimeout(() => {

  verifyShopify(request).then(verify => {

    if (verify == false) {
      console.log('INVALID REQUEST');
      return response.json({status:403, message:"This request is invalid"});
    }

    getOrder(request.body.order).then(order => {
      if (order == false) {
        console.log('NO ORDER FOUND');
        return response.json({status:500, message:"We couldn't get the order"});
      }

      if (order.orders.length < 1) {
        return response.json({status:500, message:"We couldn't get the order"});
      }

      let theEmail = order.orders[0].email.toLowerCase();
      if (request.body.email !== theEmail) {
        return response.json({status:403, message:"You cannot view that order because the email address does not match"});
      }

      let prs = [];
      let trackingNumber = null;

      if (order.orders[0].fulfillments.length > 0) {
        trackingNumber = order.orders[0].fulfillments[0].tracking_number;
      }

      let products = [];

      order.orders[0].line_items.forEach(item => {
        products.push(item.product_id);
      });

      if (trackingNumber !== null) {
      prs.push(getTracking(trackingNumber));
    }
      prs.push(getProducts(products));

      let num = null;

      Promise.all(prs).then(data => {
        if (data[0].data && data[0].data.trackings && data[0].data.trackings.length > 0) {
        num = data[0].data.trackings[0];
      }
      let num = {};
      num.products = data[1];
      num.shop_order = order;
      return response.json(num);
      })

  });
}, 500);

});

});

app.get('/get-customer', (request, response) => {
  setTimeout(() => {
    verifyShopify(request).then(verify => {
      if (verify === false) {
        console.log('INVALID REQUEST');
        return response.json({status:403, message:"This request is invalid"});
      }

      getCustomer(request.query.id).then(customer => {
        if (customer === false) {
          console.log('CUSTOMER NOT FOUND');
          return response.json({status:500, message:"We couldn't find the customer"});
        }
        else {
          return response.json(customer);
        }
      });
    });
  }, 500);
});

app.get('/get-zendesk-form', (request, response) => {
  setTimeout(() => {
    verifyShopify(request).then(verify => {
      if (verify === false) {
        console.log('INVALID REQUEST');
        return response.json({status:403, message:"This request is invalid"});
      }

      getZendeskForm(request.query.id).then(form => {
        if (form === false) {
          console.log('FORM NOT FOUND');
          return response.json({status:500, message:"We couldn't find the customer"});
        }
        else {
          let zendeskForm = {
            fields: []
          }, prs = [];
          form.ticket_form.ticket_field_ids.forEach(id => {
            prs.push(getZendeskField(id));
          });
          Promise.all(prs).then(data=> {
            zendeskForm = {
              form: form,
              fields: [...data]
            }

            return response.json(zendeskForm);
          });
        }
      });
    });
  }, 500);
});

app.get('/', (request, response) => {
  response.send({status:200});
});

app.listen(PORT, () => {
  console.log(`App running on port ${PORT}.`)
});

}
