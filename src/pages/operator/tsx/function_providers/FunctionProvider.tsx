import { RemoteRobot } from "shared/remoterobot";
import { VelocityCommand } from "shared/commands";
import { ValidJoints } from "shared/util";
import { ActionMode } from "../utils/component_definitions";

type BaseStepPose = {
    x: number;
    y: number;
    yaw: number;
};

/**
 * Provides logic to connect the {@link RemoteRobot} and the components in the
 * interface
 */
export abstract class FunctionProvider {
    protected static remoteRobot?: RemoteRobot;
    public static velocityScale: number;
    public static actionMode: ActionMode;
    public activeVelocityAction?: VelocityCommand;
    public velocityExecutionHeartbeat?: number; // ReturnType<typeof setInterval>
    public basePulseTimeout?: number;
    public baseStepInterval?: number;
    public basePulseHeartbeat?: number;

    /**
     * Adds a remote robot instance to this function provider. This must be called
     * before any components of the interface will be able to execute functions
     * to change the state of the robot.
     *
     * @param remoteRobot the remote robot instance to add
     */
    static addRemoteRobot(remoteRobot: RemoteRobot) {
        FunctionProvider.remoteRobot = remoteRobot;
    }

    /**
     * Sets the initial values for the velocity scale and action mode
     *
     * @param velocityScale initial velocity scale
     * @param actionMode initial action mode
     */
    static initialize(velocityScale: number, actionMode: ActionMode) {
        this.velocityScale = velocityScale;
        this.actionMode = actionMode;
    }

    public incrementalBaseDrive(linVel: number, angVel: number) {
        this.stopCurrentAction();
        this.activeVelocityAction = FunctionProvider.remoteRobot?.driveBase(
            linVel,
            angVel
        );
    }

    public incrementalJointMovement(jointName: ValidJoints, increment: number) {
        this.stopCurrentAction();
        this.activeVelocityAction =
            FunctionProvider.remoteRobot?.incrementalMove(jointName, increment);
    }

    public continuousBaseDrive(linVel: number, angVel: number) {
        this.stopCurrentAction();
        this.activeVelocityAction = FunctionProvider.remoteRobot?.driveBase(
            linVel,
            angVel
        );
        this.velocityExecutionHeartbeat = window.setInterval(() => {
            this.activeVelocityAction = FunctionProvider.remoteRobot?.driveBase(
                linVel,
                angVel
            );
        }, 150);
    }

    public pulseBaseDrive(
        linVel: number,
        angVel: number,
        durationMs: number = 250,
        targetOverride?: number
    ) {
        this.stopCurrentAction(true);
        const startPose = this.getBaseStepPose();
        const target =
            targetOverride ??
            (Math.abs(linVel) > 0
                ? Math.abs(linVel) * (durationMs / 1000)
                : Math.abs(angVel) * (durationMs / 1000));
        const maxDurationMs = startPose
            ? Math.max(2000, durationMs * 4)
            : durationMs;

        this.activeVelocityAction = FunctionProvider.remoteRobot?.driveBase(
            linVel,
            angVel
        );
        this.basePulseHeartbeat = window.setInterval(() => {
            this.activeVelocityAction?.affirm?.();
        }, 100);
        if (startPose) {
            this.baseStepInterval = window.setInterval(() => {
                const currentPose = this.getBaseStepPose();
                if (!currentPose) return;

                const traveled =
                    Math.abs(linVel) > 0
                        ? Math.hypot(
                              currentPose.x - startPose.x,
                              currentPose.y - startPose.y
                          )
                        : Math.abs(
                              this.shortestAngularDistance(
                                  startPose.yaw,
                                  currentPose.yaw
                              )
                          );

                if (traveled >= target) {
                    this.stopBasePulse();
                }
            }, 50);
        }
        this.basePulseTimeout = window.setTimeout(() => {
            this.stopBasePulse();
        }, maxDurationMs);
    }

    private stopBasePulse() {
        this.activeVelocityAction?.stop();
        this.activeVelocityAction = undefined;
        if (this.basePulseTimeout) {
            clearTimeout(this.basePulseTimeout);
            this.basePulseTimeout = undefined;
        }
        if (this.baseStepInterval) {
            clearInterval(this.baseStepInterval);
            this.baseStepInterval = undefined;
        }
        if (this.basePulseHeartbeat) {
            clearInterval(this.basePulseHeartbeat);
            this.basePulseHeartbeat = undefined;
        }
    }

    private getBaseStepPose(): BaseStepPose | undefined {
        const transform =
            FunctionProvider.remoteRobot?.getOdomPose() ||
            FunctionProvider.remoteRobot?.getMapPose();
        if (!transform) return undefined;

        return {
            x: transform.translation.x,
            y: transform.translation.y,
            yaw: this.getYawFromQuaternion(transform.rotation),
        };
    }

    private getYawFromQuaternion(rotation: {
        x: number;
        y: number;
        z: number;
        w: number;
    }): number {
        return Math.atan2(
            2 * (rotation.w * rotation.z + rotation.x * rotation.y),
            1 - 2 * (rotation.y * rotation.y + rotation.z * rotation.z)
        );
    }

    private shortestAngularDistance(from: number, to: number): number {
        return Math.atan2(Math.sin(to - from), Math.cos(to - from));
    }

    public continuousJointMovement(jointName: ValidJoints, increment: number) {
        this.stopCurrentAction();
        this.activeVelocityAction =
            FunctionProvider.remoteRobot?.incrementalMove(jointName, increment);
        this.velocityExecutionHeartbeat = window.setInterval(() => {
            this.activeVelocityAction =
                FunctionProvider.remoteRobot?.incrementalMove(
                    jointName,
                    increment
                );
        }, 150);
    }

    // NOTE: When we undo this temp fix (of not stopping the
    // trajectory client) we also need to undo it in robot.jsx
    // `stopExecution()`.
    public stopCurrentAction(send_stop_command: boolean = false) {
        if (send_stop_command) FunctionProvider.remoteRobot?.stopTrajectory();
        if (this.activeVelocityAction) {
            // TODO: this.activeVelocityAction.stop sometimes (always?) executes the
            // exact same cancellation command(s) as FunctionProvider.remoteRobot?.stopTrajectory,
            // which means we are unnecessarily calling it twice.
            if (send_stop_command) this.activeVelocityAction.stop();
            this.activeVelocityAction = undefined;
        }
        if (this.velocityExecutionHeartbeat) {
            clearInterval(this.velocityExecutionHeartbeat);
            this.velocityExecutionHeartbeat = undefined;
        }
        if (this.basePulseTimeout) {
            clearTimeout(this.basePulseTimeout);
            this.basePulseTimeout = undefined;
        }
        if (this.baseStepInterval) {
            clearInterval(this.baseStepInterval);
            this.baseStepInterval = undefined;
        }
        if (this.basePulseHeartbeat) {
            clearInterval(this.basePulseHeartbeat);
            this.basePulseHeartbeat = undefined;
        }
    }
}
