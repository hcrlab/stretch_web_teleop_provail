var fs = require("fs");
require("dotenv").config();

var options = {
    key: fs.readFileSync(`certificates/${process.env.keyfile}`),
    cert: fs.readFileSync(`certificates/${process.env.certfile}`),
};

const socket = require("socket.io");
var express = require("express");
var app = express();
app.all("*", ensureSecure); // at top of routing calls

function ensureSecure(req, res, next) {
    if (!req.secure) {
        // handle port numbers if you need non defaults
        console.log("redirecting insecure request");
        return res.redirect("https://" + req.hostname + req.url);
        // res.redirect(`https://${req.hostname}${process.env.NGROK_URL}`);
    }

    return next();
}

var server = require("http").Server(app);
var secure_server = require("https").Server(options, app);
const io = socket(secure_server, {
    allowEIO3: true,
});
app.enable("trust proxy");
app.set("port", 443);
server.listen(80);
secure_server.listen(443);

var path = require("path");
app.use("/", express.static(path.join(__dirname, "dist")));

app.listen(process.env.port);

io.on("connect_error", (err) => {
    console.log(`connect_error due to ${err.message}`);
});

const ROOM = "default";
let robo_sock = undefined;
let oper_sock = undefined;
let oper_session_id = undefined;
let protocol = undefined; // TODO(binit): ensure robot/operator protocol match
let status = "offline"; // ["online", "offline", "occupied"]
let active_operator_session_id = null;
let initial_operator_assigned = false;
const waiting_operators = new Map();
const operator_labels = new Map();
const operator_names = new Map();
const admin_sockets = new Set();
let next_operator_number = 1;

function controlState(includePrivate = false) {
    return {
        activeSessionId: active_operator_session_id,
        operators: Array.from(waiting_operators.values()).map((operator) =>
            includePrivate
                ? {
                      ...operator,
                      adminName: operator_names.get(operator.sessionId) || "",
                  }
                : {
                      sessionId: operator.sessionId,
                      displayName: operator.displayName,
                      connectedAt: operator.connectedAt,
                  }
        ),
    };
}

function updateControlState() {
    io.emit("control_state", controlState());
    admin_sockets.forEach((socketId) =>
        io.to(socketId).emit("admin_control_state", controlState(true))
    );
}

function revokeCurrentOperator() {
    if (!oper_sock) return;
    io.to(oper_sock).emit("control_revoked");
    if (robo_sock) io.to(robo_sock).emit("bye");
    const oldSocket = io.sockets.sockets.get(oper_sock);
    if (oldSocket) oldSocket.leave(ROOM);
    oper_sock = undefined;
    oper_session_id = undefined;
    status = robo_sock ? "online" : "offline";
}
function updateRooms() {
    io.emit("update_rooms", {
        robot_id: {
            name: process.env.HELLO_FLEET_ID,
            protocol: protocol,
            status: status,
        },
    });
}

