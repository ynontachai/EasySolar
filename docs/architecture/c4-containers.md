# EasySolar Container Architecture

```mermaid
C4Container
  title Container Diagram - EasySolar Modular Monolith

  Person(solarBuyer, "Solar buyer", "ประเมิน Energy Fit")
  Person(professional, "EPC / installer", "คำนวณและสร้าง Package")
  Person(reviewer, "Data reviewer", "ตรวจข้อมูลและไฟล์")

  System_Boundary(easySolar, "EasySolar") {
    Container(webApp, "Web application", "Next.js, React, TypeScript", "Responsive UI and server application")
    Container(jobWorker, "Background worker", "Node.js", "Scan orchestration, extraction and report jobs")
    ContainerDb(postgres, "Application database", "PostgreSQL", "Catalog, assessment, project, package and commerce mapping")
    ContainerQueue(jobQueue, "Job queue", "Managed queue", "File and report job delivery")
  }

  Container_Ext(objectStorage, "Private object storage", "S3-compatible", "Datasheets, bills, quotes and reports")
  Container_Ext(scanner, "Malware scanner", "Managed or containerized scanner", "File safety verdict")
  Container_Ext(marketplace, "Marketplace", "Future external system", "Offers, orders and fulfillment")

  Rel(solarBuyer, webApp, "Uses assessment flow", "HTTPS")
  Rel(professional, webApp, "Uses catalog, engineering and package flows", "HTTPS")
  Rel(reviewer, webApp, "Uses verification workflow", "HTTPS")
  Rel(webApp, postgres, "Reads/writes transactions and snapshots", "SQL/TLS")
  Rel(webApp, objectStorage, "Creates signed upload/download intents", "S3 API/HTTPS")
  Rel(webApp, jobQueue, "Publishes file/report jobs", "Queue API")
  Rel(jobWorker, jobQueue, "Consumes jobs", "Queue API")
  Rel(jobWorker, objectStorage, "Reads/writes immutable assets", "S3 API/HTTPS")
  Rel(jobWorker, scanner, "Requests scan verdict", "API")
  Rel(jobWorker, postgres, "Updates asset/job state", "SQL/TLS")
  Rel(webApp, marketplace, "Exchanges package and offer references", "API/HTTPS, future")
```

## Deployment direction

Keep the web/API and domain engines in one deployable application initially. Add a worker and queue only when file scanning/OCR/report jobs begin. PostgreSQL and object storage are required before real Datasheets are published. Marketplace remains an integration boundary until transaction scope is approved.
