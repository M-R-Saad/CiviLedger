const { Presentation, Credential, CredentialType, VerificationEvent, Organization } = require("../models");
const verificationService = require("../services/verification.service");
const blockchainService = require("../services/blockchain.service");
const { getSigner } = require("../config/blockchain");

async function loadPresentation(token) {
  const presentation = await Presentation.findOne({ where: { share_token: token } });
  if (!presentation) return { notFound: true };
  const credentials = await Credential.findAll({
    where: { id: presentation.credential_ids },
    include: [CredentialType, { model: Organization, as: "issuer" }]
  });
  return { presentation, credentials };
}

// GET /verifier/presentations/:token
// Raw presentation + credential rows. Used for a pre-verify preview.
async function getPresentation(req, res) {
  const { presentation, credentials, notFound } = await loadPresentation(req.params.token);
  if (notFound) return res.status(404).json({ error: "not_found" });
  const expired = new Date() > presentation.expires_at;
  return res.json({ presentation, credentials, expired });
}

// GET /verifier/presentations/:token/check
// Public, read-only. Runs the full check set. Writes nothing.
async function checkPresentation(req, res) {
  try {
    const { presentation, credentials, notFound } = await loadPresentation(req.params.token);
    if (notFound) return res.status(404).json({ error: "not_found" });
    if (new Date() > presentation.expires_at) {
      return res.status(410).json({ error: "expired", expiresAt: presentation.expires_at });
    }

    const { overall, results } = await verificationService.verifyPresentationCredentials(credentials);

    return res.json({
      overall,
      results,
      recorded: false,
      presentation: {
        shareToken: presentation.share_token,
        credentialCount: credentials.length,
        createdAt: presentation.created_at,
        expiresAt: presentation.expires_at
      }
    });
  } catch (err) {
    console.error("checkPresentation failed:", err);
    return res.status(500).json({ error: "verification_failed" });
  }
}

// POST /verifier/verify   body: { share_token }
// Authenticated verifier: same checks, plus an on-chain receipt and a logged event.
async function verifyPresentation(req, res) {
  try {
    const { share_token } = req.body;
    const { presentation, credentials, notFound } = await loadPresentation(share_token);
    if (notFound) return res.status(404).json({ error: "not_found" });

    const expired = new Date() > presentation.expires_at;
    const { overall, results } = await verificationService.verifyPresentationCredentials(credentials);
    const finalVerdict = expired && overall === "VALID" ? "EXPIRED" : overall;

    presentation.verifier_org_id = req.user.organization_id;
    await presentation.save();

    const eventResult = verificationService.toEventResult(finalVerdict);
    let event = null;
    let receiptTx = null;

    if (eventResult) {
      try {
        const adminSigner = getSigner("ADMIN_PRIVATE_KEY");
        const result = await blockchainService.recordPresentationReceipt({
          verifierSigner: adminSigner,
          consentHash: presentation.consent_hash,
          result: finalVerdict === "VALID"
        });
        receiptTx = result.txHash;
      } catch (chainErr) {
        console.warn("On-chain receipt recording failed (non-fatal):", chainErr.message);
      }

      event = await VerificationEvent.create({
        presentation_id: presentation.id,
        verifier_org_id: req.user.organization_id,
        verifier_user_id: req.user.id,
        result: eventResult,
        onchain_receipt_tx: receiptTx
      });
    }

    return res.json({
      overall: finalVerdict,
      results,
      recorded: Boolean(event),
      receiptTx,
      event
    });
  } catch (err) {
    console.error("verifyPresentation failed:", err);
    return res.status(500).json({ error: "verification_failed" });
  }
}

// GET /verifier/stats — aggregate counts for verifier dashboard
async function getVerifierStats(req, res) {
  try {
    const where = { verifier_org_id: req.user.organization_id };
    const [totalVerifications, passed, failed] = await Promise.all([
      VerificationEvent.count({ where }),
      VerificationEvent.count({ where: { ...where, result: "PASS" } }),
      VerificationEvent.count({ where: { ...where, result: "FAIL" } }),
    ]);
    res.json({ totalVerifications, passed, failed });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /verifier/history — list verification history for this verifier
async function getVerifierHistory(req, res) {
  try {
    const history = await VerificationEvent.findAll({
      where: { verifier_org_id: req.user.organization_id },
      order: [["verified_at", "DESC"]],
      limit: 50,
      include: [
        { model: Presentation, attributes: ["share_token", "credential_ids"] }
      ]
    });
    res.json(history);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { getPresentation, checkPresentation, verifyPresentation, getVerifierStats, getVerifierHistory };
