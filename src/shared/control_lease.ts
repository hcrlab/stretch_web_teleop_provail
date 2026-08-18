import { FirebaseOptions, getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import {
    Database,
    get,
    getDatabase,
    onDisconnect,
    onValue,
    ref,
    runTransaction,
    serverTimestamp,
    set,
} from "firebase/database";

export interface ControlLease {
    activeUserUid: string | null;
    activeUserName?: string;
    generation: number;
    assignedAt?: number;
    assignedBy?: string;
}

export interface WaitingUser {
    uid: string;
    displayName: string;
    state: "online" | "offline";
    lastSeenAt?: number;
    ipAddress?: string;
    adminName?: string;
}

export function firebaseConfig(): FirebaseOptions {
    return {
        apiKey: process.env.apiKey,
        authDomain: process.env.authDomain,
        databaseURL: process.env.databaseURL,
        projectId: process.env.projectId,
        storageBucket: process.env.storageBucket,
        messagingSenderId: process.env.messagingSenderId,
        appId: process.env.appId,
        measurementId: process.env.measurementId,
    };
}

function database(): Database {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig());
    return getDatabase(app);
}

export async function resolveRobotUid(robotName: string): Promise<string> {
    const db = database();
    const user = await waitForUser();
    const assignment = await get(ref(db, `assignments/${user.uid}/robots`));
    const robots = assignment.val() || {};
    for (const robotUid of Object.keys(robots)) {
        const robot = await get(ref(db, `robots/${robotUid}`));
        if (robot.val()?.name === robotName) return robotUid;
    }
    throw new Error(`User is not assigned to robot ${robotName}`);
}

export function waitForUser(): Promise<User> {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig());
    const auth = getAuth(app);
    if (auth.currentUser) return Promise.resolve(auth.currentUser);
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            user ? resolve(user) : reject(new Error("Authentication required"));
        });
    });
}

export function subscribeToControlLease(
    robotUid: string,
    callback: (lease: ControlLease) => void
): () => void {
    if (process.env.storage !== "firebase") {
        callback({ activeUserUid: "local", generation: 1 });
        return () => undefined;
    }
    return onValue(ref(database(), `controlLeases/${robotUid}`), (snapshot) => {
        const value = snapshot.val() || {};
        callback({
            activeUserUid: value.activeUserUid || null,
            activeUserName: value.activeUserName,
            generation: value.generation || 0,
            assignedAt: value.assignedAt,
            assignedBy: value.assignedBy,
        });
    });
}

export async function registerWaitingPresence(
    robotUid: string
): Promise<() => void> {
    if (process.env.storage !== "firebase") return () => undefined;
    const user = await waitForUser();
    const presenceRef = ref(database(), `presence/${robotUid}/${user.uid}`);
    const offline = {
        displayName: user.displayName || user.email || user.uid,
        state: "offline",
        lastSeenAt: serverTimestamp(),
    };
    await onDisconnect(presenceRef).set(offline);
    await set(presenceRef, {
        displayName: user.displayName || user.email || user.uid,
        state: "online",
        lastSeenAt: serverTimestamp(),
    });
    return () => {
        set(presenceRef, offline);
    };
}

export function subscribeToPresence(
    robotUid: string,
    callback: (users: WaitingUser[]) => void
): () => void {
    return onValue(ref(database(), `presence/${robotUid}`), (snapshot) => {
        const value = snapshot.val() || {};
        callback(
            Object.entries<any>(value).map(([uid, user]) => ({
                uid,
                displayName: user.displayName || uid,
                state: user.state === "online" ? "online" : "offline",
                lastSeenAt: user.lastSeenAt,
            }))
        );
    });
}

export async function assignControl(
    robotUid: string,
    activeUserUid: string | null,
    activeUserName?: string
): Promise<void> {
    const user = await waitForUser();
    const token = await user.getIdTokenResult(true);
    if (token.claims.admin !== true)
        throw new Error("Administrator access required");
    await runTransaction(
        ref(database(), `controlLeases/${robotUid}`),
        (current) => ({
            activeUserUid,
            activeUserName: activeUserUid
                ? activeUserName || activeUserUid
                : null,
            generation: (current?.generation || 0) + 1,
            assignedAt: Date.now(),
            assignedBy: user.uid,
        })
    );
}

export async function listAdminRobots(): Promise<
    Array<{ uid: string; name: string }>
> {
    const user = await waitForUser();
    const token = await user.getIdTokenResult(true);
    if (token.claims.admin !== true)
        throw new Error("Administrator access required");
    const snapshot = await get(ref(database(), "robots"));
    const robots = snapshot.val() || {};
    return Object.entries<any>(robots).map(([uid, robot]) => ({
        uid,
        name: robot.name || uid,
    }));
}
