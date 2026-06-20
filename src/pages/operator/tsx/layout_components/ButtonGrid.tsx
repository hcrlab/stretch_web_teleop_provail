import React from "react";
import { buttonFunctionProvider } from "operator/tsx/index";
import {
    ButtonFunctions,
    ButtonPadButton,
    ButtonState,
} from "../function_providers/ButtonFunctionProvider";
import {
    CustomizableComponentProps,
    isSelected,
} from "./CustomizableComponent";
import { ButtonGridDefinition } from "../utils/component_definitions";
import { className } from "shared/util";
import "operator/css/ButtonGrid.css";
import { ResizeHandles } from "./ResizeHandles";

const BUTTON_NAMES = [
    "Forward",
    "Backwards",
    "Turn Left",
    "Turn Right",

    "Move Lift Up",
    "Move Lift Down",
    "Extend Arm",
    "Collapse Arm",

    "Roll Left",
    "Roll Right",
    "Pitch Up",
    "Pitch Down",
    "Rotate Left",
    "Rotate Right",

    "Open Gripper",
    "Close Gripper",
];

const BUTTON_FUNCTIONS = [
    ButtonPadButton.BaseForward,
    ButtonPadButton.BaseReverse,
    ButtonPadButton.BaseRotateLeft,
    ButtonPadButton.BaseRotateRight,
    ButtonPadButton.ArmLift,
    ButtonPadButton.ArmLower,
    ButtonPadButton.ArmExtend,
    ButtonPadButton.ArmRetract,
    ButtonPadButton.WristRollLeft,
    ButtonPadButton.WristRollRight,
    ButtonPadButton.WristPitchUp,
    ButtonPadButton.WristPitchDown,
    ButtonPadButton.WristRotateIn,
    ButtonPadButton.WristRotateOut,
    ButtonPadButton.GripperOpen,
    ButtonPadButton.GripperClose,
];

const HEADER_NAMES = [
    "Basic Driving Controls",
    "Basic Arm Controls",
    "Wrist Controls",
    "Gripper Controls",
];

const BACKGROUND_COLORS: JSX.Element[] = [];
for (let i = 0; i < 4; i++) {
    BACKGROUND_COLORS.push(
        <span
            key={i}
            style={{
                gridRow: (i + 1) * 2,
                backgroundColor: `hsl(317, 79%, ${35 - 6 * i}%)`,
            }}
            className="button-grid-bkg-color"
        />,
    );
}

export const ButtonGrid = (props: CustomizableComponentProps) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [, forceResizeRender] = React.useState(0);
    const { customizing } = props.sharedState;
    const selected = isSelected(props);
    const definition = props.definition as ButtonGridDefinition;

    function getSize() {
        const rect = containerRef.current?.getBoundingClientRect();
        return {
            width: definition.width ?? rect?.width ?? 400,
            height: definition.height ?? rect?.height ?? 300,
        };
    }

    function onResize(width: number, height: number) {
        definition.width = width;
        definition.height = height;
        forceResizeRender((v) => v + 1);
    }

    function handleSelect(event: React.MouseEvent<HTMLDivElement>) {
        event.stopPropagation();
        props.sharedState.onSelect(props.definition, props.path);
    }

    const containerStyle: React.CSSProperties = definition.width
        ? { flex: `0 0 ${definition.width}px`, height: `${definition.height ?? 300}px` }
        : { flex: "1 1 0", ...(definition.height ? { height: `${definition.height}px` } : {}) };

    return (
        <div
            ref={containerRef}
            className={className("button-grid", { selected, customizing })}
            onClick={handleSelect}
            style={containerStyle}
        >
            {BACKGROUND_COLORS}
            {HEADER_NAMES.map((headerName, idx) => (
                <p key={idx} style={{ gridArea: `header${idx}` }}>
                    {headerName}
                </p>
            ))}
            {BUTTON_NAMES.map((buttonName, idx) => {
                const buttonFunction = BUTTON_FUNCTIONS[idx];
                const buttonState: ButtonState =
                    props.sharedState.buttonStateMap?.get(buttonFunction) ||
                    ButtonState.Inactive;
                const functs: ButtonFunctions =
                    buttonFunctionProvider.provideFunctions(buttonFunction);
                const clickProps = props.sharedState.customizing
                    ? {}
                    : {
                          onMouseDown: functs.onClick,
                          onMouseUp: functs.onRelease,
                          onMouseLeave: functs.onLeave,
                      };
                return (
                    <button
                        key={idx}
                        style={{ gridArea: `b${idx}` }}
                        {...clickProps}
                        className={buttonState}
                    >
                        {buttonName}
                    </button>
                );
            })}
            {customizing && selected ? (
                <ResizeHandles
                    getSize={getSize}
                    onResize={onResize}
                    onLayoutChange={props.sharedState.onLayoutChange}
                    containerRef={containerRef}
                />
            ) : undefined}
        </div>
    );
};
