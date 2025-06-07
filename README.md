# Iceberg Table Infrastructure with AWS CDK

This project demonstrates how to define, provision, and manage Apache Iceberg tables in AWS using the AWS Cloud Development Kit (CDK). It creates a scalable, modular data lakehouse foundation with proper infrastructure-as-code practices.

## 🚀 Overview

This repository provisions:
- **S3 buckets** to store Iceberg table data and schema files.
- **Glue Catalog databases and tables** compatible with Iceberg.
- **Athena queries via custom AWS SDK resources** for declarative table creation.
- **Automatic schema parsing from JSON** to Iceberg-compatible SQL.
- **Parameter storage in AWS SSM** for safe retrieval of table details.

It supports flexible schema definitions, optional SQL overrides, and SSM-based configuration for secure and reusable environments.

---

## 🧱 Project Structure

```bash
iceberg-tables-example/
├── bin/
│   └── createIcebergTables.ts     # CDK entry point to deploy infrastructure
├── lib/
│   ├── interfaces.ts              # TypeScript interfaces for table configuration
│   ├── bucketStack.ts            # CDK stack for creating secure S3 buckets
│   ├── icebergTableStack.ts      # CDK stack for deploying Iceberg tables
│   ├── utils.ts                  # Utilities for schema parsing, SSM access, and validation
│   └── versionedStack.ts         # Base class for versioned CDK stacks
├── data/
│   └── schemas/                  # JSON schema files for Iceberg tables
├── package.json
└── README.md                     # Project documentation (this file)
