import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { parse } from "csv-parse/sync";
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { mapPolarisRowToNormalized, asString } from "../lib/normalized-offer.js";

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-2";
const RAW_TABLE = process.env.POLARIS_RAW_TABLE || "polaris_raw_weekly";
const TARGET_TABLE = process.env.TARGET_TABLE || "hbfa_sales_offers";
const PHONE_HASH_SALT = process.env.PHONE_HASH_SALT || "";
const INCLUDE_FUSION = /^1|true|yes$/i.test(process.env.POLARIS_INCLUDE_FUSION || "");

const ddb = new DynamoDBClient({ region: REGION });

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    if (arg.startsWith("--file=")) args.file = arg.slice("--file=".length);
    else if (arg.startsWith("--report-date=")) args.reportDate = arg.slice("--report-date=".length);
    else if (arg === "--dry-run") args.dryRun = true;
  }
  if (!args.file) throw new Error("Missing --file=<path-to-polaris-csv>");
  if (!args.reportDate) {
    const fallback = guessReportDateFromFilename(args.file);
    if (!fallback) throw new Error("Missing --report-date=YYYY-MM-DD");
    args.reportDate = fallback;
  }
  return args;
}

function guessReportDateFromFilename(file) {
  const name = basename(file);
  const match = name.match(/(\d{4})[-_.](\d{2})[-_.](\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

const normalizeKey = (key) =>
  key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .replace(/__+/g, "_");

async function putRawRow(reportDate, rowId, rawRow, summary, dryRun = false) {
  if (dryRun) return;
  const item = {
    report_date: reportDate,
    row_id: rowId,
    project_name: summary.project_name,
    unit_name: summary.unit_name,
    status: summary.status,
    raw_record: rawRow,
    imported_at: new Date().toISOString(),
  };
  await ddb.send(
    new PutItemCommand({
      TableName: RAW_TABLE,
      Item: marshall(item, { removeUndefinedValues: true }),
    })
  );
}

async function getExisting(projectId, contractUnitNumber) {
  const { Item } = await ddb.send(
    new GetItemCommand({
      TableName: TARGET_TABLE,
      Key: marshall(
        {
          project_id: projectId,
          contract_unit_number: contractUnitNumber,
        },
        { removeUndefinedValues: true }
      ),
    })
  );
  return Item ? unmarshall(Item) : null;
}

async function upsertNormalized(mapped, dryRun = false) {
  const { project_id, contract_unit_number } = mapped;
  const existing = await getExisting(project_id, contract_unit_number);
  const existingImmutable = existing?.is_immutable === 1 || existing?.is_immutable === "1";
  const incomingImmutable = mapped.is_immutable === 1 || mapped.is_immutable === "1";

  if (existingImmutable && !incomingImmutable) {
    return { skipped: true, reason: "immutable_existing" };
  }

  const updatePayload = { ...mapped };
  delete updatePayload.project_id;
  delete updatePayload.contract_unit_number;

  const marshalled = marshall(updatePayload, { removeUndefinedValues: true });
  if (!Object.keys(marshalled).length) {
    return { skipped: true, reason: "no_fields_to_update" };
  }

  const sets = [];
  const names = {};
  const values = {};
  for (const [key, value] of Object.entries(marshalled)) {
    sets.push(`#${key} = :${key}`);
    names[`#${key}`] = key;
    values[`:${key}`] = value;
  }

  if (!dryRun) {
    await ddb.send(
      new UpdateItemCommand({
        TableName: TARGET_TABLE,
        Key: marshall(
          { project_id, contract_unit_number },
          { removeUndefinedValues: true }
        ),
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      })
    );
  }

  return { skipped: false };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const csvBuffer = await readFile(args.file);

  // csv-parse can't detect UTF-8 BOM automatically in some cases; strip it manually
  let csvText = csvBuffer.toString("utf8");
  if (csvText.charCodeAt(0) === 0xfeff) {
    csvText = csvText.slice(1);
  }

  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const seenRowIds = new Map(); // rowId -> count
  let rawWritten = 0;
  let normalizedUpserts = 0;
  let skipped = 0;

  for (const rawRow of records) {
    const normalizedRow = {};
    for (const [key, value] of Object.entries(rawRow)) {
      normalizedRow[normalizeKey(key)] = value;
    }

    const projectName =
      asString(rawRow["Project Name"]) ||
      asString(rawRow["project_name"]) ||
      asString(normalizedRow.project_name);
    const unitName =
      asString(rawRow["Unit Name"]) ||
      asString(rawRow["Buyer Contract: Unit Name"]) ||
      asString(normalizedRow.unit_name) ||
      asString(normalizedRow.buyer_contract_unit_name);

    const baseRowId = `${projectName || "unknown"}#${unitName || "row"}`;
    const count = seenRowIds.get(baseRowId) || 0;
    seenRowIds.set(baseRowId, count + 1);
    const rowId = count === 0 ? baseRowId : `${baseRowId}#${count}`;

    await putRawRow(
      args.reportDate,
      rowId,
      rawRow,
      {
        project_name: projectName,
        unit_name: unitName,
        status:
          rawRow["Buyer Contract: Status"] ||
          rawRow["Status"] ||
          normalizedRow.status,
      },
      args.dryRun
    );
    rawWritten += 1;

    const { skip, reason, mapped } = mapPolarisRowToNormalized(
      normalizedRow,
      args.reportDate,
      { phoneHashSalt: PHONE_HASH_SALT, includeFusion: INCLUDE_FUSION }
    );
    if (skip) {
      skipped += 1;
      continue;
    }

    const result = await upsertNormalized({ ...mapped }, args.dryRun);
    if (result.skipped) {
      skipped += 1;
    } else {
      normalizedUpserts += 1;
    }
  }

  console.log(
    `Polaris import complete. Raw rows stored: ${rawWritten}. Normalized upserts: ${normalizedUpserts}. Skipped: ${skipped}.`
  );
}

run().catch((err) => {
  console.error("Polaris import failed:", err);
  process.exitCode = 1;
});
