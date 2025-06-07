#!/usr/bin/env node
import 'source-map-support/register';

import { BucketStack } from '../lib/bucketStack';
import { IcebergTableStack } from '../lib/icebergTableStack';
import { TableBuildProps } from '../lib/interfaces';
import { app, stackProps } from './index';

const STACKPREFIX = "iceberg-example";

//////////////////////////////////////////////////
// create S3 bucket for the tables
//////////////////////////////////////////////////

const bucketStack = new BucketStack(
  app,
  `${STACKPREFIX}-Bucket`,
  `datalakehouse.${STACKPREFIX}`,
  stackProps
);

//////////////////////////////////////////////////
// create Iceberg table
//////////////////////////////////////////////////

const eventRecordsTableProps: TableBuildProps = {
  icebergTableName: "example_table",
  schemaFileName: "example_table.schema.json",
  catalogName: "glue_catalog",
  databaseName: "datalakehouse",
  bucketName: bucketStack.bucket.bucketName,
  bucketPrefix: "",
  schemaBucketName: bucketStack.bucket.bucketName,
  schemaBucketPrefix: "example_table/schemas/",
  partitionedBy: ["uid", "ts"]
};

const exampleTable = new IcebergTableStack(
  app,
  `${STACKPREFIX}-Table`,
  stackProps
);
exampleTable.createTable(eventRecordsTableProps);
