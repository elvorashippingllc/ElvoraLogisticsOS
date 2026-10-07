// English → Arabic UI dictionary. Anything missing falls back to English.
const RAW = `
Dashboard|لوحة التحكم
Operations|العمليات
Master Jobs|أوامر الشحن الرئيسية
Master Job|أمر شحن رئيسي
Shipments (Sub-Jobs)|الشحنات (الفرعية)
Shipment|شحنة
Carrier Bookings|حجوزات الناقل
Delivery Orders|أوامر التسليم
Delivery order|أمر تسليم
Track & Trace|التتبع
Customs (SB / BOE)|التخليص الجمركي
Job Search|بحث الشحنات
CRM & Sales|العملاء والمبيعات
Customers & Parties|العملاء والأطراف
Customer / Party|عميل / طرف
Contacts|جهات الاتصال
Leads|العملاء المحتملون
Opportunities|الفرص البيعية
Calls & Activities|المكالمات والأنشطة
Campaigns|الحملات
Quotations|عروض الأسعار
Rate Cards|قوائم الأسعار
Contracts|العقود
Transport|النقل
Transport Orders|أوامر النقل
Vehicles|المركبات
Drivers|السائقون
Fuel Logs|سجل الوقود
Maintenance|الصيانة
Warehouse|المستودع
Stock on Hand|المخزون المتاح
Goods Receipts (GRN)|استلام البضائع
Dispatch Orders|أوامر الصرف
Stock Ledger|سجل المخزون
Items (SKU)|الأصناف
Warehouses|المستودعات
Bins & Locations|المواقع والرفوف
Accounts|الحسابات
Invoices & Notes|الفواتير والإشعارات
Customer Receipts|إيصالات العملاء
Vendor Bills|فواتير الموردين
Vendor Payments|مدفوعات الموردين
Journal Entries|قيود اليومية
Expense Claims|مطالبات المصروفات
Bank Accounts|الحسابات البنكية
Bank Reconciliation|مطابقة البنك
Chart of Accounts|دليل الحسابات
Financial Statements|القوائم المالية
Bank Statement Import|استيراد كشف الحساب
Year-end Close|إقفال نهاية السنة
Legal Entities|الكيانات القانونية
People & Support|الموظفون والدعم
Employees|الموظفون
Leave|الإجازات
Attendance|الحضور
Payroll|الرواتب
WPS Salary File|ملف نظام حماية الأجور
Complaints & Tickets|الشكاوى والتذاكر
Cargo Claims|مطالبات الشحن
Cargo Insurance|تأمين البضائع
Work|العمل
Tasks & Follow-ups|المهام والمتابعات
Projects|المشاريع
Calendar|التقويم
Documents Library|مكتبة المستندات
Blog & Announcements|المدونة والإعلانات
Fixed Assets|الأصول الثابتة
Purchase Orders|أوامر الشراء
AI Team|فريق الذكاء الاصطناعي
Jarvis & Employees|جارفيس والموظفون
Approvals|الموافقات
AI Activity|نشاط الذكاء الاصطناعي
WhatsApp|واتساب
Reports & Tools|التقارير والأدوات
Reports|التقارير
KPI Dashboard|مؤشرات الأداء
Freight Tools|أدوات الشحن
Master Data|البيانات الأساسية
Ports & Locations|الموانئ والمواقع
Carriers & Airlines|الناقلون وشركات الطيران
Charge Codes|رموز الرسوم
Container Types|أنواع الحاويات
Currencies|العملات
Exchange-rate History|سجل أسعار الصرف
VAT / Tax Codes|رموز ضريبة القيمة المضافة
Payment Terms|شروط الدفع
HS Codes|الرموز الجمركية
Vessels|السفن
Countries|الدول
Units of Measure|وحدات القياس
Service Types|أنواع الخدمة
Administration|الإدارة
Users|المستخدمون
Roles & Permissions|الأدوار والصلاحيات
Branches|الفروع
Departments|الأقسام
Company Settings|إعدادات الشركة
Integrations|التكاملات
Integration Log|سجل التكاملات
Custom Fields|حقول مخصصة
Automation Rules|قواعد الأتمتة
E-mail Outbox|صندوق البريد الصادر
Webhooks|ويب هوك
API Keys|مفاتيح الواجهة البرمجية
Audit Log|سجل التدقيق
Backup & Data|النسخ الاحتياطي والبيانات
Status|الحالة
Active|نشط
Type|النوع
Name|الاسم
Notes|ملاحظات
Description|الوصف
Currency|العملة
Date|التاريخ
Master job|الأمر الرئيسي
Branch|الفرع
Code|الرمز
Customer|العميل
Employee|الموظف
Remarks|ملاحظات
Qty|الكمية
Amount|المبلغ
Phone|الهاتف
VAT|ضريبة القيمة المضافة
Location|الموقع
Rate|السعر
Charge|الرسم
HS code|الرمز الجمركي
Owner|المالك
Driver|السائق
Journal|القيد
Country|الدولة
Department|القسم
Category|الفئة
Source|المصدر
Payment term|شرط الدفع
Contact|جهة الاتصال
Origin|المنشأ
Exchange rate to AED|سعر الصرف مقابل الدرهم
Vehicle|المركبة
E-mail|البريد الإلكتروني
Email|البريد الإلكتروني
Carrier|الناقل
Unit|الوحدة
Company|الشركة
Commodity|السلعة
Total|الإجمالي
Tax|الضريبة
Item|الصنف
Project|المشروع
Task|المهمة
Address|العنوان
Tax registration no. (TRN)|رقم التسجيل الضريبي
Legal entity|الكيان القانوني
Trade licence no.|رقم الرخصة التجارية
Role|الدور
Designation|المسمى الوظيفي
Title|العنوان
Subject|الموضوع
Error|خطأ
When|متى
Action|الإجراء
Expiry|الانتهاء
Container|الحاوية
Service type|نوع الخدمة
Shipper|الشاحن
Consignee|المرسل إليه
Notify party|الطرف المُخطَر
Salesperson|مندوب المبيعات
Start|البداية
Lead|عميل محتمل
Destination|الوجهة
Opportunity|فرصة بيعية
Service|الخدمة
Mode|الوسيلة
Quotation|عرض سعر
Packages|الطرود
Gross weight (kg)|الوزن الإجمالي (كجم)
Volume (CBM)|الحجم (م³)
Equipment|المعدات
Approval|الموافقة
Contract|العقد
ETD|موعد المغادرة المتوقع
ETA|موعد الوصول المتوقع
ATD|موعد المغادرة الفعلي
ATA|موعد الوصول الفعلي
Container no.|رقم الحاوية
Invoice|فاتورة
Bill|فاتورة مورد
Receipt|إيصال
Account|الحساب
Due date|تاريخ الاستحقاق
Subtotal|المجموع الفرعي
Total (AED)|الإجمالي (درهم)
Bank account|الحساب البنكي
Assigned to|مسند إلى
City|المدينة
User|المستخدم
Full name|الاسم الكامل
Website|الموقع الإلكتروني
Vendor|المورد
Vendor / supplier|مورد
Transporter|ناقل بري
Customs broker|مخلص جمركي
Overseas agent|وكيل خارجي
Primary contact|جهة الاتصال الرئيسية
Credit days|أيام الائتمان
Credit limit|حد الائتمان
Legal name|الاسم القانوني
Budget|الميزانية
Direction|الاتجاه
Date & time|التاريخ والوقت
Valid until|صالح حتى
Valid from|صالح من
Valid to|صالح إلى
Job No.|رقم الشحنة
Job Date|تاريخ الشحنة
Job Status|حالة الشحنة
Client|العميل
Job Info|معلومات الشحنة
MBL / MAWB No.|رقم بوليصة الشحن الرئيسية
HBL / HAWB No.|رقم بوليصة الشحن الفرعية
B/L Status|حالة بوليصة الشحن
INCO Terms|شروط الإنكوتيرمز
Incoterms|شروط الإنكوتيرمز
Operational Status|الحالة التشغيلية
Export / Import|تصدير / استيراد
Service Type|نوع الخدمة
POL|ميناء التحميل
POD|ميناء التفريغ
POR|مكان الاستلام
Vessel Name / Flight|اسم السفينة / الرحلة
Voyage / Flight No.|رقم الرحلة
Parties|الأطراف
Containers|الحاويات
Cargo|البضاعة
Routing|المسار
Accounting|المحاسبة
Customs|الجمارك
Revenue (AED)|الإيرادات (درهم)
Cost (AED)|التكلفة (درهم)
Profit (AED)|الربح (درهم)
Debit|مدين
Credit|دائن
Paid|المدفوع
Balance|الرصيد
Method|الطريقة
Payment|دفعة
Reference|المرجع
Invoice date|تاريخ الفاتورة
Document no.|رقم المستند
Document type|نوع المستند
Notes to customer|ملاحظات للعميل
Terms|الشروط
Bank|البنك
IBAN|رقم الآيبان
Opening balance|الرصيد الافتتاحي
Employee no.|رقم الموظف
Join date|تاريخ الانضمام
Nationality|الجنسية
Passport no.|رقم جواز السفر
Passport expiry|انتهاء جواز السفر
Emirates ID|الهوية الإماراتية
Visa expiry|انتهاء التأشيرة
Basic salary|الراتب الأساسي
Housing|بدل السكن
Basic|الأساسي
Allowances|البدلات
Overtime|العمل الإضافي
Deductions|الخصومات
Net pay|صافي الراتب
Period (YYYY-MM)|الفترة (سنة-شهر)
Priority|الأولوية
Resolution|الحل
Ticket no.|رقم التذكرة
Claim no.|رقم المطالبة
Premium|القسط
Policy no.|رقم الوثيقة
Due|مستحق
Start date|تاريخ البدء
Asset no.|رقم الأصل
Purchase date|تاريخ الشراء
Supplier|المورد
PO no.|رقم أمر الشراء
Requested by|طلب بواسطة
Approved by|اعتمد بواسطة
Number|الرقم
Message|الرسالة
Provider|المزود
Summary|الملخص
Detail|التفاصيل
Fiscal year|السنة المالية
Closing date|تاريخ الإقفال
Net profit / (loss)|صافي الربح / (الخسارة)
Period|الفترة
Employees|الموظفون
Autonomy|مستوى الاستقلالية
Runs|التشغيل
Last run|آخر تشغيل
Job title|المسمى الوظيفي
Steps|الخطوات
Result|النتيجة
Base currency|العملة الأساسية
Default entity|الكيان الافتراضي
Role name|اسم الدور
Permissions|الصلاحيات
Login e-mail|البريد الإلكتروني لتسجيل الدخول
Last login|آخر دخول
Event|الحدث
Events|الأحداث
Body|المحتوى
Attachments|المرفقات
File|الملف
Label|التسمية
Order|الترتيب
Required|إلزامي
Region|المنطقة
Time zone|المنطقة الزمنية
Symbol|الرمز
Decimals|الخانات العشرية
Rate %|النسبة %
Term|المدة
Mobile / WhatsApp|الجوال / واتساب
Industry|المجال
Stage|المرحلة
Probability %|الاحتمالية %
Expected close|الإغلاق المتوقع
Outcome|النتيجة
Quote no.|رقم العرض
Trade|التجارة
Port of loading|ميناء التحميل
Port of discharge|ميناء التفريغ
Margin|الهامش
Margin %|الهامش %
Revision|المراجعة
Terms & conditions|الشروط والأحكام
Sell rate|سعر البيع
Cost rate|سعر التكلفة
Contract no.|رقم العقد
Counterparty|الطرف المقابل
Contract value|قيمة العقد
Booking no.|رقم الحجز
Declaration|الإقرار
Declaration date|تاريخ الإقرار
Duty|الرسوم الجمركية
Duty %|نسبة الرسوم %
Value (CIF)|القيمة (سيف)
Plate no.|رقم اللوحة
Make|الصنع
Model|الطراز
Year|السنة
Trip no.|رقم الرحلة
Pick-up location|موقع الاستلام
Delivery location|موقع التسليم
Distance (km)|المسافة (كم)
Litres|لترات
Station|المحطة
Area (sqm)|المساحة (م²)
SKU|رمز الصنف
Barcode|الباركود
Min. stock|الحد الأدنى للمخزون
Lot / batch|الدفعة
GRN no.|رقم الاستلام
Dispatch no.|رقم الصرف
Account code|رمز الحساب
Account name|اسم الحساب
Entry no.|رقم القيد
Narration|البيان
Party|الطرف
Receipt no.|رقم الإيصال
Payment no.|رقم الدفعة
Bill no.|رقم الفاتورة
Vendor invoice no.|رقم فاتورة المورد
Opening date|تاريخ الافتتاح
Withdrawal|سحب
Deposit|إيداع
Matched to|مطابق مع
Expense|مصروف
Category|الفئة
Leave type|نوع الإجازة
Days|الأيام
Reason|السبب
Check-in|تسجيل الحضور
Check-out|تسجيل الانصراف
Hours|الساعات
Announcement|إعلان
Pinned|مثبت
Content|المحتوى
Documents|المستندات
Compensation|التعويضات
Company name|اسم الشركة
Address line 1|العنوان 1
Address line 2|العنوان 2
Address & contact|العنوان والتواصل
Tax & credit|الضريبة والائتمان
Relationship|العلاقة
Lead no.|رقم العميل المحتمل
Contact person|الشخص المسؤول
Contact name|اسم جهة الاتصال
Channel|القناة
Estimated value|القيمة التقديرية
Ticket|تذكرة
Subcontractor|مقاول من الباطن
Instructions|التعليمات
Delivered at|تاريخ التسليم
Customs line|بند جمركي
Description of goods|وصف البضاعة
Marks & numbers|العلامات والأرقام
Gross wt (kg)|الوزن الإجمالي (كجم)
Net wt (kg)|الوزن الصافي (كجم)
Weight (kg)|الوزن (كجم)
Pkgs|الطرود
CBM|م³
Freight|الشحن
Details|التفاصيل
From|من
To|إلى
Voyage|الرحلة
Shipments|الشحنات
Booking|حجز
Pickup|استلام
Ports|الموانئ
Consignments|الشحنات
`
export const AR: Record<string, string> = {}
for (const line of RAW.split('\n')) { const i = line.indexOf('|'); if (i > 0) AR[line.slice(0, i).trim()] = line.slice(i + 1).trim() }

