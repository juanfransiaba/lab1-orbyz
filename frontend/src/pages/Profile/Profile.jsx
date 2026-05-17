import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import "./Profile.css";

function Profile() {
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [editingFields, setEditingFields] = useState({
        username: false,
        email: false,
        password: false,
    });

    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const isEditing = useMemo(
        () => Object.values(editingFields).some(Boolean),
        [editingFields]
    );

    const handleLogout = () => {
        localStorage.removeItem("token");
        navigate("/login");
    };

    const handleDeleteAccount = async () => {
        const confirmed = window.confirm(
            "¿Estás seguro de que querés eliminar tu cuenta? Esta acción no se puede deshacer."
        );

        if (!confirmed) {
            return;
        }

        const token = localStorage.getItem("token");

        if (!token) {
            navigate("/login");
            return;
        }

        setDeleting(true);
        setMessage("");
        setError("");

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/user/profile`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                setError("No se pudo eliminar la cuenta");
                return;
            }

            localStorage.removeItem("token");
            navigate("/login");
        } catch (error) {
            setError("No se pudo eliminar la cuenta");
        } finally {
            setDeleting(false);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem("token");

        if (!token) {
            navigate("/login");
            return;
        }

        const fetchProfile = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/user/profile`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                const data = await response.json();

                if (!response.ok) {
                    localStorage.removeItem("token");
                    navigate("/login");
                    return;
                }

                setUser(data);
                setUsername(data.username || "");
                setEmail(data.email || "");
            } catch (error) {
                navigate("/login");
            } finally {
                setLoading(false);
            }
        };

        void fetchProfile();
    }, [navigate]);

    const handleEditField = (field) => {
        setMessage("");
        setError("");

        if (field === "username") {
            setUsername(user?.username || "");
        }

        if (field === "email") {
            setEmail(user?.email || "");
        }

        if (field === "password") {
            setPassword("");
        }

        setEditingFields((prev) => ({
            ...prev,
            [field]: true,
        }));
    };

    const handleCancelEdit = () => {
        setUsername(user?.username || "");
        setEmail(user?.email || "");
        setPassword("");
        setEditingFields({
            username: false,
            email: false,
            password: false,
        });
        setError("");
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();

        const token = localStorage.getItem("token");

        if (!token) {
            navigate("/login");
            return;
        }

        setSaving(true);
        setMessage("");
        setError("");

        try {
            const body = {
                username,
                email,
            };

            if (editingFields.password && password.trim()) {
                body.password = password;
            }

            const response = await fetch(`${import.meta.env.VITE_API_URL}/user/profile`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message || "No se pudo actualizar el perfil");
                return;
            }

            const updatedUser = data.user || data;

            setUser(updatedUser);
            setUsername(updatedUser.username || "");
            setEmail(updatedUser.email || "");
            setPassword("");
            setEditingFields({
                username: false,
                email: false,
                password: false,
            });
            setMessage("Perfil actualizado correctamente");
        } catch (error) {
            setError("Ocurrió un error al actualizar el perfil");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="profile-page">
                <div className="profile-loading">Cargando perfil...</div>
            </div>
        );
    }

    return (
        <div className="profile-page">
            <header className="profile-header">
                <div className="profile-header-glow" />

                <div className="profile-header-actions">
                    <Link to="/mainmenu" className="profile-back-button">
                        Volver
                    </Link>
                </div>

                <div className="profile-title-wrap">
                    <span className="profile-title-kicker">Geography Game System</span>
                    <h1 className="profile-title">Perfil</h1>
                </div>

                <div className="profile-header-tools">
                    {user?.roles === "admin" && (
                        <Link to="/admin" className="profile-manage-button">
                            Gestionar
                        </Link>
                    )}
                </div>
            </header>

            <main className="profile-main">
                <section className="profile-top-section">
                    <div className="profile-card profile-user-card">
                        <div className="profile-user-top">
                            <div className="profile-avatar">
                                <span>
                                    {user?.username ? user.username.charAt(0).toUpperCase() : "U"}
                                </span>
                            </div>

                            <div className="profile-user-info">
                                <p className="profile-label">Jugador</p>
                                <h2>{user?.username || "Usuario"}</h2>
                                <p className="profile-subtitle">
                                    Administrá tu cuenta, tus datos y tu progreso.
                                </p>
                            </div>
                        </div>

                        <form className="profile-fields" onSubmit={handleUpdateProfile}>
                            <div className="profile-field">
                                <div className="profile-field-header">
                                    <label htmlFor="username">Nombre de usuario</label>
                                    {!editingFields.username && (
                                        <button
                                            type="button"
                                            className="profile-edit-button"
                                            onClick={() => handleEditField("username")}
                                        >
                                            Editar
                                        </button>
                                    )}
                                </div>

                                {editingFields.username ? (
                                    <input
                                        id="username"
                                        className="profile-field-box"
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                    />
                                ) : (
                                    <div className="profile-field-value">{user?.username || "-"}</div>
                                )}
                            </div>

                            <div className="profile-field">
                                <div className="profile-field-header">
                                    <label htmlFor="email">Correo electrónico</label>
                                    {!editingFields.email && (
                                        <button
                                            type="button"
                                            className="profile-edit-button"
                                            onClick={() => handleEditField("email")}
                                        >
                                            Editar
                                        </button>
                                    )}
                                </div>

                                {editingFields.email ? (
                                    <input
                                        id="email"
                                        className="profile-field-box"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                ) : (
                                    <div className="profile-field-value">{user?.email || "-"}</div>
                                )}
                            </div>

                            <div className="profile-field">
                                <div className="profile-field-header">
                                    <label htmlFor="password">Contraseña</label>
                                    {!editingFields.password && (
                                        <button
                                            type="button"
                                            className="profile-edit-button"
                                            onClick={() => handleEditField("password")}
                                        >
                                            Editar
                                        </button>
                                    )}
                                </div>

                                {editingFields.password ? (
                                    <input
                                        id="password"
                                        className="profile-field-box"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Ingresar nueva contraseña"
                                    />
                                ) : (
                                    <div className="profile-field-value">********</div>
                                )}
                            </div>

                            {message && <p className="profile-success-message">{message}</p>}
                            {error && <p className="profile-error-message">{error}</p>}

                            {isEditing && (
                                <div className="profile-actions-row">
                                    <button
                                        type="submit"
                                        className="profile-save-button"
                                        disabled={saving}
                                    >
                                        {saving ? "Guardando..." : "Guardar cambios"}
                                    </button>

                                    <button
                                        type="button"
                                        className="profile-cancel-button"
                                        onClick={handleCancelEdit}
                                        disabled={saving}
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            )}
                        </form>
                    </div>

                    <aside className="profile-card profile-side-card">
                        <h3>Accesos rápidos</h3>

                        <div className="profile-side-actions">
                            <Link to="/friends" className="profile-side-button">
                                Ver mis amigos
                            </Link>

                            <Link to="/history" className="profile-side-button">
                                Ver historial completo
                            </Link>

                            <button
                                type="button"
                                className="profile-side-button profile-delete-button"
                                onClick={handleDeleteAccount}
                                disabled={deleting}
                            >
                                {deleting ? "Eliminando..." : "Eliminar cuenta"}
                            </button>
                        </div>

                        <button className="profile-logout-button" onClick={handleLogout}>
                            Cerrar sesión
                        </button>
                    </aside>
                </section>

                <section className="profile-card profile-history-card">
                    <div className="profile-history-header">
                        <div>
                            <p className="profile-label">Actividad</p>
                            <h3>Historial reciente</h3>
                        </div>

                        <Link to="/history" className="profile-history-link">
                            Ver todo
                        </Link>
                    </div>

                    <div className="profile-history-empty">
                        Todavía no hay partidas registradas.
                    </div>
                </section>
            </main>
        </div>
    );
}

export default Profile;
