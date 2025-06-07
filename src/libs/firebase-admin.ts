import admin from "firebase-admin";
import type { ServiceAccount } from "firebase-admin";
import { config } from "dotenv";

config(); // Tải biến môi trường

// Kiểm tra xem biến môi trường có tồn tại không
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  throw new Error(
    "Biến môi trường FIREBASE_SERVICE_ACCOUNT chưa được thiết lập."
  );
}

let serviceAccount: ServiceAccount;

try {
  serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT
  ) as ServiceAccount;
} catch (error) {
  console.error("Lỗi khi phân tích FIREBASE_SERVICE_ACCOUNT:", error);
  throw new Error("Định dạng JSON của FIREBASE_SERVICE_ACCOUNT không hợp lệ.");
}

// Khởi tạo Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default admin;
