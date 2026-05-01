# HYSA (Pure PHP + MySQL)

هذا مجلد جاهز للرفع على استضافة PHP/MySQL مثل InfinityFree (بدون Node.js).

## 1) قاعدة البيانات

1. أنشئ قاعدة بيانات MySQL من لوحة التحكم.
2. استورد ملف `schema.sql` في phpMyAdmin.

## 2) إعداد الاتصال

عدّل الملف `api/db.php` وضع بيانات MySQL:

- `DB_HOST`
- `DB_NAME`
- `DB_USER`
- `DB_PASS`

## 3) الرفع (Upload)

ارفع محتويات مجلد `php/` إلى `htdocs/` في الاستضافة بحيث تكون المسارات:

- `/index.html`
- `/app.js`
- `/styles.css`
- `/api/...`
- `/uploads/...`

وتأكد أن مجلد `uploads/` موجود وقابل للكتابة.
