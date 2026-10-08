# Buying vendor services and serving your customer

Elvora can hire equipment or buy a subcontracted service from a supplier, then charge its customer through the same job. The supplier and customer are different parties; their rates, quantities, currencies and taxes can also differ.

Open **Operations → Vendor services & hired equipment**, or open a customer job and select **Vendor services**. Use one record for each agreed service, hire or extra charge. Supported types include container, truck and trailer hire, transport, forklift/crane, storage, customs clearance and other services.

## Before creating a service

1. Create the supplier under Customers & Parties and enable **Vendor / supplier**. Enable Transporter too when the supplier performs a trip. Add supplier contacts, payment terms and relevant references there.
2. Create the customer and its job. The job determines which customer receives the selling charge.
3. Obtain the vendor's written quotation and agree what is included. If your company requires a purchase order, use the existing independent PO approval workflow first. An optional linked PO must belong to this vendor and be Approved, Ordered or Received.
4. Agree the selling price with the customer. Use the existing quotation workflow where required. Attach vendor quotes and customer acceptance to the service's Files panel.

## Record both sides of the agreement

Enter the job, vendor, service description and vendor quotation/booking reference. Record equipment size/capacity, container number or truck/trailer plate, driver contact, route, hire dates, and return due date where applicable. Link the transport trip if one exists; it must belong to the same job and customer, and its assigned subcontractor must match the supplier.

Choose a charge code with appropriate cost and income accounts. Enter the vendor's quantity, rate, charging basis, currency, exchange rate and tax code. Enter the customer's corresponding values separately. Quantities are entered from the agreement; dates do not automatically calculate rental days. Taxes must be selected according to the actual service and invoice; the OS does not assume every service has the same tax treatment.

Record fuel, tolls, loading/unloading, waiting, free days, overtime, insurance, damage, cancellation and payment terms under Vendor agreement. Attach the supporting agreement. Use another service record for an additional agreed waiting, overtime, demurrage or rental-extension charge. A transport order's existing rate/cost fields are trip reference values; use the vendor-service record to create job accounting charges. Do not also enter the same charge manually in Job Accounting.

**Example:** hire a truck for two days at AED 500 per day and sell the service at AED 700 per day. Vendor amount: AED 1,000. Customer amount: AED 1,400. Expected job profit: AED 400 before tax. With 5% tax on both sides, the vendor bill is AED 1,050 and customer invoice AED 1,470. Tax is recorded separately from job profit. Confirmed amounts are agreed job costs/revenue; they are not cash collected or paid.

## Confirm, perform and return

1. Save the Draft and review its buying and selling details.
2. Click **Confirm and add job charges**. Requires job edit and finance create permissions. It creates one cost charge for the vendor and one revenue charge for the job's customer, updates job profit, and records the action in history. It does not post an invoice, bill or payment. Repeating confirmation is blocked.
3. For a correction before work starts and before any financial document uses the charges, choose **Reset unbilled service to draft**. This removes the pair of charges and recalculates the job. Correct, then confirm again. Commercial fields and linked job charges are otherwise locked. Reset requires job edit and finance edit permissions.
4. Edit the service to **In use** when work starts. Hired equipment needs its identifying number. The same vendor equipment cannot be In use on two service records at once.
5. Attach signed POD or completion evidence and enter its reference; change status to **Completed**.
6. For container, truck or trailer hire, attach the vendor return receipt, enter the actual return date and reference, then select **Returned**. The return requirement is automatic for these hire types. For a transport service supplied entirely by a subcontractor, choose Transport service and use Completed when the work ends; enable return required only if equipment has actually been hired.
7. Cancel an unused Draft if the agreement is withdrawn. Confirmed services must first be reset where permitted. Records are retained rather than deleted. Started or financially referenced services require resolution of the work and the normal financial correction process; they cannot be erased through reset.

## Bill, invoice and settle

1. Open the job's Accounting tab. Check that the supplier cost and customer revenue appear once, with the right parties.
2. Use **Vendor bill from job costs**. Select the supplier, enter its real invoice number and review the draft against its invoice and supporting service evidence. The existing duplicate supplier-invoice check and bill approvals apply. Post only after review.
3. Use **Tax invoice from unbilled charges** to create the customer invoice. Review its selling description, quantities and taxes before posting and sending. Vendor buying prices and agreement terms are not copied into customer invoice lines.
4. Record and allocate the customer's receipt and the supplier payment through the existing Accounts workflow. Supplier payment and customer collection remain separate, so one never marks the other as paid.
5. Check job profit and outstanding customer/vendor balances. Use the existing controlled void/credit process for posted documents; never change a confirmed service to disguise a posted cost or sale.
6. Complete job closure review. Active vendor services, incomplete subcontracted work and unreturned hired equipment block closure. Existing cost review, billing, document and equipment checks still apply. Changes to vendor service evidence invalidate the previous closure review fingerprint.

Refundable deposits are not hire expenses. Use the existing **Container deposits** workflow for payment, recovery and independently approved damage deductions. Do not enter the refundable principal as a cost charge. Additional non-refundable charges can be recorded as a separate vendor service with the agreed customer selling treatment.

Supplier prices and agreements are internal records; the customer portal cannot open vendor-service records. Internal users still need the appropriate job and finance permissions. The feature records agreements, execution and accounting; it does not automatically book vendor equipment, calculate late fees, send supplier orders or transfer money.
