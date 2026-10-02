const ENV = "prod"; // Change to 'prod' before deploying to main branch

const CONFIG = {
  dev: {
    apiUrl: "https://script.google.com/macros/s/AKfycbyuY1-ZkbpA2Udpe__rKSE6H4EBfl_OKn_Xep719FJII1u5RxAXhSzU3dyrD0c64diS/exec",
    SHEET_ID: "1iwMMprtim5dgDKOC80qpbRQvHC0nEoKmpulKed8ZeZQ",
    enableDebugLogs: true
  },
  prod: {
    apiUrl: "https://script.google.com/macros/s/AKfycbweTOjVcY0R1sxXrYfbN2S9jqMz4yr5b1alVoz0gjVy3P3ty42rtHlfgfpdjtFnF4nFaQ/exec",
    SHEET_ID: "14jmYyesfG9btWcIeptDwD6Bkxj8UZiQVlAOGc6BdM84",
    enableDebugLogs: false
  }
}[ENV] || {
  // Fallback if ENV string is invalid
  apiUrl: "https://script.google.com/macros/s/AKfycbyuY1-ZkbpA2Udpe__rKSE6H4EBfl_OKn_Xep719FJII1u5RxAXhSzU3dyrD0c64diS/exec",
  SHEET_ID: "1iwMMprtim5dgDKOC80qpbRQvHC0nEoKmpulKed8ZeZQ",
  enableDebugLogs: true
};

// Optional: Convenience exports for direct global access
const SHEET_ID = CONFIG.SHEET_ID;
const API_URL = CONFIG.apiUrl;