io.on("connection", function (socket) {
    console.log("new socket.io connection");
    // console.log('socket.handshake = ');
    // console.log(socket.handshake);

    socket.on("operator_presence", (operator) => {
        if (!operator || typeof operator.sessionId !== "string") return;
        if (!operator_labels.has(operator.sessionId)) {
            operator_labels.set(
                operator.sessionId,
                `Waiting user ${next_operator_number++}`
            );
        }
        waiting_operators.set(socket.id, {
            sessionId: operator.sessionId,
            displayName: operator_labels.get(operator.sessionId),
            ipAddress: String(socket.handshake.address || "").replace(
                /^::ffff:/,
                ""
            ),
            connectedAt: Date.now(),
        });
        if (!initial_operator_assigned) {
            initial_operator_assigned = true;
            active_operator_session_id = operator.sessionId;
            console.log("Automatically activated the first waiting operator");
        }
        updateControlState();
    });

    socket.on("admin_subscribe", () => {
        admin_sockets.add(socket.id);
        socket.emit("admin_control_state", controlState(true));
    });

    socket.on("admin_set_name", (request, callback) => {
        if (!request || typeof request.sessionId !== "string") {
            callback?.({ success: false, error: "Invalid session" });
            return;
        }
        const exists = Array.from(waiting_operators.values()).some(
            (operator) => operator.sessionId === request.sessionId
        );
        if (!exists) {
            callback?.({
                success: false,
                error: "Operator is no longer connected",
            });
            return;
        }
        operator_names.set(
            request.sessionId,
            String(request.name || "")
                .trim()
                .slice(0, 80)
        );
        updateControlState();
        callback?.({ success: true });
    });

    socket.on("admin_set_active", (sessionId, callback) => {
        const next = sessionId || null;
        const exists = Array.from(waiting_operators.values()).some(
            (operator) => operator.sessionId === next
        );
        if (next && !exists) {
            if (callback)
                callback({
                    success: false,
                    error: "Operator is no longer connected",
                });
            return;
        }
        if (oper_session_id !== next) revokeCurrentOperator();
        active_operator_session_id = next;
        updateControlState();
        updateRooms();
        if (callback) callback({ success: true });
    });

    socket.on("join_as_robot", (callback) => {
        console.log("Received join_as_robot request");
        if (!robo_sock) {
            socket.join(ROOM);
            robo_sock = socket.id;
            status = "online";
            console.log("join_as_robot SUCCESS");
            callback({ success: true });
        } else {
            status = "occupied";
            console.log("join_as_robot FAILURE");
            callback({ success: false });
        }
        updateRooms();
    });

    socket.on("list_rooms", () => {
        updateRooms();
    });

    socket.on("join_as_operator", (operator, callback) => {
        if (typeof operator === "function") {
            callback = operator;
            operator = undefined;
        }
        console.log("Received join_as_operator request");
        if (!operator || operator.sessionId !== active_operator_session_id) {
            console.log("join_as_operator FAILURE: operator is not active");
            callback({ success: false });
            return;
        }
        if (robo_sock) {
            status = "occupied";
            if (!oper_sock) {
                socket.join(ROOM);
                socket.in(ROOM).emit("joined");
                oper_sock = socket.id;
                oper_session_id = operator.sessionId;
                console.log("join_as_operator SUCCESS");
                callback({ success: true });
            } else {
                console.log(
                    "join_as_operator FAILURE: occupied by another operator"
                );
                callback({ success: false });
            }
        } else {
            status = "offline";
            console.log("join_as_operator FAILURE: robot is not available");
            callback({ success: false });
        }
        updateRooms();
    });

    socket.on("signalling", (message) => {
        if (robo_sock && oper_sock && io.sockets.adapter.rooms.get(ROOM)) {
            socket.to(ROOM).emit("signalling", message);
        } else {
            console.log(
                `signaling FAILURE: robo_sock=${robo_sock} oper_sock=${oper_sock} room=${io.sockets.adapter.rooms.get(ROOM)}`
            );
        }
    });

    socket.on("bye", (role) => {
        console.log(`Received bye from ${role}`);
        if (socket.rooms.has(ROOM)) {
            socket.to(ROOM).emit("bye");
            if (socket.id == robo_sock) {
                status = "offline";
                robo_sock = undefined;
                console.log("Robot disconnected");
            }
            if (socket.id == oper_sock) {
                status = "online";
                oper_sock = undefined;
                oper_session_id = undefined;
                console.log("Operator disconnected");
            }
            socket.leave(ROOM);
        }
        updateRooms();
    });

    socket.on("disconnect", () => {
        admin_sockets.delete(socket.id);
        const disconnected = waiting_operators.get(socket.id);
        waiting_operators.delete(socket.id);
        if (socket.id == robo_sock) {
            status = "offline";
            robo_sock = undefined;
            console.log("Robot disconnected");
        }
        if (socket.id == oper_sock) {
            status = "online";
            oper_sock = undefined;
            oper_session_id = undefined;
            console.log("Operator disconnected");
        }
        if (disconnected?.sessionId === active_operator_session_id) {
            active_operator_session_id = null;
            if (robo_sock) io.to(robo_sock).emit("bye");
        }
        updateControlState();
        updateRooms();
    });
});
