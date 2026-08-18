import io, { Socket } from "socket.io-client";

export interface AnonymousOperator {
    sessionId: string;
    displayName: string;
    connectedAt?: number;
    ipAddress?: string;
    adminName?: string;
}

export interface LocalControlState {
    activeSessionId: string | null;
    operators: AnonymousOperator[];
}

const SESSION_KEY = "stretch_operator_session_id";

function makeSessionId(): string {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function currentAnonymousOperator(): AnonymousOperator {
    let sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
        sessionId = makeSessionId();
        sessionStorage.setItem(SESSION_KEY, sessionId);
    }
    return { sessionId, displayName: "Waiting user" };
}

export function connectLocalOperatorControl(
    callback: (state: LocalControlState, operator: AnonymousOperator) => void
): { socket: Socket; operator: AnonymousOperator; disconnect: () => void } {
    const socket = io();
    const operator = currentAnonymousOperator();
    const announce = () => socket.emit("operator_presence", operator);
    socket.on("connect", announce);
    socket.on("control_state", (state: LocalControlState) =>
        callback(state, operator)
    );
    announce();
    socket.emit("admin_subscribe");
    return { socket, operator, disconnect: () => socket.disconnect() };
}

export function connectLocalAdminControl(
    callback: (state: LocalControlState) => void
): {
    setActive: (sessionId: string | null) => Promise<void>;
    setName: (sessionId: string, name: string) => Promise<void>;
    disconnect: () => void;
} {
    const socket = io();
    const subscribe = () => socket.emit("admin_subscribe");
    socket.on("connect", subscribe);
    socket.on("admin_control_state", callback);
    subscribe();
    return {
        setActive: (sessionId) =>
            new Promise<void>((resolve, reject) => {
                socket.emit("admin_set_active", sessionId, (response) => {
                    response?.success
                        ? resolve()
                        : reject(
                              new Error(
                                  response?.error ||
                                      "Could not change active operator"
                              )
                          );
                });
            }),
        setName: (sessionId, name) =>
            new Promise<void>((resolve, reject) => {
                socket.emit(
                    "admin_set_name",
                    { sessionId, name },
                    (response) => {
                        response?.success
                            ? resolve()
                            : reject(
                                  new Error(
                                      response?.error || "Could not save name"
                                  )
                              );
                    }
                );
            }),
        disconnect: () => socket.disconnect(),
    };
}
