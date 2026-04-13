import logo from "../../../assets/images/logo.png";
import "./OfflineGameLayout.css";

function normalizeOption(option, index) {
    if (typeof option === "string") {
        return {
            id: `option-${index}`,
            value: option,
            label: option,
        };
    }

    return {
        id: option?.id ?? option?.value ?? `option-${index}`,
        value: option?.value ?? option?.id ?? option?.label ?? `option-${index}`,
        label: option?.label ?? option?.text ?? option?.name ?? "Opción",
    };
}

function areOptionsEqual(first, second) {
    return String(first) === String(second);
}

function OfflineGameLayout({
                               title,
                               prompt,
                               imageSrc,
                               imageAlt,
                               options = [],
                               onSelectOption,
                               selectedOption,
                               correctOption,
                               feedback,
                               onBack,
                               actionLabel,
                               onAction,
                               isActionDisabled = false,
                               imageFit = "cover",
                           }) {
    const normalizedOptions = options.map(normalizeOption);
    const hasCheckedAnswer =
        selectedOption !== undefined &&
        selectedOption !== null &&
        correctOption !== undefined &&
        correctOption !== null;
    const hasImage = Boolean(imageSrc);

    return (
        <div className="offline-game-layout-page">
            <header className="offline-game-layout-header">
                <div className="offline-game-layout-header-left">
                    <button
                        type="button"
                        className="offline-game-layout-back-button"
                        onClick={onBack}
                    >
                        Volver
                    </button>
                </div>

                <div className="offline-game-layout-header-center">
                    <img
                        src={logo}
                        alt="Logo ORBYZ"
                        className="offline-game-layout-header-logo"
                    />
                    <h1>{title}</h1>
                </div>

                <div className="offline-game-layout-header-right" />
            </header>

            <main className="offline-game-layout-main">
                <section className="offline-game-layout-panel">
                    <div className="offline-game-layout-top">
                        <div className="offline-game-layout-prompt-block">
                            <span className="offline-game-layout-kicker">Modo offline</span>
                            <h2>{prompt}</h2>
                        </div>

                        <div className="offline-game-layout-visual-block">
                            {hasImage ? (
                                <img
                                    src={imageSrc}
                                    alt={imageAlt || "Referencia visual del desafío"}
                                    className={`offline-game-layout-image ${
                                        imageFit === "contain" ? "is-contain" : "is-cover"
                                    }`}
                                />
                            ) : (
                                <div className="offline-game-layout-image-placeholder">
                                    <span>Espacio para imagen o referencia</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="offline-game-layout-options">
                        {normalizedOptions.map((option) => {
                            const isSelected = areOptionsEqual(selectedOption, option.value);
                            const isCorrect =
                                hasCheckedAnswer && areOptionsEqual(correctOption, option.value);
                            const isIncorrect = hasCheckedAnswer && isSelected && !isCorrect;

                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    className={`offline-game-layout-option ${
                                        isSelected ? "is-selected" : ""
                                    } ${isCorrect ? "is-correct" : ""} ${
                                        isIncorrect ? "is-incorrect" : ""
                                    }`}
                                    onClick={() => onSelectOption?.(option.value, option)}
                                >
                                    <span className="offline-game-layout-option-marker">
                                        {option.label.charAt(0).toUpperCase()}
                                    </span>
                                    <span className="offline-game-layout-option-label">
                                        {option.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="offline-game-layout-footer">
                        <div
                            className={`offline-game-layout-feedback ${
                                hasCheckedAnswer
                                    ? areOptionsEqual(selectedOption, correctOption)
                                        ? "is-success"
                                        : "is-error"
                                    : "is-neutral"
                            } ${feedback ? "has-text" : ""}`}
                        >
                            {feedback || "Seleccioná una opción para continuar."}
                        </div>

                        {actionLabel ? (
                            <button
                                type="button"
                                className="offline-game-layout-action-button"
                                onClick={onAction}
                                disabled={isActionDisabled}
                            >
                                {actionLabel}
                            </button>
                        ) : null}
                    </div>
                </section>
            </main>
        </div>
    );
}

export default OfflineGameLayout;