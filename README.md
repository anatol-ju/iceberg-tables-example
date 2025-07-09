# Iceberg Table Infrastructure with AWS CDK

This project demonstrates how to define, provision, and manage Apache Iceberg tables in AWS using the AWS Cloud Development Kit (CDK). It creates a scalable, modular data lakehouse foundation with proper infrastructure-as-code practices.

> 🛠️ This repository was created for demonstration purposes and is part of my engineering portfolio. While it can be adapted for real use cases, it is not actively maintained for production.

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
│   └── createIcebergTables.ts    # CDK entry point to deploy infrastructure
├── lib/
│   ├── interfaces.ts             # TypeScript interfaces for table configuration
│   ├── bucketStack.ts            # CDK stack for creating secure S3 buckets
│   ├── icebergTableStack.ts      # CDK stack for deploying Iceberg tables
│   ├── utils.ts                  # Utilities for schema parsing, SSM access, and validation
│   └── versionedStack.ts         # Base class for versioned CDK stacks
├── data/
│   └── schemas/                  # JSON schema files for Iceberg tables
├── package.json
└── README.md                     # Project documentation (this file)
```

---

## 🔧 Features
- Environment-aware deployments via EnvAwareStackProps
- Custom SQL support with onCreateQuery, onUpdateQuery, and onDeleteQuery
- JSON Schema → SQL column mapping with custom type conversions
- SSM-resolved parameters for runtime bucket config and outputs
- Partitioned table support for efficient querying
- Reusable IAM roles with scoped permissions
- Schema upload to S3 for transparency and auditing

---

## 📦 Prerequisites
- Node.js ≥ 16
- AWS CDK v2
- AWS credentials with permissions for:
- S3
- Athena
- Glue
- SSM
- IAM

Install dependencies:
```bash
yarn install
```

---

## 🚚 Deploying the Stack
1.	Configure your environment
    Edit `stackProps` and `environment` settings in `bin/createIcebergTables.ts`.
2.	Add your JSON schema
    Place your Iceberg-compatible schema in `data/schemas/your_table.schema.json`.
3.	Define your table properties
    Adjust or add a new `TableBuildProps` object in `createIcebergTables.ts`.
4.	Deploy
    ```
    yarn deploy:dev
    ```

This will:
- Create the bucket
- Upload schema to S3
- Create an Iceberg table using Athena
- Store key table metadata in SSM

---

## 🧪 Example Schema Mapping

Here’s an example of a JSON schema-to-Iceberg conversion using the mapping feature:
```typescript
const mapping = {
  "json_str": {
    "json_map": {
      "type": "map",
      "properties": {
        "key": { "type": "string" },
        "value": { "type": "integer" }
      }
    }
  }
};
```
This will rename `json_str` to `json_map` and convert it to `map<string, int>` in the resulting SQL schema.

---

## 🔍 Outputs

After deployment, the following will be saved in AWS Systems Manager Parameter Store:
- Table name
- Table ARN
- Table S3 location
- Output S3 path for Athena
- Path to schema in S3

These can be referenced across your infrastructure for consistency.

---

## 📋 Local Setup

To spin up a fully local test environment (no real AWS):

1. Ensure Docker and Docker Compose are installed on your machine.
2. From the project root, bring up all services:
   ```bash
   make start
   ```
   This starts two containers:
   - **localstack**: emulates AWS S3, Glue, CloudFormation, IAM, STS
   - **cdk**: runs `cdklocal` to bootstrap and deploy your CDK stacks into LocalStack

3. Deploy your CDK stacks locally:
   ```bash
   make deploy
   ```
   This uses `cdklocal` to create S3 buckets, Glue databases, and Iceberg tables in LocalStack.

4. Inspect your bucket contents (optional):
   ```bash
   awslocal s3 ls s3://<your-warehouse-bucket>/warehouse/ --recursive
   ```
   or from your host:
   ```bash
   aws s3 ls s3://<your-warehouse-bucket>/warehouse/ --recursive \
       --endpoint-url http://localhost:4566 --region eu-west-1
   ```

You now have a zero-cost, offline playground for developing and testing your Iceberg CDK stacks.

IMPORTANT:

The deployment can be shown as successful, but you can't access the table.
This is because Localstack Pro is required to use AWS Glue.
You can still use this setup with the standard Localstack to test whether your CDK stack can be deployed.

---

## 📖 Learn More

- [Apache Iceberg Docs](https://iceberg.apache.org/docs/nightly/)
- [AWS CDK Docs](https://docs.aws.amazon.com/cdk/v2/guide/home.html)
- [AWS Athena Iceberg Setup](https://docs.aws.amazon.com/athena/latest/ug/querying-iceberg.html)
- [Glue Overview](https://docs.aws.amazon.com/glue/latest/dg/what-is-glue.html)

---

## 🧑‍💻 Author

Anatol Jurenkow

Cloud Data Engineer | AWS CDK Enthusiast | Iceberg Fan

(https://github.com/anatol-ju)[GitHub] · (https://de.linkedin.com/in/anatol-jurenkow)[LinkedIn]

---

## 📄 License

“This project is for portfolio purposes only. Please contact me if you’d like to reuse or adapt this code.”
