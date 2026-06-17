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

Open:

```text
http://localhost:8080/operator?mock=1
```

## What Mock Mode Does

- Renders the real operator UI.
- Provides animated canvas-backed mock video streams for overhead, realsense,
  and gripper cameras.
- Installs a mock `RemoteRobot` that logs commands to the browser console as
  `[mock robot command]`.
- Seeds basic robot state: homed, navigation mode, runstop disabled, and battery
  voltage.

## Verify These Changes

Keyboard shortcuts:

- Open browser devtools.
- Press `W`, `A`, `S`, or `D`.
- Confirm a `[mock robot command]` log appears.
- Confirm shortcuts do not fire while the cursor is inside a text input.

Panel resizing:

- Click `Customize`.
- Confirm each panel shows a `Resize panel` handle.
- Drag a handle or focus it and press `ArrowUp` / `ArrowDown`.
- Confirm panels resize.
- Click `Done`, reload, and confirm the size persists through local storage.

Configuration add/delete behavior:

- Click `Customize`.
- Select a component from the sidebar, such as `Button Grid`.
- Click a visible pin drop zone.
- Confirm the component is added and the sidebar remains open in the component
  picker state.
- Select an existing component, delete it, and confirm the sidebar remains open.
