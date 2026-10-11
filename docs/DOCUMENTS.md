# Generated documents and company seal

Invoices, quotations, vouchers, purchase orders, statements and other print layouts identify the customer, supplier, consignee, employee or other recipient before the document title. Where no recipient is available, they say “To whom it may concern”.

Every document includes a system-generated notice. Invoices say: **“This is a system-generated invoice and does not require a signature.”** Other layouts identify their document type and say that an issuer’s signature is not required. This notice is independent of the configurable footer. Customer acceptance, delivery/warehouse acknowledgements, custody requirements and the authorised carrier-original issuance process remain in place.

## Configure the seal

In **Company settings → Document text → Company seal**, upload the original Elvora stamp image as PNG or JPEG (up to 1 MB, at most 4096 pixels in either dimension). The image is retained without redrawing it. A transparent PNG or a tightly cropped image with a white background prints best. Remote URLs and SVG files are not accepted.

Choose **Include the company seal by default**, then **Save settings**. Removing the seal also clears this default. Settings changes require administration edit access and are audited. Demo settings remain isolated from the live company.

## Generate a document

- **Print / Save as PDF:** open the record’s print page and choose **Include company seal**. The choice travels in the page URL and survives reloads. Printing is enabled once record and related data are ready.
- **PDF:** use the seal checkbox next to the record’s PDF download button. The server uses this choice for the generated file.
- **Email PDF:** choose the seal in the email dialog. The attachment uses that choice; the default message also includes the system-generated notice. Existing sender, permission and demo delivery controls apply.

Leaving the seal off still includes the notice. Draft/void/copy watermarks are retained. Statements preserve their requested date range; customer portal users can only request their own company’s statement. Server PDFs wait for related queries, fonts and images rather than exporting a partly loaded page or an error sheet.

## Verification

Run `npm run build` followed by `CHROME_PATH=/usr/bin/chromium npm run test:documents`. The test starts an isolated server and fictional demo database. It covers continuous settings typing, original raster upload, invalid-image rejection, recipient ordering, notices, default/override choices, VAT/letterhead metadata, statement date ranges, missing-record errors, mobile preview containment, and PDF text/image inspection with Poppler. Its seal is a test fixture, not the company’s stamp.
