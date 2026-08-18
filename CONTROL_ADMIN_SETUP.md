# Admin-controlled operator access

The `/admin/` page lets a coordinator select the single operator permitted to
control each robot. It intentionally has no login or password in local mode;
access is based on being able to reach the robot-hosted web server. Operators
appear after opening the operator page.
The operator UI and command channel are disabled until the administrator grants
control. Changing or releasing the lease also disconnects the old WebRTC session
and stops base, joint trajectory, navigation, pre-grasp, and tablet actions.

## Local robot-hosted mode (recommended)

No authentication setup is required. Each browser tab gets a random anonymous
session ID stored in `sessionStorage`. No user or computer name is collected.
The server labels connected sessions `Waiting user 1`, `Waiting user 2`, and so
on, based on arrival order:

```text
https://ROBOT_IP/operator
https://ROBOT_IP/operator
https://ROBOT_IP/admin/
```

The Socket.IO server keeps the waiting list and active session in memory. It
admits only the selected session to WebRTC. Restarting the server clears the
selection, and the coordinator selects a user again. The admin page shows each
session's IP address and lets the coordinator assign a temporary private name.
That name is delivered only to subscribed admin-page sockets and is never shown
on `/operator/`. Names are cleared when the server restarts.

The first operator to connect after the server starts is activated automatically
so the robot can be used immediately. This automatic grant happens only once per
server run. If the coordinator releases that user in `/admin/`, the server leaves
control unassigned until the coordinator explicitly activates someone.

## Optional Firebase-hosted mode

1. Deploy `database.rules.json` as the Realtime Database rules. If this project
   already has additional production rules, merge these paths rather than
   replacing unrelated rules.
2. Give administrator accounts the Firebase Authentication custom claim
   `{ "admin": true }` using the Firebase Admin SDK in a trusted environment.
   Never set this claim from browser code.
3. Have the administrator sign out and back in after the claim is assigned so a
   refreshed ID token contains the claim.
4. Build and serve the app, then open `/admin/`. Firebase mode still uses its
   authentication identities because it is designed for access beyond the
   robot's trusted local network.

Example one-off Admin SDK operation:

```js
await getAuth().setCustomUserClaims("ADMIN_FIREBASE_UID", { admin: true });
```

## Database paths

-   `controlLeases/{robotUid}`: current operator and monotonically increasing generation.
-   `presence/{robotUid}/{operatorUid}`: online/waiting-user information.
-   `rooms/{robotUid}/operator`: WebRTC signaling plus controller UID and lease generation.

See `provail_docs/mock_operator_testing.md` for a no-login, multi-tab demo.
