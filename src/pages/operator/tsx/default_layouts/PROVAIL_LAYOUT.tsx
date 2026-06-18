import {
    ActionMode,
    ButtonPadDefinition,
    ButtonPadId,
    ComponentType,
    LayoutDefinition,
    LayoutGridDefinition,
    PanelDefinition,
    TabDefinition,
} from "../utils/component_definitions";

/**
 * Provail Layout
 */
export const PROVAIL_LAYOUT: LayoutDefinition = {
    type: ComponentType.Layout,
    displayMovementRecorder: false,
    displayTextToSpeech: false,
    displayLabels: true,
    actionMode: ActionMode.PressAndHold,
    children: [
        {
            type: ComponentType.LayoutGrid,
            children: [
                {
                    type: ComponentType.Panel,
                    children: [
                        {
                            type: ComponentType.SingleTab,
                            label: "Base",
                            children: [
                                {
                                    type: ComponentType.ButtonPad,
                                    id: ButtonPadId.Base,
                                } as ButtonPadDefinition,
                            ],
                        } as TabDefinition,
                    ],
                } as PanelDefinition,
            ],
        } as LayoutGridDefinition,
        {
            type: ComponentType.LayoutGrid,
            children: [
                {
                    type: ComponentType.Panel,
                    children: [
                        {
                            type: ComponentType.SingleTab,
                            label: "Wrist & Gripper",
                            children: [
                                {
                                    type: ComponentType.ButtonPad,
                                    id: ButtonPadId.DexWrist,
                                } as ButtonPadDefinition,
                            ],
                        } as TabDefinition,
                    ],
                } as PanelDefinition,
            ],
        } as LayoutGridDefinition,
        {
            type: ComponentType.LayoutGrid,
            children: [
                {
                    type: ComponentType.Panel,
                    children: [
                        {
                            type: ComponentType.SingleTab,
                            label: "Arm & Lift",
                            children: [
                                {
                                    type: ComponentType.ButtonPad,
                                    id: ButtonPadId.Arm,
                                } as ButtonPadDefinition,
                            ],
                        } as TabDefinition,
                    ],
                } as PanelDefinition,
            ],
        } as LayoutGridDefinition,
    ],
};
