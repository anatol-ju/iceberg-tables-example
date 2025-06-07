import { Construct } from 'constructs';
import fs from 'fs';
import { join } from 'path';

import { SdkCallProps } from './interfaces';
import { Role } from 'aws-cdk-lib/aws-iam';
import {
    AwsCustomResource, AwsCustomResourcePolicy, AwsSdkCall, PhysicalResourceId
} from 'aws-cdk-lib/custom-resources';
import { Stack } from 'aws-cdk-lib';

/**
 * Returns an object defining an AwsSdkCall for an AwsCustomResource.
 *
 * @param props Properties for the SDK Call.
 * @returns An AwsSdkCall object with to be used with AwsCustomResource.
 */
export function getSdkCall(props: SdkCallProps): AwsSdkCall {
    return {
        service: "Athena",
        action: "startQueryExecution",
        parameters: {
            "QueryExecutionContext": {
                "Database": props.databaseName,
            },
            "QueryString": props.query,
            "ResultConfiguration": {
                "OutputLocation": props.outputLocation
            },
            "WorkGroup": "primary"
        },
        physicalResourceId: PhysicalResourceId.of(`CustomResourceIcebergTable-${props.tableName}`)
    };
}

/**
 * This helper function isolates a single file into a temporary folder
 * so that it can be used as an asset in a CDK deployment, avoiding globbing issues
 * with the `BucketDeployment` construct.
 *
 * @param schemaFileName The name of the schema file to prepare, e.g. `my_schema.json`.
 *  The file must be located in the `data/schemas/` folder.
 * @returns The path to the temporary folder containing the schema file.
 */
export function prepareSchemaAsset(schemaFileName: string): string {
    const tempDir = join(__dirname, `../cdk.out/schema-deploy/${schemaFileName}`);
    const inputPath = join(__dirname, `../data/schemas/${schemaFileName}`);

    fs.mkdirSync(tempDir, { recursive: true });
    fs.copyFileSync(inputPath, join(tempDir, schemaFileName));

    return tempDir;
}

/**
 * Keywords that are reserved for use in AWS Athena DDL queries.
 * If used as field names, they must be quoted with backticks.
 */
const RESERVED_KEYWORDS = [
    "all", "alter", "and", "array", "as", "authorization", "between", "bigint",
    "binary", "boolean", "both", "by", "case", "cashe", "cast", "char", "column",
    "conf", "constraint", "commit", "create", "cross", "cube", "current",
    "current_date", "current_timestamp", "cursor", "database", "date",
    "dayofweek", "decimal", "delete", "describe", "distinct", "double", "drop",
    "else", "end", "exchange", "exists", "extended", "external", "extract",
    "false", "fetch", "float", "floor", "following", "for", "foreign", "from",
    "full", "function", "grant", "group", "grouping", "having", "if", "import",
    "in", "inner", "insert", "int", "integer", "intersect", "interval", "into",
    "is", "join", "lateral", "left", "less", "like", "local", "macro", "map",
    "more", "none", "not", "null", "numeric", "of", "on", "only", "or", "order",
    "out", "outer", "over", "partialscan", "partition", "percent", "preceding",
    "precision", "preserve", "primary", "procedure", "range", "reads", "reduce",
    "regexp", "references", "revoke", "right", "rlike", "rollback", "rollup",
    "row", "rows", "select", "set", "smallint", "start", "table", "tablesample",
    "then", "time", "timestamp", "to", "transform", "trigger", "true", "truncate",
    "unbounded", "union", "uniquejoin", "update", "user", "using", "utc_timestamp",
    "values", "varchar", "views", "when", "where", "window", "with"];

/**
 * Validates a column name.
 * - Surrounds reserved words with backticks, for example ``` database -> `database` ```.
 * - Removes any non-alphanumeric characters, except underscore `_` and dash `-`.
 * @param fieldName The name of the column to be validated.
 * @returns The validated version of the column name as a string.
 */
export function validatedFieldName(fieldName: string): string {
    if (fieldName.length == 0) {
        return ""
    }
    if (RESERVED_KEYWORDS.includes(fieldName.toLowerCase())) {
        return "`" + fieldName.replace(/[^a-zA-Z0-9_-]/g, "") + "`"
    } else {
        return fieldName.replace(/[^a-zA-Z0-9_-]/g, "")
    }
}

