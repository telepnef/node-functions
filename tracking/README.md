# tracking

Birdy Grey's integration that powers our [tracking page](https://www.birdygrey.com/pages/tracking?order=#2188308) to connect Shopify order  shipment and status data with [Aftership's API](https://www.aftership.com/). Queries are made to both the Aftership API and the Shopify orders API using customer email address

## Requirements

- [Google Cloud Project Permissions](https://console.cloud.google.com/functions/list?env=gen1&hl=en&project=bg-tracking-348611&tab=variables)
- [Homebrew](https://brew.sh/)
- [Google Cloud CLI Tools](https://cloud.google.com/sdk/docs/install)
- Node
  - [NVM](https://github.com/nvm-sh/nvm) to manage versions

## Setup

To get started using better-tracking locally:
- Clone this repository: `git clone https://github.com/birdygrey/tracking.git`
- Create a Shopify development app in `https://birdystaging.com/`
- Grant permissions for the `Admin API access scopes`
  - `Products`: `read_products`
  - `Orders`: `read_orders`
- Generate Admin API key
- add to `.env` file (SHOPIFY_ADMIN_API_ACCESS_TOKEN=xxxxxxxx)
- Create an API key in `Birdy Grey Staging` in (Aftership)[https://organization.automizely.com/api-keys]
- Grant permissions for the `Tracking` API
  - `Carriers`:`Write`
  - `Estimated delivery dates`:`Write`
  - `Last checkpoints`:`Read`
  - `Notifications`:`Write`
  - `Trackings`: `Write`
- Generate Tracking API key
- add to `.env` file (AFTERSHIP_API_KEY=xxxxxxxx)
- Install dependencies: `npm install`
- Launch the integration locally: `npm start`

```
gcloud auth login
gcloud config set project PROJECT_ID
gcloud functions deploy FUNCTION_ID
```

## Useful Documentation
[Aftership API](https://www.aftership.com/docs/tracking/quickstart/api-quick-start)
[Google Cloud Functions](https://cloud.google.com/functions/docs)
[Shopify Admin API](https://shopify.dev/docs/api/admin)
