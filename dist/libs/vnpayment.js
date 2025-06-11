import crypto from "crypto";
import qs from "qs";
import dateFormat from "dateformat";
// 👉 Hàm sortObject chuẩn theo demo VNPAY (rất quan trọng)
export function sortObject(obj) {
    const sorted = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
        sorted[key] = encodeURIComponent(obj[key]).replace(/%20/g, "+");
    }
    return sorted;
}
export function createVNPayChecksum(params, secretKey) {
    const sortedParams = sortObject(params);
    const signData = Object.entries(sortedParams)
        .map(([key, val]) => `${key}=${val}`)
        .join("&");
    const hmac = crypto.createHmac("sha512", secretKey);
    return hmac.update(signData, "utf-8").digest("hex");
}
export function generatePaymentUrl({ amount, orderId, orderInfo, returnUrl, ipAddr, bankCode = "", locale = "vn", }) {
    const tmnCode = process.env.VNP_TMNCODE;
    const secretKey = process.env.VNP_HASHSECRET;
    const vnpUrl = process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    const date = new Date();
    const createDate = dateFormat(date, "yyyymmddHHMMss");
    const vnp_TxnRef = orderId;
    const vnp_Params = {
        vnp_Version: "2.1.0",
        vnp_Command: "pay",
        vnp_TmnCode: tmnCode,
        vnp_Locale: locale,
        vnp_CurrCode: "VND",
        vnp_TxnRef,
        vnp_OrderInfo: orderInfo,
        vnp_OrderType: "other",
        vnp_Amount: amount * 100,
        vnp_ReturnUrl: returnUrl,
        vnp_IpAddr: ipAddr,
        vnp_CreateDate: createDate,
    };
    if (bankCode) {
        vnp_Params["vnp_BankCode"] = bankCode;
    }
    const sortedParams = sortObject(vnp_Params);
    const signData = Object.entries(sortedParams)
        .map(([key, val]) => `${key}=${val}`)
        .join("&");
    const hmac = crypto.createHmac("sha512", secretKey);
    const secureHash = hmac.update(signData, "utf-8").digest("hex");
    sortedParams["vnp_SecureHash"] = secureHash;
    const url = `${vnpUrl}?${qs.stringify(sortedParams, { encode: false })}`;
    return { url, vnp_TxnRef };
}
