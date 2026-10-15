import * as restate from '@restatedev/restate-sdk'
import {
  inventoryService,
  paymentService,
  orderCheckoutSaga,
} from './services.js'

const port = Number(process.env.PORT || 9080)

restate
  .endpoint()
  .bind(inventoryService)
  .bind(paymentService)
  .bind(orderCheckoutSaga)
  .listen(port, () => {
    console.log(`[Restate] Order Saga server listening on port ${port}`)
  })
