FROM amazonlinux:2023

# Install AWS CLI and CDK
RUN dnf update -y \
    && dnf install -y unzip git python3 python3-pip python3-devel python3-setuptools \
    && pip3 install awscli-local \
    && export ARCH=$(uname -m) \
    && if [ "$ARCH" = "aarch64" ]; then \
         CLI_URL="https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip"; \
       else \
         CLI_URL="https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip"; \
       fi \
    && curl "$CLI_URL" -o /tmp/awscliv2.zip \
    && unzip /tmp/awscliv2.zip -d /tmp \
    && /tmp/aws/install \
    && rm -rf /tmp/aws /tmp/awscliv2.zip \
    && curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - \
    && dnf install -y nodejs \
    && npm install -g aws-cdk aws-cdk-local \
    && dnf clean all

# Set up working directory
WORKDIR /app

# Copy package files and enable correct Yarn version
COPY package*.json yarn.lock ./
RUN corepack enable && corepack prepare yarn --activate && yarn install

# Add source files (so ts-node works on deploy)
COPY . .

# Build TypeScript
RUN yarn install && yarn build

# use an official Node.js runtime
# FROM node:20

# # set working dir
# WORKDIR /app

# # copy package definitions and install deps first, to leverage Docker cache
# COPY package*.json ./
# RUN npm ci \
#     # install AWS CDK toolkit and the cdk-local shim globally
#     && npm install -g aws-cdk aws-cdk-local \
#     # clean up npm cache to keep image lean
#     && npm cache clean --force

# # copy the rest of your CDK app
# COPY . .

# # default env vars for talking to LocalStack
# ENV AWS_ACCESS_KEY_ID=test \
#     AWS_SECRET_ACCESS_KEY=test \
#     AWS_DEFAULT_REGION=eu-west-1 \
#     AWS_ENDPOINT_URL=http://localstack:4566

# # bootstrap + deploy when container runs;
# # you can override the CMD at runtime if needed
# CMD ["sh", "-c", "cdk-local bootstrap --require-approval never -c env=local && cdk-local deploy --require-approval never -c env=local"]