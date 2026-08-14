import React from "react";
import { buttonFunctionProvider } from "operator/tsx/index";
import { ButtonPadButton } from "../function_providers/ButtonFunctionProvider";
import "operator/css/VoiceControl.css";

type BrowserSpeechRecognition = {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onresult: ((event: any) => void) | null;
    onerror: ((event: any) => void) | null;
    onend: (() => void) | null;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

const movementCommands: ReadonlyArray<readonly [string, ButtonPadButton]> = [
    ["Forward", ButtonPadButton.BaseForward],
    ["Reverse", ButtonPadButton.BaseReverse],
    ["Rotate Left", ButtonPadButton.BaseRotateLeft],
    ["Rotate Right", ButtonPadButton.BaseRotateRight],
    ["Higher", ButtonPadButton.ArmLift],
    ["Lower", ButtonPadButton.ArmLower],
    ["Extend", ButtonPadButton.ArmExtend],
    ["Retract", ButtonPadButton.ArmRetract],
    ["Open", ButtonPadButton.GripperOpen],
    ["Close", ButtonPadButton.GripperClose],
    ["Pitch Up", ButtonPadButton.WristPitchUp],
    ["Pitch Down", ButtonPadButton.WristPitchDown],
    ["Rotate Out", ButtonPadButton.WristRotateOut],
    ["Rotate In", ButtonPadButton.WristRotateIn],
    ["Roll Left", ButtonPadButton.WristRollLeft],
    ["Roll Right", ButtonPadButton.WristRollRight],
    ["Tilt Up", ButtonPadButton.CameraTiltUp],
    ["Tilt Down", ButtonPadButton.CameraTiltDown],
    ["Pan Left", ButtonPadButton.CameraPanLeft],
    ["Pan Right", ButtonPadButton.CameraPanRight],
];

const commandMap = new Map(
    movementCommands.map(([movement, button]) => [
        normalizeCommand(movement),
        button,
    ])
);

function normalizeCommand(command: string): string {
    return command
        .toLocaleLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function speechRecognitionConstructor():
    | BrowserSpeechRecognitionConstructor
    | undefined {
    const speechWindow = window as typeof window & {
        SpeechRecognition?: BrowserSpeechRecognitionConstructor;
        webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    };
    return (
        speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
    );
}

/** Continuously listens for names from provail_keybindings.csv. */
export const VoiceControl = (props: { compact?: boolean }) => {
    const Recognition = speechRecognitionConstructor();
    const recognitionRef = React.useRef<BrowserSpeechRecognition>();
    const listeningRef = React.useRef(false);
    const restartTimerRef = React.useRef<number>();
    const [listening, setListening] = React.useState(false);
    const [status, setStatus] = React.useState(
        Recognition ? "Microphone off" : "Voice control is unavailable"
    );

    React.useEffect(() => {
        if (!Recognition) return;

        const recognition = new Recognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onresult = (event) => {
            for (
                let index = event.resultIndex;
                index < event.results.length;
                index++
            ) {
                const result = event.results[index];
                if (!result.isFinal) continue;

                const spoken = result[0].transcript.trim();
                const button = commandMap.get(normalizeCommand(spoken));
                if (!button) {
                    setStatus(`Not a command: “${spoken}”`);
                    continue;
                }

                const accepted =
                    buttonFunctionProvider.executeButtonPress(button);
                setStatus(
                    accepted
                        ? `Command: ${spoken}`
                        : `Blocked by collision or limit: ${spoken}`
                );
            }
        };

        recognition.onerror = (event) => {
            if (event.error === "no-speech" || event.error === "aborted") {
                return;
            }
            if (
                event.error === "not-allowed" ||
                event.error === "service-not-allowed"
            ) {
                listeningRef.current = false;
                setListening(false);
                setStatus("Microphone permission was denied");
                return;
            }
            setStatus(`Voice recognition error: ${event.error}`);
        };

        // Browsers periodically end continuous recognition. Restart while the
        // user still has voice control enabled.
        recognition.onend = () => {
            if (!listeningRef.current) return;
            restartTimerRef.current = window.setTimeout(() => {
                try {
                    recognition.start();
                } catch {
                    listeningRef.current = false;
                    setListening(false);
                    setStatus("Could not restart voice recognition");
                }
            }, 250);
        };

        recognitionRef.current = recognition;
        return () => {
            listeningRef.current = false;
            if (restartTimerRef.current !== undefined) {
                window.clearTimeout(restartTimerRef.current);
            }
            recognition.abort();
            recognitionRef.current = undefined;
        };
    }, [Recognition]);

    const toggleListening = () => {
        const recognition = recognitionRef.current;
        if (!recognition) return;

        if (listeningRef.current) {
            listeningRef.current = false;
            setListening(false);
            setStatus("Microphone off");
            if (restartTimerRef.current !== undefined) {
                window.clearTimeout(restartTimerRef.current);
            }
            recognition.stop();
            return;
        }

        try {
            listeningRef.current = true;
            setListening(true);
            setStatus("Listening for a movement command…");
            recognition.start();
        } catch {
            listeningRef.current = false;
            setListening(false);
            setStatus("Could not start the microphone");
        }
    };

    return (
        <div
            className={
                props.compact ? "voice-control compact" : "voice-control"
            }
        >
            <button
                type="button"
                className={listening ? "listening" : ""}
                onClick={toggleListening}
                disabled={!Recognition}
                aria-pressed={listening}
                aria-label={
                    listening
                        ? "Turn off voice control"
                        : "Turn on voice control"
                }
                title={
                    listening
                        ? "Turn off voice control"
                        : "Turn on voice control"
                }
            >
                <span className="material-icons">
                    {listening ? "mic" : "mic_off"}
                </span>
            </button>
            <span className="voice-control-status" role="status">
                {status}
            </span>
            {!props.compact && (
                <details>
                    <summary aria-label="Show voice commands">
                        <span className="material-icons">info</span>
                    </summary>
                    <div className="voice-control-command-list">
                        {movementCommands.map(([movement]) => (
                            <span key={movement}>{movement}</span>
                        ))}
                    </div>
                </details>
            )}
        </div>
    );
};
