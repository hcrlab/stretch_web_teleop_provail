import {
    JOINT_VELOCITIES,
    JOINT_INCREMENTS,
    ValidJoints,
    ValidJointStateDict,
} from "shared/util";
import { ActionMode } from "../utils/component_definitions";
import { FunctionProvider } from "./FunctionProvider";

/**
 * Each of the possible buttons which could be on a button pad. The string is
 * the label of the button which appears in the tooltip.
 */
export enum ButtonPadButton {
    BaseForward = "Base Forward",
    BaseReverse = "Base Reverse",
    BaseRotateRight = "Base rotate right",
    BaseRotateLeft = "Base rotate left",
    ArmLift = "Arm lift",
    ArmLower = "Arm lower",
    ArmExtend = "Arm extend",
    ArmRetract = "Arm retract",
    GripperOpen = "Gripper open",
    GripperClose = "Gripper close",
    WristRotateIn = "Wrist rotate in",
    WristRotateOut = "Wrist rotate out",
    WristPitchUp = "Wrist pitch up",
    WristPitchDown = "Wrist pitch down",
    WristRollLeft = "Wrist roll left",
    WristRollRight = "Wrist roll right",
    CameraTiltUp = "Camera tilt up",
    CameraTiltDown = "Camera tilt down",
    CameraPanLeft = "Camera pan left",
    CameraPanRight = "Camera pan right",
}

/** Array of the pan tilt buttons */
export const panTiltButtons: ButtonPadButton[] = [
    ButtonPadButton.CameraTiltUp,
    ButtonPadButton.CameraTiltDown,
    ButtonPadButton.CameraPanLeft,
    ButtonPadButton.CameraPanRight,
];

/** Button functions which require moving a joint in the negative direction. */
const negativeButtonPadFunctions = new Set<ButtonPadButton>([
    ButtonPadButton.BaseReverse,
    ButtonPadButton.BaseRotateRight,
    ButtonPadButton.ArmLower,
    ButtonPadButton.ArmRetract,
    ButtonPadButton.GripperClose,
    ButtonPadButton.WristRotateOut,
    ButtonPadButton.WristPitchDown,
    ButtonPadButton.WristRollLeft,
    ButtonPadButton.CameraTiltDown,
    ButtonPadButton.CameraPanRight,
]);

const BASE_STEP_REFERENCE_SCALE = 0.8;
const BASE_STEP_SLOWEST_SCALE = 0.2;
const BASE_STEP_FASTEST_SCALE = 1.6;
const BASE_STEP_DURATION_MS = 250;
const BASE_STEP_MEDIUM_MULTIPLIER = 1 +
    ((BASE_STEP_REFERENCE_SCALE - BASE_STEP_SLOWEST_SCALE) /
        (BASE_STEP_FASTEST_SCALE - BASE_STEP_SLOWEST_SCALE)) *
        9;
const BASE_STEP_MIN_MULTIPLIER = 0.5;
const BASE_STEP_MAX_MULTIPLIER = BASE_STEP_MEDIUM_MULTIPLIER * 0.7;
const BASE_STEP_TRANSLATION_M = 0.05;
const BASE_STEP_ROTATION_RAD = 0.15;

function getBaseStepScale(velocityScale = FunctionProvider.velocityScale): number {
    const minScale = BASE_STEP_SLOWEST_SCALE;
    const maxScale = BASE_STEP_FASTEST_SCALE;
    const normalized = (velocityScale - minScale) / (maxScale - minScale);
    return (
        BASE_STEP_MIN_MULTIPLIER +
        Math.max(0, Math.min(1, normalized)) *
            (BASE_STEP_MAX_MULTIPLIER - BASE_STEP_MIN_MULTIPLIER)
    );
}

function getBaseStepDurationMs(velocityScale?: number): number {
    return BASE_STEP_DURATION_MS * getBaseStepScale(velocityScale);
}

function getBaseStepTranslationTarget(velocityScale?: number): number {
    return BASE_STEP_TRANSLATION_M * getBaseStepScale(velocityScale);
}

function getBaseStepRotationTarget(velocityScale?: number): number {
    return BASE_STEP_ROTATION_RAD * getBaseStepScale(velocityScale);
}

/** Functions called when the user interacts with a button. */
export type ButtonFunctions = {
    onClick: () => void;
    onRelease?: () => void;
    onLeave?: () => void;
};

/** State for a single button on a button pad. */
export enum ButtonState {
    Inactive = "inactive",
    Active = "active",
    Collision = "collision",
    Limit = "limit",
}

