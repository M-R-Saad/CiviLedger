const http = require("http");

const data = JSON.stringify({ email: "abrar@employer.test", password: "password123" });
const options = {
  hostname: "localhost",
  port: 4000,
  path: "/auth/login",
  method: "POST",
  headers: { "Content-Type": "application/json", "Content-Length": data.length }
};

const req = http.request(options, (res) => {
  let body = "";
  res.on("data", (c) => body += c);
  res.on("end", () => {
    const token = JSON.parse(body).token;
    
    const req2 = http.request({
      hostname: "localhost",
      port: 4000,
      path: "/verifier/history",
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    }, (res2) => {
      let body2 = "";
      res2.on("data", (c) => body2 += c);
      res2.on("end", () => console.log(res2.statusCode, body2.substring(0, 500)));
    });
    req2.end();
  });
});
req.write(data);
req.end();
