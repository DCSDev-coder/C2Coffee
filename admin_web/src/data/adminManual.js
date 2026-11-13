export const adminManualSections = [
  {
    group: 'Daily work',
    page: 'Barista Console',
    purpose: 'Monitor incoming customer orders and move each order through preparation, collection, and completion.',
    steps: ['Open an order to review the customer, items, modifiers, voucher, and payment status.', 'Use the status action only when the order has actually moved to the next preparation stage.', 'Open the SOP guide when a drink or store procedure needs to be checked.'],
    notes: 'Do not mark an order collected before the customer receives it. Payment status is controlled by the server.'
  },
  {
    group: 'Daily work',
    page: 'Barista Workspace',
    purpose: 'Provide the barista team with the work queue, attendance context, store tasks, and visual SOP guides.',
    steps: ['Review the current shift and assigned work.', 'Use the SOP library for drink preparation, attire, and store rules.', 'Complete operational tasks only for the current outlet and shift.'],
    notes: 'Keep SOP images current in Staff Guides so the workspace always reflects the latest procedure.'
  },
  {
    group: 'Daily work',
    page: 'Dashboard',
    purpose: 'Get a quick view of sales, orders, customers, tokens, vouchers, and operational alerts.',
    steps: ['Choose the correct outlet or reporting period where available.', 'Use the figures as a summary, then open the related report for detail.', 'Investigate unusual changes before making operational decisions.'],
    notes: 'Dashboard totals are summaries; Finance and Product Report are the detailed sources for reconciliation.'
  },
  {
    group: 'Daily work',
    page: 'Orders',
    purpose: 'Search and manage customer orders, payment status, preparation status, refunds, and order history.',
    steps: ['Search by order reference or customer details.', 'Open the order to review its server-verified items and payment record.', 'Use refund or cancellation actions only according to the store procedure.'],
    notes: 'Refunds can reverse loyalty and referral rewards, so confirm the business reason before approving one.'
  },
  {
    group: 'Daily work',
    page: 'Customers',
    purpose: 'Review customer accounts, membership status, activity, vouchers, and wallet history.',
    steps: ['Search for the customer and confirm the account identity.', 'Review the customer history before changing any wallet or membership information.', 'Use the protected confirmation flow for manual wallet changes.'],
    notes: 'Never share OTPs, passwords, or customer private information with another person.'
  },
  {
    group: 'Menu setup',
    page: 'Menu',
    purpose: 'Manage menu categories, products, prices, availability, images, and customer-facing presentation.',
    steps: ['Create or update the category before adding a menu item.', 'Set the correct token and RM price, item type, availability, and outlet visibility.', 'Archive items that should no longer be sold while preserving history.'],
    notes: 'Changing a live price affects new orders. Check both token and RM payment modes before saving.'
  },
  {
    group: 'Menu setup',
    page: 'Options & Nutrition',
    purpose: 'Create reusable customer choices such as milk, temperature, beans, syrups, and nutritional values.',
    steps: ['Create an option group and select the menu items that can use it.', 'Add each choice, price adjustment, token adjustment, and default selection.', 'Save and verify the group on a new customer order.'],
    notes: 'Use a negative token adjustment only when the business intends to deduct tokens.'
  },
  {
    group: 'Menu setup',
    page: 'Inventory',
    purpose: 'Run the complete stock flow for ingredients, packaging, finished goods, candles, perfumes, and other saleable products.',
    steps: ['Use Quick work and create each physical inventory item once.', 'Link every supplier that can provide the item, including its carton or package conversion, price, minimum order, and lead time.', 'Create and submit a purchase order for the chosen supplier.', 'When stock arrives, open that order and record delivered, accepted, rejected, batch, expiry, delivery order, and invoice details.', 'Set Product usage for every sold menu item, then set Choice usage for options that add, remove, or replace materials.', 'Use Count stock, Record loss, supplier returns, and Reports & audit trail to reconcile differences and explain order deductions.'],
    notes: 'Use a purchase order for normal deliveries so supplier and receiving history remain complete. Manual stock entry is only for controlled corrections. Product usage works for drinks, food, candles, perfumes, bundles, and future menu types.'
  },
  {
    group: 'Marketing & loyalty',
    page: 'Marketing',
    purpose: 'Publish posters, campaigns, announcements, and social or entertainment links to customer surfaces.',
    steps: ['Choose the poster surface and audience.', 'Set the active period, ordering, and destination link.', 'Preview the poster before publishing.', 'Use the fixed Home, Floating, and Partnership surfaces consistently.'],
    notes: 'Do not publish a campaign without checking its dates, destination URL, and customer wording.'
  },
  {
    group: 'Marketing & loyalty',
    page: 'Voucher',
    purpose: 'Create and manage campaign voucher templates, issuance, eligibility, schedules, limits, and reminders.',
    steps: ['Create the reward and choose the eligible audience.', 'Choose token, RM, or both payment modes as appropriate.', 'Configure schedule, available days, usage limit, and optional top-up qualification.', 'Set start and end reminders only when customers should receive them.', 'Review issued, redeemed, active, upcoming, and unavailable behaviour before publishing.'],
    notes: 'Issued vouchers cannot have core eligibility or reward rules changed. Duplicate the voucher for a new campaign.'
  },
  {
    group: 'Marketing & loyalty',
    page: 'Referral Program',
    purpose: 'Configure referral qualification, rewards, caps, and referral history.',
    steps: ['Set the qualifying action and reward for each side of the referral.', 'Configure monthly limits and eligibility carefully.', 'Review the referral record before handling a dispute or refund.'],
    notes: 'Refunded qualifying orders can reverse referral rewards.'
  },
  {
    group: 'Marketing & loyalty',
    page: 'C2 Credit Ledger',
    purpose: 'Review token additions, deductions, reversals, top-ups, and manual adjustments.',
    steps: ['Search by customer, transaction, or reference.', 'Confirm the reason and source of every manual adjustment.', 'Use the confirmation flow and record the business explanation.'],
    notes: 'Never use a manual ledger change to hide a payment or order error; use the correct refund or reconciliation process.'
  },
  {
    group: 'Marketing & loyalty',
    page: 'Tier Management',
    purpose: 'Configure loyalty tiers, tier unlocks, birthday rewards, and tier-specific benefits.',
    steps: ['Define the tier thresholds and benefits.', 'Configure the associated reward templates separately.', 'Test a qualifying customer before announcing a new tier campaign.'],
    notes: 'Tier and birthday rewards are managed separately from ordinary campaign vouchers.'
  },
  {
    group: 'Reports',
    page: 'Finance',
    purpose: 'Review revenue, expenses, payment channels, refunds, and financial reconciliation information.',
    steps: ['Choose the reporting period and outlet.', 'Compare totals against payment-provider and operational records.', 'Investigate differences before exporting or sharing a report.'],
    notes: 'Use server payment records as the source of truth; do not rely only on a client screen.'
  },
  {
    group: 'Reports',
    page: 'Product Report',
    purpose: 'Review product sales, quantities, categories, and item performance.',
    steps: ['Filter by date, outlet, category, or product.', 'Use the result to support purchasing and menu decisions.', 'Compare product quantities with inventory consumption when investigating variance.'],
    notes: 'Product sales and inventory usage are related but not identical when wastage, returns, or recipe changes exist.'
  },
  {
    group: 'Staff & store',
    page: 'Barista Management',
    purpose: 'Manage staff membership, roles, employee status, and barista access.',
    steps: ['Add or update staff using the correct outlet and employee status.', 'Remove access when a staff member leaves.', 'Review history before deleting or changing a staff record.'],
    notes: 'Preserve historical records when removing staff; do not reuse another person’s account.'
  },
  {
    group: 'Staff & store',
    page: 'Outlets',
    purpose: 'Manage outlet identity, status, schedules, trading availability, and outlet-specific settings.',
    steps: ['Confirm the outlet timezone and displayed name.', 'Set published opening schedules and temporary closures.', 'Verify the customer order status after changing availability.'],
    notes: 'An unpublished or closed outlet should not appear available for customer ordering.'
  },
  {
    group: 'Staff & store',
    page: 'C2 Store Devices',
    purpose: 'Activate and manage counter devices, device status, and printer connections.',
    steps: ['Create or activate a device using the displayed activation process.', 'Confirm the device is assigned to the correct outlet.', 'Disable or revoke devices that are lost or replaced.'],
    notes: 'A device must not be shared between outlets or staff without reactivation.'
  },
  {
    group: 'Staff & store',
    page: 'Staff Guides',
    purpose: 'Maintain written instructions and visual SOP references for store teams.',
    steps: ['Use the Admin Manual section for page-by-page instructions.', 'Upload current drink, attire, and store-rule images below it.', 'Delete or replace outdated visual guides.'],
    notes: 'Visual guides are shown to operational staff, so avoid publishing drafts or confidential information.'
  },
  {
    group: 'Staff & store',
    page: 'Operations',
    purpose: 'Manage attendance, tasks, sounds, and store readiness.',
    steps: ['Review the configured outlet opening hours.', 'Record attendance and complete assigned operational tasks.', 'Review store locks or notices before opening service.'],
    notes: 'Operational availability depends on opening hours and at least one barista being clocked in.'
  },
  {
    group: 'Administration',
    page: 'Admin Management',
    purpose: 'Manage administrator accounts, roles, access, and tenant membership.',
    steps: ['Give each person only the role needed for their work.', 'Remove access immediately when responsibility changes.', 'Review audit history for sensitive administration changes.'],
    notes: 'Super Admin access includes sensitive cost, deployment, retention, and configuration controls.'
  },
  {
    group: 'Administration',
    page: 'Deployment',
    purpose: 'Review deployment status, release information, and operational readiness checks.',
    steps: ['Review the release version and build information.', 'Run the readiness checks before production changes.', 'Record any manual checks that still need to be completed.'],
    notes: 'A passing automated readiness check does not replace real OTP, device, payment, or staff acceptance testing.'
  },
  {
    group: 'Administration',
    page: 'Audit Logs',
    purpose: 'Review who changed sensitive settings, data, vouchers, inventory, and financial controls.',
    steps: ['Filter by action, administrator, date, or target.', 'Open the record and compare the before and after values.', 'Use the audit reference when investigating a correction.'],
    notes: 'Audit records are historical evidence and should not be edited to correct a mistake.'
  },
  {
    group: 'Administration',
    page: 'Data Retention',
    purpose: 'Review retention status and perform controlled cleanup where the policy allows it.',
    steps: ['Review the cleanup preview and affected data categories.', 'Confirm the administrator password and business reason.', 'Run cleanup only after verifying that protected business history is excluded.'],
    notes: 'Retention cleanup is destructive and restricted to Super Admin.'
  },
  {
    group: 'Administration',
    page: 'Settings',
    purpose: 'Manage tenant appearance, customer outlet details, maintenance mode, and application configuration.',
    steps: ['Update one setting group at a time.', 'Save and verify the customer-facing result.', 'When enabling maintenance mode, confirm employee bypass and the customer message.'],
    notes: 'Maintenance mode blocks customer activity and should be disabled only after production checks are complete.'
  }
];
