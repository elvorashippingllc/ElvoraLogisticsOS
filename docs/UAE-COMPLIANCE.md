# UAE compliance

Prepared 7 October 2026 from three sources: the company's DET trade licence pack (commercial licence no. 1645802, commercial register no. 2911510, Dubai Chamber membership no. 697774), the public website www.elvorashipping.com, and this application's code. It is a working aid, **not legal or tax advice** – have your tax and legal advisers confirm the points marked *verify*.

## 1. What the licence says

| | |
|---|---|
| Company | ELVORA SHIPPING L.L.C · إلفورا للشحن ش.ذ.م.م |
| Legal form | LLC – Single Owner; capital AED 200,000 (200 shares); one owner who is also the manager |
| Authority | Dubai Economy and Tourism (DET); the licence names the **Dubai Maritime Authority** as follow-up authority |
| Issued / expires | 17 Aug 2026 / **16 Aug 2027** (licence, register and Chamber membership all share these dates) |
| Address | Naif, Dubai, Parcel ID 118-157 (the office number is printed in Arabic – copy it exactly onto documents) |
| Licensed activities | **Customs Broker · Sea Shipping Lines Agents · Cargo Loading & Unloading Services · Sea Cargo Services** |
| Licence conditions | No change of location or licence details without DET approval · signboard name identical to the licence, Arabic and English · permits for warehouses and additional offices · no sales/offers without a permit · invoices must show goods/service amounts and VAT |

## 2. Findings

### A. Operations versus the licence (highest risk)
The OS, the website and the marketing pack offer **air freight, road transport / trucking, warehousing and courier**, none of which is a licensed activity. Warehousing also needs a DET permit for the premises (licence condition 13). Multimodal and project cargo are only licensed for their sea leg. Sea freight, customs clearance, agency and cargo handling are covered.
Action: obtain the activities/permits from DET, or subcontract those legs to licensed parties and stop advertising them as your own services. The OS now flags and (optionally) blocks unlicensed services – see §3.

### B. Public website (www.elvorashipping.com)
| Finding | Fix |
|---|---|
| Advertises Air Freight, Land Transport, Warehousing as services | Remove or qualify ("through licensed partners") until licensed |
| No trade licence number, legal name with L.L.C, TRN or licensing authority in the footer | Add them (see snippet below) |
| Quote form collects name, e-mail and shipment details with no privacy notice or consent wording | Add a privacy notice link and a consent line (UAE PDPL) |
| No privacy policy, terms of business or cookie notice pages | Publish them |
| Address shows only "Bur Dubai"; licence address is Naif | Use the licensed address |
| "EST." shown with no year; lanes and transit times are marked illustrative in the page source | Fill or remove; do not publish unverified claims |
| Name shown as "ELVORA" / "Elvora Shipping L.L.C." | Use the licensed name exactly, Arabic and English, same size |

Footer snippet:
```html
<footer>ELVORA SHIPPING L.L.C · إلفورا للشحن ش.ذ.م.م · Licensed by Dubai Economy and Tourism, licence no. 1645802 · Commercial register 2911510 · Naif, Dubai, U.A.E. · TRN [15 digits once registered]</footer>
<label><input type="checkbox" required> I agree that Elvora Shipping may use these details to respond to my enquiry, as described in the <a href="/privacy">privacy notice</a>.</label>
```

### C. Application gaps (now addressed – §3)
Invoices could be posted without a supplier TRN or reason on credit notes; VAT could be charged by a company that is not VAT-registered; the PINT AE file used the full TRN as the Peppol endpoint (it must be the 10-digit TIN); no licence/permit register, no statutory calendar, no sanctions-screening control, no related-party, gratuity or privacy data; letterhead lacked the Arabic name and licence number.

### D. Time-critical items
| Date | Item |
|---|---|
| **17 Nov 2026** | Corporate-tax registration (3 months from licence issue; FTA Decision 3 of 2024 – *verify in EmaraTax*) |
| When taxable supplies pass AED 375,000 in 12 months (zero-rated sales count) | Mandatory VAT registration within 30 days |
| 31 Mar 2027 / 1 Jul 2027 | Appoint an accredited e-invoicing provider / go live (businesses under AED 50m revenue; Ministerial Decision 243 of 2025). AED 50m or more: 31 Jul 2026 / 1 Jan 2027 |
| 16 Aug 2027 | Licence, commercial register and Chamber membership renewal |
| 28 days after each tax period | VAT return and payment (periods assigned by the FTA) |
| 9 months after financial year end | Corporate-tax return and payment |

## 3. What was added to the OS

