import React from "react";
import { createRoot } from "react-dom/client";
import {
    assignControl,
    ControlLease,
    listAdminRobots,
    subscribeToControlLease,
    subscribeToPresence,
    WaitingUser,
} from "shared/control_lease";
import { connectLocalAdminControl } from "shared/local_control";
import "../css/index.css";

interface RobotState {
    uid: string;
    name: string;
    lease: ControlLease;
    users: WaitingUser[];
}

function AdminPage() {
    const [robots, setRobots] = React.useState<RobotState[]>([]);
    const [error, setError] = React.useState("");
    const [busy, setBusy] = React.useState("");
    const localAdmin = React.useRef<
        ReturnType<typeof connectLocalAdminControl> | undefined
    >(undefined);

    React.useEffect(() => {
        if (process.env.storage !== "firebase") {
            localAdmin.current = connectLocalAdminControl((state) => {
                const active = state.operators.find(
                    (operator) => operator.sessionId === state.activeSessionId
                );
                setRobots([
                    {
                        uid: "local-robot",
                        name: "Stretch robot",
                        lease: {
                            activeUserUid: state.activeSessionId,
                            activeUserName:
                                active?.adminName || active?.displayName,
                            generation: 0,
                        },
                        users: state.operators.map((operator) => ({
                            uid: operator.sessionId,
                            displayName: operator.displayName,
                            state: "online",
                            lastSeenAt: operator.connectedAt,
                            ipAddress: operator.ipAddress,
                            adminName: operator.adminName,
                        })),
                    },
                ]);
            });
            return () => localAdmin.current?.disconnect();
        }
        const unsubscribers: Array<() => void> = [];
        listAdminRobots()
            .then((items) => {
                setRobots(
                    items.map((robot) => ({
                        ...robot,
                        lease: { activeUserUid: null, generation: 0 },
                        users: [],
                    }))
                );
                items.forEach((robot) => {
                    unsubscribers.push(
                        subscribeToControlLease(robot.uid, (lease) => {
                            setRobots((current) =>
                                current.map((item) =>
                                    item.uid === robot.uid
                                        ? { ...item, lease }
                                        : item
                                )
                            );
                        })
                    );
                    unsubscribers.push(
                        subscribeToPresence(robot.uid, (users) => {
                            setRobots((current) =>
                                current.map((item) =>
                                    item.uid === robot.uid
                                        ? { ...item, users }
                                        : item
                                )
                            );
                        })
                    );
                });
            })
            .catch((reason) => setError(reason.message));
        return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
    }, []);

    async function switchUser(robot: RobotState, user: WaitingUser | null) {
        const key = `${robot.uid}:${user?.uid || "release"}`;
        setBusy(key);
        setError("");
        try {
            if (process.env.storage === "firebase") {
                await assignControl(
                    robot.uid,
                    user?.uid || null,
                    user?.displayName
                );
            } else {
                await localAdmin.current!.setActive(user?.uid || null);
            }
        } catch (reason: any) {
            setError(reason.message);
        } finally {
            setBusy("");
        }
    }

    async function saveName(user: WaitingUser, name: string) {
        setBusy(`name:${user.uid}`);
        setError("");
        try {
            await localAdmin.current!.setName(user.uid, name);
        } catch (reason: any) {
            setError(reason.message);
        } finally {
            setBusy("");
        }
    }

    return (
        <main className="admin-page">
            <header className="admin-header">
                <div>
                    <h1>Control administration</h1>
                    <p>Select the one user permitted to control each robot.</p>
                </div>
                <a href="/">Home</a>
            </header>
            {error && (
                <div className="admin-error" role="alert">
                    {error}
                </div>
            )}
            <div aria-live="polite" className="admin-status">
                {busy ? "Saving change…" : ""}
            </div>
            {robots.map((robot) => (
                <section className="admin-robot" key={robot.uid}>
                    <h2>{robot.name}</h2>
                    <p>
                        Active user:{" "}
                        <strong>
                            {robot.lease.activeUserName || "Nobody"}
                        </strong>
                    </p>
                    {robot.lease.activeUserUid && (
                        <button
                            disabled={Boolean(busy)}
                            onClick={() => switchUser(robot, null)}
                        >
                            Release control
                        </button>
                    )}
                    <h3>Users</h3>
                    {robot.users.length === 0 && (
                        <p>No users currently waiting.</p>
                    )}
                    {robot.users.map((user) => {
                        const active = robot.lease.activeUserUid === user.uid;
                        return (
                            <div className="admin-user" key={user.uid}>
                                <div>
                                    <strong>
                                        {user.adminName || user.displayName}
                                    </strong>
                                    <br />
                                    {process.env.storage !== "firebase" && (
                                        <>
                                            <span className="admin-technical-label">
                                                {user.displayName} · IP{" "}
                                                {user.ipAddress || "unknown"}
                                            </span>
                                            <AdminNameEditor
                                                user={user}
                                                disabled={Boolean(busy)}
                                                onSave={saveName}
                                            />
                                        </>
                                    )}
                                    <span
                                        className={`admin-status ${active ? "active" : "waiting"}`}
                                    >
                                        {active
                                            ? "Active"
                                            : user.state === "online"
                                              ? "Waiting"
                                              : "Offline"}
                                    </span>
                                </div>
                                <button
                                    disabled={
                                        active ||
                                        user.state !== "online" ||
                                        Boolean(busy)
                                    }
                                    onClick={() => switchUser(robot, user)}
                                >
                                    {active ? "Has control" : "Make active"}
                                </button>
                            </div>
                        );
                    })}
                </section>
            ))}
        </main>
    );
}

function AdminNameEditor(props: {
    user: WaitingUser;
    disabled: boolean;
    onSave: (user: WaitingUser, name: string) => Promise<void>;
}) {
    const [name, setName] = React.useState(props.user.adminName || "");
    React.useEffect(
        () => setName(props.user.adminName || ""),
        [props.user.adminName]
    );
    return (
        <div className="admin-name-editor">
            <label htmlFor={`name-${props.user.uid}`}>Private admin name</label>
            <input
                id={`name-${props.user.uid}`}
                value={name}
                maxLength={80}
                placeholder="e.g. Jamie"
                disabled={props.disabled}
                onChange={(event) => setName(event.target.value)}
            />
            <button
                disabled={
                    props.disabled ||
                    name.trim() === (props.user.adminName || "")
                }
                onClick={() => props.onSave(props.user, name)}
            >
                Save name
            </button>
        </div>
    );
}

createRoot(document.getElementById("root")!).render(<AdminPage />);
