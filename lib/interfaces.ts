import { StackProps } from 'aws-cdk-lib';

export interface EnvAwareStackProps extends StackProps {
  environment: string;
}

/**
 * Properties that define a table created by an SQL query in AWS Athena.
 */
export interface TableBuildProps {
    /**
     * Name of the Iceberg table in the DataLakehouse.
     * Iceberg tables are always created using the table name as prefix in S3.
     * @example
     * icebergTableName = "example_table";
     * tableBucket = "iceberg_tables"
     * // resulting S3 path for table data
     * uri = "s3://iceberg_tables/example_table/data/"
     */
    icebergTableName: string,
    /**
     * The columns of the table as a string as pairs of column name and data type.
     * The value is a string as it would be written in a SQL query.
     * IMPORTANT: Data types have to be Iceberg compatible, see https://iceberg.apache.org/spec/#schemas-and-data-types.
     * If not provided, the schema is inferred from the schema file.
     * @example
     * columns='\
     * id string,\
     * date date,\
     * refs list<string>,\
     * options map<string, string>,\
     * other struct<col1: int, col2: float, col3: timestamp>
     */
    columns?: string,
    /**
     * Any columns (with data type) that are not included in the schema.
     * @example
     * extraColumns = ["ts timestamp", "sum float"]
     */
    extraColumns?: Array<string>,
    /**
     * Name of the database in AWS Glue.
     */
    databaseName: string,
    /**
     * The AWS Glue catalog's name.
     */
    catalogName: string,
    /**
     * Name of the JSON file with the schema of the table.
     * This is relative to `data/schemas/` directory.
     */
    schemaFileName: string,
    /**
     * An optional dictionary to be used as a mapping.
     * It has to be in the form:
     * ```
     * {
     *   "existing_col_name": {
     *     "new_col_name": {"type": "new_type"}
     *   }
     * }
     * ```
     */
    mapping?: any,
    /**
     * Name of the S3 bucket where the table is stored.
     */
    bucketName: string,
    /**
     * An optional prefix to be used in the S3 path, must end with '/'.
     * Resolves to 's3://${bucketName}/${bucketPrefix}${tableName}/'.
     */
    bucketPrefix?: string,
    /**
     * The name of the bucket where the Athena query data should be stored.
     * If not specified, the default location is used.
     */
    outputBucketName?: string,
    /**
     * An optional prefix to be used in the S3 path for the output bucket.
     * Can be used without the `outputBucketName` parameter. In this case
     * `bucketName` and `bucketPrefix` are used for the location.
     * Resolves to 's3://${outputBucketName}/${outputBucketPrefix}/${tableName}'.
     */
    outputBucketPrefix?: string,
    /**
     * The name of the bucket where the schema file is saved, using the table name as prefix.
     * If not specified, `bucketName` and `bucketPrefix` are used for the location.
     */
    schemaBucketName: string,
    /**
     * An optional prefix to be used in the S3 path for the output bucket.
     * Can be used without the `schemaBucketName` parameter. In this case
     * `bucketName` and `bucketPrefix` are used for the location.
     * Resolves to 's3://${schemaBucketName}/${schemaBucketPrefix}/${tableName}'.
     */
    schemaBucketPrefix?: string,
    /**
     * An optional instruction on how to partition the table.
     * See: https://iceberg.apache.org/spec/#schemas-and-data-types.
     * @example
     * partitionedBy = ['id', 'hour(date_col)']
     */
    partitionedBy?: Array<string>,
    /**
     * An optional SQL query that is used when the resource is **created**.
     * WARNING: This overwrites the default behaviour, that is creating the table.
     * Use this only to change **how** the table is created.
     */
    onCreateQuery?: string,
    /**
     * An optional SQL query that is used when the resource is **updated**.
     * This can be used to update the table.
     */
    onUpdateQuery?: string,
    /**
     * An optional SQL query that is used when the resource is **deleted**.
     * WARNING: This overwrites the default behaviour, that is deleting the table.
     * This can be set to `undefined` to not do anything when the resource is deleted.
     */
    onDeleteQuery?: string
}

/**
 * Properties to define AWS SDK calls to be used in
 * AwsCustomResource objects.
 */
export interface SdkCallProps {
    /**
     * Name of the table.
     */
    tableName: string,
    /**
     * The query to be used for the SDK call.
     */
    query: string,
    /**
     * Name of the database as the context for the query.
     */
    databaseName: string,
    /**
     * The S3 location where the query output is stored.
     */
    outputLocation: string
}
