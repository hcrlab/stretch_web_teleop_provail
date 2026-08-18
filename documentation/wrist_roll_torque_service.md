# Wrist-roll torque service

The golf-swing control expects the Stretch ROS 2 driver to expose:

```text
/wrist_roll_torque
std_srvs/srv/SetBool

data: false  disables wrist-roll torque
data: true   enables wrist-roll torque
```

This service belongs in `stretch_core/stretch_core/stretch_driver.py`, because
the Stretch driver owns the `stretch_body.Robot` hardware connection. Do not
open a second `stretch_body.Robot` connection from web teleop.

Add the service in `ros_setup()` alongside `/runstop`:

```py
self.wrist_roll_torque_service = self.create_service(
    SetBool,
    "/wrist_roll_torque",
    self.wrist_roll_torque_service_callback,
    callback_group=self.main_group,
)
```

Add this callback to the driver:

```py
def wrist_roll_torque_service_callback(self, request, response):
    """Enable or disable torque on only the wrist-roll Dynamixel."""
    wrist_roll = self.robot.end_of_arm.get_joint("wrist_roll")
    if wrist_roll is None:
        response.success = False
        response.message = "wrist_roll is not available on this end-of-arm tool"
        return response

    try:
        with self.robot.end_of_arm.pt_lock:
            if request.data:
                wrist_roll.enable_torque()
                response.message = "Wrist roll torque enabled"
            else:
                wrist_roll.disable_torque()
                response.message = "Wrist roll torque disabled"
        response.success = True
    except Exception as exc:
        self.get_logger().error(
            "Failed to set wrist roll torque: {0}".format(exc)
        )
        response.success = False
        response.message = "Failed to set wrist roll torque: {0}".format(exc)
    return response
```

After rebuilding and restarting `stretch_driver`, verify the service before
using the web button:

```bash
ros2 service call /wrist_roll_torque std_srvs/srv/SetBool "{data: false}"
ros2 service call /wrist_roll_torque std_srvs/srv/SetBool "{data: true}"
```

Keep the wrist clear and supported during this test. Disabling torque makes the
attached club move freely under gravity.
