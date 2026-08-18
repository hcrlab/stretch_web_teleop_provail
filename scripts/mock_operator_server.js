const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
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

let activeSessionId = null;
let initialOperatorAssigned = false;
const operators = new Map();
const operatorLabels = new Map();
const operatorNames = new Map();
const adminSockets = new Set();
let nextOperatorNumber = 1;

function broadcastControlState() {
    io.emit("control_state", {
        activeSessionId,
        operators: Array.from(operators.values()).map((operator) => ({
            sessionId: operator.sessionId,
            displayName: operator.displayName,
            connectedAt: operator.connectedAt,
        })),
    });
    const adminState = {
        activeSessionId,
        operators: Array.from(operators.values()).map((operator) => ({
            ...operator,
            adminName: operatorNames.get(operator.sessionId) || "",
        })),
    };
    adminSockets.forEach((socketId) =>
        io.to(socketId).emit("admin_control_state", adminState)
    );
}

io.on("connection", (socket) => {
    socket.on("operator_presence", (operator) => {
        if (!operator || typeof operator.sessionId !== "string") return;
        if (!operatorLabels.has(operator.sessionId)) {
            operatorLabels.set(
                operator.sessionId,
                `Waiting user ${nextOperatorNumber++}`
            );
        }
        operators.set(socket.id, {
            sessionId: operator.sessionId,
            displayName: operatorLabels.get(operator.sessionId),
            ipAddress: String(socket.handshake.address || "").replace(
                /^::ffff:/,
                ""
            ),
            connectedAt: Date.now(),
        });
        if (!initialOperatorAssigned) {
            initialOperatorAssigned = true;
            activeSessionId = operator.sessionId;
        }
        broadcastControlState();
    });
    socket.on("admin_subscribe", () => {
        adminSockets.add(socket.id);
        broadcastControlState();
    });
    socket.on("admin_set_name", (request, callback) => {
        if (!request || typeof request.sessionId !== "string") {
            callback?.({ success: false, error: "Invalid session" });
            return;
        }
        const exists = Array.from(operators.values()).some(
            (operator) => operator.sessionId === request.sessionId
        );
        if (!exists) {
            callback?.({
                success: false,
                error: "Operator is no longer connected",
            });
            return;
        }
        operatorNames.set(
            request.sessionId,
            String(request.name || "")
                .trim()
                .slice(0, 80)
        );
        broadcastControlState();
        callback?.({ success: true });
    });
    socket.on("admin_set_active", (sessionId, callback) => {
        const next = sessionId || null;
        const exists = Array.from(operators.values()).some(
            (operator) => operator.sessionId === next
        );
        if (next && !exists) {
            callback?.({
                success: false,
                error: "Operator is no longer connected",
            });
            return;
        }
        activeSessionId = next;
        broadcastControlState();
        callback?.({ success: true });
    });
    socket.on("disconnect", () => {
        adminSockets.delete(socket.id);
        const disconnected = operators.get(socket.id);
        operators.delete(socket.id);
        if (disconnected?.sessionId === activeSessionId) activeSessionId = null;
        broadcastControlState();
    });
});

server.listen(port, () => {
    console.log(
        `Mock operator server listening at http://localhost:${port}/operator?mock=1`
    );
});
