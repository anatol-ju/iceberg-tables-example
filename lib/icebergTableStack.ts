import { aws_iam as iam, aws_logs as logs, aws_s3 as s3, aws_ssm as ssm, Stack } from 'aws-cdk-lib';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { AwsCustomResource } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

import { EnvAwareStackProps, TableBuildProps } from './interfaces';
import {
    getArn, getParameter, getSdkCall, prepareSchemaAsset, readSqlSchemaFromJson
} from './utils';
import { VersionedStack } from './versionedStack';

export class IcebergTableStack extends VersionedStack {
    private readonly env: string;

    constructor(scope: Construct, id: string, props: EnvAwareStackProps) {
        super(scope, id, props);

        this.env = props.environment;
        const account = Stack.of(scope).account;
        const region = Stack.of(scope).region;
        if (!account || !region) {
            throw new Error('Account and region must be set to build the iceberg table stack.');
        }
    }

    /**
     * Creates a `PARTITIONED BY` statement that is then inserted in the query.
     * See: https://iceberg.apache.org/docs/latest/spark-ddl/#partitioned-by.
     *
     * @param partitionedBy - Instructions to use for table partitioning.
     * @returns A string to be used in the query, empty if no columns are specified.
     * @example
     * //input
     * ["id", "hour(ts)"]
     * //results in
     * "PARTITIONED BY (id, hour(ts)) "
     */
    private getPartitionedBy(partitionedBy?: Array<string>) {
        if (partitionedBy && partitionedBy.length > 0) {
            return `PARTITIONED BY (${partitionedBy.join(", ")}) `
        } else {
            return ""
        }
    }