**Compliance Centre** (*Compliance (UAE)* in the menu, new permission module `compliance`; Admin and Manager have it automatically)
* **Readiness score** and checklist: licence validity, VAT/TRN, corporate-tax registration, e-invoicing provider, operations within licence, Dubai Customs and DMA approvals, WPS set-up, sanctions-screening coverage, name match with the licence, open exceptions.
* **Licences & registrations register** – seeded with the three documents above (number, authority, issue/expiry) plus the registrations still to verify (Dubai Customs broker registration, DMA approval, VAT, corporate tax, e-invoicing provider, MOHRE/WPS, ICP, Ejari, liability insurance, UBO register, privacy notice). Reminders at 60/30/14/7/3/2/1 days and weekly once expired.
* **Licensed activities** – the four licence activities mapped to service codes. Jobs, quotations, transport orders and warehouse receipts are checked; mode `warn` (default) logs an exception, `block` refuses. Adding an activity after a licence amendment lifts the block immediately.
* **Compliance calendar** – generates VAT returns, corporate-tax registration and returns, e-invoicing milestones and licence renewals from your settings; overdue items are flagged and notified.
* **Exceptions log** – every finding with rule, record link, acknowledgement note and reviewer; findings resolve themselves when the record is fixed.

**Statutory rules in finance** (`enforce` by default, `advisory` to warn only)
| Rule | Severity |
|---|---|
| Supplier TRN must be 15 digits to post a tax document | Blocks |
| VAT cannot be charged when the company is recorded as not VAT-registered; documents print "Invoice" instead of "Tax Invoice" | Blocks |
| Credit note must state a reason; original invoice should be linked | Blocks / warns |
| Invoice dated more than 14 days after the date of supply (new *Date of supply* field) | Warns |
| Customer TRN and address on full tax invoices (AED 10,000 or more) | Warns |
| Zero-rated lines need evidence: warned when no job is linked or the job is a domestic UAE move | Warns |
| VAT shown in AED with the exchange rate on foreign-currency invoices (print) | – |
| Input VAT from a supplier with no TRN | Warns |
| Trade licence expired → no new jobs, quotations or tax invoices | Blocks |
| Confirmed sanctions match → no jobs, quotations, invoices or bills for the party (party is blocked); potential match or unscreened → warning on the party | Blocks / warns |

**Other**
* Customer fields: sanctions-screening status/date, risk rating, related-party flag, marketing consent (PDPL), customs client code. Lead consent field. Screening is recorded with `POST /api/compliance/parties/:id/screen`; **screening itself must be done against the UAE Local Terrorist List and UN Consolidated List – the OS records it, it does not query the lists.**
* Employee fields: work-permit/labour-contract expiry and ILOE status; both feed *Expiring documents*.
* Reports: **End-of-service gratuity** (Federal Decree-Law 33 of 2021: 21 days' basic per year for the first 5 years, 30 days after, capped at two years' pay) and **Related-party transactions** (for the corporate-tax return); *Expiring documents* now includes company licences.
* Letterhead prints the Arabic name and licence number; **PINT AE** file now uses scheme 0235 with the 10-digit TIN as endpoint (reserved values for non-Peppol buyers).
* Company Settings → **UAE compliance** tab: Arabic name, licence dates, VAT/CT status, financial year end, enforcement modes.

## 4. Go-live checklist
1. Company Settings → UAE compliance: confirm the data, set VAT status (untick *VAT-registered* if not registered yet) and enter the TRN when issued.
2. Register for corporate tax by the date in the calendar; tick *Registered* and enter the TRN.
3. Decide on air, road and warehousing: obtain activities/permits, or leave `warn`/set `block` and subcontract.
4. Update the *Licences & registrations* statuses from *To verify* to *Active* with numbers and expiries; attach copies in the Documents library.
5. Screen customers and vendors; record results; flag related parties (owner/group companies).
6. Choose an accredited e-invoicing provider before 31 Mar 2027; connect it under Integrations.
7. Fix the website (§2B) and regenerate the corporate templates, which still read "Elvora Shipping LLC" and advertise unlicensed services (`tools/docs`, then `npm run docs:build`).
8. Keep tax records for at least 7 years (Tax Procedures law) – do not delete documents; the OS soft-deletes only.

## 5. Not covered / to decide with your advisers
* Whether the AED 3m Small Business Relief or other corporate-tax reliefs apply; the OS offers only the related-party report, not a tax computation.
* VAT treatment of each charge (international transport and directly related services can be zero-rated; local services, customs clearance and handling usually are not) – review the VAT code on every charge code.
* Peppol / ASP technical validation of the XML; WPS file layout with your bank; Dubai Customs (Mirsal 2 / Dubai Trade) integration.
* Emiratisation quotas (apply at 20+ employees in listed sectors, 50+ otherwise), PDPL data-subject request handling, AML duties if handling precious metals/stones.
