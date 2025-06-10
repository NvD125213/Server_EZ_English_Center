import XLSX from "xlsx";
import fs from "fs";

function convertExcelToJson() {
  const workbook = XLSX.readFile("C:/CenterManagement/Server/ai/faq.xlsx");
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  fs.writeFileSync("./ai/data-training.json", JSON.stringify(data, null, 2));
  console.log("Chuyển Excel sang JSON thành công");
}

convertExcelToJson();