    /**
     * Create a table in Iceberg format.
     *
     * This function uses a CustomResource that runs SQL queries in AWS Athena (through an AWS SDK call) when created.
     * The `onCreate` query creates the table and the `onDelete` and `onUpdate` queries are empty.
     *
     * It is possible to use custom queries through the properties that then overwrite existing ones.
     * You can specify the `onUpdate` query to change table structure and the `onDelete` query to drop table when stack is deleted.
     * If you want more control over how the table is created, you can also overwrite the `onCreate` query.
     * @param props Properties defining the table.
     */
    public createTable(props: TableBuildProps) {
        const prefix = this.node.id;
        const env = this.env;

        const role = new iam.Role(this, `${prefix}-LambdaRole`, {
            roleName: `${prefix}-LambdaRole`,
            assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"),
                iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonAthenaFullAccess")
            ]
        });
        // Add SSM GetParameter permissions to the role
        // The same role must be used with all custom resources in the stack
        role.addToPolicy(new iam.PolicyStatement({
            actions: [
                "ssm:GetParameter"
            ],
            resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/service/data/${env}/published/*`]
        }));

        // Use default bucket if no output bucket was provided
        let outputLocation = "";
        let runtimeBucketName = undefined;
        if (props.outputBucketName) {
            outputLocation = `s3://${props.outputBucketName}/${props.outputBucketPrefix ?? ""}`;
        } else {
            runtimeBucketName = getParameter(this, `${prefix}-RuntimeBucketSSM`, `/service/data/${env}/published/data-lake/runtime-bucket`, role);
            const athenaOutputLocation = "athena/queries";
            outputLocation = `s3://${runtimeBucketName}/${athenaOutputLocation}/`;
        }

        const columns = props.columns ?? readSqlSchemaFromJson(`./src/schemas/${props.schemaFileName}`, props.mapping);
        const location = `s3://${props.bucketName}/${props.bucketPrefix ?? ""}${props.icebergTableName}`;
        const createQuery = `CREATE TABLE IF NOT EXISTS ${props.icebergTableName} `.concat(
            `(`,
            columns,
            props.extraColumns ? `, ${props.extraColumns?.join(", ")}` : "",
            `) `,
            this.getPartitionedBy(props.partitionedBy),
            `LOCATION '${location}' `,
            `TBLPROPERTIES ('table_type'='ICEBERG', 'format'='parquet', 'write_compression'='snappy')`);

        const onCreateCall = props.onCreateQuery == undefined
            ? getSdkCall({
                tableName: props.icebergTableName,
                query: createQuery,
                databaseName: props.databaseName,
                outputLocation: outputLocation + "ddl/"
            })
            : getSdkCall({
                tableName: props.icebergTableName,
                query: props.onCreateQuery,
                databaseName: props.databaseName,
                outputLocation: outputLocation + "ddl/"
            });

        const onDeleteCall = props.onDeleteQuery == undefined ? undefined : getSdkCall({
            tableName: props.icebergTableName,
            query: props.onDeleteQuery,
            databaseName: props.databaseName,
            outputLocation: outputLocation + "ddl/"
        });

        const onUpdateCall = props.onUpdateQuery == undefined ? undefined : getSdkCall({
            tableName: props.icebergTableName,
            query: props.onUpdateQuery,
            databaseName: props.databaseName,
            outputLocation: outputLocation + "ddl/"
        });

        const tableRes = new AwsCustomResource(this, `${prefix}-CustomResourceIcebergTable`, {
            resourceType: "Custom::CustomResourceIcebergTable",
            onCreate: onCreateCall,
            onDelete: onDeleteCall,
            onUpdate: onUpdateCall,
            installLatestAwsSdk: false,
            role: role,
            logRetention: logs.RetentionDays.THREE_YEARS
        });

        // write schema file to S3
        const schemaBucketArn = getArn(this, `${prefix}-SchemaBucketArn`, props.schemaBucketName ?? props.bucketName, "s3");
        const schemaBucket = s3.Bucket.fromBucketArn(this, `${prefix}-SchemaBucket`, schemaBucketArn);

        const destinationKeyPrefix = props.schemaBucketPrefix ?? "/";

        const preparedSchemaDir = prepareSchemaAsset(props.schemaFileName);

        const schemaDeployment = new BucketDeployment(this, `${prefix}-SchemaDeployment`, {
            sources: [Source.asset(preparedSchemaDir)],
            destinationBucket: schemaBucket,
            destinationKeyPrefix: destinationKeyPrefix
        });

        const tableNameSsmParameter = `/service/data/${env}/published/iceberg/${props.icebergTableName.toLowerCase()}-name`;

        new ssm.StringParameter(this, `${prefix}-TableNameSsmParameter`, {
            parameterName: tableNameSsmParameter,
            stringValue: props.icebergTableName
        });

        const tableArnSsmParameter = `/service/data/${env}/published/iceberg/${props.icebergTableName.toLowerCase()}-arn`;

        new ssm.StringParameter(this, `${prefix}-TableArnSsmParameter`, {
            parameterName: tableArnSsmParameter,
            stringValue: `arn:aws:glue:${this.region}:${this.account}:table/${props.databaseName}/${props.icebergTableName}`
        });

        const bucketArnSsmParameter = `/service/data/${env}/published/iceberg/${props.icebergTableName.toLowerCase()}-bucket-arn`;

        new ssm.StringParameter(this, `${prefix}-BucketArnSsmParameter`, {
            parameterName: bucketArnSsmParameter,
            stringValue: s3.Bucket.fromBucketName(this, `${prefix}-Bucket`, props.bucketName).bucketArn
        });

        const locationSsmParameter = `/service/data/${env}/published/iceberg/${props.icebergTableName.toLowerCase()}-location`;

        new ssm.StringParameter(this, `${prefix}-locationSsmParameter`, {
            parameterName: locationSsmParameter,
            stringValue: location
        });

        const outputSsmParameter = `/service/data/${env}/published/iceberg/${props.icebergTableName.toLowerCase()}-output`;

        new ssm.StringParameter(this, `${prefix}-outputSsmParameter`, {
            parameterName: outputSsmParameter,
            stringValue: outputLocation + "temp/"
        });

        const tableSchemaLocationSsmParameter = `/service/data/${env}/published/iceberg/${props.icebergTableName.toLowerCase()}-schema-location`;

        new ssm.StringParameter(this, `${prefix}-TableSchemaLocationSsmParameter`, {
            parameterName: tableSchemaLocationSsmParameter,
            stringValue: `s3://${schemaBucket.bucketName}/${destinationKeyPrefix}${props.schemaFileName}`
        });
    }
}