/** Mapping from each type of button pad button to the state for that button */
export type ButtonStateMap = Map<ButtonPadButton, ButtonState>;

/**
 * Provides functions for the button pads
 */
export class ButtonFunctionProvider extends FunctionProvider {
    private buttonStateMap: ButtonStateMap = new Map<
        ButtonPadButton,
        ButtonState
    >();

    /**
     * Callback function to update the button state map in the operator so it
     * can rerender the button pads.
     */
    private operatorCallback?: (buttonStateMap: ButtonStateMap) => void =
        undefined;

    constructor() {
        super();
        this.provideFunctions = this.provideFunctions.bind(this);
        this.updateJointStates = this.updateJointStates.bind(this);
        this.setButtonActiveState = this.setButtonActiveState.bind(this);
        this.setButtonInactiveState = this.setButtonInactiveState.bind(this);
    }

    /**
     * Takes joint states and updates the button state map based on which joints
     * are in collision or at their limit.
     *
     * @param inJointLimit dictionary of joints whose limit booleans have changed
     * @param inCollision dictionary of joints whose collision booleans have changed
     */
    public updateJointStates(
        inJointLimit: ValidJointStateDict,
        inCollision: ValidJointStateDict
    ) {
        // For all the joints that are in collision, set their corresponding buttons
        // either to collision (for the button corresponding to the direction the
        // collision is in) or inactive (for the button corresponding to the other direction).
        Object.keys(inCollision).forEach((k: string) => {
            const key = k as ValidJoints;
            const [inCollisionNeg, inCollisionPos] = inCollision[key]!;
            const buttons = getButtonsFromJointName(key);
            if (!buttons) return;
            let [buttonNeg, buttonPos] =
                key !== "joint_wrist_yaw" && key !== "joint_wrist_pitch"
                    ? buttons
                    : buttons.reverse();

            // TODO: i think there's still something wrong with this logic
            const prevButtonStateNeg = this.buttonStateMap.get(buttonNeg);
            const prevButtonStatePos = this.buttonStateMap.get(buttonPos);
            const prevInCollisionNeg =
                prevButtonStateNeg === ButtonState.Collision;
            const prevInCollisionPos =
                prevButtonStatePos === ButtonState.Collision;
            if (!prevButtonStateNeg || inCollisionNeg !== prevInCollisionNeg)
                this.buttonStateMap.set(
                    buttonNeg,
                    inCollisionNeg
                        ? ButtonState.Collision
                        : ButtonState.Inactive
                );
            if (!prevButtonStatePos || inCollisionPos !== prevInCollisionPos)
                this.buttonStateMap.set(
                    buttonPos,
                    inCollisionPos
                        ? ButtonState.Collision
                        : ButtonState.Inactive
                );
        });

        // For all the joints that are at their limit, set their corresponding buttons
        // either to limit (for the button corresponding to the direction the joint
        // limit is in) or inactive (for the button corresponding to the other direction).
        Object.keys(inJointLimit).forEach((k: string) => {
            const key = k as ValidJoints;
            const [inLimitNeg, inLimitPos] = inJointLimit[key]!;
            const buttons = getButtonsFromJointName(key);
            if (!buttons) return;
            const [buttonNeg, buttonPos] = buttons;
            const prevButtonStateNeg = this.buttonStateMap.get(buttonNeg);
            const prevButtonStatePos = this.buttonStateMap.get(buttonPos);
            const prevInLimitNeg = prevButtonStateNeg !== ButtonState.Limit;
            const prevInLimitPos = prevButtonStatePos !== ButtonState.Limit;
            if (
                prevButtonStateNeg == undefined ||
                inLimitNeg !== prevInLimitNeg
            )
                this.buttonStateMap.set(
                    buttonNeg,
                    inLimitNeg ? ButtonState.Inactive : ButtonState.Limit
                );
            if (
                prevButtonStatePos == undefined ||
                inLimitPos !== prevInLimitPos
            )
                this.buttonStateMap.set(
                    buttonPos,
                    inLimitPos ? ButtonState.Inactive : ButtonState.Limit
                );
        });

        if (this.operatorCallback) this.operatorCallback(this.buttonStateMap);
    }

    /**
     * Sets the local pointer to the operator's callback function, to be called
     * whenever the button state map updates.
     *
     * @param callback operator's callback function to update the button state map
     */
    public setOperatorCallback(
        callback: (buttonStateMap: ButtonStateMap) => void
    ) {
        this.operatorCallback = callback;
    }

