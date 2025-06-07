#!/usr/bin/env node
import 'source-map-support/register';

import { RemovalPolicy, StackProps } from 'aws-cdk-lib';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { VersionedStack } from './versionedStack';
import { EnvAwareStackProps } from '../lib/interfaces';

/**
 * Create an S3 Bucket with the specified name.
 */
export class BucketStack extends VersionedStack {
    public readonly bucket: Bucket;

    constructor(scope: Construct, id: string, bucketName: string, props: EnvAwareStackProps) {
        super(scope, id, props);

        const { account, region } = props.env || {};
        if (!(account && region)) {
            throw new Error('Account and region must be set to build the bucket stack.');
        }
        if (!bucketName) {
            throw new Error('bucketName is required to create the bucket.');
        }
        this.bucket = new Bucket(this, id, {
            bucketName,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            encryption: BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            versioned: false,
            removalPolicy: RemovalPolicy.RETAIN,
        });
    }
}
