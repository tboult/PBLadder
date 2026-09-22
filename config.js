// config.js
const ENV = "dev"; // Change to 'prod' before deploying to main branch

const CONFIG = {
  dev: {
    apiUrl: "https://script.google.com/macros/s/AKfycbyuY1-ZkbpA2Udpe__rKSE6H4EBfl_OKn_Xep719FJII1u5RxAXhSzU3dyrD0c64diS/exec",
    enableDebugLogs: false
  },
  prod: {
    apiUrl: "https://script.google.com/macros/s/AKfycbweTOjVcY0R1sxXrYfbN2S9jqMz4yr5b1alVoz0gjVy3P3ty42rtHlfgfpdjtFnF4nFaQ/exec",
    enableDebugLogs: true
  }
}[ENV];
