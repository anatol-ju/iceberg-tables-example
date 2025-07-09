#!/usr/bin/env node

import { App } from "aws-cdk-lib";
import { EnvAwareStackProps } from "../lib/interfaces";

export const app = new App();
export const envName = app.node.tryGetContext("env");
const envs = app.node.tryGetContext("envs");
const envConfig = envs?.[envName];

if (!envConfig) {
  throw new Error(`Missing context for env: ${envName}`);
}

export const stackProps: EnvAwareStackProps = {
  env: {
    account: envConfig.account,
    region: envConfig.region,
  },
  environment: envName,
};

// Import the stack after App is initialized
import './createIcebergTables';
