/**
 * Batch Transfer permission keys.
 *
 * These keys are reserved for the `role_config_json.enable` / `.disable`
 * arrays on Cloud Roles (see [src/screens/CloudRoles.js](src/screens/CloudRoles.js)).
 * The role-based feature gating layer is being built out incrementally; once
 * the central permission-check helper exists, every action button in the
 * batch transfer flow should be wrapped with a check against the matching
 * key here.
 *
 * Root accounts bypass every check (existing behavior).
 */
export const TRANSFER_PERMISSIONS = {
  // Initiate a new transfer request (create draft + submit) and cancel one
  // we authored. Required for the FAB on BatchTransferRequestList and the
  // "Submit Request" / "Cancel Request" buttons on Detail.
  CREATE: 'transfer.create',

  // Review an incoming request as the destination: edit per-entry
  // accepted_qty and dest_remarks, plus the Accept / Reject actions.
  REVIEW: 'transfer.review',

  // Press "Transfer" on an accepted request (status accepted → transferring).
  // Only the source branch can perform this action.
  TRANSFER_OUT: 'transfer.transfer_out',

  // Press "Transfer Received" on the destination side: opens the receive
  // screen and writes the destination's inventory_logs rows.
  RECEIVE: 'transfer.receive',
};

export const TRANSFER_PERMISSION_LABELS = {
  [TRANSFER_PERMISSIONS.CREATE]: 'Create batch transfer request',
  [TRANSFER_PERMISSIONS.REVIEW]: 'Review incoming transfer requests',
  [TRANSFER_PERMISSIONS.TRANSFER_OUT]: 'Dispatch accepted transfers',
  [TRANSFER_PERMISSIONS.RECEIVE]: 'Receive incoming transfers',
};
