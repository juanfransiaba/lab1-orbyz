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
        label: option?.label ?? option?.text ?? option?.name ?? "Opcion",
    };
}

function areOptionsEqual(first, second) {
    return String(first) === String(second);
}

function OfflineGameLayout({
    title,
    prompt,
    promptLabel = "",
    isResultScreen = false,
    resultVariant = "neutral",
    resultSubtitle = "",
    resultStats = [],
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
    progressText = "",
    lives = 3,
    maxLives = 3,
    hideOptions = false,
    feedbackTone,
}) {
    const normalizedOptions = options.map(normalizeOption);
    const hasCheckedAnswer =
        selectedOption !== undefined &&
        selectedOption !== null &&
        correctOption !== undefined &&
        correctOption !== null;
    const hasImage = Boolean(imageSrc);

    const resolvedFeedbackTone =
        feedbackTone ||
        (hasCheckedAnswer
            ? areOptionsEqual(selectedOption, correctOption)
                ? "success"
                : "error"
            : "neutral");

    return (
        <div className="offline-game-layout-page">
            <header className="offline-game-layout-header">
                <div className="offline-game-layout-header-glow" />

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
                    <div className="offline-game-layout-header-title">
                        <span className="offline-game-layout-title-kicker">
                            Geography Game System
                        </span>
                        <h1>{title}</h1>
                    </div>

                    {progressText ? (
                        <span className="offline-game-layout-progress">
                            {progressText}
                        </span>
                    ) : null}
                </div>

                <div className="offline-game-layout-header-right">
                    <div
                        className="offline-game-layout-lives"
                        aria-label={`Vidas restantes: ${lives} de ${maxLives}`}
                    >
                        {Array.from({ length: maxLives }, (_, index) => {
                            const isActive = index < lives;

                            return (
                                <span
                                    key={`life-${index}`}
                                    className={`offline-game-layout-heart ${
                                        isActive ? "is-active" : "is-lost"
                                    }`}
                                    aria-hidden="true"
                                >
                                    ♥
                                </span>
                            );
                        })}
                    </div>
                </div>
            </header>

            <main className="offline-game-layout-main">
                <section
                    className={`offline-game-layout-panel ${
                        isResultScreen ? "is-result-screen" : ""
                    }`}
                >
                    {isResultScreen ? (
                        <>
                            <div
                                className={`offline-game-layout-result-hero is-${resultVariant}`}
                            >
                                {promptLabel ? (
                                    <span className="offline-game-layout-kicker">
                                        {promptLabel}
                                    </span>
                                ) : null}
                                <h2>{prompt}</h2>
                                {resultSubtitle ? (
                                    <p className="offline-game-layout-result-subtitle">
                                        {resultSubtitle}
                                    </p>
                                ) : null}
                            </div>

                            {resultStats.length ? (
                                <div className="offline-game-layout-result-stats">
                                    {resultStats.map((stat) => (
                                        <article
                                            key={stat.label}
                                            className="offline-game-layout-result-stat"
                                        >
                                            <span className="offline-game-layout-result-stat-label">
                                                {stat.label}
                                            </span>
                                            <strong className="offline-game-layout-result-stat-value">
                                                {stat.value}
                                            </strong>
                                        </article>
                                    ))}
                                </div>
                            ) : null}
                        </>
                    ) : (
                        <div className="offline-game-layout-top">
                            <div className="offline-game-layout-prompt-block">
                                {promptLabel ? (
                                    <span className="offline-game-layout-kicker">
                                        {promptLabel}
                                    </span>
                                ) : null}
                                <h2>{prompt}</h2>
                            </div>

                            <div className="offline-game-layout-visual-block">
                                {hasImage ? (
                                    <img
                                        src={imageSrc}
                                        alt={imageAlt || "Referencia visual del desafio"}
                                        className={`offline-game-layout-image ${
                                            imageFit === "contain"
                                                ? "is-contain"
                                                : "is-cover"
                                        }`}
                                    />
                                ) : (
                                    <div className="offline-game-layout-image-placeholder">
                                        <span>Espacio para imagen o referencia</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {!hideOptions && !isResultScreen ? (
                        <div className="offline-game-layout-options">
                            {normalizedOptions.map((option) => {
                                const isSelected = areOptionsEqual(
                                    selectedOption,
                                    option.value
                                );
                                const isCorrect =
                                    hasCheckedAnswer &&
                                    areOptionsEqual(correctOption, option.value);
                                const isIncorrect =
                                    hasCheckedAnswer && isSelected && !isCorrect;

                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        className={`offline-game-layout-option ${
                                            isSelected ? "is-selected" : ""
                                        } ${isCorrect ? "is-correct" : ""} ${
                                            isIncorrect ? "is-incorrect" : ""
                                        }`}
                                        onClick={() =>
                                            onSelectOption?.(option.value, option)
                                        }
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
                    ) : null}

                    <div className="offline-game-layout-footer">
                        <div
                            className={`offline-game-layout-feedback is-${resolvedFeedbackTone} ${
                                feedback ? "has-text" : ""
                            }`}
                        >
                            {feedback || "Selecciona una opcion para continuar."}
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
