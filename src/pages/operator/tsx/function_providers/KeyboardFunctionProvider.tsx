import {
    ButtonFunctionProvider,
    ButtonPadButton,
} from "./ButtonFunctionProvider";
import { JOINT_VELOCITIES } from "shared/util";
import { FunctionProvider } from "./FunctionProvider";

/** Maps WASD keys to the base driving button pad buttons */
const BASE_DRIVE_KEY_MAP: Record<string, ButtonPadButton> = {
    w: ButtonPadButton.BaseForward,
    s: ButtonPadButton.BaseReverse,
    a: ButtonPadButton.BaseRotateLeft,
    d: ButtonPadButton.BaseRotateRight,
};

/** How often (ms) to repeat the step while a key is held down */
const REPEAT_INTERVAL_MS = 150;

export class KeyboardFunctionProvider extends ButtonFunctionProvider {
    private keysPressed = new Set<string>();
    private repeatIntervalId?: ReturnType<typeof setInterval>;

    constructor() {
        super();
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
    }

    /**
     * Returns a function which executes a single step-action for the given
     * button, regardless of the current global action mode.
     */
    public provideKeyboardShortcut(button: ButtonPadButton): () => void {
        return () => this.pressButtonOnce(button);
    }

    public startKeyboardShortcut(button: ButtonPadButton): void {
        switch (button) {
            case ButtonPadButton.BaseForward:
                this.continuousBaseDrive(
                    JOINT_VELOCITIES.translate_mobile_base *
                        FunctionProvider.velocityScale,
                    0
                );
                break;
            case ButtonPadButton.BaseReverse:
                this.continuousBaseDrive(
                    -JOINT_VELOCITIES.translate_mobile_base *
                        FunctionProvider.velocityScale,
                    0
                );
                break;
            case ButtonPadButton.BaseRotateLeft:
                this.continuousBaseDrive(
                    0,
                    JOINT_VELOCITIES.rotate_mobile_base *
                        FunctionProvider.velocityScale
                );
                break;
            case ButtonPadButton.BaseRotateRight:
                this.continuousBaseDrive(
                    0,
                    -JOINT_VELOCITIES.rotate_mobile_base *
                        FunctionProvider.velocityScale
                );
                break;
            default:
                this.pressButtonOnce(button);
        }
    }

    public stopKeyboardShortcut(button: ButtonPadButton): void {
        switch (button) {
            case ButtonPadButton.BaseForward:
            case ButtonPadButton.BaseReverse:
            case ButtonPadButton.BaseRotateLeft:
            case ButtonPadButton.BaseRotateRight:
                this.stopCurrentAction(true);
                break;
        }
    }
    /** Starts listening for WASD keys to drive the base. */
    public enableBaseDrivingShortcuts() {
        window.addEventListener("keydown", this.handleKeyDown);
        window.addEventListener("keyup", this.handleKeyUp);
    }

    /** Stops listening for WASD keys and clears any held-key state. */
    public disableBaseDrivingShortcuts() {
        window.removeEventListener("keydown", this.handleKeyDown);
        window.removeEventListener("keyup", this.handleKeyUp);
        this.keysPressed.clear();
        if (this.repeatIntervalId) {
            clearInterval(this.repeatIntervalId);
            this.repeatIntervalId = undefined;
        }
    }

    /** Don't hijack WASD if the user is typing in a text field/modal. */
    private isTypingTarget(target: EventTarget | null): boolean {
        if (!(target instanceof HTMLElement)) return false;
        return (
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable
        );
    }

    private handleKeyDown(event: KeyboardEvent) {
        if (this.isTypingTarget(event.target)) return;

        // Only start driving shortcuts when both Shift and Alt are held.
        // This avoids accidental activation while typing or using other UI keys.
        if (!(event.shiftKey && event.altKey)) return;

        const key = event.key.toLowerCase();
        const button = BASE_DRIVE_KEY_MAP[key];
        if (!button) return;

        // Prevent default browser behavior for these shortcuts when active
        event.preventDefault();

        if (this.keysPressed.has(key)) return; // ignore OS auto-repeat
        this.keysPressed.add(key);

        // Fire immediately, then keep stepping while held
        this.pressButtonOnce(button);

        if (!this.repeatIntervalId) {
            this.repeatIntervalId = setInterval(() => {
                this.keysPressed.forEach((k) => {
                    this.pressButtonOnce(BASE_DRIVE_KEY_MAP[k]);
                });
            }, REPEAT_INTERVAL_MS);
        }
    }

    private handleKeyUp(event: KeyboardEvent) {
        const key = event.key.toLowerCase();
        if (!BASE_DRIVE_KEY_MAP[key]) return;

        // Always clear held-key state on keyup for the mapped keys so we don't
        // leave sticky state if modifiers change while keys are held.
        this.keysPressed.delete(key);

        if (this.keysPressed.size === 0 && this.repeatIntervalId) {
            clearInterval(this.repeatIntervalId);
            this.repeatIntervalId = undefined;
        }
    }
}
