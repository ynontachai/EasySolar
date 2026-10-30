# EasySolar Supabase Setup Walkthrough

คู่มือนี้พา EasySolar จากโครงปัจจุบันไปสู่ Supabase Database, private Datasheet Storage และ Auth/RBAC โดยไม่เปิดข้อมูลหรือ secret เกินจำเป็น

## เป้าหมายรอบแรก

เมื่อจบรอบ setup ระบบควรมี:

- Supabase project สำหรับ development/staging
- PostgreSQL schema จาก migration ปัจจุบัน
- Vercel Preview เชื่อมฐานข้อมูลผ่าน transaction pooler
- private bucket ชื่อ `easysolar-private`
- Datasheet upload/download ผ่าน S3-compatible adapter เดิม
- Supabase Auth แบบ invite-only พร้อม role `account_admin`, `reviewer`, `super_admin`

รอบแรกยังไม่เปิด production data และยังไม่เปิด public signup

## Architecture ที่เลือก

```text
Browser
  -> EasySolar on Vercel
       -> Supabase Postgres transaction pooler
       -> Supabase Storage S3 endpoint
       -> Supabase Auth (รอบ A0)
```

EasySolar ใช้ `postgres` และ AWS S3 SDK อยู่แล้ว จึงเริ่มเชื่อม Supabase ได้โดยไม่เปลี่ยน data-access layer ทั้งหมด:

- Database อ่าน `DATABASE_URL` ก่อน และ fallback ไป `POSTGRES_URL` ที่ Vercel integration สร้างให้
- Postgres.js ใช้ `prepare: false` และ default pool size `1` ซึ่งเหมาะกับ transaction pooler บน serverless
- Storage ใช้ Supabase S3 endpoint โดยตั้ง `S3_FORCE_PATH_STYLE=true`

ข้อจำกัดสำคัญ: Supabase S3 access keys มีสิทธิ์ทุก bucket และข้าม Storage RLS ใช้ได้เฉพาะ server เท่านั้น รอบ MVP จึงให้ EasySolar API ตรวจ session/permission ก่อนสร้าง signed URL ทุกครั้ง เมื่อ Auth พร้อมแล้วจึงพิจารณาเปลี่ยนเป็น Storage API หรือ S3 session token เพื่อบังคับ RLS ตามผู้ใช้

## ข้อมูลที่ต้องตกลงก่อนเริ่ม

ส่งข้อมูลที่ไม่เป็นความลับให้ทีมพัฒนาได้:

1. ชื่อ Supabase organization และ project
2. Project ref และ region ที่เลือก
3. อีเมล Super Admin คนแรก
4. อีเมล Account Admin/Reviewer ชุดแรก
5. Site URL ของ Production และ Preview URL ที่ใช้ทดสอบ invite
6. ยืนยันว่า MVP เป็น single organization หรือ multi-organization
7. ยืนยันว่าจะเปิด four-eyes approval ตั้งแต่ MVP หรือไม่

ห้ามส่ง Database password, `sb_secret_...`, S3 secret access key หรือ personal access token ผ่าน chat, email หรือ commit ให้กรอกค่าเหล่านี้ตรงใน Supabase/Vercel dashboard หรือใช้ password manager ที่เข้ารหัส

## Step 1 — สร้าง Supabase project

ทางเลือกที่แนะนำสำหรับโปรเจกต์นี้คือ Vercel Marketplace เพราะโปรเจกต์ Vercel มีอยู่แล้วและ integration จะ sync environment variables ให้

1. เปิด Vercel project `easy-solar`
2. ไปที่ `Storage` หรือ `Integrations` แล้วเลือก Supabase
3. กด `Install`
4. สร้าง Supabase project ใหม่สำหรับ development/staging
5. เลือก region ที่ใกล้ผู้ใช้ในไทยและใกล้ Vercel Function region ที่จะใช้
6. เก็บ database password ใน password manager
7. เปิด Supabase Studio จาก Vercel แล้วจดเฉพาะ Project ref

ถ้ามี Supabase project อยู่แล้ว ให้เชื่อม project เดิมแทนการสร้างซ้ำ และตรวจว่า Vercel sync variables ครบ

