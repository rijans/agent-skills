import * as restate from '@restatedev/restate-sdk'
import {
  expenseApprovalWorkflow,
  approvalDecisionService,
} from './workflow.js'

const port = Number(process.env.PORT || 9080)

restate
  .endpoint()
  .bind(expenseApprovalWorkflow)
  .bind(approvalDecisionService)
  .listen(port, () => {
    console.log(`[Restate] Approval Workflow server listening on port ${port}`)
  })
