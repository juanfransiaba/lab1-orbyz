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
    const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
    const [equippingAvatarId, setEquippingAvatarId] = useState("");
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const isEditing = useMemo(
        () => Object.values(editingFields).some(Boolean),
        [editingFields]
    );
    const ownedAvatars = Array.isArray(user?.ownedAvatars) ? user.ownedAvatars : [];
    const equippedAvatarId = user?.avatar?.id || user?.profile_avatar_id || "";

    const handleLogout = () => {
        localStorage.removeItem("token");
        navigate("/login");
    };

    const handleDeleteAccount = () => {
        setShowDeleteConfirm(true);
    };

    const confirmDeleteAccount = async () => {
        const token = localStorage.getItem("token");

        if (!token) {
            navigate("/login");
            return;
        }

        setShowDeleteConfirm(false);
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
        } catch {
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
            } catch {
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
        } catch {
            setError("Ocurrió un error al actualizar el perfil");
        } finally {
            setSaving(false);
        }
    };

    const handleOpenAvatarPicker = () => {
        setMessage("");
        setError("");
        setAvatarPickerOpen(true);
    };

    const handleEquipAvatar = async (avatarId) => {
        const token = localStorage.getItem("token");

        if (!token) {
            navigate("/login");
            return;
        }

        setEquippingAvatarId(avatarId);
        setMessage("");
        setError("");

        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/user/profile/avatar`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ avatarId }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setError(data.message || "No se pudo actualizar el avatar");
                return;
            }

            setUser(data.user || data);
            setAvatarPickerOpen(false);
            setMessage("Avatar actualizado correctamente");
        } catch {
            setError("No se pudo actualizar el avatar");
        } finally {
            setEquippingAvatarId("");
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
                            <button
                                type="button"
                                className="profile-avatar"
                                onClick={handleOpenAvatarPicker}
                                aria-label="Elegir avatar de perfil"
                            >
                                {user?.avatar?.imageSrc ? (
                                    <img
                                        src={user.avatar.imageSrc}
                                        alt={user.avatar.name || "Avatar"}
                                        className="profile-avatar-image"
                                    />
                                ) : (
                                    <span>
                                        {user?.avatar?.icon ||
                                            (user?.username
                                            ? user.username.charAt(0).toUpperCase()
                                            : "U")}
                                    </span>
                                )}
                                <span className="profile-avatar-edit">Cambiar</span>
                            </button>

                            <div className="profile-user-info">
                                <p className="profile-label">Jugador</p>
                                <h2>{user?.username || "Usuario"}</h2>
                                <p className="profile-subtitle">
                                    Administrá tu cuenta, tus datos y tu progreso.
                                </p>
                            </div>
                        </div>

                        <nav
                            className="profile-navigation-actions"
                            aria-label="Accesos del perfil"
                        >
                            <Link to="/friends" className="profile-navigation-button">
                                Ver mis amigos
                            </Link>

                            <Link
                                to="/history"
                                className="profile-navigation-button is-primary"
                            >
                                Ver historial completo
                            </Link>
                        </nav>

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

                        <div className="profile-account-actions">
                            <button
                                type="button"
                                className="profile-logout-button"
                                onClick={handleLogout}
                            >
                                Cerrar sesión
                            </button>

                            <button
                                type="button"
                                className="profile-delete-button"
                                onClick={handleDeleteAccount}
                                disabled={deleting}
                            >
                                {deleting ? "Eliminando..." : "Eliminar cuenta"}
                            </button>
                        </div>
                    </div>

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

            {avatarPickerOpen && (
                <div
                    className="profile-avatar-modal-backdrop"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setAvatarPickerOpen(false);
                        }
                    }}
                >
                    <section
                        className="profile-avatar-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="profile-avatar-title"
                    >
                        <div className="profile-avatar-modal-header">
                            <div>
                                <span className="profile-confirm-kicker">Perfil</span>
                                <h2 id="profile-avatar-title">Elegir avatar</h2>
                            </div>

                            <button
                                type="button"
                                className="profile-avatar-modal-close"
                                onClick={() => setAvatarPickerOpen(false)}
                                aria-label="Cerrar"
                            >
                                x
                            </button>
                        </div>

                        {ownedAvatars.length > 0 ? (
                            <div className="profile-avatar-grid">
                                {ownedAvatars.map((avatar) => {
                                    const isEquipped = avatar.id === equippedAvatarId;
                                    const isSaving = equippingAvatarId === avatar.id;

                                    return (
                                        <button
                                            type="button"
                                            className={`profile-avatar-option${
                                                isEquipped ? " is-equipped" : ""
                                            }`}
                                            key={avatar.id}
                                            onClick={() => handleEquipAvatar(avatar.id)}
                                            disabled={Boolean(equippingAvatarId) || isEquipped}
                                        >
                                            <span className="profile-avatar-option-image">
                                                {avatar.imageSrc ? (
                                                    <img src={avatar.imageSrc} alt="" />
                                                ) : (
                                                    <span>
                                                        {avatar.icon ||
                                                            avatar.name
                                                                .split(" ")
                                                                .map((word) => word.charAt(0))
                                                                .join("")
                                                                .slice(0, 2)
                                                                .toUpperCase()}
                                                    </span>
                                                )}
                                            </span>
                                            <strong>{avatar.name}</strong>
                                            <small>
                                                {isEquipped
                                                    ? "Equipado"
                                                    : isSaving
                                                      ? "Guardando..."
                                                      : "Usar"}
                                            </small>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="profile-avatar-empty">
                                Todavia no tenes avatares comprados.
                            </div>
                        )}
                    </section>
                </div>
            )}

            {showDeleteConfirm && (
                <div
                    className="profile-confirm-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="profile-delete-title"
                >
                    <div className="profile-confirm-modal">
                        <span className="profile-confirm-kicker">Cuenta</span>
                        <h2 id="profile-delete-title">Eliminar cuenta</h2>
                        <p>
                            ¿Estás seguro de que querés eliminar tu cuenta? Esta acción
                            no se puede deshacer.
                        </p>

                        <div className="profile-confirm-actions">
                            <button
                                type="button"
                                className="profile-confirm-secondary"
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={deleting}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="profile-confirm-danger"
                                onClick={confirmDeleteAccount}
                                disabled={deleting}
                            >
                                {deleting ? "Eliminando..." : "Eliminar cuenta"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Profile;
