const express = require("express");
const path = require("path");

const app = express();
const port = Number(process.env.PORT || 8080);
const distDir = path.join(__dirname, "..", "dist");

app.use(express.static(distDir));

app.get("/", (_req, res) => {
    res.redirect("/operator?mock=1");
});

app.get(["/operator", "/operator/"], (_req, res) => {
    res.sendFile(path.join(distDir, "operator", "index.html"));
});

app.get(["/robot", "/robot/"], (_req, res) => {
    res.sendFile(path.join(distDir, "robot", "index.html"));
});

app.listen(port, () => {
    console.log(`Mock operator server listening at http://localhost:${port}/operator?mock=1`);
});
