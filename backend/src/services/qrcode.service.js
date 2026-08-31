const QRCode = require("qrcode");

async function generatePresentationQrDataUrl(shareToken, baseUrl) {
  const url = `${baseUrl}/verify/${shareToken}`;
  return QRCode.toDataURL(url);
}

module.exports = { generatePresentationQrDataUrl };
