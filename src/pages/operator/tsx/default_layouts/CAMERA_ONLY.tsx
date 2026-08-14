import {
    ActionMode,
    ComponentType,
    CameraViewId,
    LayoutDefinition,
} from "../utils/component_definitions";

export const CAMERA_ONLY: LayoutDefinition = {
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
                            label: "Camera",
                            children: [
                                {
                                    type: ComponentType.CameraView,
                                    id: CameraViewId.realsense,
                                    displayButtons: true,
                                    children: [],
                                } as any,
                            ],
                        },
                    ],
                },
            ],
        },
    ],
};