// common interface strings
Object.assign(AR, {
  Save: 'حفظ', 'Save Changes': 'حفظ التغييرات', Cancel: 'إلغاء', Edit: 'تعديل', Create: 'إنشاء', Delete: 'حذف', Back: 'رجوع', Search: 'بحث', Export: 'تصدير', Filters: 'تصفية', Print: 'طباعة', Close: 'إغلاق', Send: 'إرسال', Post: 'ترحيل', Void: 'إلغاء المستند',
  'Log Out': 'تسجيل الخروج', Help: 'مساعدة', Blog: 'المدونة', Notifications: 'الإشعارات', Report: 'تقرير', 'Bulk Mail / Print': 'بريد / طباعة جماعية', 'Generate EDI': 'إنشاء EDI', KPI: 'مؤشرات الأداء', 'Generate Bulk PI': 'إنشاء فواتير مبدئية', 'Track-Trace': 'التتبع',
  Comments: 'التعليقات', 'Follow Up': 'المتابعة', References: 'المراجع', Tags: 'الوسوم', Links: 'الروابط', Likes: 'الإعجابات', Complaints: 'الشكاوى', 'Video Call': 'مكالمة فيديو', History: 'السجل',
  'Job info': 'معلومات الشحنة', Routing_: 'المسار', 'SB No/BOE No': 'رقم البيان الجمركي', Inventory: 'المخزون', Overview: 'نظرة عامة', 'Recent Jobs': 'أحدث الشحنات', 'Recent Call List': 'أحدث المكالمات', 'Recent Shipments': 'أحدث الشحنات الفرعية', 'Sales (Branch)': 'المبيعات (حسب الفرع)',
  'Welcome to Elvora Logistics OS': 'مرحباً بكم في نظام إلفورا للخدمات اللوجستية', 'Track and Manage Sales, Shipments, Jobs, Accounts and Warehouse': 'تتبع وإدارة المبيعات والشحنات والأوامر والحسابات والمستودعات',
  'All statuses': 'كل الحالات', 'Page': 'صفحة', 'No records': 'لا توجد سجلات', Loading: 'جارٍ التحميل…', Records: 'سجلات', 'New': 'جديد', Draft: 'مسودة', Posted: 'مرحّل', Paid: 'مدفوع', Open: 'مفتوح', Closed: 'مغلق', Pending: 'قيد الانتظار', Approved: 'معتمد', Rejected: 'مرفوض', Cancelled: 'ملغى',
  OPENED: 'مفتوح', 'IN PROGRESS': 'قيد التنفيذ', 'ON HOLD': 'معلّق', DELIVERED: 'تم التسليم', CLOSED: 'مغلق', CANCELLED: 'ملغى', 'Tax Invoice': 'فاتورة ضريبية', 'Credit Note': 'إشعار دائن', 'Debit Note': 'إشعار مدين', 'Proforma Invoice': 'فاتورة مبدئية',
  'Language': 'اللغة', 'Signed in as': 'تم الدخول باسم', 'Change it now': 'غيّرها الآن', 'You are signed in with the default password.': 'أنت تستخدم كلمة المرور الافتراضية.',
})
