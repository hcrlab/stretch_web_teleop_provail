# Mock Operator Testing

This branch includes a local mock mode for testing operator UI behavior without a
Stretch robot, ROS, WebRTC signaling, or HTTPS certificates.

## Run

Install dependencies:

```bash
npm install --legacy-peer-deps
```

Build the frontend in local-storage mode:

```bash
npm run mock:build
```

The webpack config watches by default. Leave it running while you test.

In a second terminal, serve the built files:

```bash
npm run mock:server
```

Open three tabs (or separate browser windows):

```text
http://localhost:8080/operator?mock=1
http://localhost:8080/operator?mock=1
http://localhost:8080/admin/
```

No login, computer name, or admin password is required. The server labels the
sessions `Waiting user 1`, `Waiting user 2`, and so on, based on arrival order.
The first session is active automatically. On the admin page, choose **Make
active** for another session or **Release control** to disable the first one. An
active operator can use the controls; other operators see a disabled-controls banner.
Switching users immediately reverses those states. Use separate browsers or
private windows to create clearly independent demo sessions.

The admin page also displays each session's IP and provides a **Private admin
name** field. Saved names appear only on the admin page; operator pages continue
to show anonymous waiting/control status.

## What Mock Mode Does

-   Renders the real operator UI.
-   Provides animated canvas-backed mock video streams for overhead, realsense,
    and gripper cameras.
-   Installs a mock `RemoteRobot` that logs commands to the browser console as
    `[mock robot command]`.
-   Registers each operator as an anonymous waiting session with the mock server.
-   Uses the same unprotected `/admin/` active-user workflow as the robot-hosted
    local server.
-   Seeds basic robot state: homed, navigation mode, runstop disabled, and battery
    voltage.

## Verify These Changes

Keyboard shortcuts:

-   Open browser devtools.
-   Press `Ctrl+Shift+Alt+W/A/S/D` for base motion.
-   Press `Ctrl+Shift+Alt+Z/C` for forward/backward base motion one speed level higher.
-   Press `Space` or `Shift+Alt+X` to stop motion.
-   Press `Shift+Alt+U/J/I/K/O/L/Y/H/T/G/F/R` for lift, arm, gripper, and wrist motion.
-   Press `Shift+Alt+ArrowUp/ArrowDown/ArrowLeft/ArrowRight` for camera tilt/pan.
-   Press `Shift+Alt+-` or `Shift+Alt+=` to adjust speed.
-   Confirm a `[mock robot command]` log appears.
-   Confirm shortcuts do not fire while the cursor is inside a text input.

Panel resizing:

-   Click `Customize`.
-   Confirm each panel shows a `Resize panel` handle.
-   Drag a handle or focus it and press `ArrowUp` / `ArrowDown`.
-   Confirm panels resize.
-   Click `Done`, reload, and confirm the size persists through local storage.

Configuration add/delete behavior:

-   Click `Customize`.
-   Select a component from the sidebar, such as `Button Grid`.
-   Click a visible pin drop zone.
-   Confirm the component is added and the sidebar remains open in the component
    picker state.
-   Select an existing component, delete it, and confirm the sidebar remains open.
