function encodeOfferId(projectId, contractUnitNumber) {
  if (!projectId || !contractUnitNumber) return "";
  return `${encodeURIComponent(projectId)}::${encodeURIComponent(contractUnitNumber)}`;
}

function decodeOfferId(offerId) {
  if (!offerId) return { projectId: "", contractUnitNumber: "" };
  const [rawProjectId = "", rawContractUnitNumber = ""] = String(offerId).split("::", 2);
  return {
    projectId: decodeURIComponent(rawProjectId),
    contractUnitNumber: decodeURIComponent(rawContractUnitNumber),
  };
}

module.exports = { encodeOfferId, decodeOfferId };
