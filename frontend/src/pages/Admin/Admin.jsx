import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import logo from "../../assets/images/logo.png";

import "./Admin.css";
import CountriesSection from "./CountriesSection.jsx";
import QuestionsSection from "./QuestionsSection.jsx";
import UsersSection from "./UsersSection.jsx";
import {
    getCountries,
    createCountry,
    updateCountry,
    deleteCountry,
    getQuestions,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    getUsers,
    updateUserRole,
} from "../../services/AdminService.js";

const ADMIN_TABS = [
    { id: "countries", label: "Paises" },
    { id: "questions", label: "Preguntas y respuestas" },
    { id: "users", label: "Usuarios" },
];

function Admin() {
    const [activeTab, setActiveTab] = useState("countries");

    const [countries, setCountries] = useState([]);
    const [questions, setQuestions] = useState([]);
    const [users, setUsers] = useState([]);

    const [loading, setLoading] = useState({
        countries: false,
        questions: false,
        users: false,
    });

    const [error, setError] = useState({
        countries: "",
        questions: "",
        users: "",
    });

    const [success, setSuccess] = useState({
        countries: "",
        questions: "",
        users: "",
    });

    useEffect(() => {
        fetchCountries();
        fetchQuestions();
        fetchUsers();
    }, []);

    function clearSectionMessage(section) {
        setError((prev) => ({ ...prev, [section]: "" }));
        setSuccess((prev) => ({ ...prev, [section]: "" }));
    }

    async function fetchCountries() {
        setLoading((prev) => ({ ...prev, countries: true }));
        setError((prev) => ({ ...prev, countries: "" }));

        try {
            const data = await getCountries();
            setCountries(data);
        } catch (err) {
            setError((prev) => ({
                ...prev,
                countries: err.message || "No se pudieron cargar los paises.",
            }));
        } finally {
            setLoading((prev) => ({ ...prev, countries: false }));
        }
    }

    async function fetchQuestions() {
        setLoading((prev) => ({ ...prev, questions: true }));
        setError((prev) => ({ ...prev, questions: "" }));

        try {
            const data = await getQuestions();
            setQuestions(data);
        } catch (err) {
            setError((prev) => ({
                ...prev,
                questions: err.message || "No se pudieron cargar las preguntas.",
            }));
        } finally {
            setLoading((prev) => ({ ...prev, questions: false }));
        }
    }

    async function fetchUsers() {
        setLoading((prev) => ({ ...prev, users: true }));
        setError((prev) => ({ ...prev, users: "" }));

        try {
            const data = await getUsers();
            setUsers(data);
        } catch (err) {
            setError((prev) => ({
                ...prev,
                users: err.message || "No se pudieron cargar los usuarios.",
            }));
        } finally {
            setLoading((prev) => ({ ...prev, users: false }));
        }
    }

    async function handleSaveCountry(payload, editingId) {
        clearSectionMessage("countries");

        try {
            if (editingId) {
                await updateCountry(editingId, payload);
                setSuccess((prev) => ({
                    ...prev,
                    countries: "Pais actualizado correctamente.",
                }));
            } else {
                await createCountry(payload);
                setSuccess((prev) => ({
                    ...prev,
                    countries: "Pais creado correctamente.",
                }));
            }

            await fetchCountries();
            return true;
        } catch (err) {
            setError((prev) => ({
                ...prev,
                countries: err.message || "No se pudo guardar el pais.",
            }));
            return false;
        }
    }

    async function handleDeleteCountry(countryId) {
        clearSectionMessage("countries");

        try {
            await deleteCountry(countryId);
            setSuccess((prev) => ({
                ...prev,
                countries: "Pais eliminado correctamente.",
            }));
            await fetchCountries();
        } catch (err) {
            setError((prev) => ({
                ...prev,
                countries: err.message || "No se pudo eliminar el pais.",
            }));
        }
    }

    async function handleSaveQuestion(payload, editingId) {
        clearSectionMessage("questions");

        try {
            if (editingId) {
                await updateQuestion(editingId, payload);
                setSuccess((prev) => ({
                    ...prev,
                    questions: "Pregunta actualizada correctamente.",
                }));
            } else {
                await createQuestion(payload);
                setSuccess((prev) => ({
                    ...prev,
                    questions: "Pregunta creada correctamente.",
                }));
            }

            await fetchQuestions();
            return true;
        } catch (err) {
            setError((prev) => ({
                ...prev,
                questions: err.message || "No se pudo guardar la pregunta.",
            }));
            return false;
        }
    }

    async function handleDeleteQuestion(questionId) {
        clearSectionMessage("questions");

        try {
            await deleteQuestion(questionId);
            setSuccess((prev) => ({
                ...prev,
                questions: "Pregunta eliminada correctamente.",
            }));
            await fetchQuestions();
        } catch (err) {
            setError((prev) => ({
                ...prev,
                questions: err.message || "No se pudo eliminar la pregunta.",
            }));
        }
    }

    async function handleUpdateUserRole(userId, role) {
        clearSectionMessage("users");

        try {
            await updateUserRole(userId, role);
            setSuccess((prev) => ({
                ...prev,
                users: "Rol actualizado correctamente.",
            }));
            await fetchUsers();
            return true;
        } catch (err) {
            setError((prev) => ({
                ...prev,
                users: err.message || "No se pudo actualizar el rol del usuario.",
            }));
            return false;
        }
    }

    return (
        <div className="admin-page">
            <header className="admin-header">
                <div className="admin-header-left">
                    <Link to="/mainmenu" className="admin-back-button">
                        Volver
                    </Link>
                </div>

                <div className="admin-header-center">
                    <img src={logo} alt="Logo ORBYZ" className="admin-header-logo" />
                    <h1>Panel de administracion</h1>
                </div>
            </header>

            <section className="admin-hero">
                <div className="admin-hero-copy">
                    <span className="admin-eyebrow">Gestion interna</span>
                    <h2>Herramientas de control</h2>
                    <p>
                        Administra paises, preguntas y usuarios desde una unica
                        interfaz.
                    </p>
                </div>

                <div className="admin-hero-stats">
                    <article className="admin-stat-card">
                        <span className="admin-stat-label">Paises</span>
                        <strong>{countries.length}</strong>
                    </article>
                    <article className="admin-stat-card">
                        <span className="admin-stat-label">Preguntas</span>
                        <strong>{questions.length}</strong>
                    </article>
                    <article className="admin-stat-card">
                        <span className="admin-stat-label">Usuarios</span>
                        <strong>{users.length}</strong>
                    </article>
                </div>
            </section>

            <nav className="admin-tabs" aria-label="Secciones del panel">
                {ADMIN_TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        className={`admin-tab ${activeTab === tab.id ? "is-active" : ""}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>

            <main className="admin-content">
                {activeTab === "countries" && (
                    <CountriesSection
                        countries={countries}
                        loading={loading.countries}
                        error={error.countries}
                        success={success.countries}
                        onSave={handleSaveCountry}
                        onDelete={handleDeleteCountry}
                        onClearMessages={() => clearSectionMessage("countries")}
                    />
                )}

                {activeTab === "questions" && (
                    <QuestionsSection
                        countries={countries}
                        questions={questions}
                        loading={loading.questions}
                        error={error.questions}
                        success={success.questions}
                        onSave={handleSaveQuestion}
                        onDelete={handleDeleteQuestion}
                        onClearMessages={() => clearSectionMessage("questions")}
                    />
                )}

                {activeTab === "users" && (
                    <UsersSection
                        users={users}
                        loading={loading.users}
                        error={error.users}
                        success={success.users}
                        onUpdateRole={handleUpdateUserRole}
                        onClearMessages={() => clearSectionMessage("users")}
                    />
                )}
            </main>
        </div>
    );
}

export default Admin;
