import functions from '@google-cloud/functions-framework';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const updateCustomer = customer => {
  return new Promise(resolve => {
    let graphqlbody = `mutation customerUpdate($input: CustomerInput!) {
      customerUpdate(input: $input) {
        userErrors {
          field
          message
        }
        customer {
          id
          firstName
          lastName
          tags
          phone
          email
        }
      }
    }`;
    console.log(customer)
    let graphql = JSON.stringify({
      query: graphqlbody,
      variables: {
        input: {
          ...customer
        }
      }
    });

    fetch(`https://birdygrace.myshopify.com/admin/api/2023-07/graphql.json`, {
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

functions.http('updateCustomerInfo', async (req, res) => {
  res.set('Access-Control-Allow-Origin', "*")
  res.set('Access-Control-Allow-Methods', 'GET, POST');

  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }

  updateCustomer(req.body.customer).then(customer => {
    if (customer === false) {
      console.log('RETURNS NOT FOUND');
      res.send({status:500, message:"We couldn't find returns for this product"});
    }
    else {
      res.send(customer);
    }
  })
    .catch(error => {
      console.log('error', error);
    });
});