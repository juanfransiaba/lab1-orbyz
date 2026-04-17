import { useMemo, useState } from "react";

const EMPTY_COUNTRY_FORM = {
    nombre: "",
    capital: "",
    continente: "",
    imagen_pais: "",
    imagen_silueta: "",
};

const INITIAL_VISIBLE_COUNTRIES = 5;


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
    const [searchTerm, setSearchTerm] = useState("");
    const [showAll, setShowAll] = useState(false);

    const filteredCountries = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();

        if (!normalizedSearch) {
            return countries;
        }

        return countries.filter((country) => {
            const searchableValues = [
                country.nombre,
                country.capital,
                country.continente,
            ];

            return searchableValues.some((value) =>
                String(value || "").toLowerCase().includes(normalizedSearch)
            );
        });
    }, [countries, searchTerm]);

    const visibleCountries = showAll
        ? filteredCountries
        : filteredCountries.slice(0, INITIAL_VISIBLE_COUNTRIES);

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

    function handleReset() {
        onClearMessages();
        resetForm();
    }

    function handleSearchChange(event) {
        setSearchTerm(event.target.value);
        setShowAll(false);
    }

    return (
        <section className="admin-section">
            <div className="admin-section-header">
                <div>
                    <h2>Paises</h2>
                    <p>Administra el catalogo de paises disponible en la plataforma.</p>
                </div>
            </div>

            <div className="admin-grid admin-grid-align-start">
                <article className="admin-panel">
                    <div className="admin-panel-header">
                        <h3>{editingId ? "Editar pais" : "Nuevo pais"}</h3>
                        <p>
                            {editingId
                                ? "Actualiza la informacion del registro seleccionado."
                                : "Carga un nuevo pais para dejarlo disponible en el sistema."}
                        </p>
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
                                        ? "Guardar cambios"
                                        : "Crear pais"}
                            </button>

                            <button
                                type="button"
                                className="admin-button admin-button-secondary"
                                onClick={handleReset}
                            >
                                {editingId ? "Cancelar" : "Limpiar"}
                            </button>
                        </div>
                    </form>

                    {error && <p className="admin-feedback admin-feedback-error">{error}</p>}
                    {success && (
                        <p className="admin-feedback admin-feedback-success">{success}</p>
                    )}
                </article>

                <article className="admin-panel">
                    <div className="admin-panel-header admin-panel-header-inline">
                        <div>
                            <h3>Listado de paises</h3>
                            <p>
                                {loading
                                    ? "Cargando registros..."
                                    : `${filteredCountries.length} resultado${filteredCountries.length === 1 ? "" : "s"}${searchTerm.trim() ? ` de ${countries.length}` : ""}.`}
                            </p>
                        </div>

                        <label className="admin-search-field">
                            <span>Buscar pais</span>
                            <input
                                type="search"
                                value={searchTerm}
                                onChange={handleSearchChange}
                                placeholder="Buscar por nombre, capital o continente"
                            />
                        </label>
                    </div>

                    {loading ? (
                        <p className="admin-empty">Cargando paises...</p>
                    ) : filteredCountries.length === 0 ? (
                        <p className="admin-empty">
                            No se encontraron paises para esa busqueda.
                        </p>
                    ) : (
                        <>
                            <div className="admin-list">
                                {visibleCountries.map((country) => (
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

                            {filteredCountries.length > INITIAL_VISIBLE_COUNTRIES && (
                                <div className="admin-list-footer">
                                    <button
                                        type="button"
                                        className="admin-button admin-button-secondary"
                                        onClick={() => setShowAll((prev) => !prev)}
                                    >
                                        {showAll ? "Mostrar menos" : "Ver listado completo"}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </article>
            </div>
        </section>
    );
}

export default CountriesSection;
