import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import "./Admin.css";
import CountriesSection from "./CountriesSection.jsx";
import UsersSection from "./UsersSection.jsx";
import {
    getCountries,
    createCountry,
    updateCountry,
    deleteCountry,
    getUsers,
    updateUserRole,
} from "../../services/AdminService.js";

const ADMIN_TABS = [
    { id: "countries", label: "Paises" },
    { id: "users", label: "Usuarios" },
];

function Admin() {
    const [activeTab, setActiveTab] = useState("countries");

    const [countries, setCountries] = useState([]);
    const [users, setUsers] = useState([]);

    const [loading, setLoading] = useState({
        countries: false,
        users: false,
    });

    const [error, setError] = useState({
        countries: "",
        users: "",
    });

    const [success, setSuccess] = useState({
        countries: "",
        users: "",
    });

    useEffect(() => {
        fetchCountries();
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
                <div className="admin-header-glow" />

                <div className="admin-header-actions">
                    <Link to="/mainmenu" className="admin-back-button">
                        Volver
                    </Link>
                </div>

                <div className="admin-title-wrap">
                    <span className="admin-title-kicker">Geography Game System</span>
                    <h1 className="admin-title">Administracion</h1>
                </div>

                <div className="admin-header-spacer" />
            </header>

            <section className="admin-hero">
                <div className="admin-hero-copy">
                    <span className="admin-eyebrow">Administracion interna</span>
                    <h2>Control operativo</h2>
                    <p>
                        Gestiona paises y usuarios desde un panel mas claro, mas
                        ordenado y enfocado en tareas reales de administracion.
                    </p>
                </div>

                <div className="admin-hero-stats">
                    <article className="admin-stat-card">
                        <span className="admin-stat-label">Paises</span>
                        <strong>{countries.length}</strong>
                        <span className="admin-stat-note">Registros disponibles</span>
                    </article>

                    <article className="admin-stat-card">
                        <span className="admin-stat-label">Usuarios</span>
                        <strong>{users.length}</strong>
                        <span className="admin-stat-note">Cuentas registradas</span>
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
