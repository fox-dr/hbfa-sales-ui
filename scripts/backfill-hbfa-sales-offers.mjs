import { DynamoDBClient, ScanCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { mapFusionOfferToNormalized } from "../lib/normalized-offer.js";

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-2";
const SOURCE_TABLE = process.env.SOURCE_TABLE || "fusion_offers";
const TARGET_TABLE = process.env.TARGET_TABLE || "hbfa_sales_offers";

const ddb = new DynamoDBClient({ region: REGION });

async function* scanTable(tableName) {
  let ExclusiveStartKey = undefined;
  do {
    const { Items = [], LastEvaluatedKey } = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey,
      })
    );
    for (const raw of Items) {
      yield unmarshall(raw);
    }
    ExclusiveStartKey = LastEvaluatedKey;
  } while (ExclusiveStartKey);
}

async function run() {
  let processed = 0;
  let written = 0;
  for await (const record of scanTable(SOURCE_TABLE)) {
    processed += 1;
    const { skip, reason, mapped } = mapFusionOfferToNormalized(record);
    if (skip) {
      console.warn("Skipping fusion record", { reason, offerId: record?.offerid });
      continue;
    }
    await ddb.send(
      new PutItemCommand({
        TableName: TARGET_TABLE,
        Item: marshall(mapped, { removeUndefinedValues: true }),
      })
    );
    written += 1;
  }

  console.log(`Backfill complete. Processed ${processed} records, wrote ${written} to ${TARGET_TABLE}.`);
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exitCode = 1;
});
