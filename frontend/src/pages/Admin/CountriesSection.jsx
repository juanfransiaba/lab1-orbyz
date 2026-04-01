import { useState } from "react";

const EMPTY_COUNTRY_FORM = {
    nombre: "",
    capital: "",
    continente: "",
    imagen_pais: "",
    imagen_silueta: "",
};

function CountriesSection({
                              countries,
                              loading,
                              error,
                              success,
                              onSave,
                              onDelete,
                              onClearMessages,
                          }) {
    const [form, setForm] = useState(EMPTY_COUNTRY_FORM);
    const [editingId, setEditingId] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    function resetForm() {
        setForm(EMPTY_COUNTRY_FORM);
        setEditingId(null);
    }

    function handleChange(event) {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    }

    function handleEdit(country) {
        onClearMessages();
        setEditingId(country.id);
        setForm({
            nombre: country.nombre,
            capital: country.capital,
            continente: country.continente,
            imagen_pais: country.imagen_pais,
            imagen_silueta: country.imagen_silueta,
        });
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setSubmitting(true);

        const saved = await onSave(
            {
                nombre: form.nombre.trim(),
                capital: form.capital.trim(),
                continente: form.continente.trim(),
                imagen_pais: form.imagen_pais.trim(),
                imagen_silueta: form.imagen_silueta.trim(),
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
                    <h2>Paises</h2>
                    <p>Crea, edita y elimina registros de paises.</p>
                </div>
            </div>

            <div className="admin-grid">
                <article className="admin-panel">
                    <div className="admin-panel-header">
                        <h3>{editingId ? "Editar pais" : "Nuevo pais"}</h3>
                        <p>Formulario conectado a `/api/paises`.</p>
                    </div>

                    <form className="admin-form" onSubmit={handleSubmit}>
                        <label className="admin-field">
                            <span>Nombre</span>
                            <input
                                type="text"
                                name="nombre"
                                value={form.nombre}
                                onChange={handleChange}
                                required
                            />
                        </label>

                        <label className="admin-field">
                            <span>Capital</span>
                            <input
                                type="text"
                                name="capital"
                                value={form.capital}
                                onChange={handleChange}
                                required
                            />
                        </label>

                        <label className="admin-field">
                            <span>Continente</span>
                            <input
                                type="text"
                                name="continente"
                                value={form.continente}
                                onChange={handleChange}
                                required
                            />
                        </label>

                        <label className="admin-field">
                            <span>Imagen del pais</span>
                            <input
                                type="url"
                                name="imagen_pais"
                                value={form.imagen_pais}
                                onChange={handleChange}
                            />
                        </label>

                        <label className="admin-field">
                            <span>Imagen silueta</span>
                            <input
                                type="url"
                                name="imagen_silueta"
                                value={form.imagen_silueta}
                                onChange={handleChange}
                            />
                        </label>

                        <div className="admin-form-actions">
                            <button
                                type="submit"
                                className="admin-button admin-button-primary"
                                disabled={submitting}
                            >
                                {submitting
                                    ? "Guardando..."
                                    : editingId
                                        ? "Actualizar pais"
                                        : "Agregar pais"}
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
                        <p className="admin-empty">Cargando paises...</p>
                    ) : countries.length === 0 ? (
                        <p className="admin-empty">No hay paises cargados para mostrar.</p>
                    ) : (
                        <div className="admin-list">
                            {countries.map((country) => (
                                <article className="admin-list-card" key={country.id}>
                                    <div className="admin-list-card-main">
                                        <h4>{country.nombre || "Pais sin nombre"}</h4>
                                        <dl className="admin-meta">
                                            <div>
                                                <dt>Capital</dt>
                                                <dd>{country.capital || "-"}</dd>
                                            </div>
                                            <div>
                                                <dt>Continente</dt>
                                                <dd>{country.continente || "-"}</dd>
                                            </div>
                                        </dl>
                                    </div>

                                    <div className="admin-list-card-actions">
                                        <button
                                            type="button"
                                            className="admin-button admin-button-secondary"
                                            onClick={() => handleEdit(country)}
                                        >
                                            Editar
                                        </button>

                                        <button
                                            type="button"
                                            className="admin-button admin-button-danger"
                                            onClick={() => onDelete(country.id)}
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

export default CountriesSection;
