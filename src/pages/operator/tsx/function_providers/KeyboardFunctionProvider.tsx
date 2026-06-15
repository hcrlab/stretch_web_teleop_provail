import {
    ButtonFunctionProvider,
    ButtonPadButton,
} from "./ButtonFunctionProvider";

export class KeyboardFunctionProvider extends ButtonFunctionProvider {
    public provideKeyboardShortcut(button: ButtonPadButton): () => void {
        return () => this.pressButtonOnce(button);
    }
}