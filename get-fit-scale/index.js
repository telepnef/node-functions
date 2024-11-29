import functions from '@google-cloud/functions-framework';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

function getReturns(ids) {
  let promises = [];
  ids.forEach(id => {
    promises.push(fetch(`https://partner.happyreturns.com/return`, {
      method: 'POST',
      headers: {
        'X-HR-APIKEY': '7FGZrhYfJD4YfijQ',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        orderNumber: `#${id}`,
        happyReturnsRetailerID: 'birdygrey'
      })
    })
      .then(response => response.json()))
  });

  return Promise.all(promises)
    .catch(err => {
      console.log(err)
    })
}
const getProduct = id => {
  return new Promise(resolve => {
    let graphqlbody = `product(id: "gid://shopify/Product/${id}") {
          title
          handle
      }`
    let graphql = JSON.stringify({
      query: `{${graphqlbody}}`
    });

    fetch(`https://birdygrace.myshopify.com/admin/api/2022-04/graphql.json`, {
      method: 'POST',
      headers: {'X-Shopify-Access-Token': process.env.ACCESS_TOKEN, "Content-Type": "application/json"},
      body: graphql
    }).then(res => res.json()).then(response => {
      resolve(response);
    }).catch(err => {
      console.log(err);
      resolve(false);
    })
  });
}
const getOrdersForHappyReturns = (productId, date) => {
  return new Promise(resolve => {
    let after_date = new Date(date);
    fetch(`https://birdygrace.myshopify.com/admin/api/2022-01/orders.json?status=any&created_at_min=${after_date}&fields=line_items`, {
      method: 'GET',
      "Content-Type": "application/json",
      headers: {'X-Shopify-Access-Token': process.env.ACCESS_TOKEN}
    }).then(res => res.json()).then(async response => {
      if (response.errors) {
        resolve(response);
      }
      else {
        let orderIdsWithVariant = response.orders
          .filter(order => order.line_items.find(item => item.product_id === productId * 1))
          .map(order => order.order_number);
        let returns = await getReturns(orderIdsWithVariant), returnsCount = 0, tooSmallCount = 0, tooBigCount = 0, fit_rate_return = 0, fit_scale;
        returns.forEach(items => {
          items.items.forEach(item => {
            returnsCount++;
            if (item.returnReasonID === 'too-small') {
              tooSmallCount++;
            }
            else if (item.returnReasonID === 'too-big') {
              tooBigCount++;
            }
          });
        });
        if (tooSmallCount !== 0 && tooBigCount !== 0) {
          fit_rate_return = (tooBigCount - tooSmallCount) / (returnsCount * 100);
        }
        if (fit_rate_return < -0.82) {
          fit_scale = 0;
        }
        else if (fit_rate_return < -0.64 && fit_rate_return >= -0.82) {
          fit_scale = 1;
        }
        else if (fit_rate_return < -0.46 && fit_rate_return >= -0.64) {
          fit_scale = 2;
        }
        else if (fit_rate_return < -0.28 && fit_rate_return >= -0.46) {
          fit_scale = 3;
        }
        else if (fit_rate_return < -0.1 && fit_rate_return >= -0.28) {
          fit_scale = 4;
        }
        else if(fit_rate_return < 0.1 && fit_rate_return >= -0.1) {
          fit_scale = 5;
        }
        else if (fit_rate_return >= 0.1 && fit_rate_return < 0.28) {
          fit_scale = 6;
        }
        else if (fit_rate_return >= 0.28 && fit_rate_return < 0.46) {
          fit_scale = 7;
        }
        else if (fit_rate_return >= 0.46 && fit_rate_return < 0.64) {
          fit_scale = 8;
        }
        else if (fit_rate_return >= 0.64 && fit_rate_return < 0.82) {
          fit_scale = 9;
        }
        else if (fit_rate_return >= 0.82) {
          fit_scale = 10;
        }
        resolve(fit_scale);
      }
    })
      .catch(err => {
        resolve(err);
      })
  });
}

function getDataForCSV(productId, date) {
  return new Promise(resolve => {
    let prs = [];
    prs.push(getOrdersForHappyReturns(productId, date));
    prs.push(getProduct(productId));
    Promise.all(prs).then(data => {
      if (data[0].errors) {
        resolve(data[0].errors)
      }
      else {
        resolve([{
          id: productId,
          handle: data[1].data.product.handle,
          title: data[1].data.product.title,
          fit_scale: data[0]
        }])
      }
    })
      .catch(err => {
        console.log(err);
        resolve(err)
      });
  })
}


functions.http('getFitScale', async (req, res) => {
  res.set('Access-Control-Allow-Origin', "*")
  res.set('Access-Control-Allow-Methods', 'GET, POST');

  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }
  getDataForCSV(req.query.productId, req.query.date).then(dataForCSV => {
    if (dataForCSV === false) {
      console.log('RETURNS NOT FOUND');
      res.send({status:500, message:"We couldn't find returns for this product"});
    }
    else {
      res.send(dataForCSV);
    }
  })
    .catch(error => {
      console.log('error', error);
    });
});