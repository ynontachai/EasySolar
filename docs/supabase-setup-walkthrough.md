# EasySolar Supabase Setup Walkthrough

คู่มือนี้พา EasySolar จากโครงปัจจุบันไปสู่ Supabase Database, private Datasheet Storage และ Auth/RBAC โดยไม่เปิดข้อมูลหรือ secret เกินจำเป็น

## เป้าหมายรอบแรก

เมื่อจบรอบ setup ระบบควรมี:

- Supabase project สำหรับ development/staging
- PostgreSQL schema จาก migration ปัจจุบัน
- Vercel Preview เชื่อมฐานข้อมูลผ่าน transaction pooler
- private bucket ชื่อ `easysolar-private`
- Datasheet upload/download ผ่าน S3-compatible adapter เดิม
- รายการงานชัดเจนสำหรับแทน `EASYSOLAR_ADMIN_TOKEN` ด้วย Supabase Auth และ RLS

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

โปรเจกต์มี migration เดิมสองไฟล์:

- `db/migrations/0001_initial.sql`
- `db/migrations/0002_datasheet_assets.sql`

ก่อน push ให้ย้ายเนื้อหาไปเป็น migration แบบ timestamp ภายใต้ `supabase/migrations/` โดยรักษาลำดับเดิม เช่น:

```text
supabase/migrations/202610290001_initial.sql
supabase/migrations/202610290002_datasheet_assets.sql
```

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

หลัง push ให้เปิด Table Editor และตรวจ `manufacturer`, `product_model`, `datasheet_revision`, `asset` และ `datasheet_asset`

Migration ปัจจุบันยังไม่มี RLS policy จึงห้ามเปิด Data API ให้ client ใช้ schema นี้ในรอบ bootstrap ให้ปิด automatic exposure/revoke grants หรือเพิ่ม security migration ที่เปิด RLS โดยไม่มี client policy ก่อนนำข้อมูลจริงเข้า จากนั้นค่อยเพิ่ม grants + policies ที่ผ่านการทดสอบในรอบ A0

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

## Step 5 — ตั้งค่าชั่วคราวสำหรับ Datasheet intake

ก่อน Auth/RBAC พร้อม ให้ใช้ bootstrap token เฉพาะ Preview:

```text
EASYSOLAR_ADMIN_TOKEN=<random secret>
EASYSOLAR_SCANNER_TOKEN=<different random secret>
FILE_SCAN_MODE=external
APP_ENVIRONMENT=staging
```

ห้ามใช้ token เดียวกันสำหรับ Admin และ Scanner และห้ามเปิด `trusted-dev` บน Production

จากนั้น redeploy Preview แล้วตรวจ `/admin/equipment` ว่าสถานะ Database, Storage และ Admin auth เป็น ready

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

## Step 7 — แทน bootstrap token ด้วย Supabase Auth/RBAC

ทำเป็น implementation slice A0 ก่อนเปิด Admin ให้ผู้ใช้จริง:

1. ติดตั้ง `@supabase/supabase-js` และ `@supabase/ssr`
2. ใช้ cookie-based session สำหรับ Next.js App Router
3. สร้าง identity/organization/role migrations ตาม Admin Catalog Operations Plan
4. เปิด RLS และกำหนด grants สำหรับทุก table/view ที่ Data API มองเห็น
5. ใช้ Custom Access Token Auth Hook ใส่ coarse role/scope claims
6. ให้ database permission functions และ RLS เป็นผู้ตัดสินสิทธิ์จริง
7. invite ผู้ใช้จาก trusted server หรือ Supabase Dashboard เท่านั้น
8. ลบช่องกรอก `EASYSOLAR_ADMIN_TOKEN` และถอด token ออกจาก Production
9. เปิด step-up authentication สำหรับการ assign Super Admin, recall และ emergency access

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
| `EASYSOLAR_ADMIN_TOKEN` | No | Temporary manual secret | Bootstrap only; remove in A0 |
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