/**
 * Create a string representation of a JSON schema to be used in SQL `CREATE TABLE` query.
 *
 * Since the JSON schema format is limited and does not support many data types that are used
 * in databases, the `mapping` parameter can be used to modify the columns.
 * In nested data types (like `struct`), only the top-level (column definition) is modified.
 *
 * IMPORTANT: Any "custom" data types used in the mapping that are not part of the original
 * JSON schema specification, must be handled in the `readSqlSchemaFromObject` function.
 * Otherwise an Error is raised.
 * All resulting data types must be compliant with Athena schema.

 * Currently supported types are:
 * - `float` signed 32-bit floating point numbers
 * - `date`: objects representing a date `yyyy-MM-dd` without timezone or time
 * - `datetime`: datetime in the format `yyyy-MM-dd HH:mm:ss[.f...]`, converted to `timestamp` for compatibility with Athena
 * - `timestamp`: unix epoch time in microseconds without timezone, converted to `bigint` for compatibility with Athena
 * - `long`: signed 64-bit integer, converted into `bigint` for compatibility with Athena
 * - `decimal`: decimal objects are numbers with precision (digits before the `.`)
 * and scale (digits after the `.`), use like ```properties: {precision: 5, scale: 2}```
 * - `map`: dictionary without column name information, use like ```properties: {key: {type: "string"}, value: {type: "integer"}}```
 *
 * Unsupported:
 * - `null`: columns that can only have `null` values
 *
 * JSON schema: https://json-schema.org/understanding-json-schema/reference.
 * Athena schema: https://docs.aws.amazon.com/athena/latest/ug/data-types.html.
 * Iceberg schema: https://iceberg.apache.org/docs/latest/schemas/#schemas.
 *
 * @param filePath Path to local JSON file containing the schema.
 * @param mapping Optional dictionary to replace JSON schema column definitions.
 * @returns A single string with comma separated column definitions.
 * Example output: `id string, ts timestamp`.
 *
 * @example
 * // rename column 'json_str' to 'json_map'
 * // and use 'map' data type with 'string' as key and 'integer' as value
 * const mapping = {
 *     "json_str": {
 *         "json_map": {
 *             "type": "map",
 *             "properties": {
 *                 "key": {"type": "string"},
 *                 "value": {"type": "integer"}
 *             }
 *         }
 *     }
 * }
 * // results in
 * json_map map<string,int>
 */
export function readSqlSchemaFromJson(filePath: string, mapping?: any): string {
    const file_content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(file_content);

    const result: string = parseSqlSchemaFromObject(data, mapping);

    if (result.startsWith("struct<") && result.endsWith(">")) {
        return result.substring(7, result.length - 1)
    } else {
        return result
    }
}

function parseSqlSchemaFromObject(data: any, mapping?: any): any {
    if (data["type"] == undefined || typeof data["type"] !== "string") {
        if (data["properties"] !== undefined) {
            return parseSqlSchemaFromObject(data["properties"], mapping)
        } else {
            let arr: Array<string> = new Array<string>();
            for (const key in data) {
                if (mapping && key in mapping) {
                    let newKey = Object.keys(mapping[key])[0];
                    arr.push(`${validatedFieldName(newKey)} ${parseSqlSchemaFromObject(Object.values(mapping[key])[0])}`);
                } else {
                    arr.push(`${validatedFieldName(key)} ${parseSqlSchemaFromObject(data[key])}`);
                }
            }
            return `struct<${arr.join(", ")}>`;
        }
    } else if (data["type"] == "null") {
        throw new Error(`Data type '${data["type"]}' is not supported by Iceberg schema.`);
    } else if (data["type"] == "string") {
        return "string"
    } else if (data["type"] == "boolean") {
        return "boolean"
    } else if (data["type"] == "integer") {
        return "int"
    } else if (data["type"] == "number") {
        return "float"
    } else if (data["type"] == "array") {
        return `array<${parseSqlSchemaFromObject(data["items"])}>`
    } else if (data["type"] == "object") {
        let arr: Array<string> = new Array<string>();
        for (const key in data["properties"]) {
            arr.push(`${validatedFieldName(key)}: ${parseSqlSchemaFromObject(data["properties"][key])}`);
        }
        return `struct<${arr.join(", ")}>`;
        // custom data types
    } else if (data["type"] == "float") {
        return "float"
    } else if (data["type"] == "date") {
        return "date"
    } else if (data["type"] == "datetime") {
        return "timestamp"
    } else if (data["type"] == "timestamp") {
        return "bigint"
    } else if (data["type"] == "long") {
        return "bigint"
    } else if (data["type"] == "decimal") {
        return `decimal(${Number(data["properties"]["precision"])},${Number(data["properties"]["scale"])})`
    } else if (data["type"] == "map") {
        return `map<${parseSqlSchemaFromObject(data["properties"]["key"])}, ${parseSqlSchemaFromObject(data["properties"]["value"])}>`
    } else {
        throw new Error(`Unknown data type '${data["type"]}'.`)
    }
}

export const getParameter = (scope: Construct, id: string, paramName: string, role?: Role) => {
    const paramResource = new AwsCustomResource(scope, id, {
        onUpdate: {
            service: 'SSM',
            action: 'getParameter',
            parameters: {
                Name: paramName,
                WithDecryption: true,
            },
            physicalResourceId: PhysicalResourceId.of(paramName), // Use deterministic physical ID to avoid unnecessary updates
        },
        role: role,
        policy: AwsCustomResourcePolicy.fromSdkCalls({
            resources: AwsCustomResourcePolicy.ANY_RESOURCE,
        })
    });

    const value = paramResource.getResponseField('Parameter.Value');
    return value;
};

