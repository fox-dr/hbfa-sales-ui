// Centralized AWS client configuration that supports custom env var names
// to avoid Netlify's reserved AWS_* variables.
//
// Usage:
//   import { awsClientConfig } from "./utils/awsClients.js";
//   const ddb = new DynamoDBClient(awsClientConfig());
//   const s3 = new S3Client(awsClientConfig());

export function awsClientConfig() {
  const region =
    process.env.S3_REGION ||
    process.env.DDB_REGION ||
    process.env.HBFA_AWS_REGION ||
    "us-east-2";

  const accessKeyId = process.env.HBFA_AWS_ACCESS_KEY_ID || null;
  const secretAccessKey = process.env.HBFA_AWS_SECRET_ACCESS_KEY || null;

  if (accessKeyId && secretAccessKey) {
    return { region, credentials: { accessKeyId, secretAccessKey } };
  }
  return { region };
}