    /**
     * Executes the step-action behavior for a button exactly once, independent
     * of the current global action mode.
     *
     * This is useful for interaction surfaces such as keyboard shortcuts, where
     * pressing a shortcut should not start a press-and-hold or click-click
     * continuous action.
     *
     * @param buttonPadFunction the {@link ButtonPadButton} to execute once
     */
    public pressButtonOnce(
        buttonPadFunction: ButtonPadButton,
        velocityScaleOverride?: number
    ) {
        const jointName: ValidJoints =
            getJointNameFromButtonFunction(buttonPadFunction);
        const multiplier: number = negativeButtonPadFunctions.has(
            buttonPadFunction
        )
            ? -1
            : 1;
        const isBaseJoint =
            jointName === "translate_mobile_base" ||
            jointName === "rotate_mobile_base";

        // Shared velocityScale controls both arm and base speeds so the base
        // moves faster as the user increases the global SpeedControl.
        const velocity =
            multiplier *
            JOINT_VELOCITIES[jointName]! *
            FunctionProvider.velocityScale;
        const baseStepVelocity =
            multiplier *
            JOINT_VELOCITIES[jointName]! *
            BASE_STEP_REFERENCE_SCALE *
            getBaseStepScale(velocityScaleOverride);

        // Step increments for the base should also scale with velocityScale so
        // pressing a step moves farther at higher speed presets.
        const increment =
            multiplier *
            JOINT_INCREMENTS[jointName]! *
            (isBaseJoint ? FunctionProvider.velocityScale : 1);

        switch (buttonPadFunction) {
            case ButtonPadButton.BaseForward:
            case ButtonPadButton.BaseReverse:
                this.pulseBaseDrive(
                    baseStepVelocity,
                    0,
                    getBaseStepDurationMs(velocityScaleOverride),
                    getBaseStepTranslationTarget(velocityScaleOverride)
                );
                break;
            case ButtonPadButton.BaseRotateLeft:
            case ButtonPadButton.BaseRotateRight:
                this.pulseBaseDrive(
                    0,
                    baseStepVelocity,
                    getBaseStepDurationMs(velocityScaleOverride),
                    getBaseStepRotationTarget(velocityScaleOverride)
                );
                break;
            case ButtonPadButton.CameraTiltUp:
            case ButtonPadButton.CameraTiltDown:
            case ButtonPadButton.CameraPanLeft:
            case ButtonPadButton.CameraPanRight:
                this.incrementalJointMovement(jointName, increment);
                FunctionProvider.remoteRobot?.setToggle(
                    "setFollowGripper",
                    false
                );
                break;
            default:
                this.incrementalJointMovement(jointName, increment);
                break;
        }

        this.setButtonActiveState(buttonPadFunction);
        setTimeout(() => this.setButtonInactiveState(buttonPadFunction), 1000);
    }

    /**
     * Sets a type of a button pad button to active.
     *
     * @param buttonType the button pad button to set active
     */
    private setButtonActiveState(buttonType: ButtonPadButton) {
        const currentState = this.buttonStateMap.get(buttonType);

        // Don't set to active if in collision or at it's limit
        if (
            currentState === ButtonState.Collision ||
            currentState === ButtonState.Limit
        )
            return;

        this.buttonStateMap.set(buttonType, ButtonState.Active);
        if (this.operatorCallback) this.operatorCallback(this.buttonStateMap);
    }

    /**
     * Sets a type of a button pad button to inactive.
     *
     * @param buttonType the button pad button to set active
     */
    private setButtonInactiveState(buttonType: ButtonPadButton) {
        const currentState = this.buttonStateMap.get(buttonType);

        // Don't set to inactive if in collision or at it's limit
        if (
            currentState === ButtonState.Collision ||
            currentState === ButtonState.Limit ||
            currentState === ButtonState.Inactive
        )
            return;

        this.buttonStateMap.set(buttonType, ButtonState.Inactive);
        if (this.operatorCallback) this.operatorCallback(this.buttonStateMap);
    }