/**
 * Checks if the given base string starts with the specified substring.
 *
 * @param {string} baseString - The string to be checked.
 * @param {string} subString - The substring to look for at the beginning of the base string.
 * @returns {boolean} - Returns `true` if the base string starts with the substring, otherwise `false`.
 */
export const startsWith = (baseString: string, subString: string): boolean => {
    return baseString.lastIndexOf(subString, 0) === 0
};

/**
 * Generates an AWS ARN (Amazon Resource Name) based on the provided parameters.
 *
 * @param {Construct} scope - The scope in which this ARN is being created.
 * @param {string} id - An identifier for the construct.
 * @param {string} param - The base parameter to be converted into an ARN. This can be an ARN, an SSM parameter key, or a resource name.
 * @param {string} [service] - The AWS service for which the ARN is being generated. Optional if `param` is already an ARN or an SSM parameter key.
 * @param {string} [resource] - The specific resource within the service. Optional if `param` is already an ARN or an SSM parameter key.
 * @returns {string} The generated ARN.
 * @throws {Error} - Throws an error if `param` cannot be resolved to an ARN and `service` and `resource` are not provided.
 *
 * The function handles different cases:
 * - If `param` is already an ARN, it is returned as is.
 * - If `param` starts with '/', it is treated as an SSM parameter key, and the corresponding parameter value is retrieved and converted to an ARN.
 * - If `param` is a valid resource name, it constructs an ARN using the provided `service` and `resource`.
 * - For certain services like S3, which do not include region or account information in their ARNs, the function adjusts accordingly.
 *
 * @example
 * // input
 * param = "example_table/data"
 * service = "dynamodb"
 * resource = "table"
 * // results in (region and account from scope)
 * arn:aws:dynamodb:eu-west-1:1234567890:table/example_table
 * @example
 * // input
 * param = "example_bucket"
 * service = "s3"
 * resource = undefined
 * // results in (region and account are not part of ARNs for S3)
 * arn:aws:s3:::example_bucket/data
 */
export function getArn(scope: Construct, id: string, param: string, service?: string, resource?: string): string {
    // list of services where the ARN doesn't contain region info
    const noRegionServices = ["s3"];
    // list of services where the ARN doesn't contain account info
    const noAccountServices = ["s3"];

    const isArn = startsWith(param, "arn");
    const isSsm = startsWith(param, "/");
    if (isArn) {
        return param;
    } else if (isSsm && !isArn) {
        return getParameter(scope, id, param);
    } else if (!isSsm && !isArn) {
        if (service === undefined) {
            throw new Error("Can not resolve parameter. Please provide both 'service' and 'resource'.");
        }
        const region = noRegionServices.includes(service) ? '' : Stack.of(scope).region;
        const account = noAccountServices.includes(service) ? '' : Stack.of(scope).account;
        const res = (resource === undefined || !resource) ? "" : resource + "/";
        return `arn:aws:${service}:${region}:${account}:${res}${param}`;
    } else {
        throw new Error(`The parameter '${param}' must be an ARN, SSM parameter key or valid resource name.`);
    }
};

/**
 * Recursively resolves SSM parameters using ssm.StringParameter.valueFromLookup.
 * Supports resolving values in nested objects.
 * @param scope - The CDK stack or construct scope
 * @param obj - The dictionary-like object with nested structures
 * @returns A new object with resolved SSM parameter values
 */
export function resolveSSMParameters(scope: Construct, id: string, obj: any): any {
    let counter = 0;
    // Helper function to check if the value is a string that starts with '/'
    const isSSMParameter = (value: any) => typeof value === "string" && value.startsWith("/");

    // Recursively resolve the object or array
    const recursiveResolve = (currentObj: any): any => {
        if (typeof currentObj === "object" && !Array.isArray(currentObj)) {
            // Resolve values in an object
            const resolvedObj: any = {};
            for (const key of Object.keys(currentObj)) {
                const value = currentObj[key];

                if (isSSMParameter(value)) {
                    // If value is a string that starts with '/', resolve it as an SSM parameter
                    counter ++;
                    resolvedObj[key] = getParameter(scope, `${id}-${counter}`, value);
                } else if (typeof value === "object") {
                    // Recursively resolve nested objects or arrays
                    resolvedObj[key] = recursiveResolve(value);
                } else if (Array.isArray(value)) {
                    // Resolve values in an array
                    return value.map(item => {
                        if (isSSMParameter(item)) {
                            // If array element is a string starting with '/', resolve it as an SSM parameter
                            counter ++;
                            return getParameter(scope, `${id}-${counter}`, item);
                        } else if (typeof item === "object" || Array.isArray(item)) {
                            // Recursively resolve nested objects or arrays
                            return recursiveResolve(item);
                        } else {
                            // For primitive values, copy them directly
                            return item;
                        }
                    });
                } else {
                    // For primitive values, copy them directly
                    resolvedObj[key] = value;
                }
            }
            return resolvedObj;
        } else {
            // If it's a primitive (string, number, etc.), return it unchanged
            return currentObj;
        }
    };

    return recursiveResolve(obj);
}
