import React from "react";
import {
    ComponentType,
    LayoutDefinition,
    LayoutGridDefinition,
    PanelDefinition,
    TabDefinition,
} from "operator/tsx/utils/component_definitions";
import { SharedState } from "../layout_components/CustomizableComponent";
import {
    ComponentList,
    ComponentListProps,
} from "../layout_components/ComponentList";
import "operator/css/LayoutArea.css";
import { DropZone } from "../layout_components/DropZone";

/** Properties for {@link LayoutArea} */
type LayoutAreaProps = {
    /** Layout structure to render */
    layout: LayoutDefinition;
    sharedState: SharedState;
};

function getPanelDefaultFlex(panel: PanelDefinition): number {
    const firstTab = panel.children[0] as TabDefinition | undefined;
    if (!firstTab || firstTab.type !== ComponentType.SingleTab) return 1;
    if (firstTab.label === "Safety") return 1;
    return Math.max(firstTab.children.length + 1, 1);
}

function getPanelFlex(panel: PanelDefinition): number {
    return panel.flexGrow ?? getPanelDefaultFlex(panel);
}

function getLayoutGridFlex(layoutGrid: LayoutGridDefinition): number {
    if (layoutGrid.children.length === 0) return 1;
    return Math.max(
        1,
        layoutGrid.children.reduce(
            (total, panel) => total + getPanelFlex(panel),
            0,
        ),
    );
}

/** Main area of the interface where the user can add, remove, or rearrange elements. */
export const LayoutArea = (props: LayoutAreaProps) => {
    // const componentListProps: ComponentListProps = {
    //     definition: props.layout,
    //     path: "",
    //     sharedState: props.sharedState
    // }
    const panelColumn = props.layout.children;
    return (
        <>
            {panelColumn.map((compDef: LayoutGridDefinition, index: number) => {
                const layoutGridFlex = getLayoutGridFlex(compDef);
                return (
                    // compDef.children.length > 0 ?
                    <React.Fragment key={"layout-grid-wrapper-" + `${index}`}>
                        <DropZone
                            path={`${index}`}
                            sharedState={props.sharedState}
                            parentDef={props.layout}
                        />
                        <div
                            className="layout-area"
                            style={{
                                flex: `${layoutGridFlex} ${layoutGridFlex} 0px`,
                            }}
                        >
                            <ComponentList
                                key={"layout-grid-" + `${index}`}
                                {...({
                                    definition: compDef,
                                    path: `${index}`,
                                    sharedState: props.sharedState,
                                } as ComponentListProps)}
                            />
                        </div>
                    </React.Fragment>
                    // :
                    // <></>
                );
            })}
            <DropZone
                path={`${props.layout.children.length}`}
                sharedState={props.sharedState}
                parentDef={props.layout}
            />
        </>
    );
};
