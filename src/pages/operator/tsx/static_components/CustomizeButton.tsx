import React from "react";
import "operator/css/CustomizeButton.css";
import CheckIcon from "@mui/icons-material/Check";
import BuildIcon from "@mui/icons-material/Build";

type CustomizeButtonProps = {
    /** If the interface is in customization mode */
    customizing: boolean;
    /** Callback for clicking the button */
    onClick: () => void;
    /** Whether to show the text label next to the icon */
    showText?: boolean;
};

/** Button to toggle customization mode. */
export const CustomizeButton = (props: CustomizeButtonProps) => {
    const icon = props.customizing ? <CheckIcon /> : <BuildIcon />;
    const text = props.customizing ? "Done" : "Customize";
    return (
        <button
            onClick={props.onClick}
            id="customize-button"
            className={
                props.customizing ? "btn-turquoise font-white" : undefined
            }
        >
            {icon}
            {props.showText !== false ? text : null}
        </button>
    );
};
// Uses icons from https://fonts.google.com/icons
