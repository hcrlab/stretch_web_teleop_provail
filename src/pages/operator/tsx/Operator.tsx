import React from "react";
// AudioControl removed from header per UX request
import { SpeedControl, VELOCITY_SCALE } from "./static_components/SpeedControl";
import { LayoutArea } from "./static_components/LayoutArea";
import { CustomizeButton } from "./static_components/CustomizeButton";
import { LoadLayoutModal } from "./static_components/Sidebar";
import { GlobalOptionsProps, Sidebar } from "./static_components/Sidebar";
import { SharedState } from "./layout_components/CustomizableComponent";
import {
    ActionMode,
    ComponentDefinition,
    LayoutDefinition,
    ComponentType,
    CameraViewId,
    CameraViewDefinition,
} from "./utils/component_definitions";

import { className, ActionState, RemoteStream, RobotPose } from "shared/util";
import {
    buttonFunctionProvider,
    underMapFunctionProvider,
    underVideoFunctionProvider,
    homeTheRobotFunctionProvider,
    keyboardFunctionProvider,
    hasBetaTeleopKit,
    stretchTool,
} from ".";
import {
    ButtonPadButton,
    ButtonState,
    ButtonStateMap,
} from "./function_providers/ButtonFunctionProvider";
import { Dropdown } from "./basic_components/Dropdown";
import {
    DEFAULT_LAYOUTS,
    DefaultLayoutName,
    StorageHandler,
} from "./storage_handler/StorageHandler";
import { FunctionProvider } from "./function_providers/FunctionProvider";
import {
    addToLayout,
    moveInLayout,
    removeFromLayout,
} from "./utils/layout_helpers";
import { MovementRecorder } from "./layout_components/MovementRecorder";
import { Alert } from "./basic_components/Alert";
import "operator/css/Operator.css";
import { TextToSpeech } from "./layout_components/TextToSpeech";
import { HomeTheRobot } from "./layout_components/HomeTheRobot";

const KEYBOARD_SHORTCUTS: Record<string, ButtonPadButton> = {
    KeyW: ButtonPadButton.BaseForward,
    KeyS: ButtonPadButton.BaseReverse,
    KeyA: ButtonPadButton.BaseRotateLeft,
    KeyD: ButtonPadButton.BaseRotateRight,

    KeyI: ButtonPadButton.ArmLift,
    KeyK: ButtonPadButton.ArmLower,
    KeyL: ButtonPadButton.ArmExtend,
    KeyJ: ButtonPadButton.ArmRetract,

    KeyT: ButtonPadButton.GripperOpen,
    KeyG: ButtonPadButton.GripperClose,

    KeyU: ButtonPadButton.WristPitchUp,
    KeyO: ButtonPadButton.WristPitchDown,
    KeyY: ButtonPadButton.WristRotateOut,
    KeyH: ButtonPadButton.WristRotateIn,
    KeyR: ButtonPadButton.WristRollLeft,
    KeyF: ButtonPadButton.WristRollRight,

    ArrowUp: ButtonPadButton.CameraTiltUp,
    ArrowDown: ButtonPadButton.CameraTiltDown,
    ArrowLeft: ButtonPadButton.CameraPanLeft,
    ArrowRight: ButtonPadButton.CameraPanRight,
};

const NOT_HOMED_DISABLED_SHORTCUTS = new Set<ButtonPadButton>([
    ButtonPadButton.ArmLower,
    ButtonPadButton.ArmLift,
    ButtonPadButton.ArmExtend,
    ButtonPadButton.ArmRetract,
    ButtonPadButton.WristRotateIn,
    ButtonPadButton.WristRotateOut,
    ButtonPadButton.GripperOpen,
    ButtonPadButton.GripperClose,
]);

const ALT_SHORTCUT_LAYER_KEY = "Digit2";

function isShortcutTextTarget(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    if (!target) return false;

    return (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
    );
}

