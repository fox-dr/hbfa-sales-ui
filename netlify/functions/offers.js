const {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  ScanCommand,
  UpdateItemCommand,
  DeleteItemCommand,
} = require("@aws-sdk/client-dynamodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const { awsClientConfig } = require("./utils/awsClients.js");
const { requireAuth } = require("./utils/auth.js");
const { audit } = require("./utils/audit.js");
const { asString, asDate, asNumber, stripEmptyValues } = require("./utils/normalizedOffer.js");
const { encodeOfferId, decodeOfferId } = require("./utils/offerKey.js");

const ddb = new DynamoDBClient(awsClientConfig());
const s3 = new S3Client(awsClientConfig());

const TABLE =
  process.env.HBFA_SALES_OFFERS_TABLE ||
  process.env.DDB_TABLE ||
  "hbfa_sales_offers";
const S3_BUCKET = process.env.S3_VAULT_BUCKET;
const S3_PREFIX = process.env.S3_VAULT_PREFIX || "offers/";
const S3_KMS_KEY_ARN =
  process.env.S3_VAULT_KMS_KEY_ARN || process.env.S3_VAULT_KMS_KEY_ID || null;

const TRACKING_FIELDS = [
  "status",
  "status_date",
  "contract_sent_date",
  "fully_executed_date",
  "week_ratified_date",
  "projected_closing_date",
  "initial_deposit_receipt_date",
  "financing_contingency_date",
  "loan_app_complete",
  "loan_approved",
  "loan_lock",
  "appraisal_ordered",
  "appraiser_visit_date",
  "appraisal_complete",
  "loan_docs_ordered",
  "loan_docs_signed",
  "loan_fund",
  "adjusted_coe",
  "extended_adjusted_coe",
  "walk_through_date",
  "notice_to_close",
  "coe_date",
  "buyer_sign_date",
  "buyer_complete",
  "envelope_sent_date",
  "docusign_envelope",
  "notes",
  "final_price",
  "list_price",
  "initial_deposit_amount",
  "seller_credit",
  "upgrade_credit",
  "total_upgrades_solar",
  "hoa_credit",
  "total_credits",
  "deposits_received_to_date",
  "base_price",
  "statusnumeric",
  "unit_number",
  "unit_name",
];

const DATE_FIELDS = new Set([
  "status_date",
  "contract_sent_date",
  "fully_executed_date",
  "week_ratified_date",
  "projected_closing_date",
  "initial_deposit_receipt_date",
  "financing_contingency_date",
  "loan_app_complete",
  "loan_approved",
  "loan_lock",
  "appraisal_ordered",
  "appraiser_visit_date",
  "appraisal_complete",
  "loan_docs_ordered",
  "loan_docs_signed",
  "loan_fund",
  "adjusted_coe",
  "extended_adjusted_coe",
  "walk_through_date",
  "notice_to_close",
  "coe_date",
  "buyer_sign_date",
  "buyer_complete",
  "envelope_sent_date",
]);

const NUMERIC_FIELDS = new Set([
  "final_price",
  "list_price",
  "initial_deposit_amount",
  "seller_credit",
  "upgrade_credit",
  "total_upgrades_solar",
  "hoa_credit",
  "total_credits",
  "deposits_received_to_date",
  "base_price",
  "statusnumeric",
]);

async function handler(event, context) {
  try {
    const method = event.httpMethod;
    const rolesAllowed = ["SA", "VP"];
    const auth = requireAuth(event, rolesAllowed);
    if (!auth.ok)
      return json(403, {
        error: auth.message,
      });
    audit(event, {
      fn: "offers",
      stage: "invoke",
      claims: auth.claims,
      extra: { method },
    });

    if (method === "POST") {
      const body = event.body ? JSON.parse(event.body) : {};
      const { projectId, contractUnitNumber } = extractKey(body);
      if (!projectId || !contractUnitNumber) {
        return json(400, { error: "project_id and contract_unit_number required" });
      }

      const normalized = normalizePayload(body);
      normalized.project_id = projectId;
      normalized.contract_unit_number = contractUnitNumber;
      if (!normalized.unit_number) normalized.unit_number = contractUnitNumber;

      const item = stripEmptyValues({
        ...applySanitizers(normalized),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      await ddb.send(
        new PutItemCommand({
          TableName: TABLE,
          Item: marshall(item, { removeUndefinedValues: true }),
        })
      );

      await persistVaultCopy(normalized);

      const offerId = encodeOfferId(projectId, contractUnitNumber);
      audit(event, {
        fn: "offers",
        stage: "success",
        claims: auth.claims,
        extra: { method, offerId },
      });
      return json(200, { offerId });
    }

    if (method === "GET") {
      const qs = event.queryStringParameters || {};
      if (qs.offerId) {
        const { projectId, contractUnitNumber } = decodeOfferId(qs.offerId);
        if (!projectId || !contractUnitNumber) {
          return json(400, { error: "Invalid offerId" });
        }
        const { Item } = await ddb.send(
          new GetItemCommand({
            TableName: TABLE,
            Key: marshall(
              {
                project_id: projectId,
                contract_unit_number: contractUnitNumber,
              },
              { removeUndefinedValues: true }
            ),
          })
        );
        const data = Item ? mapResult(Item) : {};
        audit(event, {
          fn: "offers",
          stage: "success",
          claims: auth.claims,
          extra: { method, type: "getOne" },
        });
        return json(200, data);
      }

      const { Items } = await ddb.send(
        new ScanCommand({ TableName: TABLE, Limit: 200 })
      );
      const list = (Items || []).map(mapResult);
      audit(event, {
        fn: "offers",
        stage: "success",
        claims: auth.claims,
        extra: { method, type: "scan", count: list.length },
      });
      return json(200, list);
    }

    if (method === "PUT") {
      const body = event.body ? JSON.parse(event.body) : {};
      const { projectId, contractUnitNumber } = extractKey(body);
      if (!projectId || !contractUnitNumber) {
        return json(400, {
          error: "offerId or project_id + contract_unit_number required",
        });
      }

      const updatePlan = buildUpdatePlan(body);
      if (!updatePlan) {
        return json(400, { error: "No fields to update" });
      }

      const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } =
        updatePlan;

      await ddb.send(
        new UpdateItemCommand({
          TableName: TABLE,
          Key: marshall(
            {
              project_id: projectId,
              contract_unit_number: contractUnitNumber,
            },
            { removeUndefinedValues: true }
          ),
          UpdateExpression,
          ExpressionAttributeNames,
          ExpressionAttributeValues,
        })
      );

      await persistVaultCopy({
        ...body,
        project_id: projectId,
        contract_unit_number: contractUnitNumber,
      });

      const offerId = encodeOfferId(projectId, contractUnitNumber);
      audit(event, {
        fn: "offers",
        stage: "success",
        claims: auth.claims,
        extra: { method, offerId },
      });
      return json(200, { offerId });
    }

    if (method === "DELETE") {
      const body = event.body ? JSON.parse(event.body) : {};
      const { projectId, contractUnitNumber } = extractKey(body);
      if (!projectId || !contractUnitNumber) {
        return json(400, {
          error: "offerId or project_id + contract_unit_number required",
        });
      }

      await ddb.send(
        new DeleteItemCommand({
          TableName: TABLE,
          Key: marshall(
            {
              project_id: projectId,
              contract_unit_number: contractUnitNumber,
            },
            { removeUndefinedValues: true }
          ),
        })
      );
      const offerId = encodeOfferId(projectId, contractUnitNumber);
      audit(event, {
        fn: "offers",
        stage: "success",
        claims: auth.claims,
        extra: { method, offerId, type: "delete" },
      });
      return json(200, { offerId });
    }

    return json(405, { error: "Method Not Allowed" });
  } catch (err) {
    console.error("Error in offers.js:", err);
    audit(event, {
      fn: "offers",
      stage: "error",
      extra: { message: err?.message },
    });
    return json(500, { error: err.message });
  }
}

function normalizePayload(payload = {}) {
  const out = { ...payload };
  if (
    out.add_notes !== undefined &&
    (out.notes === undefined || out.notes === null)
  ) {
    out.notes = out.add_notes;
  }
  if (!out.unit_number && out.contract_unit_number) {
    out.unit_number = out.contract_unit_number;
  }
  return out;
}

function sanitizeField(field, value) {
  if (value === undefined) return undefined;
  if (NUMERIC_FIELDS.has(field)) return asNumber(value);
  if (DATE_FIELDS.has(field)) return asDate(value);
  return asString(value);
}

function applySanitizers(payload = {}) {
  const normalized = normalizePayload(payload);
  const sanitized = {};
  for (const [key, value] of Object.entries(normalized)) {
    const clean = sanitizeField(key, value);
    if (clean !== undefined) sanitized[key] = clean;
  }
  return sanitized;
}

function buildUpdatePlan(payload = {}) {
  const normalized = normalizePayload(payload);
  const setMap = {};
  const removeFields = [];

  for (const field of TRACKING_FIELDS) {
    if (!(field in normalized)) continue;
    const raw = normalized[field];
    if (raw === "" || raw === null) {
      removeFields.push(field);
      continue;
    }
    const clean = sanitizeField(field, raw);
    if (clean === undefined) {
      removeFields.push(field);
    } else {
      setMap[field] = clean;
    }
  }

  if (!Object.keys(setMap).length && !removeFields.length) {
    return null;
  }

  setMap.updated_at = new Date().toISOString();

  const exprNames = {};
  const exprValues = {};
  const setClauses = [];
  const marshalled = marshall(setMap, { removeUndefinedValues: true });
  for (const [attr, value] of Object.entries(marshalled)) {
    const nameToken = `#${attr}`;
    const valueToken = `:${attr}`;
    exprNames[nameToken] = attr;
    exprValues[valueToken] = value;
    setClauses.push(`${nameToken} = ${valueToken}`);
  }

  const expressionParts = [];
  if (setClauses.length) {
    expressionParts.push(`SET ${setClauses.join(", ")}`);
  }

  if (removeFields.length) {
    const removeTokens = removeFields.map((attr) => {
      const token = `#${attr}`;
      exprNames[token] = attr;
      return token;
    });
    expressionParts.push(`REMOVE ${removeTokens.join(", ")}`);
  }

  return {
    UpdateExpression: expressionParts.join(" "),
    ExpressionAttributeNames: exprNames,
    ExpressionAttributeValues: Object.keys(exprValues).length
      ? exprValues
      : undefined,
  };
}

function extractKey(payload = {}) {
  if (payload.offerId) {
    const { projectId, contractUnitNumber } = decodeOfferId(payload.offerId);
    if (projectId && contractUnitNumber) {
      return { projectId, contractUnitNumber };
    }
  }
  const projectId = asString(payload.project_id);
  const contractUnitNumber = asString(payload.contract_unit_number);
  return { projectId, contractUnitNumber };
}

function mapResult(rawItem) {
  const item = unmarshall(rawItem);
  const projectId = item.project_id;
  const contractUnitNumber = item.contract_unit_number;
  return {
    ...item,
    offerId: encodeOfferId(projectId, contractUnitNumber),
  };
}

async function persistVaultCopy(payload = {}) {
  if (!S3_BUCKET) return;
  const { projectId, contractUnitNumber } = extractKey(payload);
  if (!projectId || !contractUnitNumber) return;
  const offerId = encodeOfferId(projectId, contractUnitNumber);
  const putParams = {
    Bucket: S3_BUCKET,
    Key: `${S3_PREFIX}${offerId}.json`,
    Body: JSON.stringify(payload),
    ContentType: "application/json",
  };
  if (S3_KMS_KEY_ARN) {
    putParams.ServerSideEncryption = "aws:kms";
    putParams.SSEKMSKeyId = S3_KMS_KEY_ARN;
  }
  await s3.send(new PutObjectCommand(putParams));
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

module.exports = { handler };

