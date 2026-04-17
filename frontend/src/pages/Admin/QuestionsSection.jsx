import { useState } from "react";

const EMPTY_QUESTION_FORM = {
    pregunta: "",
    paisId: "",
    respuestas: [],
};

function createEmptyAnswer() {
    return {
        id: `new-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        texto: "",
        esCorrecta: false,
    };
}


function QuestionsSection({
                              countries,
                              questions,
                              loading,
                              error,
                              success,
                              onSave,
                              onDelete,
                              onClearMessages,
                          }) {
    const [form, setForm] = useState(EMPTY_QUESTION_FORM);
    const [editingId, setEditingId] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    function resetForm() {
        setForm(EMPTY_QUESTION_FORM);
        setEditingId(null);
    }

    function handleChange(event) {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    }

    function handleAddAnswer() {
        setForm((prev) => ({
            ...prev,
            respuestas: [...prev.respuestas, createEmptyAnswer()],
        }));
    }

    function handleAnswerChange(answerId, field, value) {
        setForm((prev) => ({
            ...prev,
            respuestas: prev.respuestas.map((answer) =>
                answer.id === answerId ? { ...answer, [field]: value } : answer
            ),
        }));
    }

    function handleCorrectAnswerChange(answerId) {
        setForm((prev) => ({
            ...prev,
            respuestas: prev.respuestas.map((answer) => ({
                ...answer,
                esCorrecta: answer.id === answerId,
            })),
        }));
    }

    function handleDeleteAnswer(answerId) {
        setForm((prev) => ({
            ...prev,
            respuestas: prev.respuestas.filter((answer) => answer.id !== answerId),
        }));
    }

    function handleEdit(question) {
        onClearMessages();
        setEditingId(question.id);
        setForm({
            pregunta: question.pregunta,
            paisId: question.paisId || "",
            respuestas:
                question.respuestas.length > 0
                    ? question.respuestas
                    : [createEmptyAnswer()],
        });
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setSubmitting(true);

        const saved = await onSave(
            {
                pregunta: form.pregunta.trim(),
                paisId: form.paisId || null,
                respuestas: form.respuestas.map((answer) => ({
                    id: String(answer.id).startsWith("new-") ? undefined : answer.id,
                    texto: answer.texto.trim(),
                    esCorrecta: answer.esCorrecta,
                })),
            },
            editingId
        );

        if (saved) {
            resetForm();
        }

        setSubmitting(false);
    }

    return (
        <section className="admin-section">
            <div className="admin-section-header">
                <div>
                    <h2>Preguntas y respuestas</h2>
                    <p>Gestiona preguntas, respuestas asociadas y respuesta correcta.</p>
                </div>
            </div>

            <div className="admin-grid">
                <article className="admin-panel">
                    <div className="admin-panel-header">
                        <h3>{editingId ? "Editar pregunta" : "Nueva pregunta"}</h3>
                        <p>Formulario.</p>
                    </div>

                    <form className="admin-form" onSubmit={handleSubmit}>
                        <label className="admin-field">
                            <span>Pregunta</span>
                            <textarea
                                name="pregunta"
                                rows="4"
                                value={form.pregunta}
                                onChange={handleChange}
                                required
                            />
                        </label>

                        <label className="admin-field">
                            <span>Pais asociado</span>
                            <select
                                name="paisId"
                                value={form.paisId}
                                onChange={handleChange}
                            >
                                <option value="">Sin asociar</option>
                                {countries.map((country) => (
                                    <option key={country.id} value={country.id}>
                                        {country.nombre}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div className="admin-subsection">
                            <div className="admin-subsection-header">
                                <div>
                                    <h4>Respuestas</h4>
                                </div>

                                <button
                                    type="button"
                                    className="admin-button admin-button-secondary"
                                    onClick={handleAddAnswer}
                                >
                                    Agregar respuesta
                                </button>
                            </div>

                            {form.respuestas.length === 0 ? (
                                <p className="admin-empty">Aun no agregaste respuestas.</p>
                            ) : (
                                <div className="admin-answer-list">
                                    {form.respuestas.map((answer, index) => (
                                        <div className="admin-answer-item" key={answer.id}>
                                            <label className="admin-field">
                                                <span>Respuesta {index + 1}</span>
                                                <input
                                                    type="text"
                                                    value={answer.texto}
                                                    onChange={(event) =>
                                                        handleAnswerChange(
                                                            answer.id,
                                                            "texto",
                                                            event.target.value
                                                        )
                                                    }
                                                    required
                                                />
                                            </label>

                                            <label className="admin-radio">
                                                <input
                                                    type="radio"
                                                    name="correct-answer"
                                                    checked={answer.esCorrecta}
                                                    onChange={() =>
                                                        handleCorrectAnswerChange(answer.id)
                                                    }
                                                />
                                                <span>Marcar como correcta</span>
                                            </label>

                                            <button
                                                type="button"
                                                className="admin-button admin-button-danger"
                                                onClick={() => handleDeleteAnswer(answer.id)}
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="admin-form-actions">
                            <button
                                type="submit"
                                className="admin-button admin-button-primary"
                                disabled={submitting}
                            >
                                {submitting
                                    ? "Guardando..."
                                    : editingId
                                        ? "Actualizar pregunta"
                                        : "Agregar pregunta"}
                            </button>

                            <button
                                type="button"
                                className="admin-button admin-button-secondary"
                                onClick={resetForm}
                            >
                                Limpiar
                            </button>
                        </div>
                    </form>

                    {error && <p className="admin-feedback admin-feedback-error">{error}</p>}
                    {success && (
                        <p className="admin-feedback admin-feedback-success">{success}</p>
                    )}
                </article>

                <article className="admin-panel">
                    <div className="admin-panel-header">
                        <h3>Listado</h3>
                        <p>Datos obtenidos.</p>
                    </div>

                    {loading ? (
                        <p className="admin-empty">Cargando preguntas...</p>
                    ) : questions.length === 0 ? (
                        <p className="admin-empty">No hay preguntas cargadas para mostrar.</p>
                    ) : (
                        <div className="admin-list">
                            {questions.map((question) => (
                                <article
                                    className="admin-list-card admin-question-card"
                                    key={question.id}
                                >
                                    <div className="admin-list-card-main">
                                        <h4>{question.pregunta || "Pregunta sin texto"}</h4>

                                        <p className="admin-question-country">
                                            Pais asociado:{" "}
                                            {countries.find(
                                                (country) =>
                                                    String(country.id) ===
                                                    String(question.paisId)
                                            )?.nombre || "No definido"}
                                        </p>

                                        <div className="admin-answers-preview">
                                            {question.respuestas.length === 0 ? (
                                                <span className="admin-inline-empty">
                                                    Sin respuestas asociadas
                                                </span>
                                            ) : (
                                                question.respuestas.map((answer) => (
                                                    <span
                                                        key={answer.id}
                                                        className={`admin-answer-chip ${
                                                            answer.esCorrecta ? "is-correct" : ""
                                                        }`}
                                                    >
                                                        {answer.texto || "Respuesta sin texto"}
                                                    </span>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="admin-list-card-actions">
                                        <button
                                            type="button"
                                            className="admin-button admin-button-secondary"
                                            onClick={() => handleEdit(question)}
                                        >
                                            Editar
                                        </button>

                                        <button
                                            type="button"
                                            className="admin-button admin-button-danger"
                                            onClick={() => onDelete(question.id)}
                                        >
                                            Eliminar
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </article>
            </div>
        </section>
    );
}

export default QuestionsSection;