    /**
     * Takes a ButtonPadFunction which indicates the type of button (e.g. drive
     * base forward, lift arm), and returns a set of functions to execute when
     * the user interacts with the button.
     *
     * @param buttonPadFunction the {@link ButtonPadButton}
     * @returns the {@link ButtonFunctions} for the button
     */
    public provideFunctions(
        buttonPadFunction: ButtonPadButton
    ): ButtonFunctions {
        let action: () => void;
        const onLeave = () => {
            this.stopCurrentAction();
            this.setButtonInactiveState(buttonPadFunction);
        };

        const jointName: ValidJoints =
            getJointNameFromButtonFunction(buttonPadFunction);
        const multiplier: number = negativeButtonPadFunctions.has(
            buttonPadFunction
        )
            ? -1
            : 1;

        const isBaseJoint =
            jointName === "translate_mobile_base" ||
            jointName === "rotate_mobile_base";

        const velocity =
            multiplier *
            JOINT_VELOCITIES[jointName]! *
            FunctionProvider.velocityScale;
        const baseStepVelocity =
            multiplier *
            JOINT_VELOCITIES[jointName]! *
            BASE_STEP_REFERENCE_SCALE *
            getBaseStepScale();

        const increment =
            multiplier *
            JOINT_INCREMENTS[jointName]! *
            (isBaseJoint ? FunctionProvider.velocityScale : 1);

        switch (FunctionProvider.actionMode) {
            case ActionMode.StepActions:
                switch (buttonPadFunction) {
                    case ButtonPadButton.BaseForward:
                    case ButtonPadButton.BaseReverse:
                        action = () =>
                            this.pulseBaseDrive(
                                baseStepVelocity,
                                0,
                                getBaseStepDurationMs(),
                                getBaseStepTranslationTarget()
                            );
                        break;
                    case ButtonPadButton.BaseRotateLeft:
                    case ButtonPadButton.BaseRotateRight:
                        action = () =>
                            this.pulseBaseDrive(
                                0,
                                baseStepVelocity,
                                getBaseStepDurationMs(),
                                getBaseStepRotationTarget()
                            );
                        break;
                    case ButtonPadButton.ArmLower:
                    case ButtonPadButton.ArmLift:
                    case ButtonPadButton.ArmExtend:
                    case ButtonPadButton.ArmRetract:
                    case ButtonPadButton.WristRotateIn:
                    case ButtonPadButton.WristRotateOut:
                    case ButtonPadButton.WristPitchUp:
                    case ButtonPadButton.WristPitchDown:
                    case ButtonPadButton.WristRollLeft:
                    case ButtonPadButton.WristRollRight:
                    case ButtonPadButton.GripperOpen:
                    case ButtonPadButton.GripperClose:
                        action = () =>
                            this.incrementalJointMovement(jointName, increment);
                        break;
                    case ButtonPadButton.CameraTiltUp:
                    case ButtonPadButton.CameraTiltDown:
                    case ButtonPadButton.CameraPanLeft:
                    case ButtonPadButton.CameraPanRight:
                        action = () => {
                            this.incrementalJointMovement(jointName, increment);
                            FunctionProvider.remoteRobot?.setToggle(
                                "setFollowGripper",
                                false
                            );
                        };
                        break;
                }
                return {
                    onClick: () => {
                        action();
                        this.setButtonActiveState(buttonPadFunction);
                        // Set button state inactive after 1 second
                        setTimeout(
                            () =>
                                this.setButtonInactiveState(buttonPadFunction),
                            1000
                        );
                    },
                    onLeave: onLeave,
                };
            case ActionMode.PressAndHold:
            case ActionMode.ClickClick:
                switch (buttonPadFunction) {
                    case ButtonPadButton.BaseForward:
                    case ButtonPadButton.BaseReverse:
                        // Use continuous base drive (cmd_vel style) so the base
                        // moves continuously while pressed. Velocity is already
                        // scaled by FunctionProvider.velocityScale.
                        action = () => this.continuousBaseDrive(velocity, 0);
                        break;
                    case ButtonPadButton.BaseRotateLeft:
                    case ButtonPadButton.BaseRotateRight:
                        action = () => this.continuousBaseDrive(0, velocity);
                        break;

                    case ButtonPadButton.ArmLower:
                    case ButtonPadButton.ArmLift:
                    case ButtonPadButton.ArmExtend:
                    case ButtonPadButton.ArmRetract:
                    case ButtonPadButton.WristRotateIn:
                    case ButtonPadButton.WristRotateOut:
                    case ButtonPadButton.WristPitchUp:
                    case ButtonPadButton.WristPitchDown:
                    case ButtonPadButton.WristRollLeft:
                    case ButtonPadButton.WristRollRight:
                    case ButtonPadButton.GripperOpen:
                    case ButtonPadButton.GripperClose:
                        action = () =>
                            this.continuousJointMovement(jointName, increment);
                        break;
                    case ButtonPadButton.CameraTiltUp:
                    case ButtonPadButton.CameraTiltDown:
                    case ButtonPadButton.CameraPanLeft:
                    case ButtonPadButton.CameraPanRight:
                        action = () => {
                            this.continuousJointMovement(jointName, increment);
                            FunctionProvider.remoteRobot?.setToggle(
                                "setFollowGripper",
                                false
                            );
                        };
                        break;
                }

                return FunctionProvider.actionMode === ActionMode.PressAndHold
                    ? {
                          onClick: () => {
                              action();
                              this.setButtonActiveState(buttonPadFunction);
                          },
                          // For press-release, stop when button released
                          onRelease: () => {
                              this.stopCurrentAction();
                              this.setButtonInactiveState(buttonPadFunction);
                          },
                          onLeave: onLeave,
                      }
                    : {
                          // For click-click, stop if button already active
                          onClick: () => {
                              if (this.activeVelocityAction) {
                                  this.stopCurrentAction();
                                  this.setButtonInactiveState(
                                      buttonPadFunction
                                  );
                              } else {
                                  action();
                                  this.setButtonActiveState(buttonPadFunction);
                              }
                          },
                          onLeave: onLeave,
                      };
        }
    }
}