เมื่อใช้ custom prefix `SUPABASE` Integration จะสร้างค่าฐานข้อมูลเป็น `SUPABASE_POSTGRES_URL` พร้อม `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ใน Vercel

## Step 2 — ตั้ง Database connection สำหรับ Vercel

1. ใน Supabase กด `Connect`
2. เลือก Transaction pooler
3. ตรวจว่า URI ใช้ port `6543`
4. ตรวจว่า connection string บังคับ SSL เช่น `sslmode=require`
5. ใน Vercel ตั้ง `DATABASE_POOL_MAX=1` สำหรับ Preview และ Production
6. ไม่ต้องสร้าง `DATABASE_URL` ซ้ำ เพราะ EasySolar fallback ไปใช้ `POSTGRES_URL` หรือ `SUPABASE_POSTGRES_URL` จาก integration

ใช้ direct connection สำหรับ migration, backup และงาน admin เท่านั้น แอปบน Vercel ต้องใช้ transaction pooler

## Step 3 — นำ migration เดิมเข้า Supabase CLI

Migration ที่ใช้งานจริงอยู่ใน `supabase/migrations/` และต้อง apply ตามลำดับ timestamp ห้ามย้อนกลับไปใช้ไฟล์ bootstrap ใน `db/migrations/` กับ remote project

จากเครื่องพัฒนา:

```bash
npx supabase init
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push --dry-run
npx supabase db push
npx supabase migration list
```

กฎการทำงาน:

- รัน `--dry-run` และอ่าน SQL impact ก่อนทุกครั้ง
- ห้ามใช้ `supabase db reset --linked` กับ production เพราะคำสั่งลบข้อมูล remote
- ห้ามแก้ migration ที่เคย apply แล้ว ให้สร้าง migration ใหม่
- ใช้ seed เฉพาะ development/staging และห้ามใส่ข้อมูลลูกค้าจริง

หลัง push ให้เปิด Table Editor และตรวจ `manufacturer`, `product_model`, `datasheet_revision`, `asset`, `datasheet_asset`, `organization`, `user_profile`, `role_assignment`, `product_variant` และ `audit_event` ตาราง Admin เปิด RLS แล้ว และสิทธิ์จริงยังถูกตรวจซ้ำที่ trusted server action

## Step 4 — สร้าง private Storage bucket

1. ไปที่ Supabase `Storage`
2. สร้าง bucket `easysolar-private`
3. ตั้ง bucket เป็น private
4. จำกัด Datasheet เป็น `application/pdf` และขนาดเริ่มต้น 25 MB
5. เปิด Storage S3 settings แล้วสร้าง access key สำหรับ EasySolar server โดยเฉพาะ
6. เก็บ access key และ secret ใน Vercel เท่านั้น

ตั้งค่า Vercel:

```text
S3_BUCKET=easysolar-private
S3_REGION=<ค่าจากหน้า Storage S3>
S3_ENDPOINT=https://<PROJECT_REF>.storage.supabase.co/storage/v1/s3
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY_ID=<server-only>
S3_SECRET_ACCESS_KEY=<server-only>
```

ทดสอบ browser preflight และ `PUT` ด้วย header ที่ระบบใช้:

```text
content-type
x-amz-checksum-sha256
x-amz-meta-assetid
x-amz-meta-sha256hex
```

ถ้า browser upload ติด CORS ห้ามแก้ด้วยการทำ bucket เป็น public ให้เปลี่ยนไปใช้ Supabase signed upload API หรือรับไฟล์ผ่าน server route จนกว่าจะยืนยัน configuration ที่ปลอดภัย

Supabase Storage S3 ยังไม่รองรับ S3 object versioning EasySolar จึงต้องใช้ immutable object key และสร้าง Datasheet revision ใหม่ทุกครั้ง ห้าม overwrite ไฟล์ที่ publish แล้ว

## Step 5 — เปิด Admin Auth และสร้าง Super Admin คนแรก

1. ใน Supabase Auth ปิด public sign-up และสร้าง/Invite user ด้วยอีเมลของเจ้าของระบบ
2. ตั้ง Email Template ของ invite ให้พาไปที่
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/admin/set-password`
3. เพิ่ม Production URL และ Preview URL ที่ใช้ทดสอบใน Auth URL Configuration
4. เมื่อ user ถูกสร้างแล้ว ให้รัน SQL ต่อไปนี้ใน SQL Editor โดยแทนค่าอีเมลจริง:

```sql
insert into public.role_assignment (user_id, role_code, organization_id)
select id, 'super_admin', null
from auth.users
where lower(email) = lower('<SUPER_ADMIN_EMAIL>')
on conflict do nothing;
```

5. เปิด `/admin/login` ตั้งรหัสผ่านผ่าน invite แล้วตรวจว่าเห็น role `Super Admin`

## Step 6 — ส่งคำเชิญ Account Admin / Reviewer ผ่านหน้าเว็บ

หน้า `/admin/users` (เฉพาะ Super Admin) เรียก `auth.admin.inviteUserByEmail` จาก server action แล้วบันทึก `organization_member`, `role_assignment` และ `audit_event` (`user.invited`) ให้อัตโนมัติ

- ตั้งค่า `SUPABASE_SERVICE_ROLE_KEY` ใน environment ฝั่ง server เท่านั้น ห้ามใส่ใน `NEXT_PUBLIC_*`
- ตั้ง Email Template ของ invite ตาม Step 5 ให้ใช้ `token_hash` และ `type=invite` เพราะ `/auth/confirm` รับ token รูปแบบนี้
- Supabase ส่งอีเมลจาก SMTP ที่ตั้งไว้ใน project; ถ้าใช้ built-in email ควรตั้ง custom SMTP ก่อนใช้งานจริง
- ถ้าการบันทึกสิทธิ์ใน Postgres ล้มเหลว ระบบจะลบ auth user ที่เพิ่งสร้างเพื่อให้ส่งคำเชิญใหม่ได้

สำหรับ Account Admin ให้สร้าง user ใน Auth ก่อน แล้วรัน:

```sql
insert into public.organization_member (organization_id, user_id, status)
select '00000000-0000-4000-8000-000000000001', id, 'active'
from auth.users
where lower(email) = lower('<ACCOUNT_ADMIN_EMAIL>')
on conflict (organization_id, user_id) do nothing;

insert into public.role_assignment (user_id, role_code, organization_id)
select id, 'account_admin', '00000000-0000-4000-8000-000000000001'
from auth.users
where lower(email) = lower('<ACCOUNT_ADMIN_EMAIL>')
on conflict do nothing;
```

Admin session ใช้ Supabase cookie Auth; ไม่มีช่อง token ใน browser อีกต่อไป ส่วน `EASYSOLAR_SCANNER_TOKEN` ยังเป็น machine-to-machine credential แยกต่างหาก

## Step 6 — ทดสอบแบบ end-to-end

ทดสอบด้วย PDF ที่ไม่ใช่ข้อมูลลับ:

1. ขอ upload intent จากหน้า Admin
2. อัปโหลด PDF ไป signed URL
3. finalize และตรวจ SHA-256, media type และขนาดไฟล์
4. ส่ง scan verdict เป็น `clean` จาก trusted scanner callback
5. ตรวจว่า asset เปลี่ยนเป็น `available`
6. ขอ signed download URL และเปิดไฟล์ได้
7. ตรวจว่า URL หมดอายุหลัง TTL
8. ลองเรียก upload/download โดยไม่มี token และต้องถูกปฏิเสธ
9. ตรวจ database row และ object key ว่าไม่มีชื่อหรืออีเมลผู้ใช้

Release gate ของรอบนี้:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- Vercel Preview health check ผ่าน
- ไม่มี secret ใน Git history, browser bundle หรือ application logs

## Step 7 — ตรวจ Supabase Auth/RBAC ที่ติดตั้งแล้ว

Slice A0 ติดตั้ง cookie-based Auth, identity tables, role scope, RLS, protected Admin routes และ audit สำหรับการสร้าง SKU แล้ว ก่อนเปิดใช้งานจริงให้ทดสอบว่า:

1. ผู้ที่ไม่ login ถูกส่งไป `/admin/login`
2. ผู้ไม่มี role ถูกส่งไป `/admin/access-pending`
3. Account Admin สร้าง SKU ได้เฉพาะ organization ของตน
4. Reviewer อ่านได้แต่สร้าง SKU ไม่ได้
5. Super Admin เห็นทุก organization
6. SKU ซ้ำถูกปฏิเสธและการสร้างสำเร็จมี `audit_event`
7. Datasheet upload ใช้ session เดียวกันและไม่มี browser token

Custom claims และ step-up authentication สำหรับงานเสี่ยงสูงเป็น hardening slice ถัดไป; permission source of truth ปัจจุบันยังอยู่ใน Postgres และ trusted server action

Application role (`account_admin`, `reviewer`, `super_admin`) ไม่ใช่ Supabase organization role และต้องเก็บในตารางของ EasySolar เอง

## Environment checklist

| Variable | Browser-safe | Source | ใช้ทำอะไร |
| --- | :---: | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Vercel integration | Supabase client URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Vercel integration | Browser client ภายใต้ RLS |
| `SUPABASE_SECRET_KEY` | No | Vercel integration | Trusted admin/server operations |
| `POSTGRES_URL` | No | Vercel integration | Vercel runtime database connection |
| `SUPABASE_POSTGRES_URL` | No | Vercel integration with custom prefix | Vercel runtime database connection |
| `DATABASE_POOL_MAX` | No | Manual: `1` | จำกัด connection ต่อ instance |
| `S3_ACCESS_KEY_ID` | No | Supabase Storage S3 | Server-side object access |
| `S3_SECRET_ACCESS_KEY` | No | Supabase Storage S3 | Server-side object access |
| `EASYSOLAR_SCANNER_TOKEN` | No | Scanner integration | Scanner callback auth |

## จุดที่ต้องหยุดและขออนุมัติ

ทีมพัฒนาต้องขอ owner ยืนยันก่อน:

- สร้าง Supabase project ที่มีค่าใช้จ่าย
- apply migration ไปยัง production
- invite ผู้ใช้จริง
- เปลี่ยน Storage/Auth policy
- ใส่หรือ rotate production secret
- ลบหรือ reset remote data

## Official references

- [Vercel Marketplace integration](https://supabase.com/docs/guides/integrations/vercel-marketplace)
- [Connect to Postgres and choose a pooler](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Serverless Postgres drivers](https://supabase.com/docs/guides/database/connecting-to-postgres/serverless-drivers)
- [Supabase CLI workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Storage S3 authentication](https://supabase.com/docs/guides/storage/s3/authentication)
- [Storage S3 compatibility](https://supabase.com/docs/guides/storage/s3/compatibility)
- [API key security](https://supabase.com/docs/guides/getting-started/api-keys)
- [Next.js server-side Auth](https://supabase.com/docs/guides/auth/server-side)
- [Invite users](https://supabase.com/docs/guides/auth/users)
- [Custom claims and RBAC](https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