function isAltShortcut(
    event: KeyboardEvent,
    pressedKeys: Set<string>
): boolean {
    return (
        event.altKey &&
        pressedKeys.has(ALT_SHORTCUT_LAYER_KEY) &&
        event.code !== ALT_SHORTCUT_LAYER_KEY
    );
}

function cloneComponentDefinition<T extends ComponentDefinition>(
    definition: T
): T {
    const maybeParent = definition as T & { children?: ComponentDefinition[] };
    const clone = {
        ...definition,
        children: maybeParent.children?.map((child) =>
            cloneComponentDefinition(child)
        ),
    };

    return clone as T;
}

function shouldIgnoreShortcut(
    event: KeyboardEvent,
    pressedKeys: Set<string>
): boolean {
    if (event.repeat || event.ctrlKey || event.metaKey) {
        return true;
    }

    if (isShortcutTextTarget(event)) {
        return true;
    }

    if (event.altKey && !isAltShortcut(event, pressedKeys)) {
        // Allow Alt+Shift combos to bypass the Alt-layer requirement so
        // Shift+Alt+<key> shortcuts work without holding the Digit2 layer key.
        if (!event.shiftKey) return true;
    }

    return false;
}

/** Operator interface webpage */
export const Operator = (props: {
    remoteStreams: Map<string, RemoteStream>;
    layout: LayoutDefinition;
    storageHandler: StorageHandler;
}) => {
    const [customizing, setCustomizing] = React.useState(false);
    const [selectedPath, setSelectedPath] = React.useState<string | undefined>(
        undefined
    );
    const [selectedDefinition, setSelectedDef] = React.useState<
        ComponentDefinition | undefined
    >(undefined);
    const [velocityScale, setVelocityScale] = React.useState<number>(
        FunctionProvider.velocityScale
    );
    // Keep a ref in sync so event handlers (which capture closures) can
    // always read the latest velocity scale without needing to re-register
    // the DOM event listeners on every change.
    const velocityScaleRef = React.useRef<number>(
        FunctionProvider.velocityScale
    );
    React.useEffect(() => {
        velocityScaleRef.current = velocityScale;
    }, [velocityScale]);
    // No separate base velocity scale — base uses shared velocityScale.
    const [buttonCollision, setButtonCollision] = React.useState<
        ButtonPadButton[]
    >([]);
    const [moveBaseState, setMoveBaseState] = React.useState<ActionState>();
    const [moveToPregraspState, setMoveToPregraspState] =
        React.useState<ActionState>();
    const [showTabletState, setShowTabletState] = React.useState<
        ActionState | undefined
    >(undefined);
    const [robotNotHomed, setRobotNotHomed] = React.useState<boolean>(false);
    function showHomeTheRobotGlobalControl(isHomed: boolean) {
        setRobotNotHomed(!isHomed);
    }
    homeTheRobotFunctionProvider.setIsHomedCallback(
        showHomeTheRobotGlobalControl
    );

    const [showLoadLayoutModal, setShowLoadLayoutModal] =
        React.useState<boolean>(false);

    // State to control the header layout dropdown open state so keyboard can open it
    const [layoutDropdownOpen, setLayoutDropdownOpen] =
        React.useState<boolean>(false);

    // Helper to programmatically select the header layout index
    function handleLayoutSelectIndex(idx: number) {
        const defaultNames = props.storageHandler.getDefaultLayoutNames();
        const customNames = props.storageHandler.getCustomLayoutNames();
        if (idx < defaultNames.length) {
            globalOptionsProps.loadLayout(defaultNames[idx], true);
            return;
        }

        // custom
        globalOptionsProps.loadLayout(
            customNames[idx - defaultNames.length],
            false
        );
    }

    React.useEffect(() => {
        if (customizing) return;

        const pressedKeys = new Set<string>();
        const shortcutListenerOptions = { capture: true };

        function handleKeyDown(event: KeyboardEvent) {
            pressedKeys.add(event.code);

            // If the user presses the Alt-layer key (Digit2) by itself, swallow
            // it so it acts as a temporary layer toggle. However, if Shift is
            // also held (e.g., Alt+Shift+Digit2 used as a speed preset), allow
            // the event to pass through so the Digit2 handling can run.
            if (
                event.altKey &&
                event.code === ALT_SHORTCUT_LAYER_KEY &&
                !isShortcutTextTarget(event)
            ) {
                if (!event.shiftKey) {
                    event.preventDefault();
                    return;
                }
                // else: allow Alt+Shift+Digit2 to be handled by the general
                // shortcut handlers (this enables Alt+Shift+Digit2 preset).
            }

            if (shouldIgnoreShortcut(event, pressedKeys)) return;

            // First, handle robot-control keys (button pad shortcuts).
            // Require Shift+Alt to activate these so they don't trigger
            // accidentally while typing or using other UI keys.
            const button = KEYBOARD_SHORTCUTS[event.code];
            if (button) {
                if (!(event.shiftKey && event.altKey)) return;

                if (robotNotHomed && NOT_HOMED_DISABLED_SHORTCUTS.has(button)) {
                    return;
                }

                event.preventDefault();
                keyboardFunctionProvider.provideKeyboardShortcut(button)();
                return;
            }

            // Fallback: on some keyboard layouts the physical number keys with
            // modifiers may produce different `code` values but `key` will be
            // the visible character (e.g. '1','2'). Support Alt+Shift+'1'..'5'
            // via event.key so Alt+Shift+2 works regardless of layout.
            if (event.altKey && event.shiftKey) {
                const keyDigitMatch = /^[1-5]$/.exec(event.key);
                if (keyDigitMatch) {
                    event.preventDefault();
                    const idx = parseInt(keyDigitMatch[0], 10) - 1;
                    if (idx >= 0 && idx < VELOCITY_SCALE.length) {
                        const newScale = VELOCITY_SCALE[idx].scale;
                        setVelocityScale(newScale);
                        velocityScaleRef.current = newScale;
                        FunctionProvider.velocityScale = newScale;
                    }
                    return;
                }
            }

            // Next, handle UI/global shortcuts (non-robot interactions)
            // All of these map keyboard keys to the same handlers used by the UI
            switch (event.code) {
                // Toggle customization mode
                case "KeyC":
                    event.preventDefault();
                    handleToggleCustomize();
                    break;

                // Cycle action mode: Q = previous, E = next
                case "KeyQ": {
                    event.preventDefault();
                    const modes = Object.values(ActionMode);
                    const idx = modes.indexOf(layout.current.actionMode);
                    const prev = modes[(idx - 1 + modes.length) % modes.length];
                    setActionMode(prev);
                    break;
                }
                case "KeyE": {
                    event.preventDefault();
                    const modes = Object.values(ActionMode);
                    const idx = modes.indexOf(layout.current.actionMode);
                    const next = modes[(idx + 1) % modes.length];
                    setActionMode(next);
                    break;
                }

                // Adjust velocity scale: Minus = decrease, Equal (=) = increase
                case "Minus": {
                    event.preventDefault();
                    const step = 0.1;
                    const newScale = Math.max(
                        0.1,
                        Math.round((velocityScale - step) * 10) / 10
                    );
                    setVelocityScale(newScale);
                    velocityScaleRef.current = newScale;
                    FunctionProvider.velocityScale = newScale;
                    break;
                }
                case "Equal": {
                    event.preventDefault();
                    const step = 0.1;
                    const newScale = Math.min(
                        1.0,
                        Math.round((velocityScale + step) * 10) / 10
                    );
                    setVelocityScale(newScale);
                    velocityScaleRef.current = newScale;
                    FunctionProvider.velocityScale = newScale;
                    break;
                }

                // Quick set velocity presets: Alt+Shift+Digit1..5 map to the five presets
                case "Digit1":
                case "Digit2":
                case "Digit3":
                case "Digit4":
                case "Digit5": {
                    if (!(event.altKey && event.shiftKey)) break;
                    event.preventDefault();
                    const idx = parseInt(event.code.replace("Digit", "")) - 1;
                    if (idx >= 0 && idx < VELOCITY_SCALE.length) {
                        const newScale = VELOCITY_SCALE[idx].scale;
                        setVelocityScale(newScale);
                        velocityScaleRef.current = newScale;
                        FunctionProvider.velocityScale = newScale;
                    }
                    break;
                }

                // Step velocity while in menu: Alt+Shift+Comma => prev, Alt+Shift+Period => next
                case "Comma": {
                    if (!(event.altKey && event.shiftKey)) break;
                    event.preventDefault();
                    {
                        // Find the nearest preset index to the current velocityScale
                        let idx = 0;
                        let bestDiff = Infinity;
                        for (let i = 0; i < VELOCITY_SCALE.length; i++) {
                            const diff = Math.abs(
                                VELOCITY_SCALE[i].scale -
                                    velocityScaleRef.current
                            );
                            if (diff < bestDiff) {
                                bestDiff = diff;
                                idx = i;
                            }
                        }

                        const prev =
                            (idx - 1 + VELOCITY_SCALE.length) %
                            VELOCITY_SCALE.length;
                        const newScale = VELOCITY_SCALE[prev].scale;
                        setVelocityScale(newScale);
                        velocityScaleRef.current = newScale;
                        FunctionProvider.velocityScale = newScale;
                    }
                    break;
                }
                case "Period": {
                    if (!(event.altKey && event.shiftKey)) break;
                    event.preventDefault();
                    {
                        // Find the nearest preset index to the current velocityScale
                        let idx = 0;
                        let bestDiff = Infinity;
                        for (let i = 0; i < VELOCITY_SCALE.length; i++) {
                            const diff = Math.abs(
                                VELOCITY_SCALE[i].scale -
                                    velocityScaleRef.current
                            );
                            if (diff < bestDiff) {
                                bestDiff = diff;
                                idx = i;
                            }
                        }

                        const next = (idx + 1) % VELOCITY_SCALE.length;
                        const newScale = VELOCITY_SCALE[next].scale;
                        setVelocityScale(newScale);
                        FunctionProvider.velocityScale = newScale;
                    }
                    break;
                }

                // Layout dropdown keyboard: Alt+Shift+L opens the layout dropdown
                case "KeyL": {
                    if (!(event.altKey && event.shiftKey)) break;
                    event.preventDefault();
                    setLayoutDropdownOpen(true);
                    break;
                }

                // When layout dropdown is open, Alt+Shift+Digit7/8/9 select option 1/2/3 (camera, default1, default2)
                case "Digit7":
                case "Digit8":
                case "Digit9": {
                    if (!(event.altKey && event.shiftKey)) break;
                    if (!layoutDropdownOpen) break;
                    event.preventDefault();
                    const mapToIdx = (code: string) => {
                        // map Digit7->0, Digit8->1, Digit9->2
                        return parseInt(code.replace("Digit", "")) - 7;
                    };
                    const selected = mapToIdx(event.code);
                    if (selected < 0) break;
                    handleLayoutSelectIndex(selected);
                    setLayoutDropdownOpen(false);
                    break;
                }

                // Toggle movement recorder (P)
                case "KeyP":
                    event.preventDefault();
                    setDisplayMovementRecorder(
                        !layout.current.displayMovementRecorder
                    );
                    break;

                // Toggle text-to-speech (Z)
                case "KeyZ":
                    event.preventDefault();
                    setDisplayTextToSpeech(!layout.current.displayTextToSpeech);
                    break;

                // Toggle labels (B)
                case "KeyB":
                    event.preventDefault();
                    setDisplayLabels(!layout.current.displayLabels);
                    break;

                default:
                    // Unhandled key
                    break;
            }
        }

        function handleKeyUp(event: KeyboardEvent) {
            pressedKeys.delete(event.code);
        }

        function handleBlur() {
            pressedKeys.clear();
        }

        window.addEventListener(
            "keydown",
            handleKeyDown,
            shortcutListenerOptions
        );
        window.addEventListener("keyup", handleKeyUp, shortcutListenerOptions);
        window.addEventListener("blur", handleBlur);
        return () => {
            window.removeEventListener(
                "keydown",
                handleKeyDown,
                shortcutListenerOptions
            );
            window.removeEventListener(
                "keyup",
                handleKeyUp,
                shortcutListenerOptions
            );
            window.removeEventListener("blur", handleBlur);
        };
    }, [customizing, robotNotHomed]);

    const layout = React.useRef<LayoutDefinition>(props.layout);

    // Just used as a flag to force the operator to rerender when the button state map
    // has been updated
    const [buttonStateMapRerender, setButtonStateMapRerender] =
        React.useState<boolean>(false);
    const buttonStateMap = React.useRef<ButtonStateMap>();
    function operatorCallback(bsm: ButtonStateMap) {
        let collisionButtons: ButtonPadButton[] = [];
        bsm.forEach((state, button) => {
            if (state == ButtonState.Collision) collisionButtons.push(button);
        });
        setButtonCollision(collisionButtons);
        buttonStateMap.current = bsm;
        setButtonStateMapRerender(!buttonStateMapRerender);
    }
    buttonFunctionProvider.setOperatorCallback(operatorCallback);

    // Just used as a flag to force the operator to rerender when the tablet orientation
    // changes.
    const [tabletOrientationRerender, setTabletOrientationRerender] =
        React.useState<boolean>(false);
    underVideoFunctionProvider.setTabletOrientationOperatorCallback((_) => {
        setTabletOrientationRerender(!tabletOrientationRerender);
    });

    // Callback for when the move base state is updated (e.g., the ROS2 action returns)
    // Used to render alerts to the operator.
    function moveBaseStateCallback(state: ActionState) {
        setMoveBaseState(state);
    }
    underMapFunctionProvider.setOperatorCallback(moveBaseStateCallback);
    let moveBaseAlertTimeout: NodeJS.Timeout;
    React.useEffect(() => {
        if (moveBaseState && moveBaseState.alert_type != "info") {
            if (moveBaseAlertTimeout) clearTimeout(moveBaseAlertTimeout);
            moveBaseAlertTimeout = setTimeout(() => {
                setMoveBaseState(undefined);
            }, 5000);
        }
    }, [moveBaseState]);

    // Callback for when the move to pregrasp state is updated (e.g., the ROS2 action returns)
    // Used to render alerts to the operator.
    function moveToPregraspStateCallback(state: ActionState) {
        setMoveToPregraspState(state);
    }
    underVideoFunctionProvider.setMoveToPregraspOperatorCallback(
        moveToPregraspStateCallback
    );
    let moveToPregraspAlertTimeout: NodeJS.Timeout;
    React.useEffect(() => {
        if (moveToPregraspState && moveToPregraspState.alert_type != "info") {
            if (moveToPregraspAlertTimeout)
                clearTimeout(moveToPregraspAlertTimeout);
            moveToPregraspAlertTimeout = setTimeout(() => {
                setMoveToPregraspState(undefined);
            }, 5000);
        }
    }, [moveToPregraspState]);

    // Callback for when the show tablet state is updated (e.g., the ROS2 action returns)
    // Used to render alerts to the operator.
    function showTabletStateCallback(state: ActionState) {
        setShowTabletState(state);
    }
    underVideoFunctionProvider.setShowTabletOperatorCallback(
        showTabletStateCallback
    );
    let showTabletAlertTimeout: NodeJS.Timeout;
    React.useEffect(() => {
        if (showTabletState && showTabletState.alert_type != "info") {
            if (showTabletAlertTimeout) clearTimeout(showTabletAlertTimeout);
            showTabletAlertTimeout = setTimeout(() => {
                setShowTabletState(undefined);
            }, 5000);
        }
    }, [showTabletState]);

    let remoteStreams = props.remoteStreams;

    /** Rerenders the operator */
    function updateLayout() {
        console.log("update layout");
        setButtonStateMapRerender(!buttonStateMapRerender);
        setTabletOrientationRerender(!tabletOrientationRerender);
    }

    /**
     * Updates the action mode in the layout (visually) and in the function
     * provider (functionally).
     */
    function setActionMode(actionMode: ActionMode) {
        layout.current.actionMode = actionMode;
        FunctionProvider.actionMode = actionMode;
        props.storageHandler.saveCurrentLayout(layout.current);
        updateLayout();
    }

    /**
     * Sets the movement recorder component to display or hidden.
     *
     * @param displayMovementRecorder if the movement recorder component at the
     *                             top of the operator body should be displayed
     */
    function setDisplayMovementRecorder(displayMovementRecorder: boolean) {
        layout.current.displayMovementRecorder = displayMovementRecorder;
        updateLayout();
    }

    /**
     * Sets the text-to-speech component to display or hidden.
     *
     * @param displayTextToSpeech whether the text-to-speech component should
     *    be displayed.
     */
    function setDisplayTextToSpeech(displayTextToSpeech: boolean) {
        layout.current.displayTextToSpeech = displayTextToSpeech;
        updateLayout();
    }

    /**
     * Sets the display labels property to display or hidden.
     *
     * @param displayLabels if the button text labels should be displayed
     */
    function setDisplayLabels(displayLabels: boolean) {
        layout.current.displayLabels = displayLabels;
        updateLayout();
    }

    /**
     * Callback when the user clicks on a drop zone, moves the active component
     * into the drop zone
     * @param path path to the clicked drop zone
     */
    function handleDrop(path: string) {
        console.log("handleDrop", path);
        if (!selectedDefinition)
            throw Error("Active definition undefined on drop event");
        let newPath: string = path;
        if (!selectedPath) {
            // New element from the sidebar. Clone it so repeated adds do not
            // share the same mutable definition object.
            const definitionToAdd =
                cloneComponentDefinition(selectedDefinition);
            addToLayout(definitionToAdd, path, layout.current);
            setSelectedDef(undefined);
            setSelectedPath(undefined);
        } else {
            newPath = moveInLayout(selectedPath, path, layout.current);
            setSelectedPath(newPath);
        }
        console.log("new active path", newPath);
        updateLayout();
    }

    /**
     * Callback when a component is selected during customization
     * @param path path to the selected component
     * @param def definition of the selected component
     */
    function handleSelect(def: ComponentDefinition, path?: string) {
        console.log("selected", path);
        if (!customizing) return;

        // If reselected the same component at the same path, or the same component
        // without a path from the sidebar, then unactivate it
        const pathsMatch = selectedPath && selectedPath == path;
        const defsMatch =
            !selectedPath &&
            def.type === selectedDefinition?.type &&
            def.id === selectedDefinition?.id;
        if (pathsMatch || defsMatch) {
            setSelectedDef(undefined);
            setSelectedPath(undefined);
            return;
        }

        // Activate the selected component
        setSelectedDef(def);
        setSelectedPath(path);
    }

    /** Callback when the delete button in the sidebar is clicked */
    function handleDelete() {
        if (!selectedPath)
            throw Error("handleDelete called when selectedPath is undefined");
        removeFromLayout(selectedPath, layout.current);
        updateLayout();
        setSelectedPath(undefined);
        setSelectedDef(undefined);
    }

    /**
     * Callback when the customization button is clicked.
     */
    const handleToggleCustomize = () => {
        if (customizing) {
            console.log("saving layout");
            props.storageHandler.saveCurrentLayout(layout.current);
        }
        setCustomizing(!customizing);
        setSelectedDef(undefined);
        setSelectedPath(undefined);
    };

    /** Un-select current component when click inside of header */
    function handleClickHeader() {
        setSelectedDef(undefined);
        setSelectedPath(undefined);
    }

    /** State passed from the operator and shared by all components */
    const sharedState: SharedState = {
        customizing: customizing,
        onSelect: handleSelect,
        remoteStreams: remoteStreams,
        selectedPath: selectedPath,
        dropZoneState: {
            onDrop: handleDrop,
            selectedDefinition: selectedDefinition,
        },
        buttonStateMap: buttonStateMap.current,
        hideLabels: !layout.current.displayLabels,
        hasBetaTeleopKit: hasBetaTeleopKit,
        stretchTool: stretchTool,
        robotNotHomed: robotNotHomed,
        onLayoutChange: (newLayout?: LayoutDefinition) => {
            if (!newLayout) return;
            layout.current = newLayout;
            props.storageHandler.saveCurrentLayout(layout.current);
            updateLayout();
        },
    };

    /** Properties for the global options area of the sidebar */
    const globalOptionsProps: GlobalOptionsProps = {
        displayMovementRecorder: layout.current.displayMovementRecorder,
        displayTextToSpeech: layout.current.displayTextToSpeech,
        displayLabels: layout.current.displayLabels,
        setDisplayMovementRecorder: setDisplayMovementRecorder,
        setDisplayTextToSpeech: setDisplayTextToSpeech,
        setDisplayLabels: setDisplayLabels,
        defaultLayouts: Object.keys(DEFAULT_LAYOUTS),
        customLayouts: props.storageHandler.getCustomLayoutNames(),
        loadLayout: (layoutName: string, dflt: boolean) => {
            layout.current = dflt
                ? props.storageHandler.loadDefaultLayout(
                      layoutName as DefaultLayoutName
                  )
                : props.storageHandler.loadCustomLayout(layoutName);
            updateLayout();
        },
        saveLayout: (layoutName: string) => {
            if (props.storageHandler.getDefaultLayoutNames().includes(layoutName)) {
                console.error(`Cannot overwrite default layout "${layoutName}". ` +
                    `Please choose a different name.`);
                return;
            }
            props.storageHandler.saveCustomLayout(layout.current, layoutName);
        },
    };

    const actionModes = Object.values(ActionMode);

    return (
        <div id="operator">
            <div id="operator-header" onClick={handleClickHeader}>
                {/* Action mode button */}
                <Dropdown
                    onChange={(idx) => setActionMode(actionModes[idx])}
                    selectedIndex={actionModes.indexOf(
                        layout.current.actionMode
                    )}
                    possibleOptions={actionModes}
                    showActive
                    placement="bottom"
                />
                <SpeedControl
                    scale={velocityScale}
                    onChange={(newScale: number) => {
                        setVelocityScale(newScale);
                        FunctionProvider.velocityScale = newScale;
                    }}
                />
                {/* Base uses the same SpeedControl as arm/wrist/gripper */}
                {/* Load layout dropdown (shows current layout name when matched) */}
                {(() => {
                    const defaultNames =
                        props.storageHandler.getDefaultLayoutNames();
                    const customNames =
                        props.storageHandler.getCustomLayoutNames();
                    const combinedNames = defaultNames.concat(customNames);

                    // Try to find a matching name for the currently loaded layout by
                    // comparing serialized definitions. If no match, leave undefined so
                    // the dropdown shows a placeholder.
                    let matchedIndex: number | undefined = undefined;
                    try {
                        const currentJson = JSON.stringify(layout.current);

                        // Check defaults
                        for (let i = 0; i < defaultNames.length; i++) {
                            const def =
                                props.storageHandler.loadDefaultLayout(
                                    defaultNames[i] as any
                                );
                            if (JSON.stringify(def) === currentJson) {
                                matchedIndex = i;
                                break;
                            }
                        }

                        // Check customs
                        if (matchedIndex === undefined) {
                            for (let i = 0; i < customNames.length; i++) {
                                const def =
                                    props.storageHandler.loadCustomLayout(
                                        customNames[i]
                                    );
                                if (JSON.stringify(def) === currentJson) {
                                    matchedIndex = defaultNames.length + i;
                                    break;
                                }
                            }
                        }
                    } catch (e) {
                        // If loading custom layouts throws for some reason, ignore and
                        // fall back to placeholder behavior.
                        matchedIndex = undefined;
                    }

                    return (
                        <Dropdown
                            onChange={(idx) => handleLayoutSelectIndex(idx)}
                            selectedIndex={matchedIndex}
                            possibleOptions={combinedNames}
                            placeholderText={
                                matchedIndex === undefined
                                    ? "Current Layout"
                                    : undefined
                            }
                            showActive
                            placement="bottom"
                            open={layoutDropdownOpen}
                            onOpenChange={setLayoutDropdownOpen}
                        />
                    );
                })()}
                <CustomizeButton
                    customizing={customizing}
                    onClick={handleToggleCustomize}
                    showText={false}
                />
            </div>
            <LoadLayoutModal
                defaultLayouts={Object.keys(DEFAULT_LAYOUTS)}
                customLayouts={props.storageHandler.getCustomLayoutNames()}
                loadLayout={(name: string, dflt: boolean) =>
                    globalOptionsProps.loadLayout(name, dflt)
                }
                setShow={setShowLoadLayoutModal}
                show={showLoadLayoutModal}
            />
            {robotNotHomed && (
                <div className="operator-collision-alerts">
                    <div
                        className={className("operator-alert", {
                            fadeIn: robotNotHomed,
                            fadeOut: !robotNotHomed,
                        })}
                    >
                        <HomeTheRobot
                            hideLabels={!layout.current.displayLabels}
                        />
                    </div>
                </div>
            )}
            {
                <div className="operator-collision-alerts">
                    <div
                        className={className("operator-alert", {
                            fadeIn: buttonCollision.length > 0,
                            fadeOut: buttonCollision.length == 0,
                        })}
                    >
                        <Alert type="warning">
                            <span>
                                {buttonCollision.length > 0
                                    ? buttonCollision.join(", ") +
                                      " in collision!"
                                    : ""}
                            </span>
                        </Alert>
                    </div>
                </div>
            }
            {moveBaseState && (
                <div className="operator-collision-alerts">
                    <div
                        className={className("operator-alert", {
                            fadeIn: moveBaseState !== undefined,
                            fadeOut: moveBaseState == undefined,
                        })}
                    >
                        <Alert
                            type={moveBaseState.alert_type}
                            message={moveBaseState.state}
                        />
                    </div>
                </div>
            )}
            {moveToPregraspState && (
                <div className="operator-collision-alerts">
                    <div
                        className={className("operator-alert", {
                            fadeIn: moveToPregraspState !== undefined,
                            fadeOut: moveToPregraspState == undefined,
                        })}
                    >
                        <Alert
                            type={moveToPregraspState.alert_type}
                            message={moveToPregraspState.state}
                        />
                    </div>
                </div>
            )}
            {showTabletState && (
                <div className="operator-collision-alerts">
                    <div
                        className={className("operator-alert", {
                            fadeIn: showTabletState !== undefined,
                            fadeOut: showTabletState == undefined,
                        })}
                    >
                        <Alert
                            type={showTabletState.alert_type}
                            message={showTabletState.state}
                        />
                    </div>
                </div>
            )}
            <div id="operator-global-controls">
                <div
                    className={className("operator-pose-recorder", {
                        hideLabels: !layout.current.displayLabels,
                    })}
                    hidden={!layout.current.displayMovementRecorder}
                >
                    <MovementRecorder
                        hideLabels={!layout.current.displayLabels}
                    />
                </div>
                <div
                    className={className("operator-text-to-speech", {
                        hideLabels: !layout.current.displayLabels,
                    })}
                    hidden={!layout.current.displayTextToSpeech}
                >
                    <TextToSpeech hideLabels={!layout.current.displayLabels} />
                </div>
            </div>
            <div id="operator-body">
                <LayoutArea layout={layout.current} sharedState={sharedState} />
            </div>
            <Sidebar
                hidden={!customizing}
                onDelete={handleDelete}
                updateLayout={updateLayout}
                onSelect={handleSelect}
                selectedDefinition={selectedDefinition}
                selectedPath={selectedPath}
                globalOptionsProps={globalOptionsProps}
            />
        </div>
    );
};