/**
 * Uses the name of a joint on the robot to get the two related button pad buttons.
 *
 * @param jointName the name of the joint
 * @returns both of the corresponding button types (for moving the joint in the
 * negative or positive direction respectively)
 */
function getButtonsFromJointName(
    jointName: ValidJoints
): [ButtonPadButton, ButtonPadButton] | undefined {
    switch (jointName) {
        case "joint_gripper_finger_left":
            return [ButtonPadButton.GripperClose, ButtonPadButton.GripperOpen];
        case "wrist_extension":
            return [ButtonPadButton.ArmRetract, ButtonPadButton.ArmExtend];
        case "joint_lift":
            return [ButtonPadButton.ArmLower, ButtonPadButton.ArmLift];
        case "joint_wrist_roll":
            return [
                ButtonPadButton.WristRollLeft,
                ButtonPadButton.WristRollRight,
            ];
        case "joint_wrist_pitch":
            return [
                ButtonPadButton.WristPitchDown,
                ButtonPadButton.WristPitchUp,
            ];
        case "joint_wrist_yaw":
            return [
                ButtonPadButton.WristRotateOut,
                ButtonPadButton.WristRotateIn,
            ];
        case "translate_mobile_base":
            return [ButtonPadButton.BaseForward, ButtonPadButton.BaseReverse];
        case "rotate_mobile_base":
            return [
                ButtonPadButton.BaseRotateLeft,
                ButtonPadButton.BaseRotateRight,
            ];
        case "joint_head_pan":
            return [
                ButtonPadButton.CameraPanRight,
                ButtonPadButton.CameraPanLeft,
            ];
        case "joint_head_tilt":
            return [
                ButtonPadButton.CameraTiltDown,
                ButtonPadButton.CameraTiltUp,
            ];
        default:
            return undefined;
    }
}

/**
 * Uses the type of a button pad button to get the corresponding joint name.
 *
 * @param buttonType the type of button in a button pad
 * @returns the name of the corresponding joint
 */
function getJointNameFromButtonFunction(
    buttonType: ButtonPadButton
): ValidJoints {
    switch (buttonType) {
        case ButtonPadButton.BaseReverse:
        case ButtonPadButton.BaseForward:
            return "translate_mobile_base";

        case ButtonPadButton.BaseRotateLeft:
        case ButtonPadButton.BaseRotateRight:
            return "rotate_mobile_base";

        case ButtonPadButton.ArmLower:
        case ButtonPadButton.ArmLift:
            return "joint_lift";

        case ButtonPadButton.ArmRetract:
        case ButtonPadButton.ArmExtend:
            return "wrist_extension";

        case ButtonPadButton.GripperClose:
        case ButtonPadButton.GripperOpen:
            return "joint_gripper_finger_left";

        case ButtonPadButton.WristRollLeft:
        case ButtonPadButton.WristRollRight:
            return "joint_wrist_roll";

        case ButtonPadButton.WristPitchUp:
        case ButtonPadButton.WristPitchDown:
            return "joint_wrist_pitch";

        case ButtonPadButton.WristRotateIn:
        case ButtonPadButton.WristRotateOut:
            return "joint_wrist_yaw";

        case ButtonPadButton.CameraTiltUp:
        case ButtonPadButton.CameraTiltDown:
            return "joint_head_tilt";

        case ButtonPadButton.CameraPanLeft:
        case ButtonPadButton.CameraPanRight:
            return "joint_head_pan";

        default:
            throw Error("unknown button pad function" + buttonType);
    }
}
