import functions from '@google-cloud/functions-framework';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

function getReviews(id) {
  return new Promise(resolve => {
    fetch(`https://stamped.io/api/v2/${process.env.STORE_HASH}/dashboard/reviews?search=${id}&rating=&state=&dateFrom&dateTo`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${new Buffer(process.env.STAMPED_PUBLIC_KEY + ':' + process.env.STAMPED_KEY).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    })
      .then(res => res.json())
      .then(response => {
        console.log(response.results)
        resolve(response.results)
      })
      .catch(err => resolve(err));
  })
}

getReviews(119894364);
functions.http('getStampedReview', async (req, res) => {
  res.set('Access-Control-Allow-Origin', "*")
  res.set('Access-Control-Allow-Methods', 'GET, POST');

  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }
  getReviews(req.query.reviewId).then(review => {
    if (review === false) {
      console.log('REVIEW NOT FOUND');
      res.send({status:500, message:"We couldn't find the requested review"});
    }
    else {
      res.send(review);
    }
  })
    .catch(error => {
      console.log('error', error);
    });
});