Alright Dan — let’s pin this down clean so you’ve got something future-you (or anyone else on your team) can actually follow without falling into “rat-ship hell.”

---

# ✅ DocuSign + Netlify + DynamoDB: End-to-End Checklist

### 1. DocuSign Setup

* Create an **App & Integration Key** in DocuSign sandbox.
* Generate **RSA keypair** (save the PEM private key).
* Copy down:

  * Integration Key (GUID)
  * User ID / API Username (GUID, not email)
  * Account ID (numeric, not GUID)

### 2. Consent

* Visit the consent URL once (replace client\_id with Integration Key):

  ```
  https://account-d.docusign.com/oauth/auth?
  response_type=code&
  scope=signature%20impersonation&
  client_id=YOUR_INTEGRATION_KEY&
  redirect_uri=https://www.docusign.com
  ```
* Log in → Accept → ignore redirect code.

### 3. Netlify Env Vars

In **Site settings → Environment variables**:

```
DOCUSIGN_INTEGRATION_KEY=<integration GUID>
DOCUSIGN_USER_ID=<user GUID>
DOCUSIGN_ACCOUNT_ID=<numeric account ID>
DDB_REGION=us-east-2
OFFERS_TABLE=fusion_offers
MY_AWS_ACCESS_KEY_ID=<AWS key>
MY_AWS_SECRET_ACCESS_KEY=<AWS secret>
```

### 4. AWS IAM

* Create policy allowing: `GetItem`, `PutItem`, `UpdateItem`, `Query` on table ARN with correct **account ID**.
* Attach policy to IAM user.
* Create access keys (use case: application outside AWS).

### 5. Netlify Function: `send-for-signature.js`

* Add `jsonwebtoken` dependency (`npm install jsonwebtoken`).
* Implement `getAccessToken()` to fetch JWT token.
* Build envelope (buyers, approver, CCs → recipient IDs must be **ints or GUIDs**, not strings like `cc0`).
* DynamoDB client:

  ```js
  const ddb = new DynamoDBClient({
    region: process.env.DDB_REGION,
    credentials: {
      accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY,
    },
  });
  ```
* UpdateItem `Key` must match Dynamo schema **exactly** (e.g. `offerId` not `offer_id`).

### 6. Deploy

* Commit + push → Netlify rebuilds.
* Watch logs for errors.

### 7. Test

* Submit OfferForm.
* Expect `envelopeId` JSON response.
* Check DocuSign email arrives.
* Check DynamoDB row updated with `docusign_envelope_id` and `offer_status = sent`.

---

# 🛠️ Refactor Survival Guide (Dan Edition)

1. **Env var names**: Write them down once. Stick to them. Mixing `AWS_*` and `MY_AWS_*` = rabbit hole.
2. **Account IDs**: Double-check ARNs — 029622199099 vs 652968819851 bit us hard.
3. **Case matters**: Dynamo keys are drunk camels (`offerId` ≠ `offer_id`).
4. **Recipient IDs**: Must be int or GUID, never strings like `cc0`.
5. **Consent**: JWT will silently fail with `user_not_found` until you grant consent. Always do it once.

---

✅ With this doc, you’ll never again wander into “is it Netlify or AWS or DocuSign or my case-sensitivity?” land.

---

👉 Next: the **Follow-up Form**. Last time we sketched it in Roman numerals. We’ll bring it into the 21st century. Do you want me to first **recap what we had** (fields, flows, functions), or should we just design it clean from scratch now that Send-for-Signature is working?